// BLOCKED: CCAP integration requires legal review before activation.
// See docs/CCAP-LEGAL-REVIEW.md
// This module will return [] until unblocked.
//
// ─────────────────────────────────────────────────────────────────────────────
// T1-H01: Mass Eviction Filing Event
//
// Claim type: DOCUMENTED
// Severity:   T1 (1) — Immediate Action
//
// What this will do when unblocked:
//   Trigger when 5+ eviction filings by the same plaintiff appear in Wisconsin
//   CCAP (Circuit Court Access Program) within a 30-day window in a single
//   building or block. This is a DOCUMENTED claim — the filings are real court
//   records. The pattern is associated with coordinated displacement strategy.
//
// Why it's blocked:
//   Wisconsin Stat. § 758.20 governs CCAP. Automated bulk access to CCAP
//   may conflict with the program's Terms of Service. Legal review is required
//   before implementing any scraper or bulk-access mechanism.
//   See docs/CCAP-LEGAL-REVIEW.md for full analysis and open questions.
//
// Proxy approach while blocked:
//   The Eviction Lab county-level data (already ingested) can surface an
//   elevated eviction baseline for Brown County, but cannot identify specific
//   landlord-plaintiff patterns. Manual admin inserts are the only active
//   path until CCAP is unblocked.
//
// Contacts to resolve the block:
//   - Wisconsin Judicare
//   - ACLU Wisconsin
//   - Legal Action of Wisconsin
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

module.exports = {
  alertType: 'T1-H01',
  claimType: 'DOCUMENTED',
  severity: 1,

  async evaluate(/* db */) {
    // BLOCKED — returns empty until CCAP legal review is complete.
    // When unblocked, implement:
    //   1. Query CCAP for eviction filings in Brown County (last 30 days)
    //   2. Group by plaintiff name
    //   3. Flag any plaintiff with ≥5 filings in a single building or block
    //   4. Return one alert per flagged plaintiff
    return [];
  },
};
