/**
 * eviction-lab.js — Princeton Eviction Lab tract-level eviction data
 *
 * Loads eviction filing rates for Brown County, WI census tracts from the
 * Eviction Lab historical dataset (2000–2018).
 *
 * DATA SOURCE:
 *   Eviction Lab, Princeton University — WI_tracts.csv (provided manually)
 *   File: data/raw/eviction data/WI_tracts.csv
 *   Columns: GEOID, year, population, poverty.rate, renter.occupied.households,
 *     pct.renter.occupied, median.gross.rent, median.household.income,
 *     rent.burden, eviction.filings, evictions, eviction.rate, eviction.filing.rate
 *
 * ATTRIBUTION REQUIRED: This dataset is licensed CC BY 4.0.
 * Every display of this data MUST include:
 *   "Data from The Eviction Lab at Princeton University"
 *
 * NOTE: Rates are stored as 0–1 fractions (eviction.rate 5.34 → 0.0534)
 * to match the 0–1 CHOROPLETH stops in layers.js.
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

// Brown County FIPS
const BROWN_COUNTY_FIPS = '55009';
const ATTRIBUTION = 'Eviction Lab at Princeton University (evictionlab.org)';

const { getTracts } = require('../lib/boundaries');
// Eviction Lab provided the WI tract file (directory name has a space)
const CSV_PATH = path.join(__dirname, '..', 'data', 'raw', 'eviction data', 'WI_tracts.csv');

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    logger.error(`Eviction Lab WI_tracts.csv not found at ${CSV_PATH}`);
    logger.error('Obtain from: https://evictionlab.org/get-the-data/ (free email registration)');
    logger.error('Download the Wisconsin tract-level dataset.');
    process.exit(1);
  }
  logger.info('Parsing Eviction Lab WI_tracts.csv...');
  const records = parse(fs.readFileSync(CSV_PATH, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    bom: true,
  });

  // Filter to Brown County tracts (11-digit GEOID starting with '55009')
  const brownCountyRecords = records.filter(r => {
    const geoid = String(r.GEOID || r.geoid || '').padStart(11, '0');
    return geoid.startsWith(BROWN_COUNTY_FIPS);
  });

  // Keep only the most recent year per tract
  const byTract = {};
  for (const r of brownCountyRecords) {
    const geoid = String(r.GEOID || r.geoid || '').padStart(11, '0');
    const year  = parseInt(r.year || '0', 10);
    if (!byTract[geoid] || byTract[geoid]._year < year) {
      byTract[geoid] = { ...r, _geoid: geoid, _year: year };
    }
  }

  logger.info(`Found ${Object.keys(byTract).length} Brown County tracts (most recent year each)`);

  logger.info('Loading WI tract boundaries (auto-downloading if needed)...');
  const tractGeoJSON = await getTracts();
  const tractGeomMap = {};
  for (const f of tractGeoJSON.features) {
    tractGeomMap[f.properties.GEOID] = f.geometry;
  }

  const features = [];
  let skipped = 0;

  for (const [geoid, r] of Object.entries(byTract)) {
    const geom = tractGeomMap[geoid];
    if (!geom) { skipped++; continue; }

    // Eviction Lab encodes rates as percentages (e.g. 5.34 = 5.34%).
    // Divide by 100 to store as 0–1 fractions matching CHOROPLETH stops.
    const evictionRate       = (parseFloat(r['eviction.rate']        || '0') || 0) / 100;
    const evictionFilingRate = (parseFloat(r['eviction.filing.rate'] || '0') || 0) / 100;

    features.push({
      geojsonGeometry: geom,
      aggregationLevel: 'tract',
      properties: {
        geoid,
        tract_name:                  r.name || geoid,
        county:                      r['parent.location'] || 'Brown County',
        eviction_rate:               evictionRate,
        eviction_filing_rate:        evictionFilingRate,
        evictions:                   parseInt(r.evictions            || '0', 10) || 0,
        eviction_filings:            parseInt(r['eviction.filings']  || '0', 10) || 0,
        population:                  parseInt(r.population           || '0', 10) || 0,
        renter_occupied_households:  parseInt(r['renter.occupied.households'] || '0', 10) || 0,
        pct_renter_occupied:         (parseFloat(r['pct.renter.occupied']     || '0') || 0) / 100,
        median_gross_rent:           parseFloat(r['median.gross.rent']         || '0') || null,
        median_household_income:     parseFloat(r['median.household.income']   || '0') || null,
        rent_burden:                 (parseFloat(r['rent.burden']              || '0') || 0) / 100,
        pct_poverty:                 (parseFloat(r['poverty.rate']             || '0') || 0) / 100,
        data_year:                   r._year,
        // Attribution REQUIRED by CC BY 4.0 license
        attribution:                 ATTRIBUTION,
        license:                     'CC BY 4.0',
      },
    });
  }

  // Ensure layer aggregation_level is 'tract' (was 'county' before this upgrade)
  await db.query(
    "UPDATE layers SET aggregation_level = 'tract' WHERE slug = 'eviction-lab' AND aggregation_level = 'county'"
  );

  logger.info(`Inserting ${features.length} eviction-lab tract records (${skipped} skipped)`);
  const inserted = await insertFeatures(db, 'eviction-lab', features);
  logger.info(`Inserted ${inserted} Eviction Lab features`);
  await db.end();
}

run().catch(err => {
  logger.error('Eviction Lab ingest failed:', err.message);
  process.exit(1);
});
