# CommonGround

*Insights Registry & Project Plan*

v0.1 · March 2026

---

# I. Planned Cross-Layer Insights

These are the intelligence products CommonGround aims to generate by combining multiple public data sources. Each insight is a hypothesis about what the data mashup can reveal. All are labeled with their claim type per the Guiding Principles epistemic standards.

## Displacement & Housing

- **[CORRELATION]** Eviction filing rate + renovation permit spike + SNAP enrollment drop in same tract = early displacement pressure signature. Historical precedent in comparable cities suggests 4–8 week lead time before measurable population change.

- **[MECHANISM]** LLC property purchase clustering (Register of Deeds) + Eviction Lab filings by same beneficial owner = speculative landlord network identification. Research on private equity housing establishes the mechanism; local data documents the specific actors.

- **[CORRELATION]** HUD CHAS cost burden + CDC SVI housing theme + CCAP eviction density = composite housing vulnerability score. Higher composite scores predict shelter demand spikes in crisis contexts.

- **[DOCUMENTED]** Single plaintiff filing 5+ evictions in 30 days = serial filer flag. No inference required — this is a documented actor pattern.

## Food Security

- **[CORRELATION]** USDA food desert designation + absence of 211-listed pantries + absence of community fridges within 1mi = food access coverage gap. Gaps cluster near transit deserts, compounding access barriers.

- **[CORRELATION]** SNAP retailer authorization lapses (USDA monthly data) + food desert designation = access deterioration signal. When the one authorized retailer in a food desert loses authorization, the tract's effective access drops to zero.

- **[MECHANISM]** High CDC SVI + food desert designation + severe weather event = compounding food access crisis. Literature on disaster food insecurity establishes the mechanism; data combination identifies the at-risk population.

## Environmental Justice

- **[MECHANISM]** EPA EJScreen top quartile + CDC SVI top quartile = double-burden census tracts. Residents face both elevated pollution exposure and reduced capacity to respond. Environmental justice literature establishes this as a structural harm pattern.

- **[CORRELATION]** Urban heat island intensity (Sentinel-2 NDVI/LST) + absence of tree canopy + high SVI = heat vulnerability map. Low-canopy areas in vulnerable tracts face disproportionate heat stress during extreme weather events.

- **[DOCUMENTED]** EPA AirNow AQI + NWS wind direction = real-time chemical dispersion awareness. This is physics, not inference. Wind direction determines where airborne particulates travel.

## Civic & Surveillance

- **[CORRELATION]** ALPR density (DeFlock) + high-SVI tracts = surveillance burden map. Surveillance infrastructure is not evenly distributed; co-occurrence with vulnerable populations is a documented pattern in comparable cities.

- **[DOCUMENTED]** Open public comment period + housing stress indicators in affected area = civic action window. The proceeding is documented; the vulnerability of the affected area is documented; the combination creates a time-limited organizing opportunity.

- **[CORRELATION]** Polling place change (election data) + transit desert designation + high SVI = voter access barrier signal. Documented in electoral research as a mechanism for disenfranchisement.

## Community Resilience (Asset Layer)

- **[DOCUMENTED]** Mutual aid coverage radius + high-SVI census tracts = coverage map and gap map. The gap is the organizing opportunity.

- **[CORRELATION]** Mutual aid group density + food pantry density + FQHC proximity = community resilience composite. Areas with higher asset density recover faster from shocks in comparable research.

- **[DOCUMENTED]** Self-reported resource status (fridges, pantries, supply drives) + geographic clustering = real-time community capacity map. The most useful layer because it reflects actual community action.

## Assembly & Safety

- **[DOCUMENTED]** NWS wind direction + AQI + permitted assembly location = chemical dispersion awareness briefing. Symmetric public information, presented in a format useful for safety planning.

- **[DOCUMENTED]** FQHC + urgent care + hospital locations + assembly location = medical access briefing. Standard safety information compiled from public sources.

- **[CORRELATION]** Permit route geometry + OSM street network + traffic closures = crowd flow and exit route analysis. Urban design research establishes the relationship between street geometry and crowd movement.

---

# II. Project Plan

## Phase 1: Foundation (Months 1–3)

**Objectives:** Working map with static layers, data pipeline architecture, public repository, Compact published.

- Set up public GitHub repository (AGPL-3.0 license, README, Compact in /docs)
- Stack decision: PostGIS + Node/Express API + MapLibre GL JS frontend (local bundle, no CDN dependency)
- Ingest Phase 1 data sources: USDA Atlas, EPA EJScreen, CDC SVI, NWS API, HUD CHAS, HRSA FQHCs, MutualAidHub, 211 WI, OpenStreetMap via Overpass
- Build aggregate-only data pipeline: all individual-level source records are aggregated before storage; raw data never touches the application database
- Implement trust rating and claim type metadata schema for all layers
- Deploy static alert templates for Tier 3 informational alerts
- Publish decision log (simple markdown file in /docs/decisions)
- Green Bay pilot: verify data coverage for Brown County across all Phase 1 sources

## Phase 2: Intelligence Layer (Months 4–6)

**Objectives:** Cross-layer signal engine, Tier 1 and Tier 2 alerts, legal review for CCAP scraping, Stewardship Council formation begins.

- Build cross-layer signal engine: configurable rules that combine multiple data sources and emit alerts with claim type, confidence, and recommendation
- Implement Eviction Lab + NWS + EJScreen alert triggers (T1-H01, T1-E01, T2-H01, T2-ENV01)
- Begin CCAP scraping research: consult with Wisconsin open records attorney before implementation
- DeFlock data integration (Phase 2 source)
- Self-reported resource layer: simple form for mutual aid groups to register and update status
- Recruit Stewardship Council: 3–5 people with direct community work experience in Green Bay / Fox Valley
- ActivityPub spike: prototype alert publication as ActivityPub objects for Fediverse distribution
- First community feedback session with potential users

## Phase 3: Federation & Sovereignty (Months 7–12)

**Objectives:** Self-hostable instance architecture, Stewardship Council operational, ActivityPub federation between instances.

- Containerize full stack (Docker Compose) for self-hosted deployment
- Write self-hosting documentation: one-page quickstart for a non-developer community org
- Implement ActivityPub federation: instances share alert schema and can subscribe to each other's alert feeds
- Stewardship Council governance: formal veto process documented and operational
- Sentinel-2 satellite data integration for urban heat island layer
- Property ownership network layer: Brown County Register of Deeds + LLC cross-reference
- Second community feedback session; governance review
- Evaluate fiscal sponsorship: approach Open Collective, Code for America, or EFF

---

# III. Claude Executor Prompt

The following prompt is designed to be pasted into a fresh Claude conversation to execute Phase 1 development. It contains the full context needed without requiring access to this conversation history.

---

You are helping build CommonGround, a civic community intelligence platform for mutual aid groups, tenant advocates, neighborhood associations, and community organizers. It is a map-based tool that layers public data sources to surface actionable insights for communities — not institutions.

**CORE PRINCIPLES (non-negotiable):**
- All data is public-source and aggregate-only. No individual tracking. No data sold or shared with law enforcement.
- All correlations are labeled as correlations. Causal claims require primary source evidence. Uncertainty is always named.
- Architecture enforces privacy technically, not just by policy. Raw individual-level records never touch the application database.
- Licensed AGPL-3.0. All modifications must remain open source.
- Designed for self-hosting and federation. No proprietary dependencies.

**TECH STACK:**
- Backend: Node.js + Express + PostGIS (PostgreSQL with spatial extension)
- Frontend: MapLibre GL JS (bundled locally — no CDN dependency)
- Data pipelines: Node.js scripts for ingestion and aggregation
- Deployment target: Docker Compose, self-hostable
- Repository: Public GitHub, AGPL-3.0

**PHASE 1 TASK — build the following:**

**1. PROJECT STRUCTURE**
Create a monorepo with: /api (Express backend), /frontend (MapLibre app), /ingest (data pipeline scripts), /docs (Compact, decision log, data registry), /docker (Compose files)

**2. DATA PIPELINES** — write ingest scripts for these Phase 1 sources:
- USDA Food Access Research Atlas (CSV download, aggregate to tract)
- EPA EJScreen (API or bulk CSV, aggregate to block group)
- CDC Social Vulnerability Index (CSV, aggregate to tract)
- HRSA FQHCs (API, point locations)
- NWS current conditions and alerts (api.weather.gov, no key required)
- MutualAidHub directory (API or scrape)
- OpenStreetMap community assets via Overpass API (food-related, health, community amenities)

Each pipeline must: fetch source data, aggregate to minimum geographic level, strip any individual identifiers, load to PostGIS, log source name + fetch timestamp + record count.

**3. POSTDB SCHEMA**
Tables: layers (layer metadata, trust rating, claim type, update frequency), features (geom, layer_id, properties JSONB, aggregation_level, last_updated), alerts (id, alert_type, claim_type, severity, trigger_conditions JSONB, affected_geom, recommendation, caution, created_at, sources TEXT[])
The schema must make it structurally impossible to store individual-level records — minimum geometry is census tract (not parcel, not address).

**4. API ENDPOINTS**
- `GET /layers` — list all available layers with metadata
- `GET /features?layer=X&bbox=W,S,E,N` — GeoJSON features for a layer within a bounding box
- `GET /alerts?bbox=W,S,E,N&severity=X` — active alerts for an area
- `GET /weather?lat=X&lon=Y` — current NWS conditions and alerts
- `POST /resources` — submit a community resource (mutual aid group, free fridge) — requires basic validation

**5. FRONTEND MAP**
MapLibre GL JS application (single HTML file + bundled JS, no external CDN calls).
Features: layer toggle panel, alert sidebar, map markers with popup details, NWS weather widget, basic search by address.
Design language: solarpunk brutalism — warm earth tones (soil #1A1208, bark #2D1F0E, leaf #5A7A32, sprout #7FA843, amber #D4A017), Courier New for labels and UI chrome, Georgia for body text. Dark theme. Dense but legible information hierarchy.
Every alert and layer popup must display: claim type (CORRELATION / MECHANISM / DOCUMENTED), data sources, last updated, and epistemic caution.

**6. DOCKER COMPOSE**
Services: postgres (with PostGIS extension), api, frontend (nginx), ingest (cron-based). One command to start the full stack locally.

**7. DOCS**
- /docs/COMPACT.md — the CommonGround Community Compact (provided separately)
- /docs/DECISIONS.md — start the decision log with an entry for each architectural choice made during Phase 1
- /docs/DATA-REGISTRY.md — one entry per data source: name, URL, license, trust rating, aggregate level, weaponization risk, mitigation

**WHAT NOT TO BUILD:**
- No user accounts or authentication in Phase 1
- No individual-level data display of any kind
- No external analytics or tracking scripts
- No proprietary map tile providers (use OpenStreetMap/MapLibre default style or build a simple custom style)

Start with the project structure and PostGIS schema. Ask clarifying questions only if a decision would meaningfully affect the architecture. Otherwise proceed with the most privacy-protective and community-aligned interpretation.

---

*Copy everything between the amber borders and paste it into a fresh Claude conversation. The prompt is self-contained — it does not require access to prior conversation history. For Phase 2 execution, a separate prompt will be generated once Phase 1 is complete and the codebase exists as context.*
