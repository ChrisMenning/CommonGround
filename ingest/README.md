# CommonGround Data Ingest

## Overview

Ingest scripts populate the PostGIS database with Phase 1 data sources.

Some sources are fetched automatically via API; others require manual CSV downloads due to file size or terms-of-service.

---

## ⚠️ Data Resiliency Notice (Updated March 2026)

Several federal data sources have been removed or made inaccessible following cuts to federal data programs beginning in early 2025. This is one of the core reasons CommonGround exists — to preserve community access to civic data at the local level.

**Current source status:**

| Source | Federal URL | Status | Alternative |
|--------|-------------|--------|-------------|
| EPA EJScreen | epa.gov/ejscreen | ❌ REMOVED | **Auto-downloads** from Harvard Dataverse (EDGI archive) |
| CDC SVI | atsdr.cdc.gov/placeandhealth/svi | ❌ REMOVED | **Auto-downloads** from PEDP GitHub |
| USDA Food Access Atlas | ers.usda.gov | ✅ Still available | — |
| HUD CHAS | huduser.gov/portal/datasets/cp.html | ✅ Still available (updated Dec 2025) | — |
| Eviction Lab | evictionlab.org | ✅ Still available (Princeton University) | — |
| USDA SNAP Retailers | fns.usda.gov/snap/retailer/data | ✅ Still available | ArcGIS API first |
| HRSA FQHCs | data.hrsa.gov | ⚠️ Partial (DNS issues in Docker; auto-downloads CSV instead) | Auto-downloads `Health_Center_Service_Delivery_and_LookAlike_Sites.csv` |
| EPA AirNow | airnowapi.org | ✅ API still working | — |

**Archive resources:**
- [Public Environmental Data Partners (PEDP)](https://screening-tools.com/) — mirrors EPA EJScreen, FEMA tools, and more
- [PEDP EJScreen viewer](https://pedp-ejscreen.azurewebsites.net/) — interactive map (viewer only, not raw data)
- [PEDP CDC/SVI archive](https://screening-tools.com/cdc) — SVI auto-downloaded from their GitHub
- [EDGI/Harvard Dataverse](https://dataverse.harvard.edu/dataverse/edgi) — archived EPA datasets including EJScreen CSV (**requires account approval — may not be accessible**)
- [Data Rescue Project Tracker](https://www.datarescueproject.org/data-rescue-tracker/) — tracks what has/hasn't been archived

---

## Quick Start

```bash
cd ingest
npm install
# Run only auto-fetch scripts (FQHC, OSM, AirNow, SVI):
node run-all.js --skip-manual
```

---

## Manual Download Sources

### 0. HRSA FQHCs (manual fallback)

**Script:** `seeds/fqhc.js`

The script tries the HRSA API automatically. If it fails (DNS or endpoint issues inside Docker), download manually:

1. Download CSV: https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv
2. Save to: `data/raw/fqhc-sites.csv`
3. Run: `node seeds/fqhc.js` (or re-run `node run-all.js --skip-manual`)

### 1. USDA Food Access Research Atlas ✅ Still available

**Script:** `seeds/food-access.js`

USDA ERS is still publishing this data (updated September 2025). The script reads the Excel file directly — no CSV conversion needed.

1. Go to: https://www.ers.usda.gov/data-products/food-access-research-atlas/download-the-data/
2. Download the current version Excel file
3. Save to: `data/raw/` (keep the original filename, e.g. `FoodAccessResearchAtlasData2019.xlsx`)
4. Tract boundaries auto-download — no extra step needed.
5. Run: `node seeds/food-access.js`

The script automatically detects the data sheet inside the Excel file.

### 2. EPA EJScreen ✅ AUTO-DOWNLOADS

**Script:** `seeds/ejscreen.js`

The EPA EJScreen download page (`epa.gov/ejscreen`) was removed in early 2025. The script now
auto-downloads the **EJScreen 2024 block-group CSV** from the EDGI archive on Harvard Dataverse
(publicly accessible — no account required):

```bash
# Just run it — no manual download needed:
docker compose run --rm ingest node seeds/ejscreen.js
```

The script streams the full 437 MB national CSV and writes only Wisconsin block groups (~1 MB)
to disk. Brown County block groups are then loaded into the database.

**Manual fallback (if auto-download fails):**
1. Go to: https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/RLR5AX
2. Download `EJSCREEN_2024_BG_with_AS_CNMI_GU_VI.csv`
3. Filter to WI rows (GEOID starting with `55`) and save to `data/raw/ejscreen.csv`
4. Run: `node seeds/ejscreen.js`

### 3. CDC Social Vulnerability Index ✅ AUTO-DOWNLOADS

**Script:** `seeds/svi.js`

The CDC/ATSDR SVI download page was taken down in early 2025.
The script now auto-downloads from the [PEDP/OEDP archive on GitHub](https://github.com/oedp/cdc-svi/tree/main/2022_data):

```bash
# Just run it — no manual download needed:
docker compose run --rm ingest node seeds/svi.js
```

If auto-download fails, manually download `Wisconsin.csv` from the link above and save as `data/raw/svi-wi.csv`.

### 5. HUD CHAS (Housing Cost Burden) ✅ Still available

**Script:** `seeds/hud-chas.js`

HUD User is still active (updated December 2025 with 2018–2022 ACS data). They now also offer a [free API](https://www.huduser.gov/portal/dataset/chas-api.html) but it only provides county-level data. For tract-level data this script needs the CSV download.

1. Go to: https://www.huduser.gov/portal/datasets/cp.html
2. Click "Data Download" → select: Year = **2018-2022**, Summary Level = **Census Tract**, State = **Wisconsin**
3. Save CSV to: `data/raw/hud-chas-wi.csv`
4. Tract boundaries auto-download — no extra step needed.
5. Run: `node seeds/hud-chas.js`

### 6. Eviction Lab ✅ Still available (Princeton University)

**Script:** `seeds/eviction-lab.js`

Attribution required: CC BY 4.0 — *"Data from The Eviction Lab at Princeton University"*

This data is maintained by Princeton University, not a federal agency, and remains available.
Download requires a (free) email registration.

1. Go to: https://evictionlab.org/get-the-data/
2. Enter your email to access the download
3. Download the national county-level CSV
4. Save to: `data/raw/eviction-lab.csv`
5. County boundaries auto-download — no extra step needed.
6. Run: `node seeds/eviction-lab.js`

### 4. Green Bay Neighborhood Associations ✅ AUTO-FETCHES

**Script:** `seeds/neighborhood-associations.js`

Fetches neighborhood association boundaries from the City of Green Bay GIS server.
52 associations total (34 active, 18 currently inactive/reorganizing). Active
associations display in teal; inactive in gray.

```bash
docker compose run --rm ingest node seeds/neighborhood-associations.js
```

**Extending to other cities/counties:**

Every municipality structures this differently. The script has a top-level
`CONFIG` block — edit these fields to adapt it to another jurisdiction:

| Config key | Description |
|---|---|
| `jurisdiction` | Display name for log messages |
| `api_url` | ArcGIS (or other) query URL for the polygon layer |
| `field_map` | Maps source field names → our property names |
| `active_status_value` | The string in the "status" field that means active |

In a future phase, this configuration will move to a user-editable UI so
each county can manage their own sources without editing code.

**Green Bay data:**
- Service: `https://map.greenbaywi.gov/server/rest/services/CED/NeighborhoodAssociations/MapServer/0`
- ArcGIS item: https://www.arcgis.com/home/item.html?id=be811ada3f9e41d8af200e11f8553413
- Maintained by: City of Green Bay Community & Economic Development Division
- Neighborhoods website: https://gbneighborhoods.org/

---

### 5. SNAP Authorized Retailers ✅ API auto-fetches first**Script:** `seeds/snap-retailers.js`

The script tries the USDA FNS ArcGIS REST API automatically. If the API returns an error, it falls back to a local CSV.

**CSV fallback only (if API fails):**
1. Download: https://www.fns.usda.gov/snap/retailer/data
   - "Store_Locations" CSV
2. Save to: `data/raw/snap-retailers.csv`
3. Run: `node seeds/snap-retailers.js`

---

## Automatic Sources (no manual download)

| Source | Script | Notes |
|---|---|---|
| CDC SVI 2022 | `seeds/svi.js` | **Auto-downloads** from PEDP GitHub archive (CDC site removed 2025) |
| EPA EJScreen 2024 | `seeds/ejscreen.js` | **Auto-downloads** from Harvard Dataverse (EPA site removed 2025) |
| HRSA FQHCs | `seeds/fqhc.js` | Tries HRSA REST API; falls back to local CSV if DNS fails |
| OSM Community Resources | `seeds/osm-resources.js` | Overpass API |
| AirNow AQI | `seeds/airnow.js` | Requires `AIRNOW_API_KEY` in `api/.env` |
| USDA SNAP Retailers | `seeds/snap-retailers.js` | Tries ArcGIS API; falls back to local CSV |
| Green Bay Neighborhood Associations | `seeds/neighborhood-associations.js` | City of Green Bay GIS (ArcGIS MapServer); auto-runs migration to extend aggregation_level enum |

---

## Data Directory Structure

```
data/
  raw/         — downloaded source files (gitignored)
  processed/   — intermediate outputs (gitignored)
```

---

## Scheduling

For production, run ingest scripts on a schedule:

| Script | Frequency |
|---|---|
| `airnow.js` | Hourly |
| `osm-resources.js` | Weekly |
| `fqhc.js` | Quarterly |
| `snap-retailers.js` | Monthly |
| `neighborhood-associations.js` | Quarterly |
| `eviction-lab.js` | Monthly |
| `food-access.js`, `ejscreen.js`, `svi.js`, `hud-chas.js` | Annually |
