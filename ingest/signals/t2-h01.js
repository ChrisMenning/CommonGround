/**
 * t2-h01.js — T2: Compounding Displacement Pressure
 *
 * Claim type: CORRELATION
 * Severity:   T2 (2) — Emerging Pattern
 *
 * BLOCKED: Requires gb-permits seed AND zip-level Eviction Lab data.
 * See Phase 2A — ingest/seeds/gb-permits.js (not yet implemented).
 *
 * Trigger (when unblocked):
 *   Eviction filings up >10% quarter-over-quarter AND renovation permits
 *   up >15% year-over-year in the same zip code.
 *
 * Data gaps to resolve before implementing:
 *   1. Green Bay building permit feed: does the City of GB open data portal
 *      publish renovation/building permits via API or CSV export?
 *      (Same data source as T3-S01 assembly permits — check overlap)
 *   2. Zip-level Eviction Lab data: current ingest is county-level only.
 *      Does Eviction Lab publish zip-code-level rates in their full dataset?
 *
 * Epistemic note:
 *   This is a CORRELATION claim. Both indicators can rise for reasons
 *   unrelated to coordinated displacement. Do not name specific landlords
 *   or properties in this alert unless CCAP plaintiff data (T1-H01)
 *   independently supports it.
 */
'use strict';

module.exports = {
  alertType: 'T2-H01',
  claimType: 'CORRELATION',
  severity: 2,

  async evaluate(/* db */) {
    // BLOCKED — returns empty until gb-permits and zip-level eviction data land.
    // When unblocked, implement:
    //   1. Query gb-permits layer for renovation permit counts by zip, QoQ change
    //   2. Query eviction-lab layer (zip-level) for filing rate change QoQ
    //   3. Find zip codes where BOTH thresholds are exceeded
    //   4. Return one alert per qualifying zip code
    return [];
  },
};
