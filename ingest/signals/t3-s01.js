/**
 * t3-s01.js — T3: Assembly Safety Briefing
 *
 * Claim type: DOCUMENTED
 * Severity:   T3 (3) — Situational Awareness
 *
 * BLOCKED: Requires Green Bay building/assembly permit feed.
 * See Phase 2A — ingest/seeds/gb-permits.js (not yet implemented).
 *
 * Trigger (when unblocked):
 *   A permitted public assembly event is scheduled within 48 hours in or
 *   near the current map view area.
 *
 * Briefing components (all from Phase 1 data — no new sources needed once permits land):
 *   - Current weather forecast and NWS alert status (NWS API)
 *   - Current AQI for Brown County (AirNow)
 *   - Nearest FQHC to the event location (FQHC layer)
 *
 * Note: Check whether assembly/event permits are in the same GB open data
 * feed as construction/renovation permits (T2-H01 source). If so, a single
 * gb-permits seed script can serve both signals.
 */
'use strict';

module.exports = {
  alertType: 'T3-S01',
  claimType: 'DOCUMENTED',
  severity: 3,

  async evaluate(/* db */) {
    // BLOCKED — returns empty until gb-permits seed is implemented.
    // When unblocked, implement:
    //   1. Query gb-permits for assembly/event permits within next 48 hours
    //   2. For each permit: fetch NWS forecast + AQI + nearest FQHC
    //   3. Return one briefing alert per upcoming event
    return [];
  },
};
