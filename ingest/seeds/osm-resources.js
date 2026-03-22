/**
 * osm-resources.js — OpenStreetMap community infrastructure via Overpass API
 *
 * Fetches community-relevant POIs from OSM for Brown County:
 * parks, libraries, community centers, clinics, social services.
 *
 * DATA SOURCE: OpenStreetMap via Overpass API (overpass-api.de)
 * No API key required. Rate limit: be respectful, don't hammer.
 */
'use strict';
const db = require('../lib/db');
const logger = require('../lib/logger');
const { fetchJson, insertFeatures } = require('../lib/utils');

// Overpass QL query — Brown County bounding box [S,W,N,E]
// Fetches community infrastructure amenity types
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const BROWN_COUNTY_BBOX = '44.24,-88.25,44.74,-87.82';

const QUERY = `[out:json][timeout:60];
(
  node["amenity"~"^(community_centre|social_facility|clinic|health_centre|library|food_bank|shelter|place_of_worship|community_fridge)$"](${BROWN_COUNTY_BBOX});
  node["leisure"="park"](${BROWN_COUNTY_BBOX});
  node["shop"="food_bank"](${BROWN_COUNTY_BBOX});
);
out body;`;

async function run() {
  logger.info('Fetching OSM community resources via Overpass API...');

  let data;
  try {
    // Overpass uses POST for queries
    const https = require('https');
    data = await new Promise((resolve, reject) => {
      const body = `data=${encodeURIComponent(QUERY)}`;
      const url = new URL(OVERPASS_URL);
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'CommonGround-Ingest/1.0 (contact@example.org)',
        },
        timeout: 65000,
      }, (res) => {
        let buf = '';
        res.on('data', c => { buf += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(buf)); }
          catch (e) { reject(new Error('Failed to parse Overpass JSON')); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Overpass API timed out')); });
      req.write(body);
      req.end();
    });
  } catch (err) {
    logger.warn(`Overpass fetch failed: ${err.message}`);
    logger.warn('This is usually a transient Overpass API issue. Re-run the ingest to retry.');
    await db.end();
    return;  // graceful degradation — existing OSM data is preserved
  }

  const elements = (data.elements || []).filter(e => e.type === 'node' && e.lat && e.lon);
  logger.info(`Retrieved ${elements.length} OSM nodes`);

  const CATEGORY_LABELS = {
    community_centre: 'Community Center',
    social_facility:  'Social Services',
    clinic:           'Health Clinic',
    health_centre:    'Health Center',
    library:          'Public Library',
    food_bank:        'Food Pantry / Food Bank',
    shelter:          'Emergency Shelter',
    place_of_worship: 'Place of Worship / Community Hub',
    community_fridge: 'Community Fridge',
    park:             'Park',
  };

  const features = elements.map(e => {
    const tags = e.tags || {};
    const amenityKey = tags.amenity || tags.leisure || tags.shop || 'unknown';
    const categoryLabel = CATEGORY_LABELS[amenityKey] || amenityKey;
    return {
      geojsonGeometry: { type: 'Point', coordinates: [e.lon, e.lat] },
      aggregationLevel: 'point',
      properties: {
        osm_id:    e.id,
        name:      tags.name || tags['name:en'] || 'Unknown',
        category_label: categoryLabel,
        amenity:   amenityKey,
        address:   [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' '),
        phone:     tags.phone || tags['contact:phone'] || null,
        website:   tags.website || tags['contact:website'] || null,
        opening_hours: tags.opening_hours || null,
        wheelchair: tags.wheelchair || null,
        source:    'OpenStreetMap',
        osm_timestamp: e.timestamp || null,
      },
    };
  });

  const inserted = await insertFeatures(db, 'osm-resources', features);
  logger.info(`Inserted ${inserted} OSM community resource features`);
  await db.end();
}

run().catch(err => {
  logger.warn('OSM resources ingest failed:', err.message);
  process.exit(0);
});
