/**
 * t3-i01.js — T3: Surveillance Infrastructure Density
 *
 * Claim type: DOCUMENTED
 * Severity:   T3 (3) — Situational Awareness
 *
 * BLOCKED: Requires DeFlock ALPR camera data.
 * See Phase 2A — ingest/seeds/defloc-alpr.js (not yet implemented).
 *
 * Trigger (when unblocked):
 *   An area contains 3+ confirmed ALPR (Automatic License Plate Reader)
 *   cameras within a 0.5-mile radius.
 *
 * Data gaps to resolve:
 *   1. Is DeFlock's ALPR data available via API, bulk download, or scraping?
 *      Check: https://deflock.me/
 *   2. Trust rating: DeFlock is community-sourced — maximum 2/5, likely 1-2/5.
 *      Coverage gaps must be explicitly noted in the alert text.
 *   3. This is a DOCUMENTED claim (known infrastructure locations), not CORRELATION.
 *      The cameras are real. Do not add "security benefits" framing — this is
 *      informational for the surveilled community, not a balanced policy assessment.
 *
 * Frontend note: this alert type may also be triggered on map moveend/bbox change
 * (like layer queries) rather than on a fixed schedule, since it is view-dependent.
 */
'use strict';

module.exports = {
  alertType: 'T3-I01',
  claimType: 'DOCUMENTED',
  severity: 3,

  async evaluate(/* db */) {
    // BLOCKED — returns empty until defloc-alpr seed is implemented.
    // When unblocked, implement:
    //   1. Query defloc-alpr point layer
    //   2. Find clusters of ≥3 cameras within 0.5 mile (804m) using ST_DWithin
    //   3. Return one alert per dense cluster (use cluster centroid as geometry)
    return [];
  },
};
