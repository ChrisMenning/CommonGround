/**
 * t2-c01.js — T2: Civic Action Window
 *
 * Claim type: DOCUMENTED
 * Severity:   T2 (2) — Emerging Pattern
 *
 * BLOCKED: Requires Green Bay municipal portal scraper or OpenStates WI integration.
 * See Phase 2A — ingest/seeds/openstates.js (partially implemented for WI bills).
 *
 * Trigger (when unblocked):
 *   A public comment period opens on a permit or rezoning application in an
 *   area with high social stress (SVI > 0.6). This is a DOCUMENTED claim —
 *   the civic proceeding is a real public record.
 *
 * Data gaps to resolve before implementing:
 *   1. Does Green Bay publish upcoming public hearings/comment periods via API?
 *      Check: https://greenbaywi.gov/agendas (council agendas)
 *             https://greenbaywi.gov/1126/Planning-Commission (planning commission)
 *   2. OpenStates covers WI state legislature — useful for T2-C01 if a rezoning
 *      bill is state-level, but most permit/zoning decisions are municipal.
 *   3. May need to start as a manual admin-only trigger if no machine-readable feed exists.
 *
 * Fallback approach (Phase 2 partial):
 *   Admin inserts a record when a civic window is identified manually.
 *   T2-C01 alert fires from that record rather than automated detection.
 */
'use strict';

module.exports = {
  alertType: 'T2-C01',
  claimType: 'DOCUMENTED',
  severity: 2,

  async evaluate(/* db */) {
    // BLOCKED — returns empty until GB municipal portal integration exists.
    // When unblocked, implement:
    //   1. Query GB permit/hearing feed for open comment periods
    //   2. Spatial join with SVI layer: identify tracts with SVI > 0.6 nearby
    //   3. Return one alert per qualifying civic proceeding
    return [];
  },
};
