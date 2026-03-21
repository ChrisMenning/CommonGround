/**
 * hud-chas.js — HUD CHAS Housing Cost Burden ingest
 *
 * Loads HUD CHAS 2018-2022 data for Brown County, WI — census-tract-level
 * housing cost burden (households paying >30% or >50% of income on housing).
 *
 * DATA SOURCE:
 *   HUD User 2018-2022 ACS (5-year), census-tract level, downloaded as national CSV.
 *   https://www.huduser.gov/portal/datasets/cp.html
 *   File: 2018thru2022-140-csv/140/Table9.csv
 *
 * TABLE 9 COLUMN GUIDE (cost burden by tenure, nationally):
 *   T9_est1  = Total occupied housing units
 *   T9_est2  = Owner occupied
 *   T9_est3  = Owner, cost computed (T9_est4 + T9_est5 + T9_est6)
 *   T9_est4  = Owner, not cost burdened
 *   T9_est5  = Owner, cost burdened (30–50% of income)
 *   T9_est6  = Owner, severely cost burdened (>50%)
 *   T9_est38 = Renter occupied
 *   T9_est39 = Renter, cost computed (T9_est40 + T9_est41 + T9_est42)
 *   T9_est40 = Renter, not cost burdened
 *   T9_est41 = Renter, cost burdened (30–50%)
 *   T9_est42 = Renter, severely cost burdened (>50%)
 *
 * PRIVACY NOTE: Census-tract level only. No individual records stored.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const db = require('../lib/db');
const logger = require('../lib/logger');
const { insertFeatures } = require('../lib/utils');

const BROWN_COUNTY_FIPS = '55009';
const { getTracts } = require('../lib/boundaries');

// National tract-level Table9 from the HUD CHAS 2018-2022 download
const CSV_PATH = path.join(__dirname, '..', 'data', 'raw', '2018thru2022-140-csv', '140', 'Table9.csv');

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    logger.error(`HUD CHAS Table9.csv not found at ${CSV_PATH}`);
    logger.error('Download from: https://www.huduser.gov/portal/datasets/cp.html');
    logger.error('Select: All States, Census Tract level, 2018-2022');
    logger.error('Extract to: data/raw/2018thru2022-140-csv/');
    process.exit(1);
  }
  logger.info('Parsing HUD CHAS Table9...');
  const records = parse(fs.readFileSync(CSV_PATH, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    bom: true,
  });

  // Filter to Brown County: precise filter on state (st) and county (cnty) columns
  const brownCounty = records.filter(r => r.st === '55' && r.cnty === '009');
  logger.info(`Found ${brownCounty.length} Brown County tracts in HUD CHAS`);

  logger.info('Loading WI tract boundaries (auto-downloading if needed)...');
  const tractGeoJSON = await getTracts();
  const tractGeomMap = {};
  for (const f of tractGeoJSON.features) {
    tractGeomMap[f.properties.GEOID] = f.geometry;
  }

  const features = [];
  let skipped = 0;

  for (const r of brownCounty) {
    // CHAS GEOID format: '1400000US55009XXXXXX' → strip prefix → 11-digit GEOID
    const geoid = String(r.geoid || '').replace(/^1400000US/, '').padStart(11, '0');
    const geom = tractGeomMap[geoid];
    if (!geom) { skipped++; continue; }

    const totalHouseholds      = parseInt(r.T9_est1  || '0', 10) || 0;
    const ownerHH              = parseInt(r.T9_est2  || '0', 10) || 0;
    const ownerCostBurdened    = parseInt(r.T9_est5  || '0', 10) || 0; // owner 30–50%
    const ownerSeverelyBurden  = parseInt(r.T9_est6  || '0', 10) || 0; // owner >50%
    const renterHH             = parseInt(r.T9_est38 || '0', 10) || 0;
    const renterCostBurdened   = parseInt(r.T9_est41 || '0', 10) || 0; // renter 30–50%
    const renterSeverelyBurden = parseInt(r.T9_est42 || '0', 10) || 0; // renter >50%

    // Total cost-burdened = any household paying ≥30% of income on housing
    const costBurdenedHH    = ownerCostBurdened + ownerSeverelyBurden
                            + renterCostBurdened + renterSeverelyBurden;
    const severelyBurdenedHH = ownerSeverelyBurden + renterSeverelyBurden;

    // Store as 0–1 fractions to match CHOROPLETH stops in layers.js
    const pctCostBurdened     = totalHouseholds > 0 ? costBurdenedHH    / totalHouseholds : null;
    const pctSeverelyBurdened = totalHouseholds > 0 ? severelyBurdenedHH / totalHouseholds : null;

    features.push({
      geojsonGeometry: geom,
      aggregationLevel: 'tract',
      properties: {
        geoid,
        total_households:           totalHouseholds,
        owner_hh:                   ownerHH,
        renter_hh:                  renterHH,
        cost_burdened_hh:           costBurdenedHH,
        severely_cost_burdened_hh:  severelyBurdenedHH,
        // Fractions (0–1) for choropleth and popup % display
        pct_cost_burdened:          pctCostBurdened,
        pct_severely_burdened:      pctSeverelyBurdened,
        // Owner vs renter breakdown
        owner_cost_burdened:        ownerCostBurdened + ownerSeverelyBurden,
        renter_cost_burdened:       renterCostBurdened + renterSeverelyBurden,
        source:                     'HUD CHAS 2018-2022',
        data_year:                  2022,
      },
    });
  }

  logger.info(`Inserting ${features.length} HUD CHAS tracts (${skipped} skipped)`);
  const inserted = await insertFeatures(db, 'hud-chas', features);
  logger.info(`Inserted ${inserted} HUD CHAS features`);
  await db.end();
}

run().catch(err => {
  logger.error('HUD CHAS ingest failed:', err.message);
  process.exit(1);
});
