# CommonGround Data Registry

All data sources, their provenance, trust ratings, update schedules, and coverage status.

**Minimum aggregation level: census tract.** No individual-level data is stored.

---

## Phase 1 Sources

### USDA Food Access Research Atlas
| Field | Value |
|---|---|
| Slug | `food-access` |
| Provider | USDA Economic Research Service |
| URL | https://www.ers.usda.gov/data-products/food-access-research-atlas/ |
| Trust | 4/5 historically; **current: 3/5** |
| Claim type | `DOCUMENTED` |
| Aggregation | Census tract |
| Update frequency | Annual |
| Brown County coverage | ✓ Verified |
| License | Public domain (US government) |
| Ingest script | `ingest/seeds/food-access.js` |
| Manual download | Yes — see ingest/README.md |
| Notes | Primary LILA designation uses 1-mile urban / 10-mile rural threshold. 2019 is latest available as of Phase 1. |
| **Current conditions (2026)** | ERS faced a hiring freeze and publication delays in 2025. The Atlas itself is static (last updated 2019 cycle) — the reliability concern is whether future updates will be funded. Use current data as-is; flag that next update cycle is uncertain. |

---

### EPA EJScreen
| Field | Value |
|---|---|
| Slug | `ejscreen` |
| Provider | US Environmental Protection Agency |
| URL | https://www.epa.gov/ejscreen |
| Trust | 5/5 historically; **current: 3/5** |
| Claim type | `CORRELATION` |
| Aggregation | Block group |
| Update frequency | Annual |
| Brown County coverage | ✓ Verified |
| License | Public domain (US government) |
| Ingest script | `ingest/seeds/ejscreen.js` |
| Manual download | Yes — see ingest/README.md |
| Notes | Percentile rankings are *not* causal claims. EJScreen explicitly states it identifies areas that may warrant further investigation. Displayed as CORRELATION. |
| **Current conditions (2026)** | EPA's Office of Environmental Justice and External Civil Rights was effectively shuttered in early 2025. EJScreen's funding and update cadence are directly threatened by this restructuring. The 2024 dataset currently in use is reliable as a historical snapshot, but future annual updates are not guaranteed and the tool's political mandate has been removed. Alert copy using EJScreen must not imply current EPA endorsement of EJ framing. |

---

### CDC Social Vulnerability Index (SVI)
| Field | Value |
|---|---|
| Slug | `svi` |
| Provider | CDC/ATSDR |
| URL | https://www.atsdr.cdc.gov/placeandhealth/svi/ |
| Trust | 5/5 historically; **current: 3/5** |
| Claim type | `CORRELATION` |
| Aggregation | Census tract |
| Update frequency | Biennial (even years) |
| Brown County coverage | ✓ Verified |
| License | Public domain (US government) |
| Ingest script | `ingest/seeds/svi.js` |
| Manual download | Yes |
| Notes | RPL_THEMES > 0.75 indicates high vulnerability. Composite of 16 social factors across 4 themes. |
| **Current conditions (2026)** | CDC/ATSDR underwent major staffing reductions in 2025, including cuts to the SVI program team. The 2022 SVI dataset in use is a reliable historical snapshot. The next biennial update (2024 data) may be delayed or incomplete due to staffing and mandate changes. For alert copy, describe SVI values as reflecting 2022 conditions; do not imply real-time currency. |

---

### HRSA Federally Qualified Health Centers (FQHCs)
| Field | Value |
|---|---|
| Slug | `fqhc` |
| Provider | HRSA Data Warehouse |
| URL | https://data.hrsa.gov/topics/health-centers/fqhc |
| Trust | 4/5 historically; **current: 3/5** |
| Claim type | `DOCUMENTED` |
| Aggregation | Point |
| Update frequency | Quarterly |
| Brown County coverage | ✓ Verified (API-fetched) |
| License | Public domain (US government) |
| Ingest script | `ingest/seeds/fqhc.js` |
| Manual download | No — API auto-fetch |
| **Current conditions (2026)** | HRSA faced budget pressure in 2025 and the FQHC 330 grant program is under active political scrutiny. Individual FQHCs may have reduced hours, closed satellite sites, or lost funding without the HRSA data warehouse being promptly updated. The database may lag operational reality. Cross-check with facility websites if using for active resource routing. |

---

### USDA SNAP Authorized Retailers
| Field | Value |
|---|---|
| Slug | `snap-retailers` |
| Provider | USDA Food and Nutrition Service |
| URL | https://www.fns.usda.gov/snap/retailer/data |
| Trust | 4/5 historically; **current: 4/5** |
| Claim type | `DOCUMENTED` |
| Aggregation | Point |
| Update frequency | Monthly |
| Brown County coverage | ✓ Verified |
| License | Public domain (US government) |
| Ingest script | `ingest/seeds/snap-retailers.js` |
| Manual download | Yes |
| **Current conditions (2026)** | The retailer authorization database is administrative infrastructure unlikely to be degraded. Trust rating maintained at 4/5. However, SNAP enrollment and benefit levels are under active congressional and executive pressure — the existence of authorized retailers does not guarantee the program's accessibility to community members. Alert copy near this layer should not frame SNAP access as stable without acknowledging program-level risk. |

---

### EPA AirNow
| Field | Value |
|---|---|
| Slug | `airnow` |
| Provider | EPA / AirNow |
| URL | https://www.airnowapi.org/ |
| Trust | 5/5 historically; **current: 4/5** |
| Claim type | `DOCUMENTED` |
| Aggregation | Point (monitoring station) |
| Update frequency | Hourly |
| Brown County coverage | ✓ Verified (Green Bay monitor) |
| License | Public domain (US government) |
| Ingest script | `ingest/seeds/airnow.js` |
| Manual download | No — API auto-fetch (requires free API key) |
| Notes | AQI Category 1–2 = Good/Moderate. 3+ = USG/Unhealthy — triggers alert consideration. |
| **Current conditions (2026)** | Physical monitoring hardware is less vulnerable to political interference than analytical programs. The Green Bay monitoring station is maintained by the Wisconsin DNR and feeds AirNow independently. Trust maintained at 4/5 (down from 5/5 due to EPA QA staffing reductions that affect outlier detection and data validation upstream). Hourly readings remain the most reliable real-time environmental signal in the system. |

---

### HUD CHAS (Housing Cost Burden)
| Field | Value |
|---|---|
| Slug | `hud-chas` |
| Provider | HUD Office of Policy Development and Research |
| URL | https://www.huduser.gov/portal/datasets/cp.html |
| Trust | 4/5 historically; **current: 3/5** |
| Claim type | `DOCUMENTED` |
| Aggregation | Census tract |
| Update frequency | Annual (ACS-based) |
| Brown County coverage | Pending — download required |
| License | Public domain (US government) |
| Ingest script | `ingest/seeds/hud-chas.js` |
| Manual download | Yes — see ingest/README.md |
| **Current conditions (2026)** | HUD's Office of Policy Development and Research faced significant staff reductions in 2025. CHAS data depends on ACS microdata processing by HUD staff; update cadence is at risk. The dataset in use reflects pre-2025 conditions. Use CHAS figures with explicit vintage labeling — cost burden percentages from 2021 ACS data are not current housing market conditions. This matters for alert copy: a household that was cost-burdened in 2021 may be displaced by 2026. |

---

### Eviction Lab
| Field | Value |
|---|---|
| Slug | `eviction-lab` |
| Provider | Princeton Eviction Lab |
| URL | https://evictionlab.org/ |
| Trust | 4/5 |
| Claim type | `DOCUMENTED` |
| Aggregation | County |
| Update frequency | Monthly (COVID Eviction Tracking) |
| Brown County coverage | ✓ (Wisconsin data includes Brown County) |
| License | CC BY 4.0 (must attribute Princeton Eviction Lab) |
| Ingest script | `ingest/seeds/eviction-lab.js` |
| Manual download | Yes — see ingest/README.md |
| Notes | License requires attribution in UI. |
| **Current conditions (2026)** | Princeton Eviction Lab is an academic institution with independent funding; trust rating unchanged at 4/5. It is *more* reliable than federal housing data sources in the current political environment, precisely because it is not subject to federal mandate changes. Preferred over HUD CHAS for current housing stress signals where data overlaps. |

---

### OpenStreetMap (Overpass API)
| Field | Value |
|---|---|
| Slug | `osm-resources` |
| Provider | OpenStreetMap contributors |
| URL | https://www.openstreetmap.org |
| Trust | 3/5 |
| Claim type | `DOCUMENTED` |
| Aggregation | Point |
| Update frequency | Weekly |
| Brown County coverage | ✓ Verified |
| License | ODbL 1.0 — attribution required |
| Ingest script | `ingest/seeds/osm-resources.js` |
| Manual download | No — Overpass API auto-fetch |
| Notes | Map tiles (not data) use ODbL © OpenStreetMap contributors attribution. OSM data quality varies by location and contributor activity. |

---

## Phase 2 Sources (Pending Review)

| Source | Slug | Blocker |
|---|---|---|
| Community Fridges (Wisconsin) | `free-fridges` | No machine-readable API found. WPR article (2026-03-22) is active research lead — see notes below. Fallback: manual admin-trigger entry form. |
| Mutual Aid Hub | `mutual-aid-hub` | Unclear if MutualAidHub has a public API or bulk export. Coverage will be uneven; trust ceiling 2/5. |
| Green Bay Municipal Permits | `gb-permits` | Seed script implemented. Endpoint not yet configured — `data.greenbaywi.gov` is credential-gated; operator must supply ArcGIS token or Open Records file. Layer record auto-inserted on first ingest run. See seed script header for options A/B/C. |
| Wisconsin CCAP (eviction court records) | `ccap` | Legal review required — court record access, re-identification risk |
| DeFlock (ALPR surveillance locations) | `defloc-alpr` | Data availability and terms review |
| HMDA (mortgage lending) | `hmda` | Ingest design |
| FEMA Flood Hazard | `fema-flood` | Integration design |
| CDC PLACES | `cdc-places` | Ingest design |
| Property ownership / LLC networks | — | Legal review — potential re-identification risk |

### Community Fridges — Research Notes

- **WPR article lead (2026-03-22):** https://www.wpr.org/news/community-fridges-wisconsin-fill-growing-need-fresh-produce
  Identify organizations named in the article; check if any maintain a public directory or are open to a data-sharing arrangement for Brown County locations.
- **FreeFridges.net:** Check for a machine-readable endpoint or bulk export for Wisconsin; none confirmed as of 2026-03-22.
- **211 Wisconsin:** Potential fallback directory — fridges may be listed as food resources in their database (already a named fallback in `t1-f01.js`).
- **Trust ceiling:** Community-sourced or organization-reported data. Maximum 3/5; actual rating depends on update cadence of whichever source lands.
- **Claim type:** `DOCUMENTED` (locations are real infrastructure; status self-reported).
- **Ingest stub:** `ingest/seeds/free-fridges.js` (not yet implemented). Signals blocked: T1-F01 (fully), T2-F01 (partial extension).

---

### City of Green Bay Building Permits
| Field | Value |
|---|---|
| Slug | `gb-permits` |
| Provider | City of Green Bay — Community & Economic Development (CED) |
| URL | https://www.greenbaywi.gov/312/Building-Permits-Inspections |
| Trust | 4/5 (when configured) |
| Claim type | `DOCUMENTED` |
| Aggregation | Point |
| Update frequency | Daily (when configured) |
| Brown County coverage | City of Green Bay only |
| License | Public record (Wis. Stats. § 19.35 open records) |
| Ingest script | `ingest/seeds/gb-permits.js` |
| Manual download | No (API) — but endpoint requires operator configuration |
| Signal uses | T2-H01 (renovation pressure trend), T3-S01 (assembly event briefings) |
| Notes | `data.greenbaywi.gov` (ArcGIS Hub) requires organizational login — no public API as of 2026-03-22. Seed script implements three path options: (A) ArcGIS token from a GB org account, (B) Open Records GeoJSON/CSV file, (C) API partnership. Layer record is created automatically on first ingest run; it remains `active=false` until an endpoint is configured and verified. |
| **Current status** | **BLOCKED — endpoint not configured.** To unblock: obtain a Green Bay ArcGIS token or lodge a § 19.35 Open Records request with CED (920-448-3300). Configure endpoint in admin `source_configs` for slug `gb-permits`, municipality `green-bay`. |

---

## Attribution Requirements

| Source | Required attribution |
|---|---|
| OpenStreetMap | © OpenStreetMap contributors |
| Eviction Lab | Data from The Eviction Lab at Princeton University |
| All US government sources | Public domain — no attribution required but source noted in popup |

Attribution for OSM tiles appears in the map's built-in attribution control. Eviction Lab attribution will appear in alert popups and data popups when that layer is active.
