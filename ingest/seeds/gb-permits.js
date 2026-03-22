/**
 * gb-permits.js — City of Green Bay building and assembly permit data.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * DATA SOURCE (when configured):
 *   City of Green Bay Community & Economic Development (CED)
 *   Building, renovation, and assembly permits issued by the City.
 *   Contact: https://www.greenbaywi.gov/305/Community-Economic-Development
 *            Phone: 920-448-3300
 *
 * CURRENT STATUS — ENDPOINT NOT YET CONFIGURED (as of 2026-03-22)
 * ──────────────────────────────────────────────────────────────────────────
 * Green Bay does not publish building permit records through a public API.
 * Their GIS portal (data.greenbaywi.gov, an ArcGIS Hub) exists but requires
 * an organizational ArcGIS login. Options to unblock this source:
 *
 *   Option A — ArcGIS token via organizational account (preferred):
 *     1. Obtain an ArcGIS token from a City of Green Bay org account.
 *     2. Identify the FeatureServer URL for the permits layer inside
 *        data.greenbaywi.gov (browse with your org account to find it).
 *     3. In the admin interface, set source_configs for slug='gb-permits':
 *          endpoint_url:    <the FeatureServer layer URL>
 *          endpoint_format: arcgis-rest
 *          api_key:         <your ArcGIS token>
 *          enabled:         true
 *          status:          active
 *
 *   Option B — Wisconsin Open Records request (s. 19.35, Wis. Stats.):
 *     1. File a request with Green Bay CED for all building permits issued
 *        in the past 24 months in GeoJSON or CSV format with coordinates.
 *     2. Place the file at ingest/data/raw/gb-permits.geojson (or .csv).
 *     3. In the admin interface, set endpoint_url='file:gb-permits.geojson'
 *        and endpoint_format='geojson' (or 'csv').
 *     4. Set a cron job to re-request data quarterly.
 *
 *   Option C — API partnership request:
 *     Contact Green Bay CED directly to ask for API access or a recurring
 *     data export agreement.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * PURPOSE
 * ──────────────────────────────────────────────────────────────────────────
 * This source serves two signal triggers:
 *
 *   T2-H01 (Compounding Displacement Pressure):
 *     Renovation/construction permit counts by zip code, quarter-over-quarter
 *     trend. Trigger fires when renovation permits rise >15% QoQ alongside
 *     rising eviction filings in the same zip.
 *
 *   T3-S01 (Assembly Safety Briefing):
 *     Permitted public assembly events scheduled within the next 48 hours.
 *     Triggers a briefing that includes NWS weather, AirNow AQI, and the
 *     nearest FQHC to the event location.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ADMIN CONFIGURATION (source_configs slug='gb-permits', municipality='green-bay'):
 * ──────────────────────────────────────────────────────────────────────────
 *   endpoint_url:    ArcGIS FeatureServer layer URL (or 'file:...' path)
 *   endpoint_format: 'arcgis-rest' | 'geojson' | 'csv'
 *   api_key:         ArcGIS token if the endpoint requires authentication
 *   config_json: {
 *     field_map: {
 *       permit_id:   'PERMIT_NUMBER',  // adjust to actual field names
 *       permit_type: 'WORK_TYPE',
 *       category:    'CATEGORY',
 *       description: 'DESCRIPTION',
 *       value_usd:   'VALUATION',
 *       issued_date: 'ISSUED_DATE',
 *       expiry_date: 'EXPIRY_DATE',
 *       address:     'ADDRESS',
 *       zip_code:    'ZIP',
 *     },
 *     assembly_type_keywords:   ['ASSEMBLY', 'TENT', 'SPECIAL EVENT'],
 *     renovation_type_keywords: ['RENOVATION', 'REMODEL', 'ALTERATION', 'ADDITION'],
 *     days_back: 365,  // how many days of permits to load
 *   }
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const db     = require('../lib/db');
const logger = require('../lib/logger');
const { fetchJson, insertFeatures } = require('../lib/utils');
const { getSourceConfig } = require('../lib/source-config');

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_FIELD_MAP = {
  permit_id:   'PERMIT_NUMBER',
  permit_type: 'WORK_TYPE',
  category:    'CATEGORY',
  description: 'DESCRIPTION',
  value_usd:   'VALUATION',
  issued_date:  'ISSUED_DATE',
  expiry_date:  'EXPIRY_DATE',
  address:     'ADDRESS',
  zip_code:    'ZIP',
};

const DEFAULT_ASSEMBLY_KEYWORDS   = ['ASSEMBLY', 'TENT', 'SPECIAL EVENT', 'SPECIAL USE'];
const DEFAULT_RENOVATION_KEYWORDS = ['RENOVATION', 'REMODEL', 'ALTERATION', 'ADDITION', 'REPAIR'];
const DEFAULT_DAYS_BACK           = 365;
const ARCGIS_PAGE_SIZE            = 1000;

// ── Layer record ──────────────────────────────────────────────────────────────

async function ensureLayerRecord(client) {
  await client.query(`
    INSERT INTO layers
      (slug, name, description, source, source_url,
       trust_rating, claim_type, update_frequency,
       aggregation_level, geometry_type, color, active)
    VALUES (
      'gb-permits',
      'Building Permits',
      'City of Green Bay building, renovation, and assembly permits issued by the '
        || 'Department of Community and Economic Development (CED). Used to track '
        || 'renovation/construction pressure (T2-H01 signal) and upcoming permitted '
        || 'public assembly events (T3-S01 signal). Requires operator-configured '
        || 'endpoint — see ingest/seeds/gb-permits.js for setup instructions.',
      'City of Green Bay CED',
      'https://www.greenbaywi.gov/312/Building-Permits-Inspections',
      4, 'DOCUMENTED', 'daily',
      'point', 'point', '#D4A017',
      false
    )
    ON CONFLICT (slug) DO UPDATE SET
      name             = EXCLUDED.name,
      description      = EXCLUDED.description,
      source_url       = EXCLUDED.source_url,
      update_frequency = EXCLUDED.update_frequency,
      last_updated     = NOW()
  `);
}

// ── Permit type classifier ────────────────────────────────────────────────────

function classifyPermit(typeStr, descStr, assemblyKws, renovationKws) {
  const combined = ((typeStr || '') + ' ' + (descStr || '')).toUpperCase();
  if (assemblyKws.some(kw => combined.includes(kw)))   return 'assembly';
  if (renovationKws.some(kw => combined.includes(kw))) return 'renovation';
  if (/NEW CONSTRUCTION|NEW HOME|NEW COMMERCIAL|RAZE|DEMOLITION/.test(combined)) {
    return 'construction';
  }
  return 'other';
}

// ── ArcGIS REST ingest ────────────────────────────────────────────────────────

async function fromArcGIS(endpointUrl, fieldMap, apiKey, assemblyKws, renovationKws, daysBack) {
  const cutoff = new Date(Date.now() - daysBack * 24 * 3600 * 1000);
  // ArcGIS date literal format: 'YYYY-MM-DD'
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const issuedField = fieldMap.issued_date;
  const where = `${issuedField} >= DATE '${cutoffStr}'`;

  const baseUrl = endpointUrl.replace(/\/$/, '') + '/query';
  const authHeaders = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};

  const features = [];
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = `${baseUrl}?where=${encodeURIComponent(where)}`
      + `&outFields=*`
      + `&f=geojson`
      + `&resultOffset=${offset}`
      + `&resultRecordCount=${ARCGIS_PAGE_SIZE}`
      + (apiKey ? `&token=${encodeURIComponent(apiKey)}` : '');

    const geojson = await fetchJson(url, authHeaders);
    if (geojson.error) {
      throw new Error(`ArcGIS error ${geojson.error.code}: ${geojson.error.message}`);
    }

    const batch = geojson.features || [];
    for (const f of batch) {
      if (!f.geometry) continue; // skip records without coordinates
      const feature = buildFeature(f.geometry, f.properties || {}, fieldMap, assemblyKws, renovationKws);
      if (feature) features.push(feature);
    }

    offset += batch.length;
    if (!geojson.exceededTransferLimit || batch.length === 0) break;
  }

  return features;
}

// ── GeoJSON file ingest ───────────────────────────────────────────────────────

async function fromGeojsonFile(filePath, fieldMap, assemblyKws, renovationKws, daysBack) {
  const absPath = path.resolve(__dirname, '../../', filePath.replace(/^file:/, ''));
  if (!fs.existsSync(absPath)) {
    throw new Error(`GeoJSON file not found: ${absPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  const cutoff = new Date(Date.now() - daysBack * 24 * 3600 * 1000).getTime();
  const features = [];
  for (const f of (raw.features || [])) {
    if (!f.geometry) continue;
    const p = f.properties || {};
    // Filter by issued_date if available
    const rawDate = p[fieldMap.issued_date];
    if (rawDate) {
      const dateMs = typeof rawDate === 'number' ? rawDate : Date.parse(rawDate);
      if (dateMs < cutoff) continue;
    }
    const feature = buildFeature(f.geometry, p, fieldMap, assemblyKws, renovationKws);
    if (feature) features.push(feature);
  }
  return features;
}

// ── Shared feature builder ────────────────────────────────────────────────────

function buildFeature(geometry, p, fieldMap, assemblyKws, renovationKws) {
  const permitType = classifyPermit(
    String(p[fieldMap.permit_type] || ''),
    String(p[fieldMap.description] || ''),
    assemblyKws,
    renovationKws,
  );

  const rawIssued = p[fieldMap.issued_date];
  const issuedDate = rawIssued
    ? (typeof rawIssued === 'number'
        ? new Date(rawIssued).toISOString().slice(0, 10)
        : String(rawIssued).slice(0, 10))
    : null;

  const rawExpiry = p[fieldMap.expiry_date];
  const expiryDate = rawExpiry
    ? (typeof rawExpiry === 'number'
        ? new Date(rawExpiry).toISOString().slice(0, 10)
        : String(rawExpiry).slice(0, 10))
    : null;

  return {
    geojsonGeometry: geometry,
    aggregationLevel: 'point',
    properties: {
      permit_id:   String(p[fieldMap.permit_id]   || '').trim() || null,
      permit_type: permitType,
      category:    String(p[fieldMap.category]    || '').trim() || null,
      description: String(p[fieldMap.description] || '').trim().slice(0, 500) || null,
      value_usd:   p[fieldMap.value_usd] != null ? (Number(p[fieldMap.value_usd]) || null) : null,
      issued_date: issuedDate,
      expiry_date: expiryDate,
      address:     String(p[fieldMap.address]     || '').trim() || null,
      zip_code:    String(p[fieldMap.zip_code]    || '').trim().slice(0, 10) || null,
      source:      'City of Green Bay CED',
      attribution: 'City of Green Bay Department of Community and Economic Development',
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const adminCfg = await getSourceConfig('gb-permits', 'green-bay');

  // Always ensure the layer record exists so the admin UI can show it even
  // when the endpoint is not yet configured or the source is blocked.
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await ensureLayerRecord(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (!adminCfg.enabled) {
    logger.info('[gb-permits] Disabled in admin source config — skipping fetch.');
    await db.end();
    return;
  }

  if (adminCfg.status === 'blocked') {
    logger.info(`[gb-permits] Marked blocked in admin config: "${adminCfg.status_note || 'no note'}" — skipping fetch.`);
    await db.end();
    return;
  }

  if (!adminCfg.endpoint_url) {
    logger.warn(
      '[gb-permits] No endpoint URL configured.\n' +
      '  This source requires the operator to configure an endpoint via the admin interface.\n' +
      '  See ingest/seeds/gb-permits.js for setup instructions.\n' +
      '  Options: (A) ArcGIS token + FeatureServer URL from data.greenbaywi.gov;\n' +
      '           (B) Open Records request GeoJSON/CSV file;\n' +
      '           (C) API partnership with Green Bay CED (920-448-3300).'
    );
    await db.end();
    return;
  }

  const extra        = adminCfg.config_json || {};
  const fieldMap     = { ...DEFAULT_FIELD_MAP,        ...(extra.field_map || {}) };
  const assemblyKws  = extra.assembly_type_keywords   || DEFAULT_ASSEMBLY_KEYWORDS;
  const renovationKws = extra.renovation_type_keywords || DEFAULT_RENOVATION_KEYWORDS;
  const daysBack     = extra.days_back                || DEFAULT_DAYS_BACK;
  const fmt          = adminCfg.endpoint_format       || 'arcgis-rest';

  logger.info(`[gb-permits] Endpoint: ${adminCfg.endpoint_url}`);
  logger.info(`[gb-permits] Format:   ${fmt}`);
  logger.info(`[gb-permits] Loading permits issued in the last ${daysBack} days`);
  if (adminCfg.api_key) logger.info('[gb-permits] Using configured API key');

  // Fetch permits from the configured source
  let features;
  if (fmt === 'arcgis-rest') {
    features = await fromArcGIS(
      adminCfg.endpoint_url,
      fieldMap,
      adminCfg.api_key || null,
      assemblyKws, renovationKws, daysBack,
    );
  } else if (fmt === 'geojson' && adminCfg.endpoint_url.startsWith('file:')) {
    features = await fromGeojsonFile(
      adminCfg.endpoint_url, fieldMap, assemblyKws, renovationKws, daysBack,
    );
  } else if (fmt === 'json') {
    // Generic JSON endpoint returning GeoJSON FeatureCollection
    const geojson = await fetchJson(adminCfg.endpoint_url);
    features = [];
    for (const f of (geojson.features || [])) {
      if (!f.geometry) continue;
      const feature = buildFeature(f.geometry, f.properties || {}, fieldMap, assemblyKws, renovationKws);
      if (feature) features.push(feature);
    }
  } else {
    logger.warn(`[gb-permits] Unsupported endpoint_format '${fmt}'. Supported: 'arcgis-rest', 'geojson' (file), 'json'.`);
    await db.end();
    return;
  }

  const assembly    = features.filter(f => f.properties.permit_type === 'assembly').length;
  const renovation  = features.filter(f => f.properties.permit_type === 'renovation').length;
  const construction = features.filter(f => f.properties.permit_type === 'construction').length;
  const other       = features.length - assembly - renovation - construction;
  logger.info(
    `[gb-permits] Parsed: ${features.length} permits ` +
    `(${assembly} assembly, ${renovation} renovation, ${construction} construction, ${other} other)`
  );

  if (features.length === 0) {
    logger.warn('[gb-permits] No permit features returned — check field names and date filter in config_json.');
    await db.end();
    return;
  }

  const inserted = await insertFeatures(db, 'gb-permits', features);
  logger.info(`[gb-permits] Inserted ${inserted} permit features`);
  await db.end();
}

run().catch(err => {
  logger.error('[gb-permits] Ingest failed:', err.message);
  process.exit(1);
});
