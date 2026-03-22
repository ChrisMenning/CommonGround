/**
 * t1-e01.js — T1: Severe Weather + High Vulnerability
 *
 * Claim type: MECHANISM
 * Severity:   T1 (1) — Immediate Action
 *
 * Trigger: Active NWS Severe or Extreme weather alert covering Brown County, WI
 *          when ≥1 census tract has CDC SVI score above 0.75.
 *
 * Research basis: High-SVI populations face greater harm from the same weather
 * event due to housing quality, reduced transportation access, and limited
 * economic capacity to respond. The mechanism is documented; this is not a
 * coincidence claim.
 *
 * Sources: NWS (api.weather.gov) · CDC SVI 2022 (archived via PEDP/OEDP)
 *
 * Trust note: CDC SVI is rated 3/5 for current-conditions use (federal site
 * removed in 2025; data archived via PEDP). NWS API remains fully operational.
 */
'use strict';
const https = require('https');
const logger = require('../lib/logger');

// UGC codes for Brown County, WI (county and forecast zone)
// WIC009 = Brown County (county-level alerts: tornado, winter storm, etc.)
// WIZ040 = Northern Brown County forecast zone
// WIZ041 = Southern Brown County forecast zone
const BROWN_COUNTY_UGC = ['WIC009', 'WIZ040', 'WIZ041'];

const NWS_USER_AGENT = process.env.NWS_USER_AGENT || 'CommonGround/1.0 (contact@example.org)';

function fetchNwsAlerts() {
  return new Promise((resolve, reject) => {
    const req = https.get('https://api.weather.gov/alerts/active?area=WI', {
      headers: {
        'User-Agent': NWS_USER_AGENT,
        'Accept': 'application/geo+json',
      },
      timeout: 10000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`NWS returned HTTP ${res.statusCode}`));
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Failed to parse NWS alert JSON')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('NWS request timed out')); });
  });
}

module.exports = {
  alertType: 'T1-E01',
  claimType: 'MECHANISM',
  severity: 1,

  async evaluate(db) {
    // ── Step 1: Fetch active NWS alerts for Wisconsin ──────────────────────
    let nwsData;
    try {
      nwsData = await fetchNwsAlerts();
    } catch (err) {
      logger.warn(`[T1-E01] NWS API unavailable: ${err.message} — degrading gracefully`);
      return [];
    }

    const nwsFeatures = nwsData.features || [];

    // ── Step 2: Filter to Severe/Extreme alerts affecting Brown County ─────
    const qualifying = nwsFeatures.filter(f => {
      const p = f.properties;
      if (p.status !== 'Actual') return false;
      if (!['Extreme', 'Severe'].includes(p.severity)) return false;
      if (!['Immediate', 'Expected'].includes(p.urgency)) return false;
      const zones = (p.affectedZones || []).map(z => z.split('/').pop());
      return zones.some(z => BROWN_COUNTY_UGC.includes(z));
    });

    if (qualifying.length === 0) return [];

    // ── Step 3: Check for Brown County SVI tracts above threshold ─────────
    const sviRes = await db.query(`
      SELECT
        COUNT(*)::int AS tract_count,
        ROUND(AVG((f.properties->>'svi_overall')::float)::numeric, 3) AS avg_svi,
        ROUND(MAX((f.properties->>'svi_overall')::float)::numeric, 3) AS max_svi
      FROM features f
      JOIN layers l ON l.id = f.layer_id
      WHERE l.slug = 'svi'
        AND (f.properties->>'svi_overall')::float > 0.75
    `);

    const tractCount = parseInt(sviRes.rows[0]?.tract_count || 0, 10);
    if (tractCount === 0) return [];

    const avgSvi = parseFloat(sviRes.rows[0].avg_svi);
    const maxSvi = parseFloat(sviRes.rows[0].max_svi);

    // ── Step 4: Get union geometry of high-SVI tracts for map overlay ─────
    const unionRes = await db.query(`
      SELECT ST_AsGeoJSON(ST_Union(f.geom)) AS union_geom
      FROM features f
      JOIN layers l ON l.id = f.layer_id
      WHERE l.slug = 'svi'
        AND (f.properties->>'svi_overall')::float > 0.75
    `);
    const affectedGeomGeojson = unionRes.rows[0]?.union_geom || null;

    // ── Step 5: Create one alert per qualifying NWS event ─────────────────
    const alerts = [];

    for (const nwsFeature of qualifying) {
      const p = nwsFeature.properties;
      // Use the tail of the NWS alert URN as a stable key for this event
      const rawId = (p.id || nwsFeature.id || '').replace(/\s/g, '');
      const eventKey = rawId.split('/').pop().replace(/[^a-zA-Z0-9:._-]/g, '').slice(-60);
      const dedupeKey = `T1-E01:${eventKey}`;

      const expiresNws = p.expires ? new Date(p.expires) : null;
      // Expire 1 hour after the NWS alert expires, or 12h from now if unknown
      const expiresInHours = expiresNws
        ? Math.max(1, Math.ceil((expiresNws - Date.now()) / 3600000) + 1)
        : 12;

      alerts.push({
        title: `Severe Weather + High Vulnerability: ${p.event || 'Weather Alert'}`,
        description:
          `${p.event || 'A severe weather event'} is active or forecast for Brown County. ` +
          `${tractCount} census tract${tractCount !== 1 ? 's' : ''} with high social vulnerability ` +
          `(SVI > 0.75, avg ${(avgSvi * 100).toFixed(0)}th percentile) are within the affected area. ` +
          `Research consistently shows that high-SVI populations face greater harm from the same ` +
          `weather event due to housing quality, limited transportation, and reduced economic capacity ` +
          `to respond. This is an elevated risk with a known causal pathway — not a marginal concern.`,
        recommendation:
          `Alert mutual aid networks serving the affected tracts immediately. Surface the nearest ` +
          `warming/cooling centers and emergency shelters using the community resource layer. ` +
          `Share the NWS alert text directly: "${p.headline || p.event}". ` +
          `Prioritize outreach to mobile home residents and households without vehicles — ` +
          `these are tracked in the SVI housing and transportation indicators.`,
        caution:
          `SVI scores predict vulnerability at the aggregate (tract) level. Individual households ` +
          `within high-SVI tracts vary widely. This alert is a targeting tool for mutual aid ` +
          `resource deployment, not a prediction about specific households. ` +
          `CDC SVI data is from 2022 and was archived following federal data program cuts in 2025; ` +
          `trust rating is 3/5 for current-conditions use.`,
        sources: ['NWS (api.weather.gov)', 'CDC SVI 2022 (archived via PEDP/OEDP)'],
        trigger_conditions: {
          dedupe_key: dedupeKey,
          nws_event_id: rawId.slice(-120),
          nws_event_type: p.event,
          nws_severity: p.severity,
          nws_urgency: p.urgency,
          nws_headline: p.headline,
          nws_expires: p.expires,
          affected_zones: (p.affectedZones || []).map(z => z.split('/').pop()),
          svi_tracts_above_threshold: tractCount,
          svi_threshold: 0.75,
          avg_svi_score: avgSvi,
          max_svi_score: maxSvi,
        },
        affected_geom_geojson: affectedGeomGeojson,
        expires_in_hours: expiresInHours,
      });
    }

    return alerts;
  },
};
