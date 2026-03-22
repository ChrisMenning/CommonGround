'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');

// All admin routes require authentication
router.use(adminAuth);

// ── Validation helpers ────────────────────────────────────────────────────────

const VALID_FORMATS  = ['json', 'csv', 'geojson', 'xlsx', 'arcgis-rest'];
const VALID_STATUSES = ['active', 'degraded', 'blocked', 'pending'];
const VALID_CLAIM    = ['CORRELATION', 'MECHANISM', 'DOCUMENTED'];

function isValidSlug(s) { return typeof s === 'string' && /^[a-z0-9-]+$/.test(s) && s.length <= 80; }
function isValidId(v)   { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 1; }

// ── Source configs ────────────────────────────────────────────────────────────

// GET /admin/sources — list all source_configs
// SECURITY: api_key is never returned. Only api_key_set (boolean) is exposed.
router.get('/sources', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT id, slug, municipality, endpoint_url, endpoint_format,
             enabled, status, status_note, config_json, updated_at, updated_by,
             (api_key IS NOT NULL AND api_key <> '') AS api_key_set
      FROM source_configs
      ORDER BY slug ASC, municipality ASC
    `);
    res.json({ sources: result.rows });
  } catch (err) { next(err); }
});

// POST /admin/sources — create a new source config
router.post('/sources', async (req, res, next) => {
  const { slug, municipality = '', endpoint_url, endpoint_format = 'json',
          enabled = true, status = 'active', status_note, config_json, api_key } = req.body || {};

  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'slug is required and must be lowercase alphanumeric + hyphens' });
  }
  if (typeof municipality !== 'string' || municipality.length > 100) {
    return res.status(400).json({ error: 'municipality must be a string under 100 characters' });
  }
  if (!VALID_FORMATS.includes(endpoint_format)) {
    return res.status(400).json({ error: `endpoint_format must be one of: ${VALID_FORMATS.join(', ')}` });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  if (endpoint_url !== undefined && endpoint_url !== null &&
      (typeof endpoint_url !== 'string' || endpoint_url.length > 2000)) {
    return res.status(400).json({ error: 'endpoint_url must be a string under 2000 characters' });
  }
  if (status_note !== undefined && status_note !== null &&
      (typeof status_note !== 'string' || status_note.length > 2000)) {
    return res.status(400).json({ error: 'status_note must be a string under 2000 characters' });
  }
  if (api_key !== undefined && api_key !== null &&
      (typeof api_key !== 'string' || api_key.length > 500)) {
    return res.status(400).json({ error: 'api_key must be a string under 500 characters' });
  }

  let configJsonStr = '{}';
  if (config_json !== undefined && config_json !== null) {
    if (typeof config_json === 'object') {
      configJsonStr = JSON.stringify(config_json);
    } else if (typeof config_json === 'string') {
      try { JSON.parse(config_json); configJsonStr = config_json; }
      catch { return res.status(400).json({ error: 'config_json must be valid JSON' }); }
    }
  }

  try {
    const result = await db.query(
      `INSERT INTO source_configs
         (slug, municipality, endpoint_url, endpoint_format, enabled, status, status_note, api_key, config_json, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'admin')
       RETURNING id`,
      [slug, municipality, endpoint_url ?? null, endpoint_format,
       Boolean(enabled), status, status_note ?? null,
       (api_key && api_key.trim()) ? api_key.trim() : null,
       configJsonStr]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `A config for slug "${slug}" + municipality "${municipality}" already exists.` });
    }
    next(err);
  }
});

// PUT /admin/sources/:id — update a source config
router.put('/sources/:id', async (req, res, next) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const id = parseInt(req.params.id, 10);

  const { endpoint_url, endpoint_format, enabled, status, status_note, config_json, municipality, api_key } = req.body || {};
  const updates = [];
  const values  = [];

  if (municipality !== undefined) {
    if (typeof municipality !== 'string' || municipality.length > 100) {
      return res.status(400).json({ error: 'municipality must be a string under 100 characters' });
    }
    updates.push(`municipality = $${values.push(municipality)}`);
  }
  if (endpoint_url !== undefined) {
    if (endpoint_url !== null && (typeof endpoint_url !== 'string' || endpoint_url.length > 2000)) {
      return res.status(400).json({ error: 'endpoint_url must be null or a string under 2000 characters' });
    }
    updates.push(`endpoint_url = $${values.push(endpoint_url)}`);
  }
  if (endpoint_format !== undefined) {
    if (!VALID_FORMATS.includes(endpoint_format)) {
      return res.status(400).json({ error: `endpoint_format must be one of: ${VALID_FORMATS.join(', ')}` });
    }
    updates.push(`endpoint_format = $${values.push(endpoint_format)}`);
  }
  if (enabled !== undefined) {
    updates.push(`enabled = $${values.push(Boolean(enabled))}`);
  }
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    updates.push(`status = $${values.push(status)}`);
  }
  if (status_note !== undefined) {
    if (status_note !== null && (typeof status_note !== 'string' || status_note.length > 2000)) {
      return res.status(400).json({ error: 'status_note must be null or a string under 2000 characters' });
    }
    updates.push(`status_note = $${values.push(status_note)}`);
  }
  if (config_json !== undefined) {
    let v = '{}';
    if (config_json !== null) {
      if (typeof config_json === 'object') v = JSON.stringify(config_json);
      else if (typeof config_json === 'string') {
        try { JSON.parse(config_json); v = config_json; }
        catch { return res.status(400).json({ error: 'config_json must be valid JSON' }); }
      }
    }
    updates.push(`config_json = $${values.push(v)}::jsonb`);
  }
  // api_key: empty string = clear the key; non-empty = set new key; undefined = no change
  if (api_key !== undefined) {
    if (api_key !== null && typeof api_key !== 'string') {
      return res.status(400).json({ error: 'api_key must be a string or null' });
    }
    if (api_key && api_key.length > 500) {
      return res.status(400).json({ error: 'api_key must be under 500 characters' });
    }
    updates.push(`api_key = $${values.push((api_key && api_key.trim()) ? api_key.trim() : null)}`);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  updates.push(`updated_at = NOW()`, `updated_by = 'admin'`);
  values.push(id);

  try {
    const result = await db.query(
      `UPDATE source_configs SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING id`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Source config not found' });
    res.json({ updated: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A config with that slug + municipality combination already exists.' });
    }
    next(err);
  }
});

// DELETE /admin/sources/:id — remove a source config
router.delete('/sources/:id', async (req, res, next) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const id = parseInt(req.params.id, 10);
  try {
    const result = await db.query(
      'DELETE FROM source_configs WHERE id = $1 RETURNING id', [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Source config not found' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ── Layers ────────────────────────────────────────────────────────────────────

// GET /admin/layers — all layers, including inactive
router.get('/layers', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT id, slug, name, description, source, source_url,
             trust_rating, claim_type, update_frequency, aggregation_level,
             geometry_type, color, active, data_vintage,
             parent_slug, is_composite, last_updated, created_at
      FROM layers
      ORDER BY name ASC
    `);
    res.json({ layers: result.rows });
  } catch (err) { next(err); }
});

// PUT /admin/layers/:slug — update layer metadata
router.put('/layers/:slug', async (req, res, next) => {
  if (!isValidSlug(req.params.slug)) return res.status(400).json({ error: 'Invalid slug' });

  const { name, description, source, source_url, trust_rating, claim_type,
          update_frequency, aggregation_level, color, active, data_vintage } = req.body || {};
  const updates = [];
  const values  = [];

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 200) {
      return res.status(400).json({ error: 'name must be 2–200 characters' });
    }
    updates.push(`name = $${values.push(name.trim())}`);
  }
  if (description !== undefined) {
    updates.push(`description = $${values.push(description ?? null)}`);
  }
  if (source !== undefined) {
    if (typeof source !== 'string' || source.trim().length < 2 || source.length > 200) {
      return res.status(400).json({ error: 'source must be 2–200 characters' });
    }
    updates.push(`source = $${values.push(source.trim())}`);
  }
  if (source_url !== undefined) {
    updates.push(`source_url = $${values.push(source_url ?? null)}`);
  }
  if (trust_rating !== undefined) {
    const tr = parseInt(trust_rating, 10);
    if (!Number.isFinite(tr) || tr < 1 || tr > 5) {
      return res.status(400).json({ error: 'trust_rating must be 1–5' });
    }
    updates.push(`trust_rating = $${values.push(tr)}`);
  }
  if (claim_type !== undefined) {
    if (!VALID_CLAIM.includes(claim_type)) {
      return res.status(400).json({ error: `claim_type must be one of: ${VALID_CLAIM.join(', ')}` });
    }
    updates.push(`claim_type = $${values.push(claim_type)}`);
  }
  if (update_frequency !== undefined) {
    updates.push(`update_frequency = $${values.push(update_frequency ?? null)}`);
  }
  if (color !== undefined) {
    if (color !== null && (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color))) {
      return res.status(400).json({ error: 'color must be a hex color string (#RRGGBB)' });
    }
    updates.push(`color = $${values.push(color)}`);
  }
  if (active !== undefined) {
    updates.push(`active = $${values.push(Boolean(active))}`);
  }
  if (data_vintage !== undefined) {
    updates.push(`data_vintage = $${values.push(data_vintage ?? null)}`);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.slug);

  try {
    const result = await db.query(
      `UPDATE layers SET ${updates.join(', ')} WHERE slug = $${values.length} RETURNING id`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Layer not found' });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ── Community resources ───────────────────────────────────────────────────────

// GET /admin/resources — pending community resource submissions
router.get('/resources', async (req, res, next) => {
  const approved = req.query.approved === 'true' ? true :
                   req.query.approved === 'false' ? false : false;
  try {
    const result = await db.query(
      `SELECT id, name, type, description, address, contact, submitted_at, approved
       FROM resources
       WHERE approved = $1
       ORDER BY submitted_at DESC
       LIMIT 200`,
      [approved]
    );
    res.json({ resources: result.rows });
  } catch (err) { next(err); }
});

// POST /admin/resources/:id/approve — approve a community submission
router.post('/resources/:id/approve', async (req, res, next) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const id = parseInt(req.params.id, 10);
  try {
    const result = await db.query(
      'UPDATE resources SET approved = true WHERE id = $1 AND approved = false RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resource not found or already approved' });
    }
    res.json({ approved: true });
  } catch (err) { next(err); }
});

// DELETE /admin/resources/:id — reject and remove a submission
router.delete('/resources/:id', async (req, res, next) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const id = parseInt(req.params.id, 10);
  try {
    const result = await db.query('DELETE FROM resources WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ── Signal runs ───────────────────────────────────────────────────────────────

// GET /admin/signal-runs — recent signal engine evaluations
router.get('/signal-runs', async (req, res, next) => {
  const days = Math.min(parseInt(req.query.days || '7', 10), 90);
  try {
    const result = await db.query(
      `SELECT id, alert_type, run_at, triggered, expired, error
       FROM signal_runs
       WHERE run_at > NOW() - ($1 || ' days')::INTERVAL
       ORDER BY run_at DESC
       LIMIT 500`,
      [days]
    );
    res.json({ signal_runs: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;
