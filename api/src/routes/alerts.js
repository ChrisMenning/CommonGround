'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

function parseBbox(bboxStr) {
  if (typeof bboxStr !== 'string') return null;
  const parts = bboxStr.split(',');
  if (parts.length !== 4) return null;
  const [w, s, e, n] = parts.map(Number);
  if ([w, s, e, n].some(isNaN)) return null;
  if (w < -180 || w > 180 || e < -180 || e > 180) return null;
  if (s < -90 || s > 90 || n < -90 || n > 90) return null;
  if (s > n) return null;
  return { w, s, e, n };
}

// GET /alerts?bbox=W,S,E,N&severity=1|2|3
router.get('/', async (req, res, next) => {
  const { bbox, severity } = req.query;

  const params = [];
  const conditions = ['a.active = true', '(a.expires_at IS NULL OR a.expires_at > NOW())'];

  if (bbox) {
    const box = parseBbox(bbox);
    if (!box) return res.status(400).json({ error: 'Invalid bbox — expected W,S,E,N decimal degrees' });
    params.push(box.w, box.s, box.e, box.n);
    conditions.push(`(a.affected_geom IS NULL OR a.affected_geom && ST_MakeEnvelope($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length}, 4326))`);
  }

  if (severity) {
    const sev = parseInt(severity);
    if (isNaN(sev) || sev < 1 || sev > 3) {
      return res.status(400).json({ error: 'severity must be 1, 2, or 3' });
    }
    params.push(sev);
    conditions.push(`a.severity = $${params.length}`);
  }

  try {
    const result = await db.query(
      `SELECT
         a.id, a.alert_type, a.claim_type, a.severity,
         a.title, a.description,
         a.recommendation, a.caution,
         a.sources,
         a.trigger_conditions,
         ST_AsGeoJSON(a.affected_geom)::jsonb AS affected_geometry,
         a.created_at, a.expires_at
       FROM alerts a
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.severity ASC, a.created_at DESC
       LIMIT 100`,
      params
    );

    res.json({ alerts: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
