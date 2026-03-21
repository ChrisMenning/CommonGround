'use strict';
/**
 * db-init.js — run once to create schema and seed layer metadata.
 * Usage: node src/db-init.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[db-init] Schema created successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[db-init] Schema creation failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

init();
