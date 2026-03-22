# CommonGround Decision Log

Compact log of significant architectural and design decisions.
Format: `[DATE] DECISION — rationale`

---

## 2026-03-22

**[2026-03-22] Epistemic interrogation skill adopted as binding standard** — A formal interrogation method (`project-governance/commonground-epistemic-interrogation/SKILL.md`) is adopted as a binding epistemic standard for all alert copy, trust rating decisions, data assessments, and framing choices in CommonGround. The skill was developed through indirect questioning of Claude that surfaced trained reasoning biases not visible through self-report: false balance applied to asymmetric power relationships, inherited trust ratings that no longer reflect current institutional conditions, and defensive hedging that protects institutional actors at the expense of communities. The five-test checklist (symmetry, institutional deference, hedge direction, recommendation calibration, framing beneficiary) must be applied before any alert copy is finalized or any data source trust rating is assigned. The reference principles document (`references/commonground-principles.md`) operationalizes the Phase 1 claim type taxonomy alongside this framework.

**[2026-03-22] Federal source trust ratings downgraded to reflect 2025-2026 political interference** — EPA EJScreen (5/5 → 3/5), CDC SVI (5/5 → 3/5), USDA Food Access (4/5 → 3/5), HRSA FQHCs (4/5 → 3/5), HUD CHAS (4/5 → 3/5), EPA AirNow (5/5 → 4/5) all have downgraded current-conditions ratings following documented staffing reductions, mandate changes, and program defunding under the current federal administration. USDA SNAP retailer database and Eviction Lab (Princeton) maintain their ratings as the former is administrative infrastructure and the latter is academically independent. All downgraded ratings carry explicit current-conditions notes in `docs/DATA-REGISTRY.md`. The principle: a trust rating is not a permanent property of a source — it is a function of that source's current resourcing, independence, and incentive structure.

---

## 2026-03-20

**[2026-03-20] AGPL-3.0 license chosen** — Ensures all modifications to CommonGround (including network-served modifications) must be published as open source. Prevents proprietary forks from extracting community value without contributing back.

**[2026-03-20] PostGIS for spatial storage** — Native spatial indexing, ST_AsGeoJSON, ST_MakeEnvelope, and the GiST index make bbox queries fast and correct. Alternative (SQLite/SpatiaLite) rejected: insufficient for multi-user concurrent writes and production PostGIS is widely understood.

**[2026-03-20] MapLibre GL JS vendored locally** — No CDN dependency. MapLibre JS + CSS are copied from `node_modules` to `dist/vendor/` at build time. Rationale: CDN dependency is a single point of failure, a potential tracking vector, and incompatible with air-gapped deployments.

**[2026-03-20] No user accounts in Phase 1** — Minimizes attack surface and privacy risk. Phase 1 is read-only (plus community resource submission). Authentication will be scoped carefully in Phase 2 with the minimum necessary claims.

**[2026-03-20] Tile source configurable, not hardcoded** — `config.tileStyle` defaults to OpenFreeMap (open-source, no API key, permissive license) but can be overridden to a self-hosted Protomaps or OpenMapTiles instance. This preserves self-hosting integrity.

**[2026-03-20] Minimum geometry = census tract** — Enforced at schema level. `aggregation_level` column constrained to `(tract, block_group, zip, county, point)`. No parcel, address, or individual-level geometry can enter the database via the defined write paths.

**[2026-03-20] Bbox max 10° span on feature queries** — Prevents accidentally serving the entire national dataset. A 10° span covers roughly 900km × 700km at Wisconsin latitudes — far larger than any reasonable community view, but prevents pathological unbounded queries.

**[2026-03-20] Rate limit: 120 req/min per IP** — Conservative limit that allows heavy legitimate use (a user panning rapidly) while blocking automated scrapers. Configurable via environment variable.

**[2026-03-20] Helmet.js with strict CSP** — Prevents XSS and injection attacks. `scriptSrc: ["'self'"]` ensures no external scripts can be injected. `workerSrc: blob:` is required by MapLibre GL JS for its tile rendering workers.

**[2026-03-20] NWS weather proxied through API, not called from browser** — Keeps the browser CSP strict (no external connect-src needed for NWS). Also allows future caching layer. NWS API has no key requirement; User-Agent header identifies the application as required by their ToS.

**[2026-03-20] Docker containers bind to 127.0.0.1** — Database and API ports bound to loopback interface only. A reverse proxy (nginx, Caddy, Traefik) should be placed in front for public-facing deployments, handling TLS termination.

**[2026-03-20] resources.approved = false by default** — Community-submitted resources require moderation before appearing in features. Prevents spam/abuse. No moderation UI in Phase 1 (manual DB update); Phase 2 will add a lightweight moderation workflow.

**[2026-03-20] Error handler never leaks stack traces** — HTTP 5xx responses return `{ error: "Internal server error" }` only. Stack traces go to server logs (stdout). Matches OWASP A05 Security Misconfiguration best practices.

**[2026-03-20] Brown County / Green Bay as pilot geography** — All ingest scripts filter to Brown County FIPS (55009) or the Green Bay bounding box. This constrains data volume and ensures the pilot is tractable. Scripts are structured to accept state/national data and filter down, so expanding coverage is a configuration change.

**[2026-03-20] AGPL applies to Stewardship Council requirement** — When Phase 3 federation is implemented, each instance operator must make source available to their users per AGPL §13. This is the intended enforcement mechanism.
