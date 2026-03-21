# CommonGround Architecture

**Phase 1 — Foundation**
*Last updated: 2026-03-20*

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
| `layers` | Metadata for each data layer | `slug` unique |
| `features` | Spatial geometries + JSONB properties | Geometry index (GIST), minimum tract granularity |
| `alerts` | Cross-layer signal outputs | Spatial index on `affected_geom` |
| `resources` | Community-submitted locations | `approved = false` until moderated |

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
| `src/routes/features.js` | GET /features (GeoJSON) |
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
| `src/layers.js` | Layer sidebar, feature loading, click popups |
| `src/alerts.js` | Alert sidebar, map markers, detail popup |
| `src/api-client.js` | Fetch wrapper |
| `src/config.js` | Runtime configuration (overridable via window.CG_CONFIG) |
| `build.js` | esbuild bundler + MapLibre vendor copy |

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
  → Click → popup showing properties + claim_type + source + trust_rating
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

## Phase 2 Additions (scoped out of Phase 1)

- Cross-layer signal engine (trigger Tier 1/2 alerts automatically)
- Wisconsin CCAP integration (requires legal review before implementation)
- ActivityPub prototype
- Stewardship Council formation
- User-facing submission moderation UI
