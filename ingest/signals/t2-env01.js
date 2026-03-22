/**
 * t2-env01.js — T2: Environmental Burden + Vulnerability
 *
 * Claim type: MECHANISM
 * Severity:   T2 (2) — Emerging Pattern
 *
 * Trigger: Census tracts that are simultaneously in the top quartile for
 *          EJScreen composite score (ejscreen_pctile ≥ 0.75) AND in the top
 *          quartile for CDC SVI overall score (svi_overall ≥ 0.75).
 *
 * This is a MECHANISM claim, not CORRELATION. The causal pathway is
 * structurally documented: populations with the least economic and social
 * capacity to avoid, respond to, or recover from environmental harm are
 * disproportionately located in areas of concentrated environmental burden.
 * This is not coincidence. Do not add hedge language implying coincidence.
 *
 * The signal produces ONE consolidated alert covering all qualifying tracts.
 * The dedupeKey is stable ('T2-ENV01:structural') so the alert is updated
 * in place each evaluation cycle rather than creating duplicate rows.
 *
 * Sources: EPA EJScreen 2024 (archived via EDGI/Harvard Dataverse, block-group level)
 *          CDC SVI 2022 (archived via PEDP/OEDP, tract level)
 *
 * Trust note: Both sources are rated 3/5 for current-conditions use due to
 * federal data program disruptions in 2025. The underlying structural relationship
 * is unlikely to have shifted; archived 2022/2024 data accurately reflects the
 * pattern even if not fully current.
 */
'use strict';
const logger = require('../lib/logger');

module.exports = {
  alertType: 'T2-ENV01',
  claimType: 'MECHANISM',
  severity: 2,

  async evaluate(db) {
    // Find census tracts where:
    //   1. The tract's SVI overall score ≥ 0.75 (top quartile)
    //   2. ≥1 block group within that tract also has ejscreen_pctile ≥ 0.75
    //
    // EJScreen is block-group level; SVI is tract level.
    // Block groups are spatially contained within their parent tract, so we
    // use ST_Intersects to join them (a block group's centroid is always
    // within its parent tract polygon).
    const result = await db.query(`
      WITH svi_high AS (
        SELECT
          f.geom,
          f.properties->>'geoid'      AS tract_geoid,
          (f.properties->>'svi_overall')::float AS svi_score
        FROM features f
        JOIN layers l ON l.id = f.layer_id
        WHERE l.slug = 'svi'
          AND (f.properties->>'svi_overall')::float IS NOT NULL
          AND (f.properties->>'svi_overall')::float >= 0.75
      ),
      ej_high AS (
        SELECT
          f.geom,
          f.properties->>'geoid'         AS bg_geoid,
          (f.properties->>'ejscreen_pctile')::float AS ej_score
        FROM features f
        JOIN layers l ON l.id = f.layer_id
        WHERE l.slug = 'ejscreen'
          AND (f.properties->>'ejscreen_pctile')::float IS NOT NULL
          AND (f.properties->>'ejscreen_pctile')::float >= 0.75
      ),
      qualifying AS (
        SELECT
          s.tract_geoid,
          s.svi_score,
          s.geom AS tract_geom,
          COUNT(e.bg_geoid)             AS qualifying_block_groups,
          ROUND(AVG(e.ej_score)::numeric, 3) AS avg_ej_score,
          ROUND(MAX(e.ej_score)::numeric, 3) AS max_ej_score
        FROM svi_high s
        JOIN ej_high e ON ST_Intersects(s.geom, e.geom)
        GROUP BY s.tract_geoid, s.svi_score, s.geom
      )
      SELECT
        tract_geoid,
        svi_score,
        qualifying_block_groups,
        avg_ej_score,
        max_ej_score,
        ST_AsGeoJSON(tract_geom) AS geom_json
      FROM qualifying
      ORDER BY avg_ej_score DESC, svi_score DESC
    `);

    if (result.rows.length === 0) return [];

    const rows = result.rows;
    const tractGeoids  = rows.map(r => r.tract_geoid);
    const tractCount   = tractGeoids.length;
    const avgEj  = rows.reduce((s, r) => s + parseFloat(r.avg_ej_score), 0) / tractCount;
    const avgSvi = rows.reduce((s, r) => s + parseFloat(r.svi_score),    0) / tractCount;
    const maxEj  = Math.max(...rows.map(r => parseFloat(r.max_ej_score)));
    const totalBgs = rows.reduce((s, r) => s + parseInt(r.qualifying_block_groups, 10), 0);

    logger.info(
      `[T2-ENV01] ${tractCount} tract(s) qualify — avg EJScreen: ` +
      `${(avgEj * 100).toFixed(0)}pct, avg SVI: ${(avgSvi * 100).toFixed(0)}pct`
    );

    // Union all qualifying tract geometries for a single polygon overlay
    const unionRes = await db.query(`
      SELECT ST_AsGeoJSON(ST_Union(f.geom)) AS union_geom
      FROM features f
      JOIN layers l ON l.id = f.layer_id
      WHERE l.slug = 'svi'
        AND f.properties->>'geoid' = ANY($1)
    `, [tractGeoids]);

    const affectedGeomGeojson = unionRes.rows[0]?.union_geom || null;

    return [{
      title: `Environmental Burden + Vulnerability: ${tractCount} Tract${tractCount !== 1 ? 's' : ''}`,
      description:
        `${tractCount} census tract${tractCount !== 1 ? 's' : ''} in Brown County ` +
        `${tractCount !== 1 ? 'are' : 'is'} in the top quartile for both environmental burden ` +
        `(EJScreen composite ≥ 75th percentile) and social vulnerability (SVI ≥ 0.75). ` +
        `Across these tracts: average EJScreen score ${(avgEj * 100).toFixed(0)}th percentile ` +
        `(peak ${(maxEj * 100).toFixed(0)}th), average SVI ${(avgSvi * 100).toFixed(0)}th percentile, ` +
        `${totalBgs} qualifying block group${totalBgs !== 1 ? 's' : ''}. ` +
        `This is a structural pattern. Populations with the least capacity to avoid, respond to, ` +
        `or recover from environmental harm are concentrated in areas of highest environmental ` +
        `burden — a well-documented outcome of decades of racially and economically segregated ` +
        `land use and industrial siting decisions. The co-occurrence is not coincidence.`,
      recommendation:
        `Prioritize these tracts for environmental justice organizing and intervention. ` +
        `Alert environmental health advocates. Surface current AQI data for these areas. ` +
        `Connect community members with monitoring tools and know-your-rights resources ` +
        `regarding nearby pollution sources (check RMP facilities in the EJScreen overlay). ` +
        `Document any active pollution events or permit hearings for community awareness.`,
      caution:
        `EJScreen data is from 2024 (archived from EPA via EDGI following federal data program ` +
        `cuts in 2025); SVI data is from 2022 (archived via PEDP/OEDP). Both sources are rated ` +
        `3/5 for current-conditions use. The structural pattern identified here is unlikely to ` +
        `have reversed given the pace of change in environmental and housing conditions, but ` +
        `local knowledge should be used to validate priority areas. EJScreen is block-group ` +
        `level; SVI is tract level — some variation exists within tracts.`,
      sources: [
        'EPA EJScreen 2024 (archived via EDGI/Harvard Dataverse)',
        'CDC SVI 2022 (archived via PEDP/OEDP)',
      ],
      trigger_conditions: {
        dedupe_key: 'T2-ENV01:structural',
        qualifying_tracts: tractGeoids,
        qualifying_tract_count: tractCount,
        qualifying_block_group_count: totalBgs,
        ej_threshold: 0.75,
        svi_threshold: 0.75,
        avg_ej_score: parseFloat(avgEj.toFixed(3)),
        avg_svi_score: parseFloat(avgSvi.toFixed(3)),
        max_ej_score: parseFloat(maxEj.toFixed(3)),
      },
      affected_geom_geojson: affectedGeomGeojson,
      expires_in_hours: 720, // 30 days — structural conditions change slowly
    }];
  },
};
