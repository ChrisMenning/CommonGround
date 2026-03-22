'use strict';
/**
 * source-config.js — ingest helper for reading admin-configured source settings.
 *
 * Seed scripts call getSourceConfig(slug, municipality) to retrieve the
 * operator-configured endpoint URL, enabled flag, and extra parameters.
 * If no row exists in source_configs, a safe default is returned so seeds
 * remain backward-compatible without a migration being run first.
 *
 * Usage in a seed script:
 *
 *   const { getSourceConfig } = require('../lib/source-config');
 *
 *   const cfg = await getSourceConfig('neighborhood-assoc', 'green-bay');
 *   if (!cfg.enabled) { logger.info('[seed] disabled in admin config — skipping'); return; }
 *   const url = cfg.endpoint_url || DEFAULT_URL;
 *
 * The DB connection pool is imported from the shared ingest lib/db.js so the
 * pool is reused across a run-all batch.
 */
const db = require('./db');

/**
 * Retrieve the admin-configured source settings for a given seed.
 *
 * @param {string} slug         - Seed slug (matches source_configs.slug)
 * @param {string} [municipality=''] - Municipality key or '' for universal
 * @returns {Promise<{
 *   enabled:         boolean,
 *   endpoint_url:    string|null,
 *   endpoint_format: string,
 *   status:          string,
 *   status_note:     string|null,
 *   config_json:     object,
 * }>}
 */
async function getSourceConfig(slug, municipality = '') {
  const DEFAULTS = {
    enabled: true,
    endpoint_url: null,
    endpoint_format: 'json',
    status: 'active',
    status_note: null,
    config_json: {},
  };

  try {
    const result = await db.query(
      `SELECT enabled, endpoint_url, endpoint_format, status, status_note, config_json
       FROM source_configs
       WHERE slug = $1 AND municipality = $2
       LIMIT 1`,
      [slug, municipality]
    );
    if (result.rows.length === 0) return DEFAULTS;
    return { ...DEFAULTS, ...result.rows[0] };
  } catch (err) {
    // If source_configs table doesn't exist (pre-migration), fall back to defaults
    // rather than crashing the ingest run.
    if (err.code === '42P01') return DEFAULTS; // undefined_table
    throw err;
  }
}

module.exports = { getSourceConfig };
