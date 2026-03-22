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

/**
 * Resolve the layer_id to query features for, accounting for sub-layers.
 * Sub-layers have parent_slug set — they share the parent's features rows.
 * Returns { layerId, resolvedSlug } or null if not found.
 */
async function resolveLayerId(slug) {
  const result = await db.query(
    `SELECT l.id, l.slug, p.id AS parent_id, p.slug AS parent_slug_resolved
     FROM layers l
     LEFT JOIN layers p ON p.slug = l.parent_slug
     WHERE l.slug = $1 AND l.active = true`,
    [slug]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  if (row.parent_id) {
    return { layerId: row.parent_id, resolvedSlug: row.parent_slug_resolved };
  }
  return { layerId: row.id, resolvedSlug: row.slug };
}

// GET /features?layer=<slug>&bbox=W,S,E,N
// GET /features?point=lng,lat&layers=slug1,slug2,...  — point-query for info drawer
router.get('/', async (req, res, next) => {
  const { layer, bbox, point, layers } = req.query;

  // ── Point-query mode ─────────────────────────────────────────────────────
  if (point) {
    const parts = point.split(',');
    if (parts.length !== 2) {
      return res.status(400).json({ error: 'point must be "lng,lat"' });
    }
    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (isNaN(lng) || isNaN(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return res.status(400).json({ error: 'Invalid point coordinates' });
    }

    const slugList = typeof layers === 'string'
      ? layers.split(',').map(s => s.trim()).filter(s => /^[a-z0-9-]+$/.test(s)).slice(0, 20)
      : [];
    if (slugList.length === 0) {
      return res.status(400).json({ error: 'layers parameter required for point query' });
    }

    try {
      const results = {};
      for (const slug of slugList) {
        const resolved = await resolveLayerId(slug);
        if (!resolved) continue;

        const { rows } = await db.query(
          `SELECT id,
                  ST_AsGeoJSON(geom)::jsonb AS geometry,
                  properties, aggregation_level, last_updated
           FROM features
           WHERE layer_id = $1
             AND ST_Contains(geom, ST_SetSRID(ST_Point($2, $3), 4326))
           LIMIT 1`,
          [resolved.layerId, lng, lat]
        );
        if (rows.length > 0) {
          const row = rows[0];
          results[slug] = {
            type: 'Feature',
            geometry: row.geometry,
            properties: {
              ...row.properties,
              _layer: slug,
              _aggregation_level: row.aggregation_level,
              _last_updated: row.last_updated,
            },
          };
        }
      }
      return res.json({ type: 'FeatureCollection', features: results });
    } catch (err) {
      return next(err);
    }
  }

  // ── Standard layer+bbox mode ─────────────────────────────────────────────
  if (!layer || typeof layer !== 'string') {
    return res.status(400).json({ error: 'layer parameter is required' });
  }
  if (!/^[a-z0-9-]+$/.test(layer)) {
    return res.status(400).json({ error: 'Invalid layer slug' });
  }

  try {
    const resolved = await resolveLayerId(layer);
    if (!resolved) {
      return res.status(404).json({ error: 'Layer not found' });
    }
    const { layerId } = resolved;

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
