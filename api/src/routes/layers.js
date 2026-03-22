'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /layers — list active layers with metadata
// By default excludes composite parent layers (is_composite = true).
// Pass ?include_composite=true to include them.
router.get('/', async (req, res, next) => {
  const includeComposite = req.query.include_composite === 'true';
  try {
    const result = await db.query(`
      SELECT
        id, slug, name, description,
        source, source_url,
        trust_rating, claim_type,
        update_frequency, aggregation_level,
        geometry_type, color,
        data_vintage, parent_slug, is_composite,
        last_updated, created_at
      FROM layers
      WHERE active = true
        ${includeComposite ? '' : 'AND (is_composite = false OR is_composite IS NULL)'}
      ORDER BY name ASC
    `);
    res.json({ layers: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /layers/:slug — single layer metadata
router.get('/:slug', async (req, res, next) => {
  // Validate slug — only alphanumeric and hyphens
  if (!/^[a-z0-9-]+$/.test(req.params.slug)) {
    return res.status(400).json({ error: 'Invalid layer slug' });
  }
  try {
    const result = await db.query(
      `SELECT id, slug, name, description,
              source, source_url,
              trust_rating, claim_type,
              update_frequency, aggregation_level,
              geometry_type, color,
              data_vintage, parent_slug, is_composite,
              last_updated, created_at
       FROM layers WHERE slug = $1 AND active = true`,
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Layer not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
