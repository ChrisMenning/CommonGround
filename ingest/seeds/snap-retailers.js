/**
 * snap-retailers.js — USDA SNAP authorized retailer locations
 *
 * Tries the USDA FNS ArcGIS REST API first (Brown County only, no CSV needed).
 * Falls back to a locally downloaded national CSV if the API is unavailable.
 *
 * DATA SOURCE:
 *   USDA FNS SNAP Retailer Locator public dataset
 *   ArcGIS Hub: https://usda-fns.hub.arcgis.com/datasets/snap-store-locations
 *   CSV fallback: https://www.fns.usda.gov/snap/retailer/data
 *
 * MANUAL STEPS (CSV fallback only, if API is unavailable):
 *   1. Download the national SNAP retailer CSV from URL above
 *   2. Place at: ingest/data/raw/snap-retailers.csv
 *   3. Run: node seeds/snap-retailers.js
 */
'use strict';
const path = require('path');
const fs   = require('fs');
const { parse } = require('csv-parse/sync');
const db     = require('../lib/db');
const logger = require('../lib/logger');
const { fetchJson, insertFeatures } = require('../lib/utils');

const CSV_PATH = path.join(__dirname, '..', 'data', 'raw', 'snap-retailers.csv');

// Brown County bounding box for coordinate-based filter
const BROWN_COUNTY_BOUNDS = { minLat: 44.24, maxLat: 44.74, minLon: -88.25, maxLon: -87.82 };

// USDA FNS ArcGIS Hub — SNAP store locations feature service (layer index 1)
// The previous org ID (RLQu0rK7h4kbsBq5) retired; current service is at ue9rwulIoeLEI9bj
// Note: this service does not support f=geojson; use f=json and access f.attributes
const SNAP_API_URL =
  'https://services.arcgis.com/ue9rwulIoeLEI9bj/arcgis/rest/services/Store_Locations/FeatureServer/1/query'
  + '?where=State%3D%27WI%27%20AND%20County%3D%27BROWN%27'
  + '&outFields=Store_Name,Address,City,State,Zip5,Longitude,Latitude'
  + '&f=json&resultRecordCount=500';

function featureFromRecord(name, storeType, address, city, state, zip, lon, lat) {
  return {
    geojsonGeometry: { type: 'Point', coordinates: [lon, lat] },
    aggregationLevel: 'point',
    properties: {
      name:           (name || 'Unknown').trim(),
      store_type:     (storeType || '').trim(),
      address:        [address, city, state, zip].filter(Boolean).map(s => s.trim()).join(', '),
      snap_authorized: true,
      source:         'USDA SNAP',
      data_year:      new Date().getFullYear(),
    },
  };
}

async function fromApi() {
  const data = await fetchJson(SNAP_API_URL);
  if (data.error) throw new Error(`ArcGIS error ${data.error.code}: ${data.error.message}`);
  const features = [];
  let skipped = 0;
  for (const f of (data.features || [])) {
    const p   = f.attributes;
    const lon = parseFloat(p.Longitude || '0');
    const lat = parseFloat(p.Latitude  || '0');
    if (!lon || !lat || Math.abs(lat) > 90 || Math.abs(lon) > 180) { skipped++; continue; }
    features.push(featureFromRecord(p.Store_Name, null, p.Address, p.City, p.State, p.Zip5, lon, lat));
  }
  if (skipped) logger.warn(`Skipped ${skipped} API records with missing coordinates`);
  return features;
}

function fromCsv() {
  logger.info('Reading SNAP retailers from local CSV...');
  const records = parse(fs.readFileSync(CSV_PATH, 'utf8'), {
    columns: true, skip_empty_lines: true, relax_quotes: true,
  });
  const brownCounty = records.filter(r => {
    const state  = (r.State  || r.state  || '').trim().toUpperCase();
    const county = (r.County || r.county || '').trim().toUpperCase();
    if (state !== 'WI') return false;
    if (county && county.includes('BROWN')) return true;
    const lat = parseFloat(r.Latitude || r.latitude || '0');
    const lon = parseFloat(r.Longitude || r.longitude || '0');
    if (!lat || !lon) return false;
    return lat >= BROWN_COUNTY_BOUNDS.minLat && lat <= BROWN_COUNTY_BOUNDS.maxLat
      && lon >= BROWN_COUNTY_BOUNDS.minLon && lon <= BROWN_COUNTY_BOUNDS.maxLon;
  });
  logger.info(`Found ${brownCounty.length} SNAP retailers in Brown County (CSV)`);
  const features = [];
  let skipped = 0;
  for (const r of brownCounty) {
    const lat = parseFloat(r.Latitude || r.latitude || '0');
    const lon = parseFloat(r.Longitude || r.longitude || '0');
    if (!lat || !lon || Math.abs(lat) > 90 || Math.abs(lon) > 180) { skipped++; continue; }
    features.push(featureFromRecord(r.Store_Name || r.store_name, r.Store_Type || r.store_type,
      r.Address, r.City, r.State, r.Zip, lon, lat));
  }
  if (skipped) logger.warn(`Skipped ${skipped} CSV records with missing coordinates`);
  return features;
}

async function run() {
  logger.info('Fetching SNAP retailer data for Brown County, WI...');

  let features = [];

  // Try REST API first
  try {
    features = await fromApi();
    logger.info(`API returned ${features.length} SNAP retailers`);
  } catch (err) {
    logger.warn(`SNAP API unavailable: ${err.message}`);

    if (fs.existsSync(CSV_PATH)) {
      features = fromCsv();
    } else {
      logger.warn('No local CSV found. Skipping SNAP ingest.');
      logger.warn('To load SNAP retailer data manually:');
      logger.warn('  1. Visit: https://www.fns.usda.gov/snap/retailer/data');
      logger.warn('  2. Download national CSV and save to: ingest/data/raw/snap-retailers.csv');
      await db.end();
      return;
    }
  }

  if (features.length === 0) {
    logger.warn('No SNAP retailer features to insert.');
    await db.end();
    return;
  }

  logger.info(`Inserting ${features.length} SNAP retailers...`);
  const inserted = await insertFeatures(db, 'snap-retailers', features);
  logger.info(`Inserted ${inserted} SNAP retailer features`);
  await db.end();
}

run().catch(err => {
  logger.error('SNAP retailers ingest failed:', err.message);
  process.exit(1);
});
