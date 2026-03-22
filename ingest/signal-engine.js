/**
 * signal-engine.js — CommonGround cross-layer alert signal engine
 *
 * Loads all signal modules from ingest/signals/*.js, evaluates them on schedule,
 * upserts the resulting alerts into the alerts table, expires stale alerts, and
 * logs each run to signal_runs.
 *
 * Schedule by tier (matching alert severity):
 *   T1 (severity=1) — every 15 minutes
 *   T2 (severity=2) — every 1 hour
 *   T3 (severity=3) — every 6 hours
 *
 * Usage:
 *   node signal-engine.js           # runs forever (production)
 *   ONCE=1 node signal-engine.js    # evaluate all signals once then exit (CI/test)
 */
'use strict';
require('dotenv').config();
const path = require('path');
const db = require('./lib/db');
const logger = require('./lib/logger');

const RUN_ONCE = process.env.ONCE === '1';

// Interval constants
const FIFTEEN_MIN = 15 * 60 * 1000;
const ONE_HOUR    = 60 * 60 * 1000;
const SIX_HOURS   = 6 * ONE_HOUR;

// Load all signal modules
const SIGNALS_DIR = path.join(__dirname, 'signals');
const SIGNAL_FILES = [
  't1-h01.js',
  't1-e01.js',
  't1-f01.js',
  't2-h01.js',
  't2-f01.js',
  't2-c01.js',
  't2-env01.js',
  't3-s01.js',
  't3-i01.js',
  't3-r01.js',
];

const signals = SIGNAL_FILES.map(file => {
  const mod = require(path.join(SIGNALS_DIR, file));
  logger.info(`[signal-engine] Loaded signal: ${mod.alertType}`);
  return mod;
});

const t1Signals = signals.filter(s => s.severity === 1);
const t2Signals = signals.filter(s => s.severity === 2);
const t3Signals = signals.filter(s => s.severity === 3);

// ── Core upsert logic ─────────────────────────────────────────────────────

/**
 * Upsert a single alert row.
 * Matches existing active alerts by (alert_type, dedupe_key in trigger_conditions).
 * Returns 'inserted' | 'updated'.
 */
async function upsertAlert(module_, alertRow) {
  const { alertType, claimType, severity } = module_;
  const {
    title, description, recommendation, caution, sources,
    trigger_conditions, affected_geom_geojson, expires_in_hours,
  } = alertRow;

  const dedupeKey = trigger_conditions.dedupe_key;
  if (!dedupeKey) throw new Error(`Signal ${alertType} returned alert without trigger_conditions.dedupe_key`);

  const expiresAt = new Date(Date.now() + (expires_in_hours || 24) * 3600 * 1000);

  // Find existing active alert with this dedupe_key
  const existing = await db.query(
    `SELECT id FROM alerts
     WHERE alert_type = $1
       AND active = true
       AND trigger_conditions->>'dedupe_key' = $2
     LIMIT 1`,
    [alertType, dedupeKey]
  );

  if (existing.rows.length > 0) {
    await db.query(
      `UPDATE alerts SET
         title              = $1,
         description        = $2,
         trigger_conditions = $3,
         expires_at         = $4,
         active             = true
       WHERE id = $5`,
      [title, description, JSON.stringify(trigger_conditions), expiresAt, existing.rows[0].id]
    );
    return 'updated';
  }

  // Insert new alert
  if (affected_geom_geojson) {
    await db.query(
      `INSERT INTO alerts
         (alert_type, claim_type, severity, title, description, trigger_conditions,
          affected_geom, recommendation, caution, sources, active, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,
               ST_SetSRID(ST_GeomFromGeoJSON($7),4326),
               $8,$9,$10,true,$11)`,
      [alertType, claimType, severity, title, description,
       JSON.stringify(trigger_conditions), affected_geom_geojson,
       recommendation, caution, sources, expiresAt]
    );
  } else {
    await db.query(
      `INSERT INTO alerts
         (alert_type, claim_type, severity, title, description, trigger_conditions,
          recommendation, caution, sources, active, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)`,
      [alertType, claimType, severity, title, description,
       JSON.stringify(trigger_conditions),
       recommendation, caution, sources, expiresAt]
    );
  }
  return 'inserted';
}

/**
 * Expire any active alerts of this type whose dedupe_key is no longer in the current set.
 * Returns count of expired rows.
 */
async function expireStaleAlerts(alertType, activeDedupeKeys) {
  if (activeDedupeKeys.length === 0) {
    // No active conditions at all — expire everything of this type
    const res = await db.query(
      `UPDATE alerts SET active = false, expires_at = NOW()
       WHERE alert_type = $1 AND active = true`,
      [alertType]
    );
    return res.rowCount;
  }

  // Expire rows whose dedupe_key isn't in the current active set
  const placeholders = activeDedupeKeys.map((_, i) => `$${i + 2}`).join(', ');
  const res = await db.query(
    `UPDATE alerts SET active = false, expires_at = NOW()
     WHERE alert_type = $1
       AND active = true
       AND trigger_conditions->>'dedupe_key' NOT IN (${placeholders})`,
    [alertType, ...activeDedupeKeys]
  );
  return res.rowCount;
}

/**
 * Log a signal run to signal_runs.
 */
async function logRun(alertType, triggered, expired, error) {
  try {
    await db.query(
      `INSERT INTO signal_runs (alert_type, triggered, expired, error)
       VALUES ($1, $2, $3, $4)`,
      [alertType, triggered, expired, error || null]
    );
  } catch (logErr) {
    logger.warn(`[signal-engine] Failed to log run for ${alertType}: ${logErr.message}`);
  }
}

// ── Run a single signal module ────────────────────────────────────────────

async function runSignal(module_) {
  const { alertType } = module_;
  let triggered = 0;
  let expired = 0;
  let errorMsg = null;

  try {
    const alertRows = await module_.evaluate(db);

    const activeDedupeKeys = [];
    for (const alertRow of alertRows) {
      const result = await upsertAlert(module_, alertRow);
      if (result === 'inserted') triggered++;
      activeDedupeKeys.push(alertRow.trigger_conditions.dedupe_key);
    }

    expired = await expireStaleAlerts(alertType, activeDedupeKeys);

    if (triggered > 0 || expired > 0) {
      logger.info(`[signal-engine] ${alertType}: ${triggered} triggered, ${expired} expired`);
    } else {
      logger.debug(`[signal-engine] ${alertType}: no change`);
    }
  } catch (err) {
    errorMsg = err.message;
    logger.warn(`[signal-engine] ${alertType} evaluation failed: ${err.message}`);
  }

  await logRun(alertType, triggered, expired, errorMsg);
}

// ── Run a batch of signals ────────────────────────────────────────────────

async function runBatch(batch, label) {
  logger.info(`[signal-engine] Running ${label} signals (${batch.length})`);
  for (const signal of batch) {
    await runSignal(signal);
  }
}

// ── Startup: run all signals once immediately ─────────────────────────────

async function startup() {
  logger.info('[signal-engine] CommonGround signal engine starting up...');
  logger.info(`[signal-engine] Loaded ${signals.length} signals: ${signals.map(s => s.alertType).join(', ')}`);
  await runBatch(t1Signals, 'T1');
  await runBatch(t2Signals, 'T2');
  await runBatch(t3Signals, 'T3');
  logger.info('[signal-engine] Initial evaluation complete.');

  if (RUN_ONCE) {
    logger.info('[signal-engine] ONCE=1 — exiting after initial run');
    await db.end();
    process.exit(0);
  }
}

// ── Schedule ongoing runs ─────────────────────────────────────────────────

startup().then(() => {
  if (RUN_ONCE) return;

  // T1: every 15 minutes
  setInterval(() => runBatch(t1Signals, 'T1'), FIFTEEN_MIN);
  // T2: every hour
  setInterval(() => runBatch(t2Signals, 'T2'), ONE_HOUR);
  // T3: every 6 hours
  setInterval(() => runBatch(t3Signals, 'T3'), SIX_HOURS);

  logger.info('[signal-engine] Scheduled: T1 every 15m | T2 every 1h | T3 every 6h');
}).catch(err => {
  logger.error('[signal-engine] Startup failed:', err.message);
  process.exit(1);
});
