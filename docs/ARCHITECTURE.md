# CommonGround Architecture

**Phases 1 + 1.5 — Foundation**
*Last updated: 2026-03-22*

---

## Overview

CommonGround is a three-tier web application:

```
Browser (MapLibre GL JS)
    ↕  REST/JSON
Express API (Node.js)
    ↕  PostGIS SQL
PostgreSQL + PostGIS
```

All components are containerized and self-hostable via Docker Compose.

---

## Component Architecture

### Database: PostgreSQL 16 + PostGIS 3.4

Three tables:

| Table | Purpose | Key constraint |
|---|---|---|
| `layers` | Metadata for each data layer | `slug` unique; `parent_slug` + `is_composite` support Phase 1.5 sub-layers |
| `features` | Spatial geometries + JSONB properties | Geometry index (GIST), minimum tract granularity |
| `alerts` | Cross-layer signal outputs | Spatial index on `affected_geom`; `severity` is INTEGER 1–3 |
| `resources` | Community-submitted locations | `approved = false` until moderated; no lat/lon stored — addresses only |

**Privacy enforcement at the schema level:**
- `features.aggregation_level` is constrained to `(tract, block_group, zip, county, point)`
- No endpoint accepts or returns individual-level data
- The `resources` table stores submitted addresses only for geocoding purposes; approved resources appear as aggregated block-group points in `features`

### API: Node.js + Express

| File | Role |
|---|---|
| `src/index.js` | Server bootstrap, middleware chain |
| `src/db.js` | pg connection pool |
| `src/routes/layers.js` | GET /layers, GET /layers/:slug |
| `src/routes/features.js` | GET /features (GeoJSON by bbox; GET /features?point=lng,lat&layers= for point-query across sub-layers) |
| `src/routes/alerts.js` | GET /alerts |
| `src/routes/weather.js` | GET /weather (NWS proxy) |
| `src/routes/resources.js` | POST /resources |

Security measures:
- Helmet.js security headers with strict CSP
- CORS allowlist (configurable via `CORS_ORIGIN`)
- Rate limiting: 120 req/min per IP
- All SQL uses parameterized queries (`$1`, `$2`, ...)
- Input validation on all user-facing parameters
- Slug validation: `/^[a-z0-9-]+$/` before any DB query
- Bbox validation: coordinate range + max 10° span
- Error handler never leaks stack traces to clients

### Frontend: MapLibre GL JS

| File | Role |
|---|---|
| `src/app.js` | Map initialization, event wiring |
| `src/layers.js` | Layer sidebar (with sub-layer grouping toggle), feature loading, info drawer (right panel for polygon layers), click popups |
| `src/alerts.js` | Alert sidebar, map markers, detail popup |
| `src/weather.js` | Weather panel, NWS conditions + icon display |
| `src/api-client.js` | Fetch wrapper |
| `src/config.js` | Runtime configuration (overridable via window.CG_CONFIG) |
| `src/_icons.js` | Auto-generated icon map (Phosphor SVG strings keyed by resource type) — do not edit manually |
| `build.js` | esbuild bundler + MapLibre vendor copy + Phosphor icon generation (writes `src/_icons.js`) |

**No CDN dependencies:** MapLibre GL JS is copied from `node_modules/maplibre-gl/dist/` to `dist/vendor/` at build time.

**Tile source:** Configurable via `config.tileStyle`. Default: OpenFreeMap liberty style (open-source, no API key). For air-gapped/self-hosted deployments, point to a local Protomaps or OpenMapTiles instance.

---

## Data Flow

### Static layer display

```
User enables layer toggle
  → layers.js calls GET /features?layer=slug&bbox=W,S,E,N
  → features route queries PostGIS with ST_MakeEnvelope
  → Returns GeoJSON FeatureCollection (max 5000 features)
  → MapLibre renders as fill + line layers (polygon) or circle (point)
  → Click on polygon → info drawer (right panel) showing properties + claim_type + source + trust_rating
  → Click on point → popup showing properties + source
```

### Sub-layer proxy query (Phase 1.5)

```
User clicks a census tract on the map
  → layers.js calls GET /features?point=lng,lat&layers=slug1,slug2,...
  → features route queries each sub-layer for that point location
  → Returns combined JSONB properties from all matching sub-layers
  → Info drawer shows cross-layer summary for that tract
```

### Layer grouping (Phase 1.5)

```
User toggles "By Source" / "By Data Type" in sidebar
  → layers.js re-renders sidebar grouping using parent_slug hierarchy
  → Composite parent layers (is_composite = true) show aggregate indicators
  → Sub-layers toggle independently within each group
```

### Weather / real-time

```
GET /weather?lat=X&lon=Y
  → API fetches api.weather.gov/points/{lat},{lon}
  → Resolves forecast URL + alerts URL
  → Parallel fetches forecast + alerts
  → Returns curated JSON (no raw NWS internals)
```

### Alert polling

```
Frontend polls GET /alerts?bbox=W,S,E,N every 5 minutes
  → Sidebar list updated
  → Map markers updated
  → Each alert popup must display: claim_type, sources, caution
```

---

## Non-Negotiables Enforced in Code

| Non-negotiable | Enforcement |
|---|---|
| No individual tracking | features.aggregation_level constrained; no parcel/address endpoints |
| No law enforcement sharing | No auth, no user data, no API for selective access |
| No dark patterns | No tracking scripts; CSP blocks external scripts |
| Claims labeled | Every alert popup renders claim_type badge |
| AGPL-3.0 | LICENSE file; package.json license fields |
| No proprietary deps | MapLibre vendored; tile URL configurable |

---

## Accessibility Standards

All user interfaces — the main map application (`index.html`) and the admin interface (`admin.html`) — must conform to **WCAG 2.2 Level AA** (Web Content Accessibility Guidelines 2.2, W3C Recommendation 5 October 2023).

This is a non-negotiable project requirement. New UI features must be reviewed for accessibility compliance before deployment. Key requirements include:

| Principle | Implementation |
|---|---|
| Keyboard accessible | All interactive elements reachable and operable by keyboard alone |
| Sufficient contrast | Text ≥ 4.5:1, UI components and focus indicators ≥ 3:1 |
| Programmatic labels | All form controls have associated `<label>` elements |
| Live regions | Dynamic status updates announced via `aria-live` |
| Focus management | Modal open/close, panel transitions restore logical focus |
| Skip navigation | Skip-to-main-content link on every page |
| Landmarks | `<main>`, `<nav>`, `<aside>` with labels; visible heading hierarchy |
| Target size | Interactive targets meet 24×24 CSS px minimum (or spacing exception) |

---

## Phase 2 Additions (next)

**Phase 2B — Signal Engine:**
The cross-layer signal engine evaluates alert trigger conditions against live data on a scheduled cadence (initially every 15 minutes for Tier 1, hourly for Tier 2). Architecture:
- `ingest/scheduler.js` extended with alert evaluation jobs
- Each alert type has a trigger function that queries PostGIS across layers
- A new `alerts` write path: evaluated alerts insert/update rows in the `alerts` table
- The existing `GET /alerts` endpoint serves these with no frontend changes needed
- Starting signals: T1-E01 (Severe Weather + High SVI), T2-F01 (Food Access Gap), T2-ENV01 (Environmental Burden + Vulnerability) — all require no new data sources

**Phase 2D — Community Resources:**
- User-facing submission form for community resources
- Admin moderation UI (`src/routes/admin.js` — planned, not yet implemented)
- Approved resources surface as points in the `features` layer

**Phase 2 (remaining):**
- Wisconsin CCAP integration (requires legal review before implementation)
- ActivityPub prototype
- Stewardship Council formation
