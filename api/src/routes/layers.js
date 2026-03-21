'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /layers — list all active layers with metadata
router.get('/', async (_req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        id, slug, name, description,
        source, source_url,
        trust_rating, claim_type,
        update_frequency, aggregation_level,
        geometry_type, color,
        data_vintage, last_updated, created_at
      FROM layers
      WHERE active = true
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
              data_vintage, last_updated, created_at
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
