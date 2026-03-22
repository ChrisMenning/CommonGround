/**
 * layers.js â€” layer management, sidebar rendering, info drawer.
 *
 * Phase 1.5 changes:
 *  - Sub-layer CHOROPLETH configs for all 25 new sub-layers
 *  - Grouping toggle: By Source â†” By Data Type
 *  - "Show Composite Layers" toggle (hidden by default)
 *  - Info drawer for polygon/area layers (replaces popup stacking)
 *  - Point layers (fqhc, snap-retailers, airnow, osm-resources) keep MapLibre Popup
 */
'use strict';
import { apiFetch } from './api-client.js';
import ICONS from './_icons.js';

// maplibregl is a global loaded from vendor/maplibre-gl.js
/* global maplibregl */

// â”€â”€ Point layers â€” these use standard popup, NOT the drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const POINT_LAYER_SLUGS = new Set(['fqhc', 'snap-retailers', 'airnow', 'osm-resources']);

// ── Sidebar icon assignment — maps layer slug → ICONS key ────────────────────
const SIDEBAR_ICON = {
  // Environmental
  'ejscreen-ej-score':      'park',
  'ejscreen-ozone':         'park',
  'ejscreen-pm25':          'park',
  'ejscreen-traffic':       'park',
  'ejscreen-rmp':           'park',
  'airnow':                 'airnow',
  // Population
  'ejscreen-minority':      'social_facility',
  'ejscreen-under5':        'social_facility',
  'ejscreen-over64':        'social_facility',
  'ejscreen-low-income':    'social_facility',
  'ejscreen-less-hs':       'social_facility',
  // Social Vulnerability
  'svi-overall':            'social_facility',
  'svi-socioeconomic':      'social_facility',
  'svi-household':          'social_facility',
  'svi-minority-language':  'social_facility',
  'svi-housing-transit':    'shelter',
  // Housing
  'chas-cost-burdened':     'shelter',
  'chas-severe-burden':     'shelter',
  'chas-renter-burden':     'shelter',
  'eviction-filing-rate':   'shelter',
  'eviction-rate':          'shelter',
  'eviction-rent-burden':   'shelter',
  'eviction-renter-pct':    'shelter',
  'eviction-poverty':       'shelter',
  'eviction-median-rent':   'shelter',
  'eviction-median-income': 'shelter',
  // Food access
  'food-access':            'food_bank',
  'snap-retailers':         'snap',
  // Health
  'fqhc':                   'fqhc',
  // Community
  'osm-resources':          'community_centre',
  'neighborhood-assoc':     'social_facility',
  'gb-permits':             'community_centre',
};

// Render a Phosphor SVG as a 14×14 img element colored with `color`.
// Returns an <img> element, or null if the icon isn't available.
function makeSidebarIcon(key, color) {
  const svg = ICONS[key];
  if (!svg) return null;
  const colored = svg
    .replace('fill="currentColor"', `fill="${color}"`)
    .replace('<svg ', '<svg width="14" height="14" ');
  const img = document.createElement('img');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(colored);
  img.width = 14;
  img.height = 14;
  img.style.cssText = 'flex-shrink:0;opacity:0.85';
  img.alt = '';
  return img;
}


// â”€â”€ Grouping definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const GROUPS_BY_SOURCE = {
  'EPA EJScreen': [
    'ejscreen-ej-score','ejscreen-ozone','ejscreen-pm25','ejscreen-traffic','ejscreen-rmp',
    'ejscreen-minority','ejscreen-under5','ejscreen-over64','ejscreen-low-income','ejscreen-less-hs',
  ],
  'EPA AirNow': [
    'airnow',
  ],
  'CDC / ATSDR Social Vulnerability Index': [
    'svi-overall','svi-socioeconomic','svi-household','svi-minority-language','svi-housing-transit',
  ],
  'HUD CHAS (Housing Needs)': [
    'chas-cost-burdened','chas-severe-burden','chas-renter-burden',
  ],
  'Princeton Eviction Lab': [
    'eviction-filing-rate','eviction-rate','eviction-rent-burden',
    'eviction-renter-pct','eviction-poverty',
    'eviction-median-rent','eviction-median-income',
  ],
  'USDA Economic Research Service': [
    'food-access',
  ],
  'USDA SNAP Retailer Locator': [
    'snap-retailers',
  ],
  'HRSA Federally Qualified Health Centers': [
    'fqhc',
  ],
  'OpenStreetMap': [
    'osm-resources',
  ],
  'City of Green Bay': [
    'neighborhood-assoc',
    'gb-permits',
  ],
};

const GROUPS_BY_TYPE = {
  'Environmental Burden': [
    'ejscreen-ej-score','ejscreen-ozone','ejscreen-pm25','ejscreen-traffic','ejscreen-rmp',
    'airnow',
    'svi-overall',
  ],
  'Population Indicators': [
    'ejscreen-minority','ejscreen-under5','ejscreen-over64','ejscreen-low-income','ejscreen-less-hs',
    'svi-socioeconomic','svi-household','svi-minority-language',
    'eviction-poverty','eviction-renter-pct',
  ],
  'Housing Stability': [
    'chas-cost-burdened','chas-severe-burden','chas-renter-burden',
    'eviction-filing-rate','eviction-rate','eviction-rent-burden',
    'eviction-median-rent','eviction-median-income',
    'svi-housing-transit',
  ],
  'Food Access': [
    'food-access','snap-retailers',
  ],
  'Health Access': [
    'fqhc',
  ],
  'Community Infrastructure': [
    'osm-resources','neighborhood-assoc','gb-permits',
  ],
};

// â”€â”€ Choropleth display configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// property: the JSONB key to visualise
// stops: [[value, hexColor], ...]  â€” value is 0â€“1 for fractional, or dollar for dollar layers
// stopType: 'fraction' | 'dollar'
const CHOROPLETH = {
  // EJScreen
  'ejscreen':             { property: 'ejscreen_pctile',   stopType: 'fraction', stops: [[0,'#edf8e9'],[0.25,'#bae4b3'],[0.5,'#74c476'],[0.75,'#31a354'],[1,'#006d2c']] },
  'ejscreen-ej-score':    { property: 'ejscreen_pctile',   stopType: 'fraction', stops: [[0,'#edf8e9'],[0.25,'#bae4b3'],[0.5,'#74c476'],[0.75,'#31a354'],[1,'#006d2c']] },
  'ejscreen-minority':    { property: 'pct_minority',      stopType: 'fraction', stops: [[0,'#f2f0f7'],[0.25,'#cbc9e2'],[0.5,'#9e9ac8'],[0.75,'#756bb1'],[1,'#54278f']] },
  'ejscreen-under5':      { property: 'pct_under5',        stopType: 'fraction', stops: [[0,'#fff5eb'],[0.1,'#fdd0a2'],[0.2,'#fdae6b'],[0.35,'#e6550d'],[0.5,'#a63603']] },
  'ejscreen-over64':      { property: 'pct_over64',        stopType: 'fraction', stops: [[0,'#fff5eb'],[0.1,'#fdd0a2'],[0.2,'#fdae6b'],[0.35,'#e6550d'],[0.5,'#a63603']] },
  'ejscreen-low-income':  { property: 'pct_low_income',    stopType: 'fraction', stops: [[0,'#fff5f0'],[0.25,'#fcbba1'],[0.5,'#fb6a4a'],[0.75,'#cb181d'],[1,'#67000d']] },
  'ejscreen-less-hs':     { property: 'pct_less_hs',       stopType: 'fraction', stops: [[0,'#fff5f0'],[0.1,'#fcbba1'],[0.2,'#fb6a4a'],[0.35,'#cb181d'],[0.5,'#67000d']] },
  'ejscreen-ozone':       { property: 'ozone_pctile',      stopType: 'fraction', stops: [[0.50,'#eff3ff'],[0.54,'#bdd7e7'],[0.57,'#6baed6'],[0.59,'#2171b5'],[0.62,'#084594']] },
  'ejscreen-pm25':        { property: 'pm25_pctile',       stopType: 'fraction', stops: [[0.20,'#eff3ff'],[0.26,'#bdd7e7'],[0.30,'#6baed6'],[0.34,'#2171b5'],[0.38,'#084594']] },
  'ejscreen-traffic':     { property: 'traffic_pctile',    stopType: 'fraction', stops: [[0,'#ffffe5'],[0.25,'#f7fcb9'],[0.5,'#d9f0a3'],[0.75,'#addd8e'],[1,'#31a354']] },
  'ejscreen-rmp':         { property: 'rmp_pctile',        stopType: 'fraction', stops: [[0,'#fff5f0'],[0.25,'#fcbba1'],[0.5,'#fb6a4a'],[0.75,'#cb181d'],[1,'#67000d']] },
  // SVI
  'svi':                  { property: 'svi_overall',       stopType: 'fraction', stops: [[0,'#ffffb2'],[0.25,'#fecc5c'],[0.5,'#fd8d3c'],[0.75,'#f03b20'],[1,'#bd0026']] },
  'svi-overall':          { property: 'svi_overall',       stopType: 'fraction', stops: [[0,'#ffffb2'],[0.25,'#fecc5c'],[0.5,'#fd8d3c'],[0.75,'#f03b20'],[1,'#bd0026']] },
  'svi-socioeconomic':    { property: 'svi_socioeconomic', stopType: 'fraction', stops: [[0,'#ffffb2'],[0.25,'#fecc5c'],[0.5,'#fd8d3c'],[0.75,'#f03b20'],[1,'#bd0026']] },
  'svi-household':        { property: 'svi_household',     stopType: 'fraction', stops: [[0,'#ffffb2'],[0.25,'#fecc5c'],[0.5,'#fd8d3c'],[0.75,'#f03b20'],[1,'#bd0026']] },
  'svi-minority-language':{ property: 'svi_minority_lang', stopType: 'fraction', stops: [[0,'#f2f0f7'],[0.25,'#cbc9e2'],[0.5,'#9e9ac8'],[0.75,'#756bb1'],[1,'#54278f']] },
  'svi-housing-transit':  { property: 'svi_housing_transit',stopType: 'fraction',stops: [[0,'#eff3ff'],[0.25,'#bdd7e7'],[0.5,'#6baed6'],[0.75,'#2171b5'],[1,'#084594']] },
  // HUD CHAS
  'hud-chas':             { property: 'pct_cost_burdened',     stopType: 'fraction', stops: [[0.05,'#f7fbff'],[0.15,'#9ecae1'],[0.25,'#4292c6'],[0.30,'#2171b5'],[0.37,'#084594']] },
  'chas-cost-burdened':   { property: 'pct_cost_burdened',     stopType: 'fraction', stops: [[0.05,'#f7fbff'],[0.15,'#9ecae1'],[0.25,'#4292c6'],[0.30,'#2171b5'],[0.37,'#084594']] },
  'chas-severe-burden':   { property: 'pct_severely_burdened', stopType: 'fraction', stops: [[0,'#f7fbff'],[0.05,'#9ecae1'],[0.10,'#4292c6'],[0.14,'#2171b5'],[0.20,'#084594']] },
  // renter_cost_burdened/renter_hh must be computed — no pre-computed fraction in CHAS data
  'chas-renter-burden':   { property: null, computedExpr: ['/', ['to-number', ['get', 'renter_cost_burdened'], 0], ['max', 1, ['to-number', ['get', 'renter_hh'], 1]]], stopType: 'fraction', stops: [[0.10,'#f7fbff'],[0.25,'#9ecae1'],[0.40,'#4292c6'],[0.55,'#2171b5'],[0.70,'#084594']] },
  // Eviction Lab â€” fractional
  'eviction-lab':         { property: 'eviction_rate',        stopType: 'fraction', stops: [[0,'#fff5f0'],[0.05,'#fcbba1'],[0.10,'#fb6a4a'],[0.15,'#ef3b2c'],[0.20,'#cb181d']] },
  'eviction-filing-rate': { property: 'eviction_filing_rate', stopType: 'fraction', stops: [[0,'#fff5f0'],[0.05,'#fcbba1'],[0.10,'#fb6a4a'],[0.20,'#ef3b2c'],[0.35,'#cb181d']] },
  'eviction-rate':        { property: 'eviction_rate',        stopType: 'fraction', stops: [[0,'#fff5f0'],[0.05,'#fcbba1'],[0.10,'#fb6a4a'],[0.15,'#ef3b2c'],[0.20,'#cb181d']] },
  'eviction-rent-burden': { property: 'rent_burden',          stopType: 'fraction', stops: [[0,'#fff5f0'],[0.2,'#fcbba1'],[0.35,'#fb6a4a'],[0.5,'#ef3b2c'],[0.65,'#cb181d']] },
  'eviction-renter-pct':  { property: 'pct_renter_occupied',  stopType: 'fraction', stops: [[0,'#fff5f0'],[0.2,'#fcbba1'],[0.4,'#fb6a4a'],[0.6,'#ef3b2c'],[0.8,'#cb181d']] },
  'eviction-poverty':     { property: 'pct_poverty',          stopType: 'fraction', stops: [[0,'#fff5f0'],[0.1,'#fcbba1'],[0.2,'#fb6a4a'],[0.3,'#ef3b2c'],[0.4,'#cb181d']] },
  // Eviction Lab â€” dollar amount
  'eviction-median-rent':   { property: 'median_gross_rent',       stopType: 'dollar', stops: [[300,'#fff5eb'],[600,'#fdd0a2'],[900,'#fdae6b'],[1200,'#e6550d'],[1800,'#a63603']] },
  'eviction-median-income': { property: 'median_household_income', stopType: 'dollar', stops: [[10000,'#f7fbff'],[30000,'#9ecae1'],[50000,'#4292c6'],[70000,'#2171b5'],[90000,'#084594']] },
  // Food access
  'food-access':            { property: 'lila_flag', stopType: 'fraction', stops: [[0,'#f7fcb9'],[1,'#31a354']] },
};

// Human-readable label for the key choropleth property per layer
const CHOROPLETH_LABEL = {
  'ejscreen':              { label: 'EJ Score',                  format: v => `${Math.round(v * 100)}th pctile` },
  'ejscreen-ej-score':     { label: 'EJ Score',                  format: v => `${Math.round(v * 100)}th pctile` },
  'ejscreen-minority':     { label: 'People of Color',           format: v => `${Math.round(v * 100)}%` },
  'ejscreen-under5':       { label: 'Under 5 y/o',               format: v => `${Math.round(v * 100)}%` },
  'ejscreen-over64':       { label: 'Over 64',                   format: v => `${Math.round(v * 100)}%` },
  'ejscreen-low-income':   { label: 'Low Income',                format: v => `${Math.round(v * 100)}%` },
  'ejscreen-less-hs':      { label: 'Below High School Ed.',     format: v => `${Math.round(v * 100)}%` },
  'ejscreen-ozone':        { label: 'Ozone Burden',              format: v => `${Math.round(v * 100)}th pctile` },
  'ejscreen-pm25':         { label: 'PM2.5',                     format: v => `${Math.round(v * 100)}th pctile` },
  'ejscreen-traffic':      { label: 'Traffic Proximity',         format: v => `${Math.round(v * 100)}th pctile` },
  'ejscreen-rmp':          { label: 'Industrial Hazard',         format: v => `${Math.round(v * 100)}th pctile` },
  'svi':                   { label: 'Social Vulnerability',      format: v => `${Math.round(v * 100)}th pctile` },
  'svi-overall':           { label: 'Social Vulnerability',      format: v => `${Math.round(v * 100)}th pctile` },
  'svi-socioeconomic':     { label: 'Socioeconomic',             format: v => `${Math.round(v * 100)}th pctile` },
  'svi-household':         { label: 'Household Vulnerability',   format: v => `${Math.round(v * 100)}th pctile` },
  'svi-minority-language': { label: 'Race & Language',           format: v => `${Math.round(v * 100)}th pctile` },
  'svi-housing-transit':   { label: 'Housing & Transport',       format: v => `${Math.round(v * 100)}th pctile` },
  'hud-chas':              { label: 'Cost-Burdened HH',          format: v => `${Math.round(v * 100)}%` },
  'chas-cost-burdened':    { label: 'Cost-Burdened HH (â‰¥30%)',   format: v => `${Math.round(v * 100)}%` },
  'chas-severe-burden':    { label: 'Severely Burdened (â‰¥50%)',  format: v => `${Math.round(v * 100)}%` },
  'chas-renter-burden':    { label: 'Renter Cost Burden',        format: v => `${Math.round(v * 100)}%` },
  'eviction-lab':          { label: 'Eviction Rate',             format: v => `${(v * 100).toFixed(1)}%` },
  'eviction-filing-rate':  { label: 'Eviction Filing Rate',      format: v => `${(v * 100).toFixed(1)}%` },
  'eviction-rate':         { label: 'Eviction Rate',             format: v => `${(v * 100).toFixed(1)}%` },
  'eviction-rent-burden':  { label: 'Rent Burden',               format: v => `${Math.round(v * 100)}%` },
  'eviction-renter-pct':   { label: 'Renter-Occupied',           format: v => `${Math.round(v * 100)}%` },
  'eviction-poverty':      { label: 'Poverty Rate',              format: v => `${Math.round(v * 100)}%` },
  'eviction-median-rent':  { label: 'Median Gross Rent',         format: v => `$${Math.round(v).toLocaleString()}/mo`, note: '2018 historical snapshot' },
  'eviction-median-income':{ label: 'Median Household Income',   format: v => `$${Math.round(v).toLocaleString()}/yr`, note: '2018 historical snapshot' },
  'food-access':           { label: 'Low Income & Low Access',   format: v => v === 1 ? 'Yes' : 'No' },
};

// â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const layerState = {};
const _layerOpacity = {};
let _map = null;
let _layerMeta = {};
let _groupMode = 'source';
let _showComposite = false;
let _osmIconsLoaded = false;

// Make a Phosphor fill SVG white for use as a map icon overlay.
// Phosphor fill SVGs use fill="currentColor" on the root <svg>. Replace it
// with fill="white" so the icon renders visibly over the coloured circle.
// Also inject explicit width/height — Phosphor SVGs only have viewBox, and
// browsers render viewBox-only SVGs at 0×0 when loaded into new Image().
function makeIconWhite(svg, size = 48) {
  if (!svg) return null;
  return svg
    .replace('fill="currentColor"', 'fill="white"')
    .replace('<svg ', `<svg width="${size}" height="${size}" `);
}

async function loadMapImage(map, id, svgString, size = 24) {
  if (!svgString || map.hasImage(id)) return;
  const px = size * 2;
  try {
    // base64 data URI = guaranteed same-origin, no canvas taint, no Blob quirks
    const img = new Image(px, px);
    img.src = `data:image/svg+xml;base64,${btoa(svgString)}`;
    await img.decode(); // resolves only when pixels are fully ready
    if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 });
  } catch (e) {
    console.warn(`[icons] Failed to load map icon ${id}:`, e.message);
  }
}

async function ensureOSMIcons(map) {
  if (_osmIconsLoaded) return;
  const loads = [
    // OSM amenity category icons
    ...['community_centre','social_facility','clinic','health_centre','library',
        'food_bank','shelter','place_of_worship','park']
      .map(cat => loadMapImage(map, `osm-${cat}`, makeIconWhite(ICONS[cat]))),
    // Point layer icons
    loadMapImage(map, 'fqhc-icon',          makeIconWhite(ICONS.fqhc)),
    loadMapImage(map, 'snap-icon',           makeIconWhite(ICONS.snap)),
    loadMapImage(map, 'airnow-thermometer',  makeIconWhite(ICONS.airnow)),
  ];
  await Promise.all(loads);
  _osmIconsLoaded = true;
}

export async function initLayers(map) {
  _map = map;

  let layers;
  try {
    const data = await apiFetch('/layers?include_composite=true');
    layers = data.layers;
  } catch (err) {
    console.error('[layers] Failed to load layer list:', err.message);
    document.getElementById('layer-controls').innerHTML =
      '<div class="section-label" style="padding:10px 16px;color:#C0392B">Failed to load layers.</div>';
    return;
  }

  layers.forEach(l => { _layerMeta[l.slug] = l; });
  renderLayerControls(layers);
  initDrawer(map);
}

// â”€â”€ Sidebar rendering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function renderLayerControls(layers) {
  const container = document.getElementById('layer-controls');
  container.innerHTML = '';

  // Grouping mode toggle row
  const toggleRow = document.createElement('div');
  toggleRow.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 16px 4px;border-bottom:1px solid var(--border)';

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'group-mode-btn';
  toggleBtn.style.cssText = [
    'flex:1;background:var(--bark-light);border:1px solid var(--border)',
    'color:var(--text-secondary);font-family:var(--font-label);font-size:9px',
    'letter-spacing:0.12em;text-transform:uppercase;padding:4px 8px',
    'cursor:pointer;border-radius:2px;text-align:left;transition:color 0.1s',
  ].join(';');
  toggleBtn.textContent = 'GROUP: BY SOURCE';
  toggleBtn.addEventListener('click', () => {
    _groupMode = _groupMode === 'source' ? 'type' : 'source';
    toggleBtn.textContent = `GROUP: BY ${_groupMode === 'source' ? 'SOURCE' : 'DATA TYPE'}`;
    renderGroupedLayers(container, Object.values(_layerMeta), toggleRow);
  });
  toggleRow.appendChild(toggleBtn);

  const compositeBtn = document.createElement('button');
  compositeBtn.id = 'composite-btn';
  compositeBtn.title = 'Show composite parent layers (combined views)';
  compositeBtn.style.cssText = [
    'background:var(--bark-light);border:1px solid var(--border)',
    'color:var(--text-muted);font-family:var(--font-label);font-size:9px',
    'letter-spacing:0.1em;text-transform:uppercase;padding:4px 6px',
    'cursor:pointer;border-radius:2px;white-space:nowrap;transition:color 0.1s',
  ].join(';');
  compositeBtn.textContent = 'âˆ‘ COMPOSITE';
  compositeBtn.addEventListener('click', () => {
    _showComposite = !_showComposite;
    compositeBtn.style.color = _showComposite ? 'var(--sprout)' : 'var(--text-muted)';
    compositeBtn.style.borderColor = _showComposite ? 'var(--sprout)' : 'var(--border)';
    renderGroupedLayers(container, Object.values(_layerMeta), toggleRow);
  });
  toggleRow.appendChild(compositeBtn);

  container.appendChild(toggleRow);
  renderGroupedLayers(container, layers, toggleRow);
}

function renderGroupedLayers(container, layers, headerEl) {
  // Remove everything after the header row
  while (container.lastChild && container.lastChild !== headerEl) {
    container.removeChild(container.lastChild);
  }

  const groups = _groupMode === 'source' ? GROUPS_BY_SOURCE : GROUPS_BY_TYPE;
  const bySlug = {};
  layers.forEach(l => { bySlug[l.slug] = l; });

  const visibleLayers = layers.filter(l => _showComposite ? true : !l.is_composite);
  const rendered = new Set();

  for (const [groupName, slugs] of Object.entries(groups)) {
    const groupLayers = slugs
      .map(s => bySlug[s])
      .filter(l => l && visibleLayers.some(v => v.slug === l.slug));
    if (groupLayers.length === 0) continue;

    const groupLabel = document.createElement('div');
    groupLabel.className = 'layer-group-label';
    groupLabel.textContent = groupName;
    container.appendChild(groupLabel);

    groupLayers.forEach(layer => {
      rendered.add(layer.slug);
      container.appendChild(buildLayerItem(layer));
    });
  }

  // Any visible layers not in any group
  const ungrouped = visibleLayers.filter(l => !rendered.has(l.slug));
  if (ungrouped.length > 0) {
    const groupLabel = document.createElement('div');
    groupLabel.className = 'layer-group-label';
    groupLabel.textContent = 'Other';
    container.appendChild(groupLabel);
    ungrouped.forEach(layer => container.appendChild(buildLayerItem(layer)));
  }
}

function buildLayerItem(layer) {
  const item = document.createElement('div');
  item.className = 'layer-item';
  item.dataset.slug = layer.slug;

  const layerColor = layer.color || '#7FA843';
  const iconEl = makeSidebarIcon(SIDEBAR_ICON[layer.slug], layerColor);
  if (iconEl) {
    item.appendChild(iconEl);
  } else {
    const dot = document.createElement('div');
    dot.className = 'layer-dot';
    dot.style.background = layerColor;
    item.appendChild(dot);
  }

  const nameWrapper = document.createElement('span');
  nameWrapper.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:1px;min-width:0';

  const nameEl = document.createElement('span');
  nameEl.textContent = layer.name;
  nameWrapper.appendChild(nameEl);

  if (layer.data_vintage || layer.source) {
    const metaEl = document.createElement('span');
    const metaParts = [];
    if (layer.source) metaParts.push(layer.source);
    if (layer.data_vintage) metaParts.push(layer.data_vintage);
    metaEl.textContent = metaParts.join(' \u00b7 ');
    metaEl.style.cssText = 'font-size:10px;color:#888;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    nameWrapper.appendChild(metaEl);
  }

  const trust = document.createElement('span');
  trust.className = 'trust-pip';
  trust.setAttribute('aria-label', `Trust rating: ${layer.trust_rating || 0} of 5`);
  trust.textContent = '\u2605'.repeat(layer.trust_rating || 0);

  const toggle = document.createElement('div');
  toggle.className = 'layer-toggle';

  item.append(nameWrapper, trust, toggle);

  // Opacity slider — only for choropleth/fill layers; shown when active
  if (CHOROPLETH[layer.slug]) {
    const opacityRow = document.createElement('div');
    opacityRow.className = 'layer-opacity-row';

    const opacityLabel = document.createElement('span');
    opacityLabel.textContent = 'OPACITY';
    opacityLabel.id = `opacity-label-${layer.slug}`;
    opacityLabel.style.cssText = 'font-size:8px;color:var(--text-muted);font-family:var(--font-label);letter-spacing:0.1em;white-space:nowrap';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '10';
    slider.max = '100';
    slider.value = String(Math.round((_layerOpacity[layer.slug] || 0.75) * 100));
    slider.setAttribute('aria-label', `Opacity for ${layer.name}`);
    slider.setAttribute('aria-labelledby', `opacity-label-${layer.slug}`);
    slider.addEventListener('click', e => e.stopPropagation());
    slider.addEventListener('input', e => {
      const opacity = parseInt(e.target.value) / 100;
      _layerOpacity[layer.slug] = opacity;
      if (_map) {
        const fillId = `cg-${layer.slug}-fill`;
        if (_map.getLayer(fillId)) _map.setPaintProperty(fillId, 'fill-opacity', opacity);
      }
    });

    opacityRow.append(opacityLabel, slider);
    item.appendChild(opacityRow);
  }

  item.addEventListener('click', () => {
    if (layerState[layer.slug]) disableLayer(layer);
    else enableLayer(layer);
  });

  // Keyboard accessibility: Enter or Space activates the toggle
  item.setAttribute('role', 'button');
  item.setAttribute('tabindex', '0');
  item.setAttribute('aria-pressed', layerState[layer.slug] ? 'true' : 'false');
  item.setAttribute('aria-label', layer.name);
  item.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (layerState[layer.slug]) disableLayer(layer);
      else enableLayer(layer);
    }
  });

  return item;
}

// â”€â”€ Legend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function updateLegend() {
  let el = document.getElementById('map-legend');
  const activeEntry = Object.entries(layerState).find(([slug, on]) => on && CHOROPLETH[slug]);
  if (!activeEntry) {
    if (el) el.style.display = 'none';
    return;
  }
  const [slug] = activeEntry;
  const cfg = CHOROPLETH[slug];
  const labelCfg = CHOROPLETH_LABEL[slug];
  if (!cfg || !labelCfg) { if (el) el.style.display = 'none'; return; }

  if (!el) {
    el = document.createElement('div');
    el.id = 'map-legend';
    el.style.cssText = [
      'position:absolute;bottom:28px;right:10px;background:rgba(45,31,14,0.95)',
      'border:1px solid var(--border);border-radius:4px;padding:8px 10px',
      'font-size:11px;box-shadow:0 2px 8px rgba(0,0,0,0.5);z-index:10',
      'pointer-events:none;min-width:130px;font-family:var(--font-label)',
    ].join(';');
    document.getElementById('map').appendChild(el);
  }

  const firstStop = cfg.stops[0];
  const lastStop  = cfg.stops[cfg.stops.length - 1];
  const gradient  = cfg.stops.map(([v, c]) => {
    const pct = cfg.stopType === 'dollar'
      ? ((v - firstStop[0]) / (lastStop[0] - firstStop[0])) * 100
      : v * 100;
    return `${c} ${pct}%`;
  }).join(', ');
  const lowLabel  = cfg.stopType === 'dollar' ? `$${Math.round(firstStop[0]).toLocaleString()}` : 'Low';
  const highLabel = cfg.stopType === 'dollar' ? `$${Math.round(lastStop[0]).toLocaleString()}+`  : 'High';

  el.innerHTML = `
    <div style="font-weight:600;margin-bottom:5px;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-secondary)">${escHtml(labelCfg.label)}</div>
    <div style="height:10px;border-radius:2px;background:linear-gradient(to right,${gradient});margin-bottom:4px"></div>
    <div style="display:flex;justify-content:space-between;color:var(--text-muted);font-size:9px">
      <span>${escHtml(lowLabel)}</span><span>${escHtml(highLabel)}</span>
    </div>`;
  el.style.display = 'block';
}

// â”€â”€ Enable / disable layers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function enableLayer(layer) {
  layerState[layer.slug] = true;
  updateToggleUI(layer.slug, true);
  updateLegend();
  if (!_map) return;
  await addMapLayer(layer);
}

function disableLayer(layer) {
  layerState[layer.slug] = false;
  updateToggleUI(layer.slug, false);
  updateLegend();
  if (!_map) return;
  const sourceId = `cg-${layer.slug}`;
  [`${sourceId}-fill`, `${sourceId}-outline`, `${sourceId}-circle`, `${sourceId}-label`, `${sourceId}-icon`].forEach(id => {
    if (_map.getLayer(id)) _map.removeLayer(id);
  });
  if (_map.getSource(sourceId)) _map.removeSource(sourceId);
}

async function addMapLayer(layer) {
  const sourceId = `cg-${layer.slug}`;
  const bbox = getBbox(_map);

  let geojson;
  try {
    geojson = await apiFetch(`/features?layer=${layer.slug}&bbox=${bbox}`);
  } catch (err) {
    console.error(`[layers] Failed to load features for ${layer.slug}:`, err.message);
    layerState[layer.slug] = false;
    updateToggleUI(layer.slug, false);
    return;
  }

  if (_map.getSource(sourceId)) {
    _map.getSource(sourceId).setData(geojson);
    return;
  }

  _map.addSource(sourceId, { type: 'geojson', data: geojson });

  if (layer.geometry_type === 'point') {
    // Circle marker (provides color background for all point layers)
    await ensureOSMIcons(_map);

    _map.addLayer({
      id: `${sourceId}-circle`,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius':         layer.slug === 'airnow' ? 19 : 9,
        'circle-color':          layer.color || '#7FA843',
        'circle-opacity':        layer.slug === 'airnow' ? 0.9 : 0.85,
        'circle-stroke-width':   layer.slug === 'airnow' ? 2 : 1.5,
        'circle-stroke-color':   'rgba(255,255,255,0.3)',
        'circle-stroke-opacity': 1,
      },
    });

    // Icon overlay — keyed per layer slug
    const iconImageExpr = layer.slug === 'osm-resources'
      ? ['concat', 'osm-', ['get', 'amenity']]
      : layer.slug === 'airnow'
        ? 'airnow-thermometer'
        : layer.slug === 'fqhc'
          ? 'fqhc-icon'
          : layer.slug === 'snap-retailers'
            ? 'snap-icon'
            : null;

    if (iconImageExpr) {
      _map.addLayer({
        id: `${sourceId}-icon`,
        type: 'symbol',
        source: sourceId,
        layout: {
          'icon-image':            iconImageExpr,
          'icon-size':             layer.slug === 'airnow' ? 1.25 : 1.0,
          'icon-allow-overlap':    true,
          'icon-ignore-placement': true,
        },
      });
    }

    // Center viewport if AirNow stations are all off-screen
    if (layer.slug === 'airnow') {
      const bounds = _map.getBounds();
      const anyInView = geojson.features.some(f => {
        const [lng, lat] = f.geometry.coordinates;
        return bounds.contains([lng, lat]);
      });
      if (!anyInView && geojson.features.length > 0) {
        _map.flyTo({ center: geojson.features[0].geometry.coordinates, zoom: Math.max(_map.getZoom(), 11) });
      }
    }

    const onPointClick = (e) => {
      const feature = e.features[0];
      if (!feature) return;
      showPointPopup(e.lngLat, layer, feature.properties);
    };
    const onEnter = () => { _map.getCanvas().style.cursor = 'pointer'; };
    const onLeave = () => { _map.getCanvas().style.cursor = ''; };

    [`${sourceId}-circle`, `${sourceId}-icon`].forEach(lid => {
      if (!_map.getLayer(lid)) return;
      _map.on('click', lid, onPointClick);
      _map.on('mouseenter', lid, onEnter);
      _map.on('mouseleave', lid, onLeave);
    });

  } else if (layer.slug === 'neighborhood-assoc') {
    _map.addLayer({
      id: `${sourceId}-fill`,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color':   ['match', ['get', 'status'], 'ACTIVE', '#2196A5', '#aaaaaa'],
        'fill-opacity': ['match', ['get', 'status'], 'ACTIVE', 0.18, 0.07],
      },
    });
    _map.addLayer({
      id: `${sourceId}-outline`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color':   ['match', ['get', 'status'], 'ACTIVE', '#2196A5', '#999999'],
        'line-opacity': ['match', ['get', 'status'], 'ACTIVE', 0.85, 0.35],
        'line-width': 1.5,
      },
    });
    _map.addLayer({
      id: `${sourceId}-label`,
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field':         ['get', 'name'],
        'text-font':          ['Noto Sans Regular'],
        'text-size':          11,
        'text-anchor':        'center',
        'text-max-width':     8,
        'text-allow-overlap': false,
      },
      paint: {
        'text-color':      ['match', ['get', 'status'], 'ACTIVE', '#0d5c6e', '#666666'],
        'text-halo-color': 'rgba(255,255,255,0.85)',
        'text-halo-width': 1.5,
        'text-opacity':    ['match', ['get', 'status'], 'ACTIVE', 1, 0.55],
      },
    });

  } else {
    // Choropleth polygon layer
    const choropleth = CHOROPLETH[layer.slug];
    let fillColor;

    if (choropleth) {
      const { property, computedExpr, stops } = choropleth;
      if (computedExpr) {
        fillColor = [
          'case',
          ['==', ['to-number', ['get', 'renter_hh'], 0], 0], '#cccccc',
          ['interpolate', ['linear'], computedExpr, ...stops.flat()],
        ];
      } else {
        fillColor = [
          'case',
          ['==', ['get', property], null], '#cccccc',
          ['<',  ['get', property], 0],    '#cccccc',
          ['interpolate', ['linear'], ['get', property], ...stops.flat()],
        ];
      }
    } else {
      fillColor = layer.color || '#7FA843';
    }

    _map.addLayer({
      id: `${sourceId}-fill`,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color':   fillColor,
        'fill-opacity': choropleth ? (_layerOpacity[layer.slug] || 0.75) : 0.18,
      },
    });
    _map.addLayer({
      id: `${sourceId}-outline`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color':   choropleth ? '#555555' : (layer.color || '#7FA843'),
        'line-opacity': choropleth ? 0.35 : 0.6,
        'line-width': 1,
      },
    });
  }
}

// â”€â”€ Info Drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let _drawerEl = null;
let _drawerCloseCallback = null;

function initDrawer(map) {
  _drawerEl = document.createElement('div');
  _drawerEl.id = 'info-drawer';
  _drawerEl.setAttribute('role', 'dialog');
  _drawerEl.setAttribute('aria-labelledby', 'info-drawer-title');
  _drawerEl.setAttribute('aria-modal', 'false');
  _drawerEl.style.cssText = [
    'position:absolute;top:0;right:0;width:300px;height:100%',
    'background:var(--bark);border-left:2px solid var(--border)',
    'display:flex;flex-direction:column;z-index:20',
    'transform:translateX(100%);transition:transform 0.2s ease',
  ].join(';');

  const drawerHeader = document.createElement('div');
  drawerHeader.style.cssText = [
    'display:flex;align-items:center;justify-content:space-between',
    'padding:10px 14px;border-bottom:1px solid var(--border)',
    'font-family:var(--font-label);font-size:9px;letter-spacing:0.15em',
    'color:var(--text-muted);text-transform:uppercase;flex-shrink:0',
  ].join(';');
  drawerHeader.innerHTML = '<span id="info-drawer-title">Layer Data</span>';

  const closeBtn = document.createElement('button');
  closeBtn.id = 'info-drawer-close';
  closeBtn.setAttribute('aria-label', 'Close data panel');
  closeBtn.textContent = '\u2715';
  closeBtn.style.cssText = 'background:none;border:none;color:var(--text-muted);cursor:pointer;font-family:var(--font-label);font-size:11px;padding:2px 4px;line-height:1;transition:color 0.1s';
  closeBtn.addEventListener('click', closeDrawer);
  drawerHeader.appendChild(closeBtn);

  const drawerBody = document.createElement('div');
  drawerBody.id = 'info-drawer-body';
  drawerBody.style.cssText = 'flex:1;overflow-y:auto;padding:8px 0;scrollbar-width:thin;scrollbar-color:var(--bark-light) var(--bark)';

  _drawerEl.append(drawerHeader, drawerBody);
  document.getElementById('map-container').appendChild(_drawerEl);

  // Click on map opens the drawer for polygon layers
  map.on('click', async (e) => {
    // If an alert polygon fill was clicked, let the alert handler run instead.
    // Alert polygon layers are named cg-alert-<id>-fill.
    const hitAlertPolygon = map.queryRenderedFeatures(e.point)
      .some(f => f.layer && f.layer.id && f.layer.id.startsWith('cg-alert-') && f.layer.id.endsWith('-fill'));
    if (hitAlertPolygon) return;

    // If a point layer was clicked, let its popup handler run instead
    const pointLayerIds = Object.keys(layerState)
      .filter(slug => layerState[slug] && POINT_LAYER_SLUGS.has(slug))
      .map(slug => `cg-${slug}-circle`)
      .filter(id => map.getLayer(id));

    const pointFeatures = map.queryRenderedFeatures(e.point, { layers: pointLayerIds });
    if (pointFeatures.length > 0) return;

    const activeAreaSlugs = Object.keys(layerState).filter(slug =>
      layerState[slug] && !POINT_LAYER_SLUGS.has(slug)
    );
    if (activeAreaSlugs.length === 0) return;

    await openDrawer(e.lngLat, activeAreaSlugs);
  });
}

function closeDrawer() {
  if (_drawerEl) _drawerEl.style.transform = 'translateX(100%)';
  if (_drawerCloseCallback) { _drawerCloseCallback(); _drawerCloseCallback = null; }
}

async function openDrawer(lngLat, slugs) {
  if (!_drawerEl) return;
  if (_drawerCloseCallback) { _drawerCloseCallback(); _drawerCloseCallback = null; }
  const titleEl = document.getElementById('info-drawer-title');
  if (titleEl) titleEl.textContent = 'Layer Data';
  const body = document.getElementById('info-drawer-body');
  body.innerHTML = '<div style="padding:12px 14px;font-family:var(--font-label);font-size:10px;color:var(--text-muted)">Loading\u2026</div>';
  _drawerEl.style.transform = 'translateX(0)';

  const slugParam = slugs.join(',');
  const pointParam = `${lngLat.lng.toFixed(6)},${lngLat.lat.toFixed(6)}`;

  let results;
  try {
    results = await apiFetch(`/features?point=${pointParam}&layers=${encodeURIComponent(slugParam)}`);
  } catch (err) {
    body.innerHTML = `<div style="padding:12px 14px;font-family:var(--font-label);font-size:10px;color:var(--danger)">Failed to load data.</div>`;
    return;
  }

  body.innerHTML = '';
  let anyData = false;
  const featureMap = results.features || {};

  slugs.forEach((slug, idx) => {
    const layer = _layerMeta[slug];
    if (!layer) return;
    const feature = featureMap[slug];
    const card = buildDrawerCard(layer, feature ? feature.properties : null, idx === 0);
    body.appendChild(card);
    if (feature) anyData = true;
  });

  if (!anyData) {
    const msg = document.createElement('div');
    msg.style.cssText = 'padding:12px 14px;font-family:var(--font-label);font-size:10px;color:var(--text-muted)';
    msg.textContent = 'No data at this location for the active layers.';
    body.appendChild(msg);
  }
}

function buildDrawerCard(layer, props, autoExpand) {
  const hasData = props !== null;
  const choropleth = CHOROPLETH[layer.slug];
  const labelCfg = CHOROPLETH_LABEL[layer.slug];

  const card = document.createElement('div');
  card.style.cssText = `border-bottom:1px solid var(--border);${hasData ? '' : 'opacity:0.45'}`;

  const header = document.createElement('div');
  header.style.cssText = [
    'display:flex;align-items:center;gap:8px;padding:8px 14px',
    'cursor:pointer;user-select:none',
    'font-family:var(--font-label);font-size:11px;color:var(--text-secondary)',
  ].join(';');

  const dot = document.createElement('div');
  dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${layer.color || '#7FA843'};flex-shrink:0;border:1px solid rgba(255,255,255,0.2)`;

  const titleEl = document.createElement('span');
  titleEl.style.cssText = 'flex:1;font-size:11px;color:var(--text-primary)';
  titleEl.textContent = layer.name;

  // Key metric chip in header
  let metricEl = null;
  if (hasData && choropleth && labelCfg) {
    let val = props[choropleth.property];
    if (layer.slug === 'chas-renter-burden' && val == null && props.renter_cost_burdened != null && props.renter_hh > 0) {
      val = props.renter_cost_burdened / props.renter_hh;
    }
    if (val != null && val >= 0) {
      const color = choroplethColor(val, choropleth.stops, choropleth.stopType);
      metricEl = document.createElement('span');
      metricEl.style.cssText = 'font-size:10px;color:var(--text-primary);display:flex;align-items:center;gap:4px';
      metricEl.innerHTML = `<span style="width:10px;height:10px;border-radius:2px;background:${color};display:inline-block;flex-shrink:0;border:1px solid rgba(0,0,0,0.2)"></span>${escHtml(labelCfg.format(val))}`;
    }
  }

  const chevron = document.createElement('span');
  chevron.style.cssText = 'font-size:9px;color:var(--text-muted);flex-shrink:0;transition:transform 0.15s';
  chevron.textContent = 'â–¾';
  if (!autoExpand) chevron.style.transform = 'rotate(-90deg)';

  header.append(dot, titleEl);
  if (metricEl) header.appendChild(metricEl);
  header.appendChild(chevron);

  const body = document.createElement('div');
  body.style.cssText = `padding:0 14px ${autoExpand ? '10px' : '0'};overflow:hidden;max-height:${autoExpand ? '500px' : '0'};transition:max-height 0.2s ease,padding 0.2s ease`;

  header.addEventListener('click', () => {
    const isOpen = body.style.maxHeight !== '0px' && body.style.maxHeight !== '0';
    body.style.maxHeight = isOpen ? '0' : '500px';
    body.style.paddingBottom = isOpen ? '0' : '10px';
    chevron.style.transform = isOpen ? 'rotate(-90deg)' : '';
  });

  if (!hasData) {
    const noData = document.createElement('div');
    noData.style.cssText = 'font-family:var(--font-label);font-size:9px;color:var(--text-muted);padding:0 0 8px';
    noData.textContent = 'No data at this location.';
    body.appendChild(noData);
  } else if (layer.slug === 'neighborhood-assoc') {
    body.innerHTML = buildNeighborhoodBody(props);
  } else {
    body.innerHTML = buildChoroplethBody(layer, props, choropleth, labelCfg);
  }

  if (hasData) {
    const footer = document.createElement('div');
    footer.style.cssText = 'font-family:var(--font-label);font-size:9px;color:var(--text-muted);display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:0 0 4px';
    footer.innerHTML = `
      <span class="claim-badge claim-${escHtml(layer.claim_type)}">${escHtml(layer.claim_type)}</span>
      <span>${escHtml(layer.source)}</span>
      <span>${'\u2605'.repeat(layer.trust_rating || 0)}</span>`;
    body.appendChild(footer);
  }

  card.append(header, body);
  return card;
}

function buildChoroplethBody(layer, props, choropleth, labelCfg) {
  const lines = [];

  if (choropleth && labelCfg) {
    let val = props[choropleth.property];
    if (layer.slug === 'chas-renter-burden' && val == null && props.renter_cost_burdened != null && props.renter_hh > 0) {
      val = props.renter_cost_burdened / props.renter_hh;
    }
    if (val != null && val >= 0) {
      const color = choroplethColor(val, choropleth.stops, choropleth.stopType);
      const note = labelCfg.note ? ` <span style="font-style:italic;color:var(--text-muted)">â€” ${escHtml(labelCfg.note)}</span>` : '';
      lines.push(`
        <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.04);border-radius:3px;padding:6px 8px;margin-bottom:6px">
          <div style="width:14px;height:14px;border-radius:2px;background:${color};flex-shrink:0;border:1px solid rgba(0,0,0,0.2)"></div>
          <div>
            <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em">${escHtml(labelCfg.label)}${note}</div>
            <div style="font-weight:600;font-size:13px;color:var(--text-primary)">${escHtml(labelCfg.format(val))}</div>
          </div>
        </div>`);
    }
  }

  const SKIP = new Set(['geoid', 'data_year', 'source', 'attribution', 'license']);
  const skipProp = choropleth ? choropleth.property : null;
  const entries = Object.entries(props)
    .filter(([k, v]) => !SKIP.has(k) && !k.startsWith('_') && k !== skipProp && v != null && v !== '')
    .slice(0, 10);

  if (entries.length > 0) {
    lines.push('<dl style="display:grid;grid-template-columns:auto 1fr;gap:1px 8px;font-size:10px;margin-bottom:6px">');
    entries.forEach(([k, v]) => {
      const dKey = k.replace(/_/g, ' ');
      const dVal = typeof v === 'number' && v < 2 && v > 0 ? `${(v * 100).toFixed(1)}%`
        : typeof v === 'number' && v > 100 ? v.toLocaleString()
        : String(v);
      lines.push(`<dt style="color:var(--text-muted);font-size:9px;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap">${escHtml(dKey)}</dt><dd style="color:var(--text-secondary)">${escHtml(dVal)}</dd>`);
    });
    lines.push('</dl>');
  }

  if (layer.description) {
    lines.push(`<div style="font-family:var(--font-body);font-size:10px;color:var(--text-muted);font-style:italic;margin-bottom:4px;line-height:1.5">${escHtml(layer.description)}</div>`);
  }

  return lines.join('');
}

function buildNeighborhoodBody(props) {
  const isActive = props.status === 'ACTIVE';
  const badge = isActive ? '#2196A5' : '#888';
  const label = isActive ? 'Active' : 'Inactive';
  const meeting = [props.meet_schedule, props.meet_place].filter(Boolean).join(' â€” ') || null;
  const email = props.email
    ? `<a href="mailto:${escHtml(props.email)}" style="color:#2196A5">${escHtml(props.email)}</a>`
    : null;
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <div style="width:10px;height:10px;border-radius:50%;background:${badge};flex-shrink:0"></div>
      <span style="font-size:11px;color:var(--text-primary)">${escHtml(label)}</span>
    </div>
    ${props.president ? `<div style="font-size:10px;margin-bottom:3px;color:var(--text-secondary)"><b>President:</b> ${escHtml(props.president)}</div>` : ''}
    ${meeting ? `<div style="font-size:10px;margin-bottom:3px;color:var(--text-secondary)"><b>Meetings:</b> ${escHtml(meeting)}</div>` : ''}
    ${email ? `<div style="font-size:10px;margin-bottom:3px;color:var(--text-secondary)"><b>Contact:</b> ${email}</div>` : ''}`;
}

// â”€â”€ Point layer popup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function showPointPopup(lngLat, layer, props) {
  let headerHtml = '';

  if (layer.slug === 'osm-resources') {
    headerHtml = `
      <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.04);border-radius:3px;padding:6px 8px;margin-bottom:8px">
        <div style="width:14px;height:14px;border-radius:50%;background:${escHtml(layer.color || '#7FA843')};flex-shrink:0"></div>
        <div>
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em">Type</div>
          <div style="font-weight:600;font-size:13px;color:var(--text-primary)">${escHtml(props.category_label || props.amenity || 'Unknown')}</div>
        </div>
      </div>`;
  } else if (layer.slug === 'airnow') {
    const aqi = props.aqi || props.AQI;
    if (aqi != null) {
      headerHtml = `
        <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.04);border-radius:3px;padding:6px 8px;margin-bottom:8px">
          <div style="width:14px;height:14px;border-radius:3px;background:${layer.color || '#7FA843'};flex-shrink:0"></div>
          <div>
            <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em">AQI</div>
            <div style="font-weight:600;font-size:13px;color:var(--text-primary)">${escHtml(String(aqi))}</div>
          </div>
        </div>`;
    }
  }

  const SKIP_POPUP = new Set(['osm_id', 'source', 'osm_timestamp', '_layer', '_aggregation_level', '_last_updated', 'amenity']);
  const entries = Object.entries(props)
    .filter(([k]) => !SKIP_POPUP.has(k) && !k.startsWith('_'))
    .slice(0, 10);
  const propsHtml = entries
    .map(([k, v]) => `<dt style="color:var(--text-muted);font-size:9px;text-transform:uppercase;letter-spacing:0.1em">${escHtml(k.replace(/_/g, ' '))}</dt><dd style="color:var(--text-secondary);font-size:11px">${escHtml(String(v))}</dd>`)
    .join('');

  const content = `
    <div class="popup-inner">
      <div class="popup-title">${escHtml(props.name || layer.name)}</div>
      ${headerHtml}
      <dl class="popup-props" style="display:grid;grid-template-columns:auto 1fr;gap:2px 8px">${propsHtml}</dl>
    </div>
    <div class="popup-footer">
      <span class="claim-badge claim-${escHtml(layer.claim_type)}">${escHtml(layer.claim_type)}</span>
      <span>${escHtml(layer.source)}</span>
      <span>${'\u2605'.repeat(layer.trust_rating || 0)}</span>
    </div>`;

  new maplibregl.Popup({ maxWidth: '300px', closeButton: true })
    .setLngLat(lngLat)
    .setHTML(content)
    .addTo(_map);
}

// â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function choroplethColor(value, stops, stopType = 'fraction') {
  if (value <= stops[0][0]) return stops[0][1];
  if (value >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [v0, c0] = stops[i];
    const [v1, c1] = stops[i + 1];
    if (value >= v0 && value <= v1) {
      return lerpHex(c0, c1, (value - v0) / (v1 - v0));
    }
  }
  return stops[stops.length - 1][1];
}

function lerpHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 0xff) * (1 - t) + ((pb >> 16) & 0xff) * t);
  const g = Math.round(((pa >>  8) & 0xff) * (1 - t) + ((pb >>  8) & 0xff) * t);
  const bl= Math.round(( pa        & 0xff) * (1 - t) + ( pb        & 0xff) * t);
  return '#' + [r, g, bl].map(x => x.toString(16).padStart(2, '0')).join('');
}

function updateToggleUI(slug, active) {
  const item = document.querySelector(`.layer-item[data-slug="${slug}"]`);
  if (!item) return;
  item.classList.toggle('active', active);
  item.setAttribute('aria-pressed', String(active));
  // opacity row visibility is handled by CSS (.layer-item.active .layer-opacity-row)
}

function getBbox(map) {
  const b = map.getBounds();
  return `${b.getWest().toFixed(6)},${b.getSouth().toFixed(6)},${b.getEast().toFixed(6)},${b.getNorth().toFixed(6)}`;
}

export function enableLayerBySlug(slug) {
  if (!_layerMeta[slug] || layerState[slug]) return;
  enableLayer(_layerMeta[slug]);
}

export function openDrawerWithContent(title, bodyEl, onClose) {
  if (!_drawerEl) return;
  // Fire any pending close callback before replacing content
  if (_drawerCloseCallback) { _drawerCloseCallback(); _drawerCloseCallback = null; }
  _drawerCloseCallback = onClose || null;
  const titleEl = document.getElementById('info-drawer-title');
  if (titleEl) titleEl.textContent = title;
  const body = document.getElementById('info-drawer-body');
  body.innerHTML = '';
  if (bodyEl instanceof HTMLElement) {
    body.appendChild(bodyEl);
  } else {
    body.innerHTML = String(bodyEl);
  }
  _drawerEl.style.transform = 'translateX(0)';
  // Move focus to close button when drawer opens
  const closeBtn = document.getElementById('info-drawer-close');
  if (closeBtn) setTimeout(() => closeBtn.focus(), 50);
}

export async function refreshActiveLayers() {
  if (!_map) return;
  const activeSlugs = Object.entries(layerState)
    .filter(([, active]) => active)
    .map(([slug]) => slug);

  for (const slug of activeSlugs) {
    const sourceId = `cg-${slug}`;
    const source = _map.getSource(sourceId);
    if (!source) continue;
    const bbox = getBbox(_map);
    try {
      const geojson = await apiFetch(`/features?layer=${slug}&bbox=${bbox}`);
      source.setData(geojson);
    } catch (err) {
      console.error(`[layers] Failed to refresh ${slug}:`, err.message);
    }
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export { layerState };


