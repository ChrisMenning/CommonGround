'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

const MAX_FEATURES = 5000;

/**
 * Parse and validate a bbox string "W,S,E,N" (lng,lat,lng,lat).
 * Returns { w, s, e, n } or null if invalid.
 */
function parseBbox(bboxStr) {
  if (typeof bboxStr !== 'string') return null;
  const parts = bboxStr.split(',');
  if (parts.length !== 4) return null;
  const [w, s, e, n] = parts.map(Number);
  if ([w, s, e, n].some(isNaN)) return null;
  if (w < -180 || w > 180 || e < -180 || e > 180) return null;
  if (s < -90 || s > 90 || n < -90 || n > 90) return null;
  if (s > n) return null;
  // Prevent unreasonably large bboxes (> ~500km across at mid-latitudes)
  if ((e - w) > 10 || (n - s) > 10) return null;
  return { w, s, e, n };
}

// GET /features?layer=<slug>&bbox=W,S,E,N
router.get('/', async (req, res, next) => {
  const { layer, bbox } = req.query;

  if (!layer || typeof layer !== 'string') {
    return res.status(400).json({ error: 'layer parameter is required' });
  }
  // Validate slug — only alphanumeric and hyphens
  if (!/^[a-z0-9-]+$/.test(layer)) {
    return res.status(400).json({ error: 'Invalid layer slug' });
  }

  try {
    const layerResult = await db.query(
      'SELECT id FROM layers WHERE slug = $1 AND active = true',
      [layer]
    );
    if (layerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Layer not found' });
    }
    const layerId = layerResult.rows[0].id;

    let rows;
    if (bbox) {
      const box = parseBbox(bbox);
      if (!box) return res.status(400).json({ error: 'Invalid bbox — expected W,S,E,N decimal degrees (max 10° span)' });

      const result = await db.query(
        `SELECT id, layer_id,
                ST_AsGeoJSON(geom)::jsonb AS geometry,
                properties, aggregation_level, last_updated
         FROM features
         WHERE layer_id = $1
           AND geom && ST_MakeEnvelope($2, $3, $4, $5, 4326)
         LIMIT $6`,
        [layerId, box.w, box.s, box.e, box.n, MAX_FEATURES]
      );
      rows = result.rows;
    } else {
      const result = await db.query(
        `SELECT id, layer_id,
                ST_AsGeoJSON(geom)::jsonb AS geometry,
                properties, aggregation_level, last_updated
         FROM features
         WHERE layer_id = $1
         LIMIT $2`,
        [layerId, MAX_FEATURES]
      );
      rows = result.rows;
    }

    res.json({
      type: 'FeatureCollection',
      features: rows.map(row => ({
        type: 'Feature',
        geometry: row.geometry,
        properties: {
          ...row.properties,
          _layer: layer,
          _aggregation_level: row.aggregation_level,
          _last_updated: row.last_updated,
        },
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
