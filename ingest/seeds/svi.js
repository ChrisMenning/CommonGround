/**
 * svi.js — CDC Social Vulnerability Index ingest
 *
 * Loads CDC SVI 2022 data for Brown County, WI.
 * SVI provides a 16-factor composite vulnerability score per census tract.
 *
 * DATA SOURCE (primary — auto-downloaded):
 *   CDC SVI 2022 archived by Public Environmental Data Partners (PEDP/OEDP)
 *   https://github.com/oedp/cdc-svi/tree/main/2022_data
 *   Original CDC URL (TAKEN DOWN in early 2025):
 *   https://www.atsdr.cdc.gov/placeandhealth/svi/data_documentation_download.html
 *
 * This script auto-downloads svi-wi.csv from the GitHub archive if not present.
 * No manual download needed.
 *
 * PRIVACY NOTE: Census-tract level only.
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
const { download } = require('../lib/utils');

const CSV_PATH = path.join(__dirname, '..', 'data', 'raw', 'svi-wi.csv');
// CDC SVI 2022 archived by PEDP/OEDP (original CDC site taken down in early 2025)
const SVI_ARCHIVE_URL = 'https://raw.githubusercontent.com/oedp/cdc-svi/main/2022_data/Wisconsin.csv';

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    logger.info('CDC SVI CSV not found locally — auto-downloading from PEDP GitHub archive...');
    logger.info(`Archive: ${SVI_ARCHIVE_URL}`);
    try {
      await download(SVI_ARCHIVE_URL, CSV_PATH);
      logger.info('SVI CSV downloaded and cached.');
    } catch (err) {
      logger.error(`Auto-download failed: ${err.message}`);
      logger.error('Manual fallback: https://github.com/oedp/cdc-svi/tree/main/2022_data');
      logger.error(`Save Wisconsin.csv as: ${CSV_PATH}`);
      process.exit(1);
    }
  }
  logger.info('Parsing CDC SVI CSV...');
  const records = parse(fs.readFileSync(CSV_PATH, 'utf8'), { columns: true, skip_empty_lines: true });

  // FIPS column in SVI is the 11-digit tract GEOID
  const brownCounty = records.filter(r => {
    const fips = String(r.FIPS || r.GEOID || '').padStart(11, '0');
    return fips.startsWith(BROWN_COUNTY_FIPS);
  });

  logger.info(`Found ${brownCounty.length} Brown County tracts in SVI`);

  logger.info('Loading WI tract boundaries (auto-downloading if needed)...');
  const tractGeoJSON = await getTracts();
  const tractGeomMap = {};
  for (const f of tractGeoJSON.features) {
    tractGeomMap[f.properties.GEOID] = f.geometry;
  }

  const features = [];
  let skipped = 0;

  for (const r of brownCounty) {
    const geoid = String(r.FIPS || r.GEOID || '').padStart(11, '0');
    const geom = tractGeomMap[geoid];
    if (!geom) { skipped++; continue; }

    // RPL_THEMES = overall SVI percentile ranking (0–1, higher = more vulnerable)
    const sviOverall = parseFloat(r.RPL_THEMES || '-1');

    features.push({
      geojsonGeometry: geom,
      aggregationLevel: 'tract',
      properties: {
        geoid,
        tract_name: r.LOCATION || geoid,
        county: r.COUNTY || 'Brown',
        // Overall SVI
        svi_overall:         sviOverall >= 0 ? sviOverall : null,
        // 4 theme percentile rankings
        svi_socioeconomic:   parseFloat(r.RPL_THEME1 || '-1') >= 0 ? parseFloat(r.RPL_THEME1) : null,
        svi_household:       parseFloat(r.RPL_THEME2 || '-1') >= 0 ? parseFloat(r.RPL_THEME2) : null,
        svi_minority_lang:   parseFloat(r.RPL_THEME3 || '-1') >= 0 ? parseFloat(r.RPL_THEME3) : null,
        svi_housing_transit: parseFloat(r.RPL_THEME4 || '-1') >= 0 ? parseFloat(r.RPL_THEME4) : null,
        // Raw counts
        pop_total:           parseInt(r.E_TOTPOP  || '0', 10) || 0,
        pop_poverty:         parseInt(r.E_POV150  || '0', 10) || 0,
        pop_unemployed:      parseInt(r.E_UNEMP   || '0', 10) || 0,
        pop_no_hs_diploma:   parseInt(r.E_NOHSDP  || '0', 10) || 0,
        pop_65plus:          parseInt(r.E_AGE65   || '0', 10) || 0,
        pop_under17:         parseInt(r.E_AGE17   || '0', 10) || 0,
        pop_disability:      parseInt(r.E_DISABL  || '0', 10) || 0,
        pop_single_parent:   parseInt(r.E_SNGPNT  || '0', 10) || 0,
        pop_minority:        parseInt(r.E_MINRTY  || '0', 10) || 0,
        pop_no_english:      parseInt(r.E_LIMENG  || '0', 10) || 0,
        housunits_mobile:    parseInt(r.E_MOBILE  || '0', 10) || 0,
        housunits_crowded:   parseInt(r.E_CROWD   || '0', 10) || 0,
        housunits_no_vehicle:parseInt(r.E_NOVEH   || '0', 10) || 0,
        pop_group_quarters:  parseInt(r.E_GROUPQ  || '0', 10) || 0,
        data_year: 2022,
      },
    });
  }

  logger.info(`Inserting ${features.length} SVI tracts (${skipped} skipped)`);
  const inserted = await insertFeatures(db, 'svi', features);
  logger.info(`Inserted ${inserted} SVI features`);
  await db.end();
}

run().catch(err => {
  logger.error('SVI ingest failed:', err.message);
  process.exit(1);
});
