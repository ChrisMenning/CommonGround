/**
 * ejscreen.js — EPA EJScreen ingest
 *
 * Loads EPA EJScreen 2024 block-group-level data for Brown County, WI.
 * EJScreen provides combined environmental + demographic vulnerability scores.
 *
 * DATA SOURCE:
 *   EPA EJScreen 2024 — original EPA site removed early 2025.
 *   Auto-downloads from Harvard Dataverse (EDGI archive, publicly accessible):
 *     https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/RLR5AX
 *   The full national CSV (~437 MB) is streamed and filtered to WI block groups
 *   on the fly — only ~1 MB is saved locally.
 *
 * NOTE: Column names changed between EJScreen 2023 and 2024:
 *   P_VULEOPCT  → P_DEMOGIDX_2  (overall EJ 2-factor index percentile)
 *   MINORPCT    → PEOPCOLORPCT  (people of color %)
 *   P_CANCER, P_RESP → P_RSEI_AIR  (combined air toxics risk)
 *
 * PRIVACY NOTE: Block-group level only. No individual records stored.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { parse } = require('csv-parse/sync');
const db = require('../lib/db');
const logger = require('../lib/logger');
const { insertFeatures } = require('../lib/utils');

const BROWN_COUNTY_FIPS = '55009';
const WI_FIPS_PREFIX = '55';

// Harvard Dataverse: EJSCREEN_2024_BG_with_AS_CNMI_GU_VI.csv (public, no auth needed)
const DATAVERSE_URL = 'https://dataverse.harvard.edu/api/access/datafile/10775972';

const { getBlockGroups } = require('../lib/boundaries');
const CSV_PATH = path.join(__dirname, '..', 'data', 'raw', 'ejscreen.csv');

/**
 * Stream the 437 MB national CSV from Harvard Dataverse, filtering to WI
 * block groups only. Saves ~1 MB WI-only CSV to CSV_PATH.
 */
function downloadWiEjscreen() {
  return new Promise((resolve, reject) => {
    logger.info('Streaming EJScreen 2024 from Harvard Dataverse (downloading WI rows only)...');
    logger.info('This streams ~437 MB but saves only ~1 MB. Please wait...');

    const dir = path.dirname(CSV_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const out = fs.createWriteStream(CSV_PATH);
    let headerWritten = false;
    let buffer = '';
    let rowsKept = 0;

    function handleResponse(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        const loc = res.headers.location;
        const mod = loc.startsWith('https') ? https : http;
        mod.get(loc, handleResponse).on('error', reject);
        return;
      }
      if (res.statusCode !== 200) {
        out.destroy();
        return reject(new Error(`HTTP ${res.statusCode} from Dataverse`));
      }

      res.on('data', chunk => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last line

        for (const line of lines) {
          if (!headerWritten) {
            out.write(line + '\n');
            headerWritten = true;
            continue;
          }
          // Fast WI filter: block group GEOID starts with '55'
          if (line.startsWith(WI_FIPS_PREFIX)) {
            out.write(line + '\n');
            rowsKept++;
          }
        }
      });

      res.on('end', () => {
        // Flush remaining buffer
        if (buffer && buffer.startsWith(WI_FIPS_PREFIX)) {
          out.write(buffer + '\n');
          rowsKept++;
        }
        out.end(() => {
          logger.info(`Saved ${rowsKept} WI block group rows to ${CSV_PATH}`);
          resolve();
        });
      });

      res.on('error', reject);
    }

    https.get(DATAVERSE_URL, handleResponse).on('error', err => {
      out.destroy();
      reject(err);
    });
  });
}

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    try {
      await downloadWiEjscreen();
    } catch (err) {
      logger.error('Auto-download from Harvard Dataverse failed:', err.message);
      logger.error('Manual fallback: download EJSCREEN_2024_BG_with_AS_CNMI_GU_VI.csv from:');
      logger.error('  https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/RLR5AX');
      logger.error(`Save to: ${CSV_PATH}`);
      process.exit(1);
    }
  }

  logger.info('Parsing EJScreen CSV...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parse(csvContent, { columns: true, skip_empty_lines: true, bom: true });

  // Filter to Brown County block groups
  // ID field in EJScreen is 12-digit block group GEOID
  const brownCountyRecords = records.filter(r => {
    const id = String(r.ID || '').replace(/\s/g, '');
    // Block group GEOID starts with state(2) + county(3) = 5 chars = '55009'
    return id.startsWith(BROWN_COUNTY_FIPS);
  });

  logger.info(`Found ${brownCountyRecords.length} Brown County block groups in EJScreen`);

  logger.info('Loading WI block group boundaries (auto-downloading if needed)...');
  const bgGeoJSON = await getBlockGroups();
  const bgGeomMap = {};
  for (const feature of bgGeoJSON.features) {
    const geoid = feature.properties.GEOID;
    bgGeomMap[geoid] = feature.geometry;
  }

  const features = [];
  let skipped = 0;

  for (const r of brownCountyRecords) {
    const geoid = String(r.ID || '').replace(/\s/g, '').padStart(12, '0');
    const geom = bgGeomMap[geoid];
    if (!geom) { skipped++; continue; }

    features.push({
      geojsonGeometry: geom,
      aggregationLevel: 'block_group',
      properties: {
        geoid,
        // EJScreen 2024 percentile scores stored as 0–1 (EPA stores as 0–100, divide by 100)
        // This matches the MapLibre choropleth stops [0…1] in layers.js
        // P_DEMOGIDX_2 = 2-factor EJ index (env load × low income), replaces 2023's P_VULEOPCT
        ejscreen_pctile:           (parseFloat(r.P_DEMOGIDX_2  || '0') || 0) / 100,
        pollution_burden_pctile:   (parseFloat(r.P_PWDIS       || '0') || 0) / 100,
        pm25_pctile:               (parseFloat(r.P_PM25        || '0') || 0) / 100,
        ozone_pctile:              (parseFloat(r.P_OZONE       || '0') || 0) / 100,
        diesel_pm_pctile:          (parseFloat(r.P_DSLPM       || '0') || 0) / 100,
        // P_RSEI_AIR = combined air toxics risk (replaces 2023's separate P_CANCER + P_RESP)
        cancer_risk_pctile:        (parseFloat(r.P_RSEI_AIR    || '0') || 0) / 100,
        resp_hazard_pctile:        (parseFloat(r.P_RSEI_AIR    || '0') || 0) / 100,
        traffic_pctile:            (parseFloat(r.P_PTRAF       || '0') || 0) / 100,
        lead_paint_pctile:         (parseFloat(r.P_LDPNT       || '0') || 0) / 100,
        superfund_pctile:          (parseFloat(r.P_PNPL        || '0') || 0) / 100,
        rmp_pctile:                (parseFloat(r.P_PRMP        || '0') || 0) / 100,
        wastewater_pctile:         (parseFloat(r.P_PWDIS       || '0') || 0) / 100,
        // Demographic indicators (PEOPCOLORPCT replaces 2023's MINORPCT)
        pct_low_income:            parseFloat(r.LOWINCPCT     || '0') || 0,
        pct_minority:              parseFloat(r.PEOPCOLORPCT  || '0') || 0,
        pct_less_hs:               parseFloat(r.LESSHSPCT     || '0') || 0,
        pct_linguistic_isolation:  parseFloat(r.LINGISOPCT    || '0') || 0,
        pct_under5:                parseFloat(r.UNDER5PCT     || '0') || 0,
        pct_over64:                parseFloat(r.OVER64PCT     || '0') || 0,
        population:                parseInt(r.ACSTOTPOP || '0', 10) || 0,
        data_year: 2024,
      },
    });
  }

  logger.info(`Inserting ${features.length} block groups (${skipped} skipped)`);
  const inserted = await insertFeatures(db, 'ejscreen', features);
  logger.info(`Inserted ${inserted} EJScreen features`);
  await db.end();
}

run().catch(err => {
  logger.error('EJScreen ingest failed:', err.message);
  process.exit(1);
});
