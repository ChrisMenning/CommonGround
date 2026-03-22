/**
 * migrate-admin.js — Admin interface database migration
 *
 * Creates the source_configs table used by the admin interface to store
 * per-source configuration overrides (endpoint URLs, enabled/disabled flags,
 * status notes, municipality-specific settings).
 *
 * Run once against an existing database:
 *
 *   node api/src/migrate-admin.js
 *
 * Safe to re-run — uses IF NOT EXISTS and INSERT … DO NOTHING.
 * Fresh installs should use api/schema.sql instead (includes this table).
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'commonground',
  user:     process.env.DB_USER     || 'commonground',
  password: process.env.DB_PASSWORD,
});

// Default seed data — one row per seed script (+ municipality variants).
// municipality = '' means the config applies to all municipalities.
// endpoint_url = null means "use the hardcoded default inside the seed script".
const SEED_CONFIGS = [
  // ── Phase 1 auto-fetch ──────────────────────────────────────────────────
  {
    slug: 'airnow', municipality: '',
    endpoint_url: null, endpoint_format: 'json',
    enabled: true, status: 'active',
    status_note: 'AirNow API. Requires AIRNOW_API_KEY env var. ' +
      'Physical monitoring hardware maintained by WI DNR — reliable even amid EPA staffing cuts.',
  },
  {
    slug: 'fqhc', municipality: '',
    endpoint_url: null, endpoint_format: 'csv',
    enabled: true, status: 'active',
    status_note: 'HRSA CSV auto-downloaded. Falls back to data/raw/fqhc-sites.csv if DNS fails in Docker.',
  },
  {
    slug: 'osm-resources', municipality: '',
    endpoint_url: null, endpoint_format: 'json',
    enabled: true, status: 'active',
    status_note: 'Overpass API, weekly refresh. Trust 3/5 — community-edited.',
  },
  // ── Phase 1 manual-download ─────────────────────────────────────────────
  {
    slug: 'food-access', municipality: '',
    endpoint_url: 'https://www.ers.usda.gov/data-products/food-access-research-atlas/download-the-data/',
    endpoint_format: 'xlsx',
    enabled: true, status: 'active',
    status_note: 'Manual XLSX download required. See ingest/README.md. USDA ERS still publishing as of 2026.',
  },
  {
    slug: 'ejscreen', municipality: '',
    endpoint_url: null, endpoint_format: 'csv',
    enabled: true, status: 'active',
    status_note: 'Auto-downloads from EDGI/Harvard Dataverse archive. Original EPA URL removed early 2025. ' +
      'Update endpoint_url here if archive location changes.',
  },
  {
    slug: 'svi', municipality: '',
    endpoint_url: null, endpoint_format: 'csv',
    enabled: true, status: 'active',
    status_note: 'Auto-downloads from PEDP GitHub archive. Original CDC/ATSDR URL removed 2025. ' +
      'Update endpoint_url here if archive location changes.',
  },
  {
    slug: 'hud-chas', municipality: '',
    endpoint_url: 'https://www.huduser.gov/portal/datasets/cp.html',
    endpoint_format: 'csv',
    enabled: true, status: 'active',
    status_note: 'Manual CSV download required. HUD PD&R staff reductions in 2025 — update cadence at risk.',
  },
  {
    slug: 'eviction-lab', municipality: '',
    endpoint_url: 'https://evictionlab.org/eviction-tracking/',
    endpoint_format: 'csv',
    enabled: true, status: 'active',
    status_note: 'Manual download. Princeton Eviction Lab — academically independent, trust maintained at 4/5.',
  },
  {
    slug: 'snap-retailers', municipality: '',
    endpoint_url: null, endpoint_format: 'arcgis-rest',
    enabled: true, status: 'active',
    status_note: 'USDA SNAP retailer locator. ArcGIS REST API primary, CSV fallback.',
  },
  // ── Municipality-specific: Green Bay ────────────────────────────────────
  {
    slug: 'neighborhood-assoc', municipality: 'green-bay',
    endpoint_url: 'https://map.greenbaywi.gov/server/rest/services/CED/NeighborhoodAssociations/MapServer/0',
    endpoint_format: 'arcgis-rest',
    enabled: true, status: 'active',
    status_note: 'City of Green Bay GIS ArcGIS REST endpoint. Add other municipalities as separate rows.',
    config_json: JSON.stringify({ jurisdiction: 'City of Green Bay, WI' }),
  },
  {
    slug: 'gb-permits', municipality: 'green-bay',
    endpoint_url: null, endpoint_format: 'arcgis-rest',
    enabled: false, status: 'pending',
    status_note: 'BLOCKED: Checking Green Bay open data portal for building/assembly permit feed. ' +
      'Same source expected to serve both T2-H01 (displacement pressure) and T3-S01 (assembly briefing). ' +
      'Check: https://data.greenbaywi.gov/ or https://map.greenbaywi.gov/',
  },
  // ── Phase 2 stubs ────────────────────────────────────────────────────────
  {
    slug: 'free-fridges', municipality: '',
    endpoint_url: null, endpoint_format: 'json',
    enabled: false, status: 'pending',
    status_note: 'BLOCKED: No machine-readable API found as of 2026-03-22. ' +
      'Research lead: WPR article https://www.wpr.org/news/community-fridges-wisconsin-fill-growing-need-fresh-produce — ' +
      'identify orgs named there and check for directories. Fallback: manual admin data entry. ' +
      'Also check FreeFridges.net for WI endpoint and 211 Wisconsin resource database.',
  },
  {
    slug: 'mutual-aid-hub', municipality: '',
    endpoint_url: null, endpoint_format: 'json',
    enabled: false, status: 'pending',
    status_note: 'BLOCKED: Checking MutualAidHub (https://mutualaidhub.org/) for public API or bulk export. ' +
      'Trust ceiling 2/5 — coverage highly uneven; gaps may indicate absence from directory, ' +
      'not absence of mutual aid activity. Document this limitation in alert copy.',
  },
  {
    slug: 'defloc-alpr', municipality: '',
    endpoint_url: null, endpoint_format: 'json',
    enabled: false, status: 'pending',
    status_note: 'BLOCKED: Checking DeFlock (https://deflock.me/) for API, bulk download, or scraping path. ' +
      'Trust ceiling 2/5 — community-sourced. ' +
      'May also be triggered view-area-dependent (on map moveend) rather than on a schedule.',
  },
];

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── source_configs table ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS source_configs (
        id              SERIAL PRIMARY KEY,
        slug            TEXT        NOT NULL,
        municipality    TEXT        NOT NULL DEFAULT '',
        endpoint_url    TEXT,
        endpoint_format TEXT        CHECK (endpoint_format IN ('json','csv','geojson','xlsx','arcgis-rest'))
                                    DEFAULT 'json',
        enabled         BOOLEAN     NOT NULL DEFAULT true,
        status          TEXT        NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active','degraded','blocked','pending')),
        status_note     TEXT,
        api_key         TEXT,
        config_json     JSONB       NOT NULL DEFAULT '{}',
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by      TEXT        NOT NULL DEFAULT 'system',
        UNIQUE(slug, municipality)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS source_configs_slug_idx ON source_configs(slug)
    `);

    // Add api_key column if this is an upgrade from an earlier migration
    await client.query(`
      ALTER TABLE source_configs ADD COLUMN IF NOT EXISTS api_key TEXT
    `);

    // ── Seed defaults (DO NOTHING if row already exists) ──────────────────
    for (const s of SEED_CONFIGS) {
      await client.query(
        `INSERT INTO source_configs
           (slug, municipality, endpoint_url, endpoint_format, enabled, status, status_note, config_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (slug, municipality) DO NOTHING`,
        [
          s.slug,
          s.municipality,
          s.endpoint_url ?? null,
          s.endpoint_format,
          s.enabled,
          s.status,
          s.status_note,
          s.config_json ?? '{}',
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`[migrate-admin] source_configs table ready (${SEED_CONFIGS.length} seed rows).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate-admin] Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
