/**
 * fqhc.js — HRSA Federally Qualified Health Center locations
 *
 * Tries the HRSA REST API first. If that fails, auto-downloads the national
 * HRSA Health Center Service Delivery Sites CSV and filters to Brown County.
 *
 * DATA SOURCE:
 *   HRSA Data Warehouse — Health Center Service Delivery and Look-Alike Sites
 *   CSV download: https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv
 *
 * MANUAL STEPS (if auto-download fails):
 *   1. Download CSV from URL above
 *   2. Save to: ingest/data/raw/fqhc-sites.csv
 *   3. Run: node seeds/fqhc.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const db = require('../lib/db');
const logger = require('../lib/logger');
const { download, fetchJson, insertFeatures } = require('../lib/utils');

const CSV_PATH = path.join(__dirname, '..', 'data', 'raw', 'fqhc-sites.csv');

// HRSA direct GIS server — may not resolve inside Docker. Falls back to data.hrsa.gov download.
const HRSA_URL = 'https://gis.hrsa.gov/arcgis/rest/services/HGeoBHDW/HRSA_HGeoBHDW_HC_SiteLevel/FeatureServer/0/query'
  + '?where=SiteStateAbbreviation%3D%27WI%27+AND+SiteCountyName%3D%27BROWN%27'
  + '&outFields=*&f=geojson&resultRecordCount=500';
// Auto-download fallback — national Health Center Service Delivery Sites CSV
const HRSA_DOWNLOAD_URL = 'https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv';

function featuresFromGeoJson(geojson) {
  return (geojson.features || [])
    .filter(f => f.geometry && f.geometry.coordinates)
    .map(f => {
      const p = f.properties;
      return {
        geojsonGeometry: f.geometry,
        aggregationLevel: 'point',
        properties: {
          name:           p.SiteName || p.BRNSiteName || 'Unknown',
          address:        [p.SiteAddress, p.SiteCity, 'WI', p.SitePostalCode].filter(Boolean).join(', '),
          phone:          p.SitePhoneNumber || null,
          type:           p.SiteTypeDescription || 'FQHC',
          health_center:  p.BRNHealthCenterName || null,
          services:       p.ServicesProvided || null,
          hours:          p.SiteHours || null,
          accessibility:  p.SiteADAAccessible === 'Y' ? true : false,
          source:         'HRSA',
          data_year:      new Date().getFullYear(),
        },
      };
    });
}

function featuresFromCsv() {
  logger.info(`Reading FQHC CSV from ${CSV_PATH}...`);
  const records = parse(fs.readFileSync(CSV_PATH, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  });

  // Filter to Brown County, WI
  // Supports both the new DD_Files column names and legacy HCPSITE column names
  const brownCounty = records.filter(r => {
    const state  = (r['Site State Abbreviation'] || r.SiteStateAbbreviation || r.State || '').trim().toUpperCase();
    const county = (r['Complete County Name'] || r['County Equivalent Name'] || r.SiteCountyName || r.County || '').trim().toUpperCase();
    return state === 'WI' && county.includes('BROWN');
  });

  logger.info(`Found ${brownCounty.length} FQHC sites in Brown County (CSV)`);

  const features = [];
  let skipped = 0;
  for (const r of brownCounty) {
    // New CSV: X = longitude, Y = latitude
    const lat = parseFloat(r['Geocoding Artifact Address Primary Y Coordinate'] || r.Latitude || r.latitude || '0');
    const lon = parseFloat(r['Geocoding Artifact Address Primary X Coordinate'] || r.Longitude || r.longitude || '0');
    if (!lat || !lon || Math.abs(lat) > 90 || Math.abs(lon) > 180) { skipped++; continue; }
    features.push({
      geojsonGeometry: { type: 'Point', coordinates: [lon, lat] },
      aggregationLevel: 'point',
      properties: {
        name:          (r['Site Name'] || r.SiteName || r.BRNSiteName || 'Unknown').trim(),
        address:       [r['Site Address'] || r.SiteAddress, r['Site City'] || r.SiteCity, 'WI', r['Site Postal Code'] || r.SiteZipCode || r.SitePostalCode].filter(Boolean).join(', '),
        phone:         r['Site Telephone Number'] || r.SitePhoneNumber || null,
        type:          r['Health Center Service Delivery Site Location Setting Description'] || r.SiteTypeDescription || 'FQHC',
        health_center: r['Health Center Name'] || r.BRNHealthCenterName || null,
        services:      r.ServicesProvided || null,
        hours:         r.SiteHours || null,
        accessibility: r.SiteADAAccessible === 'Y' ? true : false,
        source:        'HRSA',
        data_year:     new Date().getFullYear(),
      },
    });
  }
  if (skipped > 0) logger.warn(`Skipped ${skipped} records with missing coordinates`);
  return features;
}

async function run() {
  logger.info('Fetching HRSA FQHC data for Brown County, WI...');

  let features = [];

  // Try API first
  try {
    const geojson = await fetchJson(HRSA_URL);
    features = featuresFromGeoJson(geojson);
    logger.info(`API returned ${features.length} FQHC sites`);
  } catch (err) {
    logger.warn(`HRSA GIS API unavailable: ${err.message}`);

    // Auto-download national HCPSITE.csv from data.hrsa.gov, then parse
    if (!fs.existsSync(CSV_PATH)) {
      try {
        logger.info(`Auto-downloading HCPSITE.csv from data.hrsa.gov...`);
        await download(HRSA_DOWNLOAD_URL, CSV_PATH);
        logger.info('HCPSITE.csv downloaded successfully.');
      } catch (dlErr) {
        logger.warn(`Auto-download failed: ${dlErr.message}`);
      }
    }

    if (fs.existsSync(CSV_PATH)) {
      features = featuresFromCsv();
    } else {
      logger.warn('No local CSV found. Skipping FQHC ingest.');
      logger.warn('To load FQHC data manually:');
      logger.warn('  1. Download: https://data.hrsa.gov/api/download?filename=HCPSITE.csv&fileType=csv');
      logger.warn('  2. Save to:  ingest/data/raw/fqhc-sites.csv');
      logger.warn('  3. Re-run:   node seeds/fqhc.js');
      await db.end();
      return;
    }
  }

  if (features.length === 0) {
    logger.warn('No FQHC features to insert.');
    await db.end();
    return;
  }

  const inserted = await insertFeatures(db, 'fqhc', features);
  logger.info(`Inserted ${inserted} FQHC features`);
  await db.end();
}

run().catch(err => {
  logger.error('FQHC ingest failed:', err.message);
  process.exit(1);
});
