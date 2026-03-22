'use strict';
const crypto = require('crypto');

/**
 * adminAuth — Bearer token middleware for admin routes.
 *
 * Token is set via ADMIN_TOKEN environment variable.  If the env var is not
 * set, the admin interface returns 503 (not just 401) so the operator knows
 * configuration is incomplete rather than receiving a confusing auth error.
 *
 * Uses crypto.timingSafeEqual to prevent timing-based token enumeration.
 */
module.exports = function adminAuth(req, res, next) {
  const token = process.env.ADMIN_TOKEN;

  if (!token) {
    return res.status(503).json({
      error: 'Admin interface is not enabled. Set the ADMIN_TOKEN environment variable to activate it.',
    });
  }

  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer (.+)$/);
  if (!match) {
    res.set('WWW-Authenticate', 'Bearer realm="CommonGround Admin"');
    return res.status(401).json({ error: 'Authorization header required: Bearer <token>' });
  }

  try {
    const provided = Buffer.from(match[1], 'utf8');
    const expected = Buffer.from(token, 'utf8');
    // Pad to same length so timingSafeEqual doesn't reveal length differences
    const padded = Buffer.alloc(Math.max(provided.length, expected.length));
    provided.copy(padded);
    const paddedExp = Buffer.alloc(padded.length);
    expected.copy(paddedExp);

    if (provided.length !== expected.length || !crypto.timingSafeEqual(padded, paddedExp)) {
      return res.status(403).json({ error: 'Invalid admin token' });
    }
  } catch {
    return res.status(403).json({ error: 'Invalid admin token' });
  }

  next();
};
