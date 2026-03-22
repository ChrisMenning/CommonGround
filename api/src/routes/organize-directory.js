'use strict';
/**
 * organize-directory.js — server-side proxy/scraper for organize.directory
 *
 * Fetches the Green Bay, WI page from organize.directory and parses the
 * group listings to return a JSON array. Also fetches Wisconsin statewide
 * groups. Results are cached for 6 hours to be respectful of the source.
 *
 * organize.directory does not offer a public API. This route fetches the
 * public HTML and parses it. The data is used for display only, with
 * clear attribution. organize.directory content is ©organize.directory
 * contributors; all rights reserved by them.
 *
 * ATTRIBUTION: organize.directory (https://organize.directory/)
 */

const express    = require('express');
const https      = require('https');
const router     = express.Router();

// Cache: { data: [...], fetchedAt: timestamp }
let _cache = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const URLS = [
  { url: 'https://organize.directory/green-bay', scope: 'Green Bay' },
  { url: 'https://organize.directory/wisconsin',  scope: 'Wisconsin (statewide)' },
];

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'CommonGround/1.0 civic data display (contact: see README)',
        'Accept': 'text/html',
      },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchHtml(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => { body += c; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timed out')); });
  });
}

/**
 * Parse organize.directory HTML into group objects.
 * The site renders groups as blocks: <a href="external-url">Name</a> followed
 * by a text description. We extract each external link + its trailing text
 * (up to the next external link or heading).
 */
function parseGroups(html, scope) {
  const groups = [];
  // Split on external links only — each is a separate group entry
  const parts = html.split(/(?=<a\s+href="https?:\/\/(?!organize\.directory)[^"]+)/i);

  for (const part of parts) {
    const aMatch = part.match(/^<a\s+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!aMatch) continue;

    const url     = aMatch[1];
    const rawName = aMatch[2].replace(/<[^>]+>/g, '').trim();
    if (!rawName || rawName.length < 3) continue;

    // Skip social/subscribe links for organize.directory accounts
    if (/instagram\.com\/organize\.|discord\.gg|facebook\.com\/organize/i.test(url)) continue;
    // Skip image-only links (name would be empty or just whitespace after stripping tags)
    if (!rawName || /^image:/i.test(rawName)) continue;

    // Description: the text immediately after the </a>, before next tag boundary
    const afterAnchor = part.slice(aMatch[0].length);
    const desc = afterAnchor
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 280);

    // Avoid duplicate group names
    if (groups.some(g => g.name === rawName)) continue;

    groups.push({
      name:        rawName,
      url,
      description: desc.length > 4 ? desc : null,
      scope,
    });
  }
  return groups;
}

async function fetchAndParse() {
  const allGroups = [];
  for (const { url, scope } of URLS) {
    try {
      const html = await fetchHtml(url);
      const groups = parseGroups(html, scope);
      allGroups.push(...groups);
    } catch (err) {
      console.error(`[organize-directory] Failed to fetch ${url}: ${err.message}`);
    }
  }
  return allGroups;
}

// GET /organize-directory
router.get('/', async (_req, res, next) => {
  try {
    const now = Date.now();
    if (_cache && (now - _cache.fetchedAt) < CACHE_TTL_MS) {
      return res.json({ groups: _cache.data, cached: true, fetchedAt: new Date(_cache.fetchedAt).toISOString() });
    }

    const groups = await fetchAndParse();
    _cache = { data: groups, fetchedAt: now };
    return res.json({ groups, cached: false, fetchedAt: new Date(now).toISOString() });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
