/**
 * food-access.js — USDA Food Access Research Atlas ingest
 *
 * Loads low-income / low-access (LILA) census tract designations for
 * Brown County, WI from the USDA Food Access Research Atlas.
 *
 * DATA SOURCE:
 *   https://www.ers.usda.gov/data-products/food-access-research-atlas/
 *   Accepts either:
 *     - Excel file (XLSX): data/raw/FoodAccessResearchAtlasData2019.xlsx
 *     - CSV export:        data/raw/food-access-atlas.csv
 *   The XLSX file is read directly — no manual CSV conversion required.
 *   The data sheet is detected automatically (first sheet with a CensusTract column).
 *
 * PRIVACY NOTE: Only tract-level aggregations are stored. No individual records.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');
const db = require('../lib/db');
const logger = require('../lib/logger');
const { insertFeatures } = require('../lib/utils');

// Brown County FIPS: 55009
const BROWN_COUNTY_FIPS = '55009';

const { getTracts } = require('../lib/boundaries');
const CSV_PATH  = path.join(__dirname, '..', 'data', 'raw', 'food-access-atlas.csv');
const XLSX_2019 = path.join(__dirname, '..', 'data', 'raw', 'FoodAccessResearchAtlasData2019.xlsx');
const XLSX_2015 = path.join(__dirname, '..', 'data', 'raw', 'FoodAccessResearchAtlasData2015.xlsx');

/**
 * Load records from the Food Access Atlas — tries CSV first, then XLSX.
 * Uses exceljs streaming for XLSX so only Brown County rows are kept in memory
 * (avoids loading the full ~72,000-row national dataset at once).
 * Returns an array of row objects with column headers as keys.
 */
async function loadRecords() {
  // CSV preferred (fastest), fall through to XLSX if absent
  if (fs.existsSync(CSV_PATH)) {
    logger.info('Reading Food Access Atlas CSV...');
    return parse(fs.readFileSync(CSV_PATH, 'utf8'), { columns: true, skip_empty_lines: true, bom: true });
  }

  const xlsxPath = fs.existsSync(XLSX_2019) ? XLSX_2019 : fs.existsSync(XLSX_2015) ? XLSX_2015 : null;
  if (!xlsxPath) {
    logger.error('Food Access Atlas data file not found. Looked for:');
    logger.error(`  ${CSV_PATH}`);
    logger.error(`  ${XLSX_2019}`);
    logger.error(`  ${XLSX_2015}`);
    logger.error('Download from: https://www.ers.usda.gov/data-products/food-access-research-atlas/');
    process.exit(1);
  }

  logger.info(`Reading Excel file: ${path.basename(xlsxPath)} (streaming, filtering to Brown County)...`);

  const rows = [];
  // Stream the workbook sheet by sheet, row by row — never loads full file into RAM
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(xlsxPath, {
    entries: 'emit',
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'ignore',
    worksheets: 'emit',
  });

  let headers = null;
  let censusTractIdx = -1;
  let dataSheetDone = false;

  await new Promise((resolve, reject) => {
    workbookReader.on('worksheet', (worksheet) => {
      if (dataSheetDone) return;

      worksheet.on('row', (row) => {
        const vals = row.values; // 1-based; vals[0] is undefined
        if (!headers) {
          // First row of this sheet — check if it has CensusTract
          const headerRow = vals.slice(1).map(v => (v == null ? '' : String(v).trim()));
          if (!headerRow.includes('CensusTract')) {
            // Wrong sheet — detach listener so we skip it
            worksheet.removeAllListeners();
            return;
          }
          headers = headerRow;
          censusTractIdx = headers.indexOf('CensusTract'); // 0-based in headers array
          logger.info(`Found data sheet with ${headers.length} columns`);
          return;
        }

        // Filter by county FIPS prefix before building the full object
        const rawGeoid = vals[censusTractIdx + 1]; // +1 because vals is 1-based
        const geoid = String(rawGeoid ?? '').padStart(11, '0');
        if (!geoid.startsWith(BROWN_COUNTY_FIPS)) return;

        // Build row object only for matching rows — keeps memory use tiny
        const obj = {};
        headers.forEach((h, i) => {
          const v = vals[i + 1];
          obj[h] = v == null ? '' : v;
        });
        rows.push(obj);
      });

      worksheet.on('end', () => {
        if (headers) dataSheetDone = true;
      });
    });

    workbookReader.on('end', resolve);
    workbookReader.on('error', reject);
    workbookReader.read();
  });

  logger.info(`Filtered ${rows.length} Brown County rows from XLSX`);
  return rows;
}

async function run() {
  const records = await loadRecords();
  logger.info(`Loaded ${records.length} Brown County rows`);

  // Filter to Brown County (FIPS county = 55009)
  // CensusTract column is the 11-digit tract GEOID: state(2) + county(3) + tract(6)
  const brownCountyRecords = records.filter(r => {
    const geoid = String(r.CensusTract || '').padStart(11, '0');
    return geoid.startsWith(BROWN_COUNTY_FIPS);
  });

  logger.info(`Found ${brownCountyRecords.length} Brown County tracts`);

  // Load tract geometries (auto-downloads from Census Bureau if not already cached)
  logger.info('Loading WI tract boundaries (auto-downloading if needed)...');
  const tractGeoJSON = await getTracts();
  const tractGeomMap = {};
  for (const feature of tractGeoJSON.features) {
    const geoid = feature.properties.GEOID || feature.properties.TRACTCE;
    tractGeomMap[geoid] = feature.geometry;
  }

  const features = [];
  let skipped = 0;

  for (const record of brownCountyRecords) {
    const geoid = String(record.CensusTract || '').padStart(11, '0');
    const geom = tractGeomMap[geoid];
    if (!geom) {
      skipped++;
      continue;
    }

    // Key USDA LILA flags
    // LILATracts_1And10: LILA at 1-mile (urban) or 10-mile (rural) — primary designation
    // Note: XLSX returns numeric 1/0; CSV returns string '1'/'0' — coerce with Number()
    const isLILA         = Number(record.LILATracts_1And10) === 1;
    const isLowIncome    = Number(record.LowIncomeTracts)   === 1;
    const isLowAccess1Mi = Number(record.LA1and10)          === 1;
    const isLowAccess05Mi = Number(record.LA05and10)        === 1;

    features.push({
      geojsonGeometry: geom,
      aggregationLevel: 'tract',
      properties: {
        geoid,
        tract_name: record.Census_Tract || geoid,
        county: record.County || 'Brown County',
        state: record.State || 'Wisconsin',
        // Numeric flag (0 or 1) used by CHOROPLETH in layers.js
        lila_flag:             isLILA ? 1 : 0,
        // Additional flags for popup display
        is_lila:               isLILA,
        is_low_income:         isLowIncome,
        is_low_access_1mi:     isLowAccess1Mi,
        is_low_access_half_mi: isLowAccess05Mi,
        pop_total: parseInt(record.Pop2010 || '0', 10) || 0,
        pct_low_income: parseFloat(record.PovertyRate || '0') || 0,
        median_family_income: parseFloat(record.MedianFamilyIncome || '0') || 0,
        designation: isLILA ? 'LILA' : (isLowIncome ? 'Low-Income Only' : 'Neither'),
        data_year: 2019,
      },
    });
  }

  logger.info(`Preparing to insert ${features.length} tracts (${skipped} skipped — no geometry match)`);

  const inserted = await insertFeatures(db, 'food-access', features);
  logger.info(`Inserted ${inserted} food access features`);
  await db.end();
}

run().catch(err => {
  logger.error('food-access ingest failed:', err.message);
  process.exit(1);
});
