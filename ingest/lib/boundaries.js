'use strict';
/**
 * boundaries.js — auto-downloads and parses Wisconsin Census boundary shapefiles.
 *
 * Downloads cartographic boundary ZIP files from Census Bureau TIGER, extracts the
 * shapefile (.shp + .dbf), converts to GeoJSON, and caches the result locally.
 *
 * No ogr2ogr or external tools required — uses pure-JavaScript shapefile parser.
 *
 * GEOID field names match TIGER standard: 'GEOID' (string, zero-padded).
 * - Block groups:  12 digits  (state(2) + county(3) + tract(6) + blkgrp(1))
 * - Census tracts: 11 digits  (state(2) + county(3) + tract(6))
 * - Counties:       5 digits  (state(2) + county(3))
 */
const path      = require('path');
const fs        = require('fs');
const https     = require('https');
const os        = require('os');
const AdmZip    = require('adm-zip');
const shapefile = require('shapefile');

const DATA_DIR = path.join(__dirname, '..', 'data', 'raw');

// Census GENZ 2021 cartographic boundary files (generalized, good for display)
// Confirmed accessible at time of writing.
const GENZ_BASE = 'https://www2.census.gov/geo/tiger/GENZ2021/shp';

function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'CommonGround-Ingest/1.0' },
      timeout: 180000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadToBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        const err = new Error(`HTTP ${res.statusCode} for ${url}`);
        err.statusCode = res.statusCode;
        return reject(err);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject).on('timeout', function() {
      this.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

async function shapefileZipToGeoJSON(zipBuffer, baseName) {
  // Extract .shp and .dbf from the zip into temp files
  const zip = new AdmZip(zipBuffer);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-boundaries-'));

  try {
    // Find the shp/dbf entries (zip may contain multiple files; use the main one)
    const shpEntry = zip.getEntries().find(e => e.entryName.endsWith('.shp'));
    const dbfEntry = zip.getEntries().find(e => e.entryName.endsWith('.dbf'));

    if (!shpEntry) throw new Error(`No .shp file found in zip for ${baseName}`);

    const shpPath = path.join(tmpDir, 'data.shp');
    const dbfPath = path.join(tmpDir, 'data.dbf');

    fs.writeFileSync(shpPath, shpEntry.getData());
    if (dbfEntry) fs.writeFileSync(dbfPath, dbfEntry.getData());

    // Read shapefile → GeoJSON FeatureCollection
    const fc = await shapefile.read(shpPath, dbfEntry ? dbfPath : undefined);
    return fc;
  } finally {
    // Clean up temp files
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  }
}

async function downloadBoundary(zipFile, cacheFile, description) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const outPath = path.join(DATA_DIR, cacheFile);

  if (fs.existsSync(outPath)) {
    return JSON.parse(fs.readFileSync(outPath, 'utf8'));
  }

  const url = `${GENZ_BASE}/${zipFile}`;
  console.log(`[boundaries] Downloading ${description}...`);
  console.log(`[boundaries] ${url}`);

  const zipBuffer = await downloadToBuffer(url);
  console.log(`[boundaries] Parsing shapefile (${Math.round(zipBuffer.length / 1024)} KB)...`);

  const geojson = await shapefileZipToGeoJSON(zipBuffer, zipFile);
  fs.writeFileSync(outPath, JSON.stringify(geojson));
  console.log(`[boundaries] Cached ${description}: ${geojson.features ? geojson.features.length : 0} features → ${cacheFile}`);
  return geojson;
}

/** Wisconsin (FIPS 55) block groups — used by EJScreen */
function getBlockGroups() {
  return downloadBoundary('cb_2021_55_bg_500k.zip', 'wi-blockgroups.geojson', 'WI block group boundaries');
}

/** Wisconsin (FIPS 55) census tracts — used by SVI, Food Access, HUD CHAS */
function getTracts() {
  return downloadBoundary('cb_2021_55_tract_500k.zip', 'wi-tracts.geojson', 'WI census tract boundaries');
}

/** Wisconsin (FIPS 55) counties — used by Eviction Lab
 *  County boundaries use the national GENZ file (no state-level county file exists).
 *  The eviction-lab seed filters to Wisconsin counties by GEOID prefix '55'. */
function getCounties() {
  return downloadBoundary('cb_2021_us_county_500k.zip', 'wi-counties.geojson', 'US county boundaries (for WI filtering)');
}

module.exports = { getBlockGroups, getTracts, getCounties };
