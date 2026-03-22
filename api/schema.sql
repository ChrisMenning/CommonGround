-- CommonGround database schema
-- Requires PostgreSQL + PostGIS extension
-- Run once via: node src/db-init.js

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- ============================================================
-- layers — each public data source becomes a layer
-- ============================================================
CREATE TABLE IF NOT EXISTS layers (
    id               SERIAL PRIMARY KEY,
    slug             TEXT UNIQUE NOT NULL,
    name             TEXT NOT NULL,
    description      TEXT,
    source           TEXT NOT NULL,
    source_url       TEXT,
    trust_rating     INTEGER CHECK (trust_rating BETWEEN 1 AND 5),
    claim_type       TEXT CHECK (claim_type IN ('CORRELATION', 'MECHANISM', 'DOCUMENTED')),
    update_frequency TEXT,
    aggregation_level TEXT CHECK (aggregation_level IN ('tract', 'block_group', 'zip', 'county', 'point', 'neighborhood')),
    geometry_type    TEXT DEFAULT 'polygon',
    color            TEXT DEFAULT '#7FA843',
    active           BOOLEAN DEFAULT true,
    data_vintage     TEXT,
    parent_slug      TEXT REFERENCES layers(slug),
    is_composite     BOOLEAN DEFAULT false,
    last_updated     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- features — geometries with JSONB properties
-- CRITICAL: geom minimum granularity is census tract.
-- No parcel-level or address-level geometries are permitted.
-- ============================================================
CREATE TABLE IF NOT EXISTS features (
    id                SERIAL PRIMARY KEY,
    layer_id          INTEGER NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
    geom              GEOMETRY(GEOMETRY, 4326) NOT NULL,
    properties        JSONB DEFAULT '{}',
    aggregation_level TEXT CHECK (aggregation_level IN ('tract', 'block_group', 'zip', 'county', 'point', 'neighborhood')),
    last_updated      TIMESTAMPTZ DEFAULT NOW(),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS features_geom_idx     ON features USING GIST(geom);
CREATE INDEX IF NOT EXISTS features_layer_id_idx ON features(layer_id);
CREATE INDEX IF NOT EXISTS features_props_idx    ON features USING GIN(properties);

-- ============================================================
-- alerts — cross-layer signal outputs
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
    id                 SERIAL PRIMARY KEY,
    alert_type         TEXT NOT NULL,
    claim_type         TEXT CHECK (claim_type IN ('CORRELATION', 'MECHANISM', 'DOCUMENTED')) NOT NULL,
    severity           INTEGER CHECK (severity BETWEEN 1 AND 3) NOT NULL,
    title              TEXT NOT NULL,
    description        TEXT,
    trigger_conditions JSONB DEFAULT '{}',
    affected_geom      GEOMETRY(GEOMETRY, 4326),
    recommendation     TEXT,
    caution            TEXT NOT NULL,
    sources            TEXT[] NOT NULL DEFAULT '{}',
    active             BOOLEAN DEFAULT true,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    expires_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS alerts_affected_geom_idx ON alerts USING GIST(affected_geom);
CREATE INDEX IF NOT EXISTS alerts_active_idx        ON alerts(active);
CREATE INDEX IF NOT EXISTS alerts_severity_idx      ON alerts(severity);

-- ============================================================
-- resources — community-submitted locations (Phase 1: write-only)
-- Moderated before becoming visible features
-- ============================================================
CREATE TABLE IF NOT EXISTS resources (
    id           SERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    type         TEXT NOT NULL,
    description  TEXT,
    address      TEXT,
    -- No lat/lon stored at address level; aggregated to block group on ingest
    contact      TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    approved     BOOLEAN DEFAULT false
);

-- ============================================================
-- Phase 1 layer seeds
-- ============================================================
INSERT INTO layers (slug, name, description, source, source_url, trust_rating, claim_type, update_frequency, aggregation_level, geometry_type, color, data_vintage) VALUES
  ('food-access',   'Food Desert Designations',      'USDA low-income, low-access census tracts (LILAs)',            'USDA Food Access Research Atlas', 'https://www.ers.usda.gov/data-products/food-access-research-atlas/', 4, 'DOCUMENTED', 'annual',    'tract',       'polygon', '#D4A017', '2019'),
  ('ejscreen',      'Environmental Burden (EJScreen)', 'EPA pollution burden + demographic vulnerability by block group', 'EPA EJScreen',                   'https://www.epa.gov/ejscreen',                                       5, 'CORRELATION','annual',    'block_group', 'polygon', '#7FA843', '2024'),
  ('svi',           'Social Vulnerability Index',    'CDC 16-factor composite vulnerability score by census tract',  'CDC SVI',                         'https://www.atsdr.cdc.gov/placeandhealth/svi/',                       5, 'CORRELATION','biennial',  'tract',       'polygon', '#5A7A32', '2022'),
  ('fqhc',          'Federally Qualified Health Centers', 'HRSA-funded community health center locations',            'HRSA Data Warehouse',             'https://data.hrsa.gov/topics/health-centers/fqhc',                   4, 'DOCUMENTED', 'quarterly', 'point',       'point',   '#7FA843', 'Current'),
  ('snap-retailers','SNAP Authorized Retailers',     'USDA SNAP-authorized food retailers',                         'USDA SNAP Retailer Locator',      'https://www.fns.usda.gov/snap/retailer-locator',                     4, 'DOCUMENTED', 'monthly',   'point',       'point',   '#D4A017', 'Current'),
  ('airnow',        'Air Quality Index',             'EPA AirNow hourly AQI readings by monitor location',           'EPA AirNow',                       'https://www.airnowapi.org/',                                          5, 'DOCUMENTED', 'hourly',    'point',       'point',   '#5A7A32', 'Real-time'),
  ('hud-chas',      'Housing Cost Burden',           'HUD CHAS households paying >30% or >50% of income on housing', 'HUD CHAS',                        'https://www.huduser.gov/portal/datasets/cp.html',                    4, 'DOCUMENTED', 'annual',    'tract',       'polygon', '#D4A017', '2018–2022'),
  ('eviction-lab',  'Eviction Filing Rate',          'Eviction Lab county-level eviction filing rates',              'Eviction Lab (Princeton)',         'https://evictionlab.org/eviction-tracking/',                         4, 'DOCUMENTED', 'monthly',   'county',      'polygon', '#D4A017', '2016'),
  ('osm-resources', 'Community Infrastructure',      'OpenStreetMap community facilities (parks, libraries, clinics)', 'OpenStreetMap / Overpass API',  'https://overpass-api.de/',                                           3, 'DOCUMENTED', 'weekly',    'point',       'point',   '#7FA843', 'Current'),
  ('neighborhood-assoc', 'Neighborhood Associations', 'City of Green Bay neighborhood association boundaries. Active associations shown in teal; inactive (currently reorganizing) in gray.', 'City of Green Bay GIS', 'https://map.greenbaywi.gov/server/rest/services/CED/NeighborhoodAssociations/MapServer/0', 4, 'DOCUMENTED', 'quarterly', 'neighborhood', 'polygon', '#2196A5', '2024')
ON CONFLICT (slug) DO NOTHING;
