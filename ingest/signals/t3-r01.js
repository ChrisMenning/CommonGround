/**
 * t3-r01.js — T3: Mutual Aid Gap
 *
 * Claim type: CORRELATION
 * Severity:   T3 (3) — Situational Awareness
 *
 * BLOCKED: Requires MutualAidHub integration.
 * See Phase 2A — ingest/seeds/mutual-aid-hub.js (not yet implemented).
 *
 * Trigger (when unblocked):
 *   A census tract with SVI > 0.75 has no active mutual aid resource
 *   within 1.5 miles (combining MutualAidHub + OSM community resources).
 *
 * Data gaps to resolve:
 *   1. Does MutualAidHub have a public machine-readable API or data export?
 *      Check: https://mutualaidhub.org/
 *   2. Trust rating: community-sourced directory — maximum 2/5. Coverage
 *      is highly uneven; gaps may indicate absence from the directory, not
 *      absence of mutual aid activity. Document this limitation explicitly.
 *
 * Implementation path when data lands:
 *   - ST_DWithin join: SVI tracts (svi_overall > 0.75) with no mutual-aid-hub
 *     or food/social osm-resources point within 1.5 miles (2414m)
 *   - One alert per qualifying tract
 */
'use strict';

module.exports = {
  alertType: 'T3-R01',
  claimType: 'CORRELATION',
  severity: 3,

  async evaluate(/* db */) {
    // BLOCKED — returns empty until mutual-aid-hub seed is implemented.
    // When unblocked, implement:
    //   1. Query SVI features with svi_overall > 0.75
    //   2. For each: check if any mutual-aid-hub or relevant osm-resources
    //      point is within 1.5 miles using ST_DWithin
    //   3. Return one alert per qualifying tract with no nearby resource
    return [];
  },
};
