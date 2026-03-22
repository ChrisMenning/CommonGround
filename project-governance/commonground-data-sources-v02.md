**CommonGround**

*Data Source Documentation Plan*

v0.2 · March 2026

*This document defines every planned data source for CommonGround. Each
source is evaluated against the Weaponization Test from the Guiding
Principles. Trust ratings use a 5-point scale: (1) unverified
self-report, (2) community-verified, (3) institutional open data, (4)
government primary source, (5) government primary source with
independent verification. All sources are public. No proprietary data is
used.*

Housing & Displacement

Eviction Lab --- County Filing Data

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  evictionlab.org/data · API available

  **License**       CC BY-NC 4.0

  **Coverage**      US counties; Brown County, WI included

  **Update          Quarterly updates; some counties near-real-time
  frequency**       

  **Format**        CSV, JSON API

  **Trust rating**  4/5 --- Academic primary source, Princeton University

  **Aggregate       Census tract and zip code minimum
  level**           

  **Weaponization   LOW --- aggregate filing counts do not identify
  risk**            individuals; landlords already have this data

  **Mitigation**    Never surface plaintiff names or individual case
                    numbers in UI

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

Eviction filing rates by geography and time period. Core signal for
displacement pressure. Cross-reference with property ownership data to
detect serial filers.

Wisconsin CCAP --- Circuit Court Records

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  wcca.wicourts.gov · Public web interface; no bulk API

  **License**       Public record; scraping governed by WI open records
                    law

  **Coverage**      All Wisconsin counties including Brown County

  **Update          Near real-time (24--48hr lag)
  frequency**       

  **Format**        Web scrape required; structured HTML

  **Trust rating**  5/5 --- Official state court system

  **Aggregate       Aggregate by plaintiff, zip, tract. Never individual
  level**           defendant display.

  **Weaponization   MEDIUM --- plaintiff (landlord) names are useful
  risk**            accountability data; individual defendant data must
                    never surface

  **Mitigation**    Scrape and aggregate plaintiff patterns only.
                    Defendants are never stored or displayed. Legal review
                    required before launch.

  **Phase**         Phase 2 --- requires legal review
  ----------------- ------------------------------------------------------

Wisconsin's public court access system. Enables identification of serial
eviction filers --- a key early warning signal for mass displacement
events. Plaintiff name aggregation is a public accountability function.

HUD CHAS --- Housing Affordability Data

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  huduser.gov/portal/datasets/cp.html

  **License**       Public domain

  **Coverage**      National; census tract level

  **Update          Annual (ACS-based, \~2yr lag)
  frequency**       

  **Format**        CSV

  **Trust rating**  4/5 --- Federal primary source

  **Aggregate       Census tract
  level**           

  **Weaponization   LOW --- aggregate only, no individual data
  risk**            

  **Mitigation**    None required beyond standard aggregate display

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

Comprehensive Housing Affordability Strategy data. Cost burden
percentages, overcrowding rates, substandard housing by income level and
tenure. Baseline layer for housing vulnerability mapping.

HMDA --- Home Mortgage Disclosure Act

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  ffiec.cfpb.gov/data-browser · Bulk download and API

  **License**       Public domain

  **Coverage**      National; census tract level

  **Update          Annual
  frequency**       

  **Format**        CSV, API

  **Trust rating**  4/5 --- Federal primary source (CFPB/FFIEC)

  **Aggregate       Census tract
  level**           

  **Weaponization   LOW --- aggregate lending patterns, no individual
  risk**            borrower data

  **Mitigation**    Display as tract-level denial rate / loan type
                    distributions only. Never surface individual
                    applications.

  **Phase**         Phase 2
  ----------------- ------------------------------------------------------

Federally required mortgage disclosure data. Redlining and
discriminatory lending patterns are demonstrably visible in this dataset
--- but no accessible community tool currently surfaces them at the
neighborhood level. Enables lending pattern analysis by tract, income
bracket, and racial composition. A powerful layer for housing advocacy
and community education.

Brown County Assessor --- Property Tax Delinquency

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  browncountywi.gov/departments/land-information ·
                    Public records

  **License**       Wisconsin public records --- open

  **Coverage**      Brown County parcels

  **Update          Quarterly
  frequency**       

  **Format**        CSV download or records request

  **Trust rating**  4/5 --- County primary source

  **Aggregate       Parcel-level source; display at block group minimum
  level**           

  **Weaponization   LOW-MEDIUM --- delinquency patterns useful for
  risk**            community awareness; individual parcel display could
                    stigmatize owners facing hardship

  **Mitigation**    Display as density/heat only. Never display individual
                    parcel status in UI.

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

Property tax delinquency signals financial stress in a neighborhood and
can precede foreclosure and displacement. Aggregate patterns identify
blocks under pressure before eviction filings begin.

Green Bay Building Permits

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  greenbaywi.gov/permits · Public records portal

  **License**       Public record

  **Coverage**      City of Green Bay

  **Update          Weekly
  frequency**       

  **Format**        Web scrape or records request

  **Trust rating**  4/5 --- Municipal primary source

  **Aggregate       Address-level source; display at block group minimum
  level**           

  **Weaponization   LOW --- permit data is proactively published;
  risk**            renovation permit spikes in affordable neighborhoods
                    are a documented early gentrification signal

  **Mitigation**    Aggregate to block group for display. Flag
                    concentration patterns, not individual addresses.

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

Building permit applications and approvals. Renovation permit spikes in
historically affordable areas are an early indicator of speculative
investment pressure.

Food Access & Security

USDA Food Access Research Atlas

  ----------------- -------------------------------------------------------
  **Field**         Detail

  **Source / URL**  ers.usda.gov/data-products/food-access-research-atlas

  **License**       Public domain

  **Coverage**      National; census tract level

  **Update          Every 5 years (2019 most recent; 2024 pending)
  frequency**       

  **Format**        CSV, shapefile

  **Trust rating**  4/5 --- Federal primary source

  **Aggregate       Census tract
  level**           

  **Weaponization   LOW --- aggregate designation data, no individual
  risk**            records

  **Mitigation**    None required

  **Phase**         Phase 1
  ----------------- -------------------------------------------------------

Defines food desert census tracts based on supermarket access and income
thresholds. Baseline layer for food access mapping. Note significant lag
--- supplement with 211 live data.

211 Wisconsin --- Social Services Directory

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  211wisconsin.communityos.org · API available

  **License**       API terms of service; data is public-interest

  **Coverage**      Wisconsin statewide; strong Brown County coverage

  **Update          Near real-time (provider-updated)
  frequency**       

  **Format**        REST API, JSON

  **Trust rating**  3/5 --- Institutional directory; accuracy depends on
                    provider updates

  **Aggregate       Location-level (food pantry addresses are already
  level**           public)

  **Weaponization   LOW --- service locations are published to help people
  risk**            find them

  **Mitigation**    Verify operational status before display; flag
                    last-confirmed date

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

Live directory of social services including food pantries, meal
programs, SNAP assistance sites. Critical for the community asset layer.
Pair with self-reported status updates from mutual aid groups.

SNAP Retailer Locator

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  fns.usda.gov/snap/retailer-locator · Bulk download
                    available

  **License**       Public domain

  **Coverage**      National

  **Update          Monthly
  frequency**       

  **Format**        CSV

  **Trust rating**  4/5 --- Federal primary source

  **Aggregate       Address-level (retail locations are public)
  level**           

  **Weaponization   LOW
  risk**            

  **Mitigation**    None required

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

All SNAP-authorized retailers. Combined with USDA atlas, enables
identification of areas where official food access has declined
(retailer authorization lapses, store closures).

Environmental & Health

EPA AirNow --- Real-Time AQI

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  airnowapi.org · Free API with registration

  **License**       Public domain

  **Coverage**      National monitoring station network

  **Update          Hourly
  frequency**       

  **Format**        REST API, JSON

  **Trust rating**  5/5 --- Federal monitoring network

  **Aggregate       Station-level (already public infrastructure)
  level**           

  **Weaponization   LOW --- air quality is symmetric information; benefits
  risk**            everyone equally

  **Mitigation**    Include wind direction overlay for full situational
                    picture

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

Real-time air quality index by pollutant. Critical for outdoor event
safety planning and for chronic environmental burden mapping. Wind
direction overlay enables chemical dispersion awareness for assembly
safety.

EPA EJScreen

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  ejscreen.epa.gov · Bulk download and API

  **License**       Public domain

  **Coverage**      National; block group level

  **Update          Annual
  frequency**       

  **Format**        CSV, REST API

  **Trust rating**  5/5 --- Federal environmental justice tool

  **Aggregate       Block group
  level**           

  **Weaponization   LOW --- designed specifically for community
  risk**            environmental justice use

  **Mitigation**    None required

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

EPA's environmental justice screening tool. Composite scores combining
pollution burden (air, water, waste sites, traffic) with demographic
vulnerability. One of the most powerful single layers for identifying
structural harm.

CDC Social Vulnerability Index (SVI)

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  atsdr.cdc.gov/placeandhealth/svi · Download portal

  **License**       Public domain

  **Coverage**      National; census tract level

  **Update          Every 2 years
  frequency**       

  **Format**        CSV, shapefile

  **Trust rating**  5/5 --- Federal primary source

  **Aggregate       Census tract
  level**           

  **Weaponization   LOW
  risk**            

  **Mitigation**    None required

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

Composite vulnerability index across 16 social factors grouped into four
themes: socioeconomic status, household composition, minority
status/language, housing/transportation. Essential for crisis response
prioritization.

CDC PLACES --- Local Health Outcomes

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  cdc.gov/places · Bulk download and API

  **License**       Public domain

  **Coverage**      National; census tract level

  **Update          Annual
  frequency**       

  **Format**        CSV, API

  **Trust rating**  5/5 --- Federal primary source

  **Aggregate       Census tract
  level**           

  **Weaponization   LOW --- aggregate health outcome estimates, no
  risk**            individual records

  **Mitigation**    None required

  **Phase**         Phase 2
  ----------------- ------------------------------------------------------

Tract-level estimates for 40+ health outcomes including asthma,
diabetes, heart disease, mental health, and preventive care. Distinct
from CDC SVI (which measures social vulnerability inputs) --- PLACES
measures health outcome outputs. Correlation between pollution burden
(EJScreen) and poor health outcomes (PLACES) in the same tract is one of
the most compelling layers for environmental justice storytelling and
advocacy.

HRSA --- Federally Qualified Health Centers

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  data.hrsa.gov/tools/shortage-area · API available

  **License**       Public domain

  **Coverage**      National

  **Update          Annual
  frequency**       

  **Format**        CSV, API

  **Trust rating**  4/5 --- Federal primary source

  **Aggregate       Location-level (public facility addresses)
  level**           

  **Weaponization   LOW
  risk**            

  **Mitigation**    None required

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

All FQHCs and look-alikes. Sliding-scale care for uninsured and
underinsured. Critical layer for health access mapping and for assembly
medic team route planning.

OpenFDA --- Adverse Event Reporting

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  open.fda.gov/apis · Free API, no key required for low
                    volume

  **License**       Public domain

  **Coverage**      National

  **Update          Quarterly
  frequency**       

  **Format**        REST API, JSON

  **Trust rating**  4/5 --- Federal primary source (FDA)

  **Aggregate       Aggregate by drug, device, region --- no individual
  level**           patient data in public API

  **Weaponization   LOW --- public safety information designed for
  risk**            consumer awareness

  **Mitigation**    Display aggregated signal patterns only. This is a
                    secondary layer --- flag when adverse event clusters
                    co-occur with high-SVI or healthcare-access-poor
                    tracts.

  **Phase**         Phase 3 --- exploratory
  ----------------- ------------------------------------------------------

Captures medication side effects, medical device failures, and food
safety events reported to the FDA. Public interfaces for this data are
poor. Particularly relevant for communities with limited healthcare
access who lack institutional advocates. A secondary layer for health
equity signal --- most useful when cross-referenced with healthcare
access gaps (HRSA) and health outcome data (CDC PLACES).

FEMA National Flood Hazard Layer

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  msc.fema.gov/portal/availableFloodHazardData · NFHL
                    REST API

  **License**       Public domain

  **Coverage**      National; parcel and floodplain polygon level

  **Update          Ongoing (as flood maps are updated)
  frequency**       

  **Format**        Shapefile, REST API, GeoJSON

  **Trust rating**  4/5 --- Federal primary source

  **Aggregate       Floodplain polygon and census tract
  level**           

  **Weaponization   LOW --- flood risk is symmetric information; benefits
  risk**            communities to know

  **Mitigation**    Aggregate to tract for display. Do not surface
                    individual parcel flood zone designations in a way
                    that could be used for discriminatory lending or
                    insurance purposes.

  **Phase**         Phase 2
  ----------------- ------------------------------------------------------

FEMA's official flood hazard zone designations. Disaster preparedness
infrastructure is deeply fragmented --- connecting flood risk to SVI
overlays, evacuation routes, and mutual aid coverage creates a
community-legible crisis preparedness layer. Particularly relevant in
Brown County given Green Bay's location on the Fox River.
Cross-reference with SVI to identify flood-vulnerable communities that
also lack adaptive capacity.

Civic & Surveillance Infrastructure

OpenStates --- Wisconsin Legislative Data

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  openstates.org/api · Free API

  **License**       CC BY 4.0

  **Coverage**      Wisconsin state legislature

  **Update          Real-time during session
  frequency**       

  **Format**        REST API, JSON

  **Trust rating**  4/5 --- Aggregates official state records

  **Aggregate       N/A --- bill and legislator data
  level**           

  **Weaponization   LOW
  risk**            

  **Mitigation**    None required

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

Bills, votes, legislators, committee assignments. Enables tracking of
legislation affecting housing, food access, environmental protections,
and civil liberties. Pairs with action alerts for public comment
periods.

DeFlock --- ALPR / Surveillance Camera Database

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  deflock.me · CC licensed data export

  **License**       CC BY-SA 4.0

  **Coverage**      Crowdsourced national; growing Green Bay coverage

  **Update          Crowdsourced; irregular
  frequency**       

  **Format**        GeoJSON export

  **Trust rating**  2/5 --- Community-verified crowdsource; accuracy
                    varies

  **Aggregate       Location-level (infrastructure locations are already
  level**           public by nature)

  **Weaponization   LOW --- making existing surveillance infrastructure
  risk**            visible; symmetric information

  **Mitigation**    Display with explicit trust rating and last-verified
                    date. Distinguish between confirmed and unconfirmed
                    reports.

  **Phase**         Phase 2
  ----------------- ------------------------------------------------------

Automated license plate reader locations and other surveillance
infrastructure. Framed as environmental awareness --- the same way one
would want to know about air quality. The infrastructure is already
there; knowing it exists harms no one.

Green Bay Municipal Permits & Agendas

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  greenbaywi.gov/agendas · Public portal

  **License**       Public record

  **Coverage**      City of Green Bay

  **Update          Weekly
  frequency**       

  **Format**        Web scrape

  **Trust rating**  4/5 --- Municipal primary source

  **Aggregate       Event and location level
  level**           

  **Weaponization   LOW
  risk**            

  **Mitigation**    None required

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

Parade permits, special event permits, street closures, zoning variance
applications. Critical for assembly safety layer (approved routes,
adjacent events) and for early detection of rezoning pressure on
affordable housing.

NWS --- National Weather Service

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  api.weather.gov · Free, no key required

  **License**       Public domain

  **Coverage**      National; Green Bay (GRB) forecast office

  **Update          Hourly forecast updates; real-time alerts
  frequency**       

  **Format**        REST API, JSON

  **Trust rating**  5/5 --- Federal primary source

  **Aggregate       N/A
  level**           

  **Weaponization   LOW --- weather is universally symmetric information
  risk**            

  **Mitigation**    None required

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

Real-time conditions, hourly forecasts, severe weather alerts. Critical
for outdoor event planning and assembly safety. Wind speed and direction
overlaid with AQI enables chemical dispersion awareness. Temperature
extremes pair with SVI for heat/cold vulnerability mapping.

Community Assets (Self-Reported)

Mutual Aid Hub Directory

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  mutualaidhub.org · Directory with API

  **License**       CC BY-SA

  **Coverage**      National; Wisconsin groups included

  **Update          Community-updated
  frequency**       

  **Format**        API, CSV

  **Trust rating**  2/5 --- Self-reported; community-verified over time

  **Aggregate       Organization-level (groups choose to be listed)
  level**           

  **Weaponization   LOW --- groups opt in to public listing
  risk**            

  **Mitigation**    Groups control their own listings. Distinguish active
                    from inactive. Never display internal group
                    communications or membership.

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

Directory of active mutual aid groups by geography and focus area. Core
layer for the community asset map. Enables gap analysis: where is there
need but no organized response?

FreeFridges.org / Little Free Pantry

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  freedge.org and littlefreepantry.org · Directories

  **License**       Public listings

  **Coverage**      Crowdsourced national

  **Update          Community-updated
  frequency**       

  **Format**        Web scrape or API

  **Trust rating**  2/5 --- Self-reported

  **Aggregate       Location-level (public by design --- people need to
  level**           find them)

  **Weaponization   LOW
  risk**            

  **Mitigation**    Verify operational status. Allow community status
                    updates (stocked / needs restocking / inactive).

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

Community free refrigerators and food pantries. Critical for food access
gap analysis --- these fill the spaces between institutional food banks.
Real-time status updates from the community are the key feature.

OpenStreetMap --- Community Infrastructure

  ----------------- ------------------------------------------------------
  **Field**         Detail

  **Source / URL**  openstreetmap.org · Overpass API

  **License**       ODbL

  **Coverage**      Global; Green Bay has reasonable coverage

  **Update          Near real-time (community edited)
  frequency**       

  **Format**        Overpass API, GeoJSON

  **Trust rating**  3/5 --- Community-verified; quality varies by area

  **Aggregate       Point and polygon features
  level**           

  **Weaponization   LOW
  risk**            

  **Mitigation**    None required

  **Phase**         Phase 1
  ----------------- ------------------------------------------------------

Community gardens, tool libraries, free little libraries, parks,
clinics, transit stops, sidewalk infrastructure, building footprints.
The geographic backbone of the community asset layer. Also provides
street geometry for route and chokepoint analysis.

Planned Future Sources

The following sources are identified for future phases pending technical
feasibility, legal review, or community governance approval:

-   Property ownership networks and LLC clustering (Brown County
    Register of Deeds --- Phase 2)

-   Sentinel-2 satellite imagery for urban heat island and tree canopy
    analysis (Phase 2)

-   Wisconsin campaign finance database for local election tracking
    (Phase 2)

-   Green Bay Metro Transit GTFS real-time feeds (Phase 1 --- pending
    API access). Note: transit access tooling outside major metros is
    generally poor --- this is a high-value gap to fill.

-   USGS real-time water quality monitoring (Phase 2)

-   Rental listing price tracking for speculative pressure signals
    (Phase 2 --- methodology TBD)

-   ActivityPub-federated community reports from allied
    Mastodon/Fediverse instances (Phase 3)

-   IPUMS Census microdata --- the most underutilized rich public
    dataset in the U.S. Inaccessible without a statistics background; a
    natural-language interface to local Census data could transform how
    community organizations advocate for themselves (Phase 3 ---
    exploratory)

*v0.1: Initial release, March 2026. v0.2: Added HMDA, CDC PLACES,
OpenFDA, FEMA flood hazard, IPUMS note; updated GTFS entry.*
