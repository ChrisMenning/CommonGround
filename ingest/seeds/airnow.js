/**
 * airnow.js — EPA AirNow hourly AQI data for Brown County area
 *
 * Fetches current AQI observations near Green Bay, WI from the AirNow API.
 * Designed to be run on a cron schedule (hourly).
 *
 * API KEY REQUIRED:
 *   Register free at: https://docs.airnowapi.org/account/request/
 *   Set AIRNOW_API_KEY in api/.env
 *
 * DATA SOURCE: https://www.airnowapi.org/
 */
'use strict';
const db = require('../lib/db');
const logger = require('../lib/logger');
const { fetchJson, insertFeatures } = require('../lib/utils');
const { getSourceConfig } = require('../lib/source-config');

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', 'api', '.env') });

// API key resolution order (handled by getSourceConfig):
//   1. AIRNOW_API_KEY env var
//   2. api_key column in source_configs (set via admin interface)

// Green Bay bounding box
const BBOX = '-88.25,44.24,-87.82,44.74';
// Yesterday's date for historical observations (AirNow API requires a date)
function getYesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function run() {
  const cfg = await getSourceConfig('airnow');
  const API_KEY = cfg.api_key;

  if (!API_KEY) {
    logger.warn('AIRNOW_API_KEY not set. Skipping AirNow ingest.');
    logger.warn('Register at: https://docs.airnowapi.org/account/request/');
    await db.end();
    return;
  }

  const date = getYesterdayDate();
  const url = `https://www.airnowapi.org/aq/observation/latLong/historical/`
    + `?format=application/json`
    + `&latitude=44.5133`
    + `&longitude=-88.0133`
    + `&date=${date}T00-0000`
    + `&distance=50`
    + `&API_KEY=${API_KEY}`;

  logger.info(`Fetching AirNow data for ${date}...`);

  let observations;
  try {
    observations = await fetchJson(url);
  } catch (err) {
    logger.error(`AirNow fetch failed: ${err.message}`);
    await db.end();
    return;
  }

  if (!Array.isArray(observations) || observations.length === 0) {
    logger.info('No AirNow observations returned.');
    await db.end();
    return;
  }

  const features = observations
    .filter(o => o.Latitude && o.Longitude)
    .map(o => ({
      geojsonGeometry: { type: 'Point', coordinates: [o.Longitude, o.Latitude] },
      aggregationLevel: 'point',
      properties: {
        station_name:  o.ReportingArea,
        date_time:     `${o.DateObserved} ${o.HourObserved}:00`,
        parameter:     o.ParameterName,
        aqi:           o.AQI,
        category:      o.Category?.Name || 'Unknown',
        category_num:  o.Category?.Number || null,
        source:        'EPA AirNow',
      },
    }));

  logger.info(`Found ${features.length} AirNow observations`);
  const inserted = await insertFeatures(db, 'airnow', features);
  logger.info(`Inserted ${inserted} AirNow features`);
  await db.end();
}

run().catch(err => {
  logger.error('AirNow ingest failed:', err.message);
  process.exit(1);
});
