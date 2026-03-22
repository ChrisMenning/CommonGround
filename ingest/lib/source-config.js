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
 *   api_key:         string|null,
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
    api_key: null,
    config_json: {},
  };

  // Env-var key names that take precedence over the DB value.
  const ENV_KEY_MAP = {
    'airnow': 'AIRNOW_API_KEY',
  };

  try {
    const result = await db.query(
      `SELECT enabled, endpoint_url, endpoint_format, status, status_note, api_key, config_json
       FROM source_configs
       WHERE slug = $1 AND municipality = $2
       LIMIT 1`,
      [slug, municipality]
    );
    const row = result.rows.length > 0 ? { ...DEFAULTS, ...result.rows[0] } : { ...DEFAULTS };

    // Env var always wins over DB value
    const envVar = ENV_KEY_MAP[slug];
    if (envVar && process.env[envVar]) row.api_key = process.env[envVar];

    return row;
  } catch (err) {
    if (err.code === '42P01') {
      const envVar = ENV_KEY_MAP[slug];
      const defaults = { ...DEFAULTS };
      if (envVar && process.env[envVar]) defaults.api_key = process.env[envVar];
      return defaults;
    }
    throw err;
  }
}

module.exports = { getSourceConfig };
