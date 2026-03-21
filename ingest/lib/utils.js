'use strict';
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Download a URL to a local file path.
 * Returns a Promise that resolves when file is written.
 */
function download(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'CommonGround-Ingest/1.0 (contact@example.org)',
        'Accept': '*/*',
      },
      timeout: 60000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return download(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    req.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timed out downloading ${url}`)); });
  });
}

/**
 * Fetch JSON from a URL.
 */
function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'CommonGround-Ingest/1.0 (contact@example.org)',
        'Accept': 'application/json, application/geo+json',
        ...headers,
      },
      timeout: 30000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJson(res.headers.location, headers).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

/**
 * Batch insert features into PostGIS.
 * features: array of { geojsonGeometry, properties, aggregationLevel }
 */
async function insertFeatures(db, layerSlug, features) {
  if (features.length === 0) return 0;

  const layerResult = await db.query(
    'SELECT id FROM layers WHERE slug = $1',
    [layerSlug]
  );
  if (layerResult.rows.length === 0) {
    throw new Error(`Layer not found: ${layerSlug}`);
  }
  const layerId = layerResult.rows[0].id;

  // Delete existing features for this layer before re-inserting
  await db.query('DELETE FROM features WHERE layer_id = $1', [layerId]);

  const client = await db.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    for (const f of features) {
      await client.query(
        `INSERT INTO features (layer_id, geom, properties, aggregation_level, last_updated)
         VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3, $4, NOW())`,
        [layerId, JSON.stringify(f.geojsonGeometry), f.properties, f.aggregationLevel]
      );
      inserted++;
    }
    // Update layer last_updated
    await client.query(
      'UPDATE layers SET last_updated = NOW() WHERE id = $1',
      [layerId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return inserted;
}

module.exports = { download, fetchJson, insertFeatures };
