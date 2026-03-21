'use strict';
/**
 * run-all.js — sequential ingest runner for Phase 1 data sources.
 *
 * Runs each ingest script in sequence. Failures are logged but do not
 * stop the remaining scripts (best-effort population of all layers).
 *
 * Usage: node run-all.js [--skip-manual]
 *
 * --skip-manual: skip scripts that require manually downloaded files
 */
const { spawnSync } = require('child_process');
const path = require('path');
const logger = require('./lib/logger');

const skipManual = process.argv.includes('--skip-manual');

// Scripts labeled `manual: true` require files to be manually downloaded first
const SCRIPTS = [
  { name: 'FQHC (HRSA)',          file: 'seeds/fqhc.js',           manual: false },
  { name: 'OSM Resources',        file: 'seeds/osm-resources.js',   manual: false },
  { name: 'AirNow',               file: 'seeds/airnow.js',          manual: false },
  { name: 'SNAP Retailers',       file: 'seeds/snap-retailers.js',  manual: false },
  { name: 'Food Access (USDA)',    file: 'seeds/food-access.js',     manual: true  },
  { name: 'EJScreen (EPA)',        file: 'seeds/ejscreen.js',        manual: true  },
  { name: 'SVI (CDC)',             file: 'seeds/svi.js',             manual: true  },
  { name: 'HUD CHAS',             file: 'seeds/hud-chas.js',        manual: true  },
  { name: 'Eviction Lab',         file: 'seeds/eviction-lab.js',    manual: true  },
];

let passed = 0, failed = 0, skipped = 0;

for (const script of SCRIPTS) {
  if (skipManual && script.manual) {
    logger.info(`Skipping ${script.name} (requires manual download)`);
    skipped++;
    continue;
  }

  logger.info(`Running: ${script.name}`);
  const result = spawnSync('node', [path.join(__dirname, script.file)], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    logger.warn(`${script.name} exited with status ${result.status}`);
    failed++;
  } else {
    logger.info(`${script.name} — complete`);
    passed++;
  }
}

logger.info(`\nIngest complete: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed > 0) process.exit(1);
