/**
 * mutual-aid.js — Mutual Aid networks for Brown County / Green Bay
 *
 * DATA SOURCES:
 *
 *   1. Mutual Aid Hub (https://www.mutualaidhub.org/)
 *      Published under Public Domain Dedication and License v1.0 (PDDL).
 *      No public API is available — data is served from a private Airtable
 *      backend via WebGL map. Records are manually curated from the map UI
 *      and stored in data/raw/mutual-aid-hub.json.
 *
 *      To update: visit https://www.mutualaidhub.org/, search for Brown County
 *      and Green Bay WI, and update data/raw/mutual-aid-hub.json with any new
 *      or changed listings.
 *
 *      File format: GeoJSON FeatureCollection with the following properties
 *      per feature:
 *        name        (string, required)
 *        description (string, optional)
 *        url         (string, optional)
 *        email       (string, optional)
 *        phone       (string, optional)
 *        categories  (array of strings, optional)
 *        source      "Mutual Aid Hub"
 *
 *   2. organize.directory (https://organize.directory/)
 *      A curated directory of leftist and grassroots activist groups. No API
 *      or machine-readable data is available — groups are fetched at runtime
 *      from their public HTML pages and displayed in the info drawer as a list.
 *      This seed stores a small metadata record (no geometry) used by the
 *      drawer to know which organize.directory URL to fetch.
 *
 * PRIVACY NOTE: All records are at organization/point level (opt-in public
 * listings). No individual tracking or private data is stored.
 *
 * LICENSE (Mutual Aid Hub data): PDDL 1.0 — public domain.
 * Attribution appreciated: https://www.mutualaidhub.org/
 */
'use strict';
const path = require('path');
const fs   = require('fs');
const db     = require('../lib/db');
const logger = require('../lib/logger');
const { insertFeatures } = require('../lib/utils');

const DATA_FILE = path.join(__dirname, '..', 'data', 'raw', 'mutual-aid-hub.json');

async function ensureLayerRecord() {
  await db.query(`
    INSERT INTO layers (slug, name, geometry_type, aggregation_level, source, source_url,
                        data_vintage, trust_rating, claim_type, color, active, description,
                        is_composite)
    VALUES (
      'mutual-aid', 'Mutual Aid Networks', 'point', 'point',
      'Mutual Aid Hub / organize.directory',
      'https://www.mutualaidhub.org/',
      $1, 3, 'DOCUMENTED', '#7FA843', true,
      'Mutual aid networks and grassroots organizing groups in the Green Bay area. Source: Mutual Aid Hub (PDDL 1.0).',
      false
    )
    ON CONFLICT (slug) DO UPDATE SET
      name           = EXCLUDED.name,
      source         = EXCLUDED.source,
      source_url     = EXCLUDED.source_url,
      data_vintage   = EXCLUDED.data_vintage,
      color          = EXCLUDED.color,
      active         = EXCLUDED.active,
      description    = EXCLUDED.description
  `, [new Date().getFullYear()]);
}

async function run() {
  await ensureLayerRecord();

  if (!fs.existsSync(DATA_FILE)) {
    logger.warn(`Mutual Aid Hub data file not found at ${DATA_FILE}`);
    logger.warn('To populate this layer:');
    logger.warn('  1. Visit https://www.mutualaidhub.org/ and search for Green Bay, WI');
    logger.warn('  2. Create data/raw/mutual-aid-hub.json as a GeoJSON FeatureCollection');
    logger.warn('     with point features. Each feature needs properties: name, description,');
    logger.warn('     url, email (optional), phone (optional), categories (optional array).');
    logger.warn('  3. Re-run: node seeds/mutual-aid.js');
    logger.info('Layer record created (active=true). No features inserted yet.');
    await db.end();
    return;
  }

  logger.info(`Reading ${DATA_FILE}...`);
  let geojson;
  try {
    geojson = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    logger.error(`Failed to parse ${DATA_FILE}: ${err.message}`);
    await db.end();
    return;
  }

  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    logger.error('Expected a GeoJSON FeatureCollection in mutual-aid-hub.json');
    await db.end();
    return;
  }

  const features = [];
  let skipped = 0;
  for (const f of geojson.features) {
    if (f.geometry?.type !== 'Point') { skipped++; continue; }
    const [lng, lat] = f.geometry.coordinates;
    if (!isFinite(lng) || !isFinite(lat)) { skipped++; continue; }

    const p = f.properties || {};
    features.push({
      geojsonGeometry: { type: 'Point', coordinates: [lng, lat] },
      aggregationLevel: 'point',
      properties: {
        name:        (p.name || 'Mutual Aid Network').trim(),
        description: p.description || null,
        url:         p.url         || null,
        email:       p.email       || null,
        phone:       p.phone       || null,
        categories:  Array.isArray(p.categories) ? p.categories.join(', ') : (p.categories || null),
        source:      'Mutual Aid Hub',
        attribution: 'Mutual Aid Hub (mutualaidhub.org) — PDDL 1.0',
        data_year:   new Date().getFullYear(),
      },
    });
  }

  if (skipped) logger.warn(`Skipped ${skipped} non-Point or invalid features`);
  logger.info(`Inserting ${features.length} mutual aid network records`);
  const inserted = await insertFeatures(db, 'mutual-aid', features);
  logger.info(`Inserted ${inserted} mutual aid features`);
  await db.end();
}

run().catch(err => {
  logger.error('Mutual aid ingest failed:', err.message);
  process.exit(1);
});
