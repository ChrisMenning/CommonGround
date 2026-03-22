/**
 * t2-f01.js — T2: Food Access Gap — Coverage Hole
 *
 * Claim type: CORRELATION
 * Severity:   T2 (2) — Emerging Pattern
 *
 * Trigger: A census tract designated as low-income, low-access (LILA) by
 *          USDA has no SNAP-authorized food retailer within 1 mile (1609m).
 *
 * One alert is created per qualifying tract so each gap can be tracked
 * and closed independently.
 *
 * Scope note: Phase 2 checks SNAP retailers only. When free-fridges and
 * mutual-aid-hub seed scripts land, this signal should also query those
 * layers (see TODO comments below).
 *
 * Sources: USDA Food Access Research Atlas (2019) · USDA SNAP Retailer Locator
 *
 * Trust note: USDA ERS remains operational as of 2026. Food-access data is
 * from 2019 — local conditions may have shifted. SNAP retailer data reflects
 * current USDA listings (updated monthly). Ratings: food-access 4/5,
 * snap-retailers 4/5.
 */
'use strict';
const logger = require('../lib/logger');

module.exports = {
  alertType: 'T2-F01',
  claimType: 'CORRELATION',
  severity: 2,

  async evaluate(db) {
    // Find LILA tracts with no SNAP retailer within 1 mile (1609.34 m).
    // TODO: extend EXISTS check to include free-fridges and mutual-aid-hub
    //       layers once those seed scripts are implemented (Phase 2A).
    const result = await db.query(`
      WITH lila_tracts AS (
        SELECT
          f.geom,
          f.properties->>'geoid'      AS geoid,
          f.properties->>'tract_name' AS tract_name,
          (f.properties->>'pop_total')::int AS pop_total,
          f.properties->>'designation' AS designation
        FROM features f
        JOIN layers l ON l.id = f.layer_id
        WHERE l.slug = 'food-access'
          AND (f.properties->>'lila_flag')::int = 1
      )
      SELECT
        lt.geoid,
        lt.tract_name,
        lt.pop_total,
        lt.designation,
        ST_AsGeoJSON(lt.geom) AS geom_json
      FROM lila_tracts lt
      WHERE NOT EXISTS (
        SELECT 1
        FROM features fp
        JOIN layers lp ON lp.id = fp.layer_id
        WHERE lp.slug = 'snap-retailers'
          AND ST_DWithin(lt.geom::geography, fp.geom::geography, 1609.34)
      )
      ORDER BY lt.geoid
    `);

    if (result.rows.length === 0) return [];

    logger.info(`[T2-F01] ${result.rows.length} LILA tract(s) with no food resource within 1 mile`);

    return result.rows.map(row => ({
      title: `Food Access Gap — ${row.tract_name || row.geoid}`,
      description:
        `Census tract ${row.geoid} (${row.tract_name || 'Brown County'}) is designated as a ` +
        `low-income, low-access (LILA) food desert with no SNAP-authorized retailer within 1 mile. ` +
        `This co-occurs with higher rates of food insecurity in comparable contexts. ` +
        (row.pop_total ? `Estimated tract population: ${row.pop_total.toLocaleString()}. ` : '') +
        `Note: informal food resources (community fridges, food pantries, mutual aid) may exist ` +
        `in this area but are not yet captured in this dataset.`,
      recommendation:
        `Alert food access organizers serving this tract. Identify the nearest SNAP retailer ` +
        `outside the 1-mile gap. This tract is a candidate for a community fridge or sponsored ` +
        `food distribution point. Connect with 211 Wisconsin and mutual aid food networks ` +
        `for current on-the-ground resource status.`,
      caution:
        `LILA designation is based on 2019 USDA data — local conditions may have changed. ` +
        `This signal checks SNAP retailers only; food pantries, community fridges, and mutual ` +
        `aid food programs are not yet integrated. Verify current availability with local ` +
        `knowledge before broadcasting. This is a co-occurrence pattern, not a causal claim.`,
      sources: [
        'USDA Food Access Research Atlas 2019',
        'USDA SNAP Retailer Locator (current)',
      ],
      trigger_conditions: {
        dedupe_key: `T2-F01:${row.geoid}`,
        geoid: row.geoid,
        tract_name: row.tract_name || row.geoid,
        lila_designation: row.designation || 'LILA',
        pop_total: row.pop_total || null,
        food_sources_checked: ['snap-retailers'],
        // TODO: add free-fridges, mutual-aid-hub when available
        search_radius_meters: 1609.34,
        food_resources_within_radius: 0,
        data_caveat: 'food-access data is 2019; SNAP retailer data is current-monthly',
      },
      affected_geom_geojson: row.geom_json,
      expires_in_hours: 168, // 1 week — LILA status changes annually at most
    }));
  },
};
