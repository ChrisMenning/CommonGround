/**
 * scheduler.js — long-running ingest process for Docker Compose.
 *
 * Runs auto-fetchable seeds on schedule (no manual download required):
 *   - AirNow     — every hour (AQI readings change frequently)
 *   - FQHC       — weekly    (HRSA API, live fetch)
 *   - OSM        — weekly    (Overpass API, live fetch)
 *
 * Manual-download seeds (EJScreen, SVI, food-access, etc.) must be run
 * separately with: node run-all.js (after placing CSV/GeoJSON files in
 * their expected paths per each script's inline documentation).
 *
 * Usage:
 *   node scheduler.js             # production — runs forever
 *   ONCE=1 node scheduler.js      # run all auto seeds once then exit (CI/test)
 */
'use strict';
require('dotenv').config();
const { spawnSync } = require('child_process');
const path = require('path');
const logger = require('./lib/logger');

const ONE_HOUR = 60 * 60 * 1000;
const ONE_WEEK = 7 * 24 * ONE_HOUR;
const RUN_ONCE = process.env.ONCE === '1';

function runScript(name, file) {
  logger.info(`[scheduler] Starting: ${name}`);
  const result = spawnSync('node', [path.join(__dirname, file)], {
    stdio: 'inherit',
    env: { ...process.env },
  });
  if (result.status !== 0) {
    logger.warn(`[scheduler] ${name} exited with status ${result.status}`);
  } else {
    logger.info(`[scheduler] ${name} — done`);
  }
}

// ── AirNow — hourly ────────────────────────────────────────────────────────
function runAirNow() { runScript('AirNow', 'seeds/airnow.js'); }

// ── Weekly live-API seeds ──────────────────────────────────────────────────
function runWeekly() {
  runScript('FQHC (HRSA)',   'seeds/fqhc.js');
  runScript('OSM Resources', 'seeds/osm-resources.js');
}

// Run everything immediately on startup
runAirNow();
runWeekly();

if (RUN_ONCE) {
  logger.info('[scheduler] ONCE=1 — exiting after initial run');
  process.exit(0);
}

// Schedule ongoing runs
setInterval(runAirNow, ONE_HOUR);

// Delay weekly jobs by 1 hour so the first run completes before the second starts
setTimeout(() => setInterval(runWeekly, ONE_WEEK), ONE_HOUR);

logger.info('[scheduler] CommonGround ingest scheduler running.');
logger.info(`[scheduler] AirNow: every hour | FQHC + OSM: every 7 days`);
