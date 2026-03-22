/**
 * migrate-phase-2.js — Phase 2 database migration
 *
 * Adds the signal_runs audit table introduced in Phase 2.
 * Run once against an existing Phase 1 database:
 *
 *   node api/src/migrate-phase-2.js
 *
 * Safe to run multiple times (uses IF NOT EXISTS).
 * Fresh installs do not need this — api/schema.sql already includes the table.
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

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS signal_runs (
        id          SERIAL PRIMARY KEY,
        alert_type  TEXT NOT NULL,
        run_at      TIMESTAMPTZ DEFAULT NOW(),
        triggered   INTEGER DEFAULT 0,
        expired     INTEGER DEFAULT 0,
        error       TEXT
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS signal_runs_alert_type_idx ON signal_runs(alert_type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS signal_runs_run_at_idx ON signal_runs(run_at)
    `);

    await client.query('COMMIT');
    console.log('[migrate-phase-2] signal_runs table created (or already exists).');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate-phase-2] Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
