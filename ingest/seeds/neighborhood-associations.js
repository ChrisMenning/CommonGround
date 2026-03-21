/**
 * neighborhood-associations.js — Neighborhood association boundary polygons.
 *
 * Currently configured for City of Green Bay, WI using data published by the
 * City's Community & Economic Development (CED) division via their ArcGIS
 * MapServer.  34 of 52 associations are currently active.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * EXTENDING TO OTHER COUNTIES / CITIES
 * ──────────────────────────────────────────────────────────────────────────
 * Edit the CONFIG block below.  Everything else in this script is generic.
 * The key things you will need from your jurisdiction:
 *
 *   1. An ArcGIS Feature/Map Server URL that serves neighborhood polygons
 *      (or any other GIS service — adapt fromApi() accordingly).
 *   2. Field name mappings: your service's columns → our DB properties.
 *   3. The exact string used in the "status" field for active associations.
 *
 * In a future phase, this configuration will move to a user-editable UI.
 *
 * DATA SOURCE (Green Bay):
 *   City of Green Bay GIS — Neighborhood Associations
 *   https://map.greenbaywi.gov/server/rest/services/CED/NeighborhoodAssociations/MapServer/0
 *   Referenced via ArcGIS Web Map: https://www.arcgis.com/home/item.html?id=be811ada3f9e41d8af200e11f8553413
 */
'use strict';
const db     = require('../lib/db');
const logger = require('../lib/logger');
const { fetchJson, insertFeatures } = require('../lib/utils');

// ============================================================
// CONFIGURATION — edit this block for other jurisdictions
// ============================================================
const CONFIG = {
  // Jurisdiction label — used in log messages
  jurisdiction: 'City of Green Bay, WI',

  // ArcGIS query URL.  ?where=1%3D1 means "all features".
  // Swap this entire URL for a different city/county's service.
  api_url:
    'https://map.greenbaywi.gov/server/rest/services/CED/NeighborhoodAssociations/MapServer/0/query'
    + '?where=1%3D1'
    + '&outFields=ID,N_ASSOCIAT,PRESIDENT,E_MAIL_ADD,MEET_PLACE,MEET_DATE_,STATUS'
    + '&f=geojson'
    + '&resultRecordCount=500',

  // Map the source GIS field names → our DB property names.
  // If your service uses different field names, update these.
  field_map: {
    association_id: 'ID',
    name:           'N_ASSOCIAT',
    president:      'PRESIDENT',
    email:          'E_MAIL_ADD',
    meet_place:     'MEET_PLACE',
    meet_schedule:  'MEET_DATE_',
    status:         'STATUS',
  },

  // The value in the "status" field that means an association is active.
  // Used to set the is_active boolean property.
  active_status_value: 'ACTIVE',
};
// ============================================================

async function ensureAggregationLevelEnum(client) {
  // Schema was originally created without 'neighborhood' as a valid
  // aggregation_level value.  This migration is safe to run multiple times.
  for (const table of ['layers', 'features']) {
    const { rows } = await client.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = $1::regclass
         AND contype  = 'c'
         AND conname LIKE '%aggregation_level%'`,
      [table]
    );
    if (rows.length > 0) {
      const name = rows[0].conname;
      // Check whether 'neighborhood' is already in the constraint definition
      const { rows: defRows } = await client.query(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = $1`,
        [name]
      );
      if (defRows[0]?.def?.includes('neighborhood')) continue; // already migrated
      await client.query(`ALTER TABLE ${table} DROP CONSTRAINT "${name}"`);
    }
    await client.query(
      `ALTER TABLE ${table} ADD CONSTRAINT ${table}_aggregation_level_check
         CHECK (aggregation_level IN ('tract','block_group','zip','county','point','neighborhood'))`
    );
    logger.info(`Migrated aggregation_level constraint on ${table}`);
  }
}

async function ensureLayerRecord(client) {
  await client.query(`
    INSERT INTO layers
      (slug, name, description, source, source_url,
       trust_rating, claim_type, update_frequency,
       aggregation_level, geometry_type, color)
    VALUES
      ('neighborhood-assoc',
       'Neighborhood Associations',
       'City of Green Bay neighborhood association boundaries.  Active associations are shown in teal; inactive (currently reorganizing) in gray.',
       'City of Green Bay GIS',
       'https://map.greenbaywi.gov/server/rest/services/CED/NeighborhoodAssociations/MapServer/0',
       4, 'DOCUMENTED', 'quarterly',
       'neighborhood', 'polygon', '#2196A5')
    ON CONFLICT (slug) DO UPDATE SET
      name             = EXCLUDED.name,
      description      = EXCLUDED.description,
      source_url       = EXCLUDED.source_url,
      update_frequency = EXCLUDED.update_frequency,
      color            = EXCLUDED.color,
      last_updated     = NOW()
  `);
}

async function fromApi() {
  const geojson = await fetchJson(CONFIG.api_url);
  if (geojson.error) {
    throw new Error(`ArcGIS error ${geojson.error.code}: ${geojson.error.message}`);
  }

  const fm = CONFIG.field_map;
  const features = [];
  let skipped = 0;

  for (const f of (geojson.features || [])) {
    if (!f.geometry || !f.geometry.coordinates) { skipped++; continue; }
    const p = f.properties;

    features.push({
      geojsonGeometry: f.geometry,
      aggregationLevel: 'neighborhood',
      properties: {
        association_id: p[fm.association_id] ?? null,
        name:           (p[fm.name]          || 'Unknown').trim(),
        president:      (p[fm.president]      || '').trim() || null,
        email:          (p[fm.email]          || '').trim() || null,
        meet_place:     (p[fm.meet_place]     || '').trim() || null,
        meet_schedule:  (p[fm.meet_schedule]  || '').trim() || null,
        status:         (p[fm.status]         || '').trim().toUpperCase(),
        is_active:      (p[fm.status]         || '').trim().toUpperCase() === CONFIG.active_status_value,
        jurisdiction:   CONFIG.jurisdiction,
        source:         'City of Green Bay GIS',
        data_year:      new Date().getFullYear(),
      },
    });
  }

  if (skipped) logger.warn(`Skipped ${skipped} features with missing geometry`);
  return features;
}

async function run() {
  logger.info(`Fetching neighborhood associations for ${CONFIG.jurisdiction}...`);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await ensureAggregationLevelEnum(client);
    await ensureLayerRecord(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const features = await fromApi();
  const active   = features.filter(f => f.properties.is_active).length;
  logger.info(`API returned ${features.length} neighborhoods (${active} active, ${features.length - active} inactive)`);

  if (features.length === 0) {
    logger.warn('No neighborhood association features to insert.');
    await db.end();
    return;
  }

  const inserted = await insertFeatures(db, 'neighborhood-assoc', features);
  logger.info(`Inserted ${inserted} neighborhood association features`);
  await db.end();
}

run().catch(err => {
  logger.error('Neighborhood associations ingest failed:', err.message);
  process.exit(1);
});
