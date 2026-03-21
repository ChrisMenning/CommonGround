'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

const ALLOWED_TYPES = [
  'mutual-aid', 'food-pantry', 'community-fridge', 'free-pantry',
  'health-clinic', 'shelter', 'legal-aid', 'other',
];

// POST /resources — community resource submission
// Phase 1: submissions are stored unmoderated; approved=false until reviewed
// No address-level geom is stored; block group aggregation happens on approval
router.post('/', async (req, res, next) => {
  const { name, type, description, address, contact } = req.body || {};

  // Input validation
  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 200) {
    return res.status(400).json({ error: 'name is required (2–200 characters)' });
  }
  if (!type || !ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({
      error: `type must be one of: ${ALLOWED_TYPES.join(', ')}`,
    });
  }
  if (description && (typeof description !== 'string' || description.length > 1000)) {
    return res.status(400).json({ error: 'description must be a string under 1000 characters' });
  }
  if (address && (typeof address !== 'string' || address.length > 300)) {
    return res.status(400).json({ error: 'address must be a string under 300 characters' });
  }
  // contact is optional; if provided, basic length limit
  if (contact && (typeof contact !== 'string' || contact.length > 200)) {
    return res.status(400).json({ error: 'contact must be a string under 200 characters' });
  }

  try {
    const result = await db.query(
      `INSERT INTO resources (name, type, description, address, contact)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, submitted_at`,
      [
        name.trim(),
        type,
        description?.trim() || null,
        address?.trim() || null,
        contact?.trim() || null,
      ]
    );

    res.status(201).json({
      message: 'Resource submitted for review. Thank you.',
      id: result.rows[0].id,
      submitted_at: result.rows[0].submitted_at,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
