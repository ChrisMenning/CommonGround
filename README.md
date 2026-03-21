# CommonGround

**A map-based, open-source civic community intelligence platform.**

CommonGround layers public data sources to surface actionable insights for mutual aid networks, tenant advocates, neighborhood associations, food access organizers, environmental justice advocates, and community organizers. Built *for* communities, not institutions.

Licensed under **AGPL-3.0**. All modifications must remain open source.

---

## Pilot Geography

Green Bay, Wisconsin / Brown County

---

## What This Is Not

- Not a surveillance tool
- Not a tool for law enforcement or immigration enforcement
- No individual tracking — all data is aggregated to census tract level or above
- No advertising, no engagement optimization, no dark patterns

---

## Tech Stack

| Component | Technology |
|---|---|
| Backend API | Node.js + Express |
| Spatial Database | PostgreSQL + PostGIS |
| Frontend Map | MapLibre GL JS (bundled locally) |
| Data Pipelines | Node.js ingest scripts |
| Deployment | Docker Compose |

---

## Project Structure

```
/api          — Express backend (port 3000)
/frontend     — MapLibre app (port 3001)
/ingest       — Data pipeline scripts
/docs         — Decision log, data registry, architecture notes
/docker       — Docker Compose files
```

---

## Quick Start (Development)

### Prerequisites

- Docker + Docker Compose
- Node.js 20+

### 1. Clone and configure

```bash
git clone https://github.com/your-org/commonground.git
cd commonground
cp api/.env.example api/.env
# Edit api/.env with your database credentials
```

### 2. Start with Docker Compose

```bash
cd docker
docker compose up -d
```

This starts:
- PostgreSQL + PostGIS on port 5432
- CommonGround API on port 3000
- CommonGround frontend on port 3001

### 3. Initialize the database

```bash
docker compose exec api npm run db:init
```

### 4. Run data ingest

```bash
cd ingest
npm install
node run-all.js
```

See `/ingest/README.md` for data source download instructions.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Service health check |
| GET | `/layers` | List all data layers with metadata |
| GET | `/features?layer=X&bbox=W,S,E,N` | GeoJSON features in bounding box |
| GET | `/alerts?bbox=W,S,E,N&severity=X` | Active alerts for area |
| GET | `/weather?lat=X&lon=Y` | NWS conditions + alerts (real-time) |
| POST | `/resources` | Submit a community resource |

---

## Data Sources

All data is aggregated to census tract level minimum. No parcel-level or address-level data is stored.

See `/docs/DATA-REGISTRY.md` for full source documentation including trust ratings and update frequencies.

---

## Alert System

Alerts carry explicit claim types:

- `DOCUMENTED` — primary source evidence of a specific actor/event
- `MECHANISM` — correlation + plausible causal pathway supported by external research
- `CORRELATION` — co-occurrence pattern; language uses "associated with," never "causes"

Every alert popup displays: claim type, data sources, last updated, and epistemic caution.

---

## Design Language

Solarpunk brutalism — warm earth tones, dark theme.

| Color | Hex | Use |
|---|---|---|
| Soil | `#1A1208` | Background |
| Bark | `#2D1F0E` | Panel backgrounds |
| Leaf | `#5A7A32` | Active/selected |
| Sprout | `#7FA843` | Highlights |
| Amber | `#D4A017` | Warnings/alerts |

Typography: Courier New for UI chrome, Georgia for body text.

---

## Phase Status

- **Phase 1 (Months 1–3):** Foundation — working map, static layers, data pipelines. ← *Current*
- **Phase 2 (Months 4–6):** Intelligence — cross-layer signal engine, Tier 1/2 alerts, Stewardship Council.
- **Phase 3 (Months 7–12):** Federation — Docker self-hosting, ActivityPub federation.

---

## Contributing

See `/docs/DECISION-LOG.md` for architectural decisions. All contributions must preserve the core non-negotiables listed above. PRs that add individual-level tracking, advertising, or proprietary dependencies will not be merged.

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE)
