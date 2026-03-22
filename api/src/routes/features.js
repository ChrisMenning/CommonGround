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
              _id: row.id,
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

// ── // ── Neighborhood Context ─────────────────────────────────────────────────────
// GET /features/neighborhood-context?feature_id=<int>
//
// Returns:
//   infrastructure — point features inside the neighborhood polygon.
//   stats          — area-weighted choropleth indicator averages.
//   demographics   — areal-interpolation population profile (SVI) +
//                    area-weighted economic snapshot (Eviction Lab).
//
// Security: feature_id must belong to neighborhood-assoc; all other IDs → 404.

const NEIGHBORHOOD_STAT_CONFIGS = [
  { slug: 'ejscreen',     property: 'ejscreen_pctile'      },
  { slug: 'svi',          property: 'svi_overall'          },
  { slug: 'hud-chas',     property: 'pct_cost_burdened'    },
  { slug: 'eviction-lab', property: 'eviction_filing_rate' },
];

// Reusable CTE fragment that computes nbhd geom + area once and joins a layer.
function _nbhdIsectCTE(layerSlug) {
  return `
    WITH nbhd AS (
      SELECT geom, ST_Area(geom) AS nbhd_area
      FROM features WHERE id = $1
    ),
    lr AS (
      SELECT id FROM layers WHERE slug = '${layerSlug}' AND active = true LIMIT 1
    ),
    isect AS (
      SELECT f.properties, f.geom,
             ST_Area(ST_Intersection(f.geom, n.geom)) AS isect_area,
             ST_Area(f.geom)                           AS feat_area,
             n.nbhd_area
      FROM features f, nbhd n, lr
      WHERE f.layer_id = lr.id
        AND ST_Intersects(f.geom, n.geom)
        AND ST_Area(ST_Intersection(f.geom, n.geom))
            / NULLIF(n.nbhd_area, 0) > 0.005
    )`;
}

router.get('/neighborhood-context', async (req, res, next) => {
  const featureId = Number.parseInt(req.query.feature_id, 10);
  if (!Number.isFinite(featureId) || featureId <= 0) {
    return res.status(400).json({ error: 'feature_id must be a positive integer' });
  }

  try {
    // Verify the feature belongs to neighborhood-assoc
    const nbhdCheck = await db.query(
      `SELECT f.id
       FROM features f
       JOIN layers l ON l.id = f.layer_id
       WHERE f.id = $1 AND l.slug = 'neighborhood-assoc'
       LIMIT 1`,
      [featureId]
    );
    if (nbhdCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Neighborhood feature not found' });
    }

    // ── Run all queries in parallel ───────────────────────────────────────
    const [infraRes, sviDemogRes, econRes, ...statResults] = await Promise.all([

      // ── Infrastructure: point features within boundary ──────────────────
      db.query(
        `SELECT
           l.slug,
           l.name                                        AS layer_name,
           COALESCE(f.properties->>'name', '(unnamed)')  AS name,
           COALESCE(
             f.properties->>'category_label',
             f.properties->>'amenity'
           )                                             AS category
         FROM features f
         JOIN layers l ON l.id = f.layer_id
         WHERE l.slug IN ('osm-resources', 'fqhc', 'snap-retailers')
           AND l.active = true
           AND f.aggregation_level = 'point'
           AND ST_Contains(
             (SELECT geom FROM features WHERE id = $1),
             f.geom
           )
         ORDER BY l.slug, (f.properties->>'name')
         LIMIT 60`,
        [featureId]
      ),

      // ── SVI population profile (areal interpolation) ────────────────────
      // Counts are scaled by (intersection_area / census_unit_area) to estimate
      // the sub-population of each tract that falls within this neighborhood.
      db.query(
        `${_nbhdIsectCTE('svi')}
         SELECT
           ROUND(SUM((properties->>'pop_total')::int
                 * isect_area / NULLIF(feat_area,0)))::int       AS est_total,
           ROUND(SUM((properties->>'pop_minority')::int
                 * isect_area / NULLIF(feat_area,0)))::int       AS est_minority,
           ROUND(SUM((properties->>'pop_poverty')::int
                 * isect_area / NULLIF(feat_area,0)))::int       AS est_poverty,
           ROUND(SUM((properties->>'pop_under17')::int
                 * isect_area / NULLIF(feat_area,0)))::int       AS est_under17,
           ROUND(SUM((properties->>'pop_65plus')::int
                 * isect_area / NULLIF(feat_area,0)))::int       AS est_65plus,
           ROUND(SUM((properties->>'pop_disability')::int
                 * isect_area / NULLIF(feat_area,0)))::int       AS est_disability,
           ROUND(SUM((properties->>'pop_no_hs_diploma')::int
                 * isect_area / NULLIF(feat_area,0)))::int       AS est_no_hs_diploma,
           ROUND(SUM((properties->>'housunits_no_vehicle')::int
                 * isect_area / NULLIF(feat_area,0)))::int       AS est_no_vehicle_hh,
           ROUND(SUM((properties->>'pop_single_parent')::int
                 * isect_area / NULLIF(feat_area,0)))::int       AS est_single_parent,
           ROUND(SUM((properties->>'pop_unemployed')::int
                 * isect_area / NULLIF(feat_area,0)))::int       AS est_unemployed,
           SUM(isect_area) / NULLIF(MAX(nbhd_area), 0)          AS coverage
         FROM isect`,
        [featureId]
      ),

      // ── Eviction Lab economic snapshot (area-weighted averages) ──────────
      db.query(
        `${_nbhdIsectCTE('eviction-lab')}
         SELECT
           SUM(CASE WHEN (properties->>'median_household_income')::float > 0
                 THEN (properties->>'median_household_income')::float * isect_area ELSE 0 END)
             / NULLIF(SUM(CASE WHEN (properties->>'median_household_income')::float > 0
                 THEN isect_area ELSE 0 END), 0)                  AS median_income,
           SUM(CASE WHEN (properties->>'median_gross_rent')::float > 0
                 THEN (properties->>'median_gross_rent')::float * isect_area ELSE 0 END)
             / NULLIF(SUM(CASE WHEN (properties->>'median_gross_rent')::float > 0
                 THEN isect_area ELSE 0 END), 0)                  AS median_rent,
           SUM((properties->>'pct_renter_occupied')::float * isect_area)
             / NULLIF(SUM(isect_area), 0)                         AS pct_renter,
           SUM((properties->>'pct_poverty')::float * isect_area)
             / NULLIF(SUM(isect_area), 0)                         AS pct_poverty,
           SUM((properties->>'rent_burden')::float * isect_area)
             / NULLIF(SUM(isect_area), 0)                         AS rent_burden,
           SUM(isect_area) / NULLIF(MAX(nbhd_area), 0)            AS coverage
         FROM isect`,
        [featureId]
      ),

      // ── Choropleth stats (existing 4 indicators, now parallelised) ───────
      ...NEIGHBORHOOD_STAT_CONFIGS.map(cfg =>
        db.query(
          `WITH nbhd AS (
             SELECT geom, ST_Area(geom) AS nbhd_area
             FROM features WHERE id = $1
           ),
           layer_row AS (
             SELECT id FROM layers WHERE slug = $2 AND active = true LIMIT 1
           ),
           isect AS (
             SELECT
               (f.properties->>$3)::float               AS val,
               ST_Area(ST_Intersection(f.geom, n.geom)) AS isect_area
             FROM features f, nbhd n, layer_row lr
             WHERE f.layer_id = lr.id
               AND ST_Intersects(f.geom, n.geom)
               AND ST_Area(ST_Intersection(f.geom, n.geom))
                   / NULLIF(n.nbhd_area, 0) > 0.005
           )
           SELECT
             SUM(CASE WHEN val IS NOT NULL AND val >= 0 THEN isect_area ELSE 0 END)
               / NULLIF((SELECT nbhd_area FROM nbhd), 0)          AS coverage,
             SUM(CASE WHEN val IS NOT NULL AND val >= 0 THEN val * isect_area ELSE 0 END)
               / NULLIF(
                   SUM(CASE WHEN val IS NOT NULL AND val >= 0 THEN isect_area ELSE 0 END),
                 0)                                                AS weighted_value
           FROM isect`,
          [featureId, cfg.slug, cfg.property]
        )
      ),
    ]);

    // ── Assemble stats array ──────────────────────────────────────────────
    const stats = [];
    for (let i = 0; i < NEIGHBORHOOD_STAT_CONFIGS.length; i++) {
      const cfg = NEIGHBORHOOD_STAT_CONFIGS[i];
      const row = statResults[i].rows[0];
      if (row && row.weighted_value != null) {
        stats.push({
          slug:     cfg.slug,
          property: cfg.property,
          value:    parseFloat(row.weighted_value),
          coverage: Math.min(1, parseFloat(row.coverage || 0)),
        });
      }
    }

    // ── Assemble demographics block ───────────────────────────────────────
    const demographics = {};

    const dr = sviDemogRes.rows[0];
    if (dr && dr.est_total != null && parseInt(dr.est_total) > 0) {
      demographics.population = {
        source:            'svi',
        source_year:       2022,
        coverage:          Math.min(1, parseFloat(dr.coverage || 0)),
        est_total:         parseInt(dr.est_total),
        est_minority:      parseInt(dr.est_minority      || 0),
        est_poverty:       parseInt(dr.est_poverty       || 0),
        est_under17:       parseInt(dr.est_under17       || 0),
        est_65plus:        parseInt(dr.est_65plus        || 0),
        est_disability:    parseInt(dr.est_disability    || 0),
        est_no_hs_diploma: parseInt(dr.est_no_hs_diploma || 0),
        est_no_vehicle_hh: parseInt(dr.est_no_vehicle_hh || 0),
        est_single_parent: parseInt(dr.est_single_parent || 0),
        est_unemployed:    parseInt(dr.est_unemployed    || 0),
      };
    }

    const er = econRes.rows[0];
    if (er && (er.median_income != null || er.median_rent != null)) {
      demographics.economics = {
        source:      'eviction-lab',
        source_year: 2018,
        coverage:    Math.min(1, parseFloat(er.coverage || 0)),
        median_household_income: er.median_income != null ? Math.round(parseFloat(er.median_income)) : null,
        median_gross_rent:       er.median_rent   != null ? Math.round(parseFloat(er.median_rent))   : null,
        pct_renter:              er.pct_renter    != null ? parseFloat(er.pct_renter)                : null,
        pct_poverty:             er.pct_poverty   != null ? parseFloat(er.pct_poverty)               : null,
        rent_burden:             er.rent_burden   != null ? parseFloat(er.rent_burden)               : null,
      };
    }

    return res.json({
      infrastructure: infraRes.rows,
      stats,
      demographics,
    });
  } catch (err) {
    return next(err);
  }
});
module.exports = router;
