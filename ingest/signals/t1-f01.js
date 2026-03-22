/**
 * t1-f01.js — T1: Community Fridge Critical Need
 *
 * Claim type: DOCUMENTED
 * Severity:   T1 (1) — Immediate Action
 *
 * BLOCKED: Requires free-fridges or 211 WI data source.
 * See Phase 2A — ingest/seeds/free-fridges.js (not yet implemented).
 *
 * Trigger (when unblocked):
 *   A community fridge operator self-reports 'critical need' status,
 *   OR a fridge has not confirmed stock in 72+ hours.
 *
 * Implementation path:
 *   1. Implement ingest/seeds/free-fridges.js (FreeFridges.net API or 211 WI)
 *   2. Check if FreeFridges.net has a machine-readable endpoint for WI
 *   3. Fallback: manual admin trigger path if no API exists
 *   4. Update evaluate() to query the free-fridges layer
 */
'use strict';

module.exports = {
  alertType: 'T1-F01',
  claimType: 'DOCUMENTED',
  severity: 1,

  async evaluate(/* db */) {
    // BLOCKED — returns empty until free-fridges/211 WI seed is implemented.
    // When unblocked, implement:
    //   1. Query free-fridges layer for entries with status='critical_need'
    //      OR last_confirmed < NOW() - INTERVAL '72 hours'
    //   2. Return one alert per qualifying fridge location
    return [];
  },
};
