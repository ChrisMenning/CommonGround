'use strict';
const express = require('express');
const router = express.Router();
const https = require('https');

const NWS_BASE = 'https://api.weather.gov';
// NWS requires a User-Agent header identifying the application
const USER_AGENT = process.env.NWS_USER_AGENT || 'CommonGround/1.0 (contact@example.org)';

/**
 * Fetch JSON from a URL, returning parsed body.
 * Uses Node built-in https — no external HTTP client dependency.
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/geo+json, application/json',
      },
      timeout: 8000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`NWS returned ${res.statusCode} for ${url}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Failed to parse NWS JSON response'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('NWS request timed out')); });
  });
}

function validateCoord(val, min, max, name) {
  const n = parseFloat(val);
  if (isNaN(n) || n < min || n > max) {
    throw Object.assign(new Error(`Invalid ${name}`), { status: 400 });
  }
  return n;
}

// GET /weather?lat=X&lon=Y
router.get('/', async (req, res, next) => {
  let lat, lon;
  try {
    lat = validateCoord(req.query.lat, -90,  90,  'lat');
    lon = validateCoord(req.query.lon, -180, 180, 'lon');
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Round to 4 decimal places — sufficient for weather grid selection, avoids precision leakage
  const latR = Math.round(lat * 10000) / 10000;
  const lonR = Math.round(lon * 10000) / 10000;

  try {
    // Step 1: resolve grid point
    const pointData = await fetchJson(`${NWS_BASE}/points/${latR},${lonR}`);
    const props = pointData.properties;

    // Step 2: fetch forecast and alerts in parallel
    const [forecast, hourly, alertsData] = await Promise.all([
      fetchJson(props.forecast),
      fetchJson(props.forecastHourly),
      fetchJson(`${NWS_BASE}/alerts/active?point=${latR},${lonR}`),
    ]);

    // Return curated response — no raw NWS internals exposed
    res.json({
      location: {
        gridId: props.gridId,
        gridX: props.gridX,
        gridY: props.gridY,
        timezone: props.timeZone,
        radarStation: props.radarStation,
        forecast_zone: props.forecastZone,
      },
      forecast: forecast.properties?.periods?.slice(0, 14) || [],
      forecast_hourly: hourly.properties?.periods?.slice(0, 24) || [],
      alerts: (alertsData.features || []).map(f => ({
        id: f.id,
        event: f.properties.event,
        severity: f.properties.severity,
        urgency: f.properties.urgency,
        certainty: f.properties.certainty,
        headline: f.properties.headline,
        description: f.properties.description,
        instruction: f.properties.instruction,
        effective: f.properties.effective,
        expires: f.properties.expires,
      })),
      retrieved_at: new Date().toISOString(),
    });
  } catch (err) {
    // NWS errors should not crash the server
    if (err.status === 400) return next(err);
    console.error('[weather] NWS fetch error:', err.message);
    res.status(502).json({ error: 'Unable to retrieve weather data from NWS. Try again shortly.' });
  }
});

module.exports = router;
