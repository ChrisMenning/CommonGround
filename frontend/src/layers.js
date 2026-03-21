/**
 * layers.js — layer management and sidebar rendering.
 *
 * Layers are grouped by data type and toggled on/off via sidebar toggles.
 * All layer colors and trust ratings come from the API /layers response.
 */
'use strict';
import { apiFetch } from './api-client.js';

// maplibregl is a global loaded from vendor/maplibre-gl.js
/* global maplibregl */

const LAYER_GROUPS = {
  'Environmental':  ['ejscreen', 'airnow'],
  'Food Access':    ['food-access', 'snap-retailers'],
  'Housing':        ['hud-chas', 'eviction-lab'],
  'Health':         ['fqhc', 'svi'],
  'Community':      ['osm-resources', 'neighborhood-assoc'],
};

// Track which layers are currently enabled
const layerState = {};

let _map = null;
let _layerMeta = {};  // slug → layer metadata

export async function initLayers(map) {
  _map = map;

  let layers;
  try {
    const data = await apiFetch('/layers');
    layers = data.layers;
  } catch (err) {
    console.error('[layers] Failed to load layer list:', err.message);
    document.getElementById('layer-controls').innerHTML =
      '<div class="section-label" style="padding:10px 16px;color:#C0392B">Failed to load layers.</div>';
    return;
  }

  layers.forEach(l => { _layerMeta[l.slug] = l; });
  renderLayerControls(layers);
}

function renderLayerControls(layers) {
  const container = document.getElementById('layer-controls');
  container.innerHTML = '';

  const bySlug = {};
  layers.forEach(l => { bySlug[l.slug] = l; });

  // Render grouped layers
  const rendered = new Set();

  for (const [groupName, slugs] of Object.entries(LAYER_GROUPS)) {
    const groupLayers = slugs.map(s => bySlug[s]).filter(Boolean);
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

  // Render any layers not in a group
  const ungrouped = layers.filter(l => !rendered.has(l.slug));
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
  item.title = `${layer.description || layer.name}\nSource: ${layer.source}\nTrust: ${layer.trust_rating}/5\nClaim type: ${layer.claim_type}`;

  const dot = document.createElement('div');
  dot.className = 'layer-dot';
  dot.style.background = layer.color || '#7FA843';

  const nameWrapper = document.createElement('span');
  nameWrapper.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:1px;min-width:0';

  const nameEl = document.createElement('span');
  nameEl.textContent = layer.name;

  nameWrapper.appendChild(nameEl);

  if (layer.data_vintage) {
    const vintageEl = document.createElement('span');
    vintageEl.textContent = `Data: ${layer.data_vintage}`;
    vintageEl.style.cssText = 'font-size:10px;color:#888;line-height:1.2';
    nameWrapper.appendChild(vintageEl);
  }

  const trust = document.createElement('span');
  trust.className = 'trust-pip';
  trust.textContent = '★'.repeat(layer.trust_rating || 0);

  const toggle = document.createElement('div');
  toggle.className = 'layer-toggle';

  item.append(dot, nameWrapper, trust, toggle);

  item.addEventListener('click', () => {
    const isActive = layerState[layer.slug];
    if (isActive) {
      disableLayer(layer);
    } else {
      enableLayer(layer);
    }
  });

  return item;
}

const LEGEND_CONFIG = {
  'svi':          { title: 'Social Vulnerability Index', stops: [[0,'#ffffb2','Low'],[0.5,'#fd8d3c',''],[1,'#bd0026','High']] },
  'ejscreen':     { title: 'EJScreen Percentile',        stops: [[0,'#edf8e9','Low'],[0.5,'#74c476',''],[1,'#006d2c','High']] },
  'hud-chas':     { title: 'Housing Cost Burden',        stops: [[0,'#f7fbff','Low'],[0.5,'#4292c6',''],[1,'#084594','High']] },
  'food-access':  { title: 'Low Income & Low Access',    stops: [[0,'#f7fcb9','No'],[1,'#31a354','Yes']] },
  'eviction-lab': { title: 'Eviction Rate',              stops: [[0,'#fff5f0','Low'],[0.10,'#fb6a4a',''],[0.20,'#cb181d','High']] },
};

function updateLegend() {
  let el = document.getElementById('map-legend');
  // Find the first active choropleth layer
  const activeSlug = Object.entries(layerState).find(([slug, on]) => on && LEGEND_CONFIG[slug]);
  if (!activeSlug) {
    if (el) el.style.display = 'none';
    return;
  }
  const [slug] = activeSlug;
  const cfg = LEGEND_CONFIG[slug];
  if (!el) {
    el = document.createElement('div');
    el.id = 'map-legend';
    el.style.cssText = 'position:absolute;bottom:28px;right:10px;background:rgba(255,255,255,0.92);border-radius:6px;padding:8px 10px;font-size:11px;box-shadow:0 1px 4px rgba(0,0,0,0.25);z-index:10;pointer-events:none;min-width:120px';
    document.getElementById('map').appendChild(el);
  }
  const gradient = cfg.stops.map(([v, c]) => `${c} ${v * 100}%`).join(', ');
  el.innerHTML = `
    <div style="font-weight:600;margin-bottom:5px;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#555">${escHtml(cfg.title)}</div>
    <div style="height:10px;border-radius:3px;background:linear-gradient(to right,${gradient});margin-bottom:4px"></div>
    <div style="display:flex;justify-content:space-between;color:#666">
      <span>${escHtml(cfg.stops[0][2])}</span>
      <span>${escHtml(cfg.stops[cfg.stops.length-1][2])}</span>
    </div>`;
  el.style.display = 'block';
}

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
  const layerId  = `cg-${layer.slug}-fill`;
  const outlineId = `cg-${layer.slug}-outline`;
  const circleId = `cg-${layer.slug}-circle`;
  const labelId  = `cg-${layer.slug}-label`;
  [layerId, outlineId, circleId, labelId].forEach(id => {
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
    // Monitoring station layers (AirNow) use a hollow ring marker to indicate
    // the point is a reference location, not a feature centered on that spot.
    const isMonitorStation = layer.slug === 'airnow';
    _map.addLayer({
      id: `${sourceId}-circle`,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius':        isMonitorStation ? 10 : 6,
        'circle-color':         isMonitorStation ? 'transparent' : (layer.color || '#7FA843'),
        'circle-opacity':       isMonitorStation ? 1 : 0.85,
        'circle-stroke-width':  isMonitorStation ? 3 : 1,
        'circle-stroke-color':  layer.color || '#7FA843',
        'circle-stroke-opacity': isMonitorStation ? 0.9 : 0.6,
      },
    });
  } else {
    // Choropleth config: layers that should be color-ramped by a data property
    // rather than drawn as a flat color.  property must be 0–1 (percentile rank).
    const CHOROPLETH = {
      'svi':          { property: 'svi_overall',      stops: [[0,'#ffffb2'],[0.25,'#fecc5c'],[0.5,'#fd8d3c'],[0.75,'#f03b20'],[1,'#bd0026']] },
      'ejscreen':     { property: 'ejscreen_pctile',  stops: [[0,'#edf8e9'],[0.25,'#bae4b3'],[0.5,'#74c476'],[0.75,'#31a354'],[1,'#006d2c']] },
      'hud-chas':     { property: 'pct_cost_burdened',stops: [[0,'#f7fbff'],[0.25,'#9ecae1'],[0.5,'#4292c6'],[0.75,'#2171b5'],[1,'#084594']] },
      'food-access':  { property: 'lila_flag',        stops: [[0,'#f7fcb9'],[1,'#31a354']] },
      'eviction-lab': { property: 'eviction_rate',    stops: [[0,'#fff5f0'],[0.05,'#fcbba1'],[0.10,'#fb6a4a'],[0.15,'#ef3b2c'],[0.20,'#cb181d']] },
    };

    const choropleth = CHOROPLETH[layer.slug];
    let fillColor;
    if (layer.slug === 'neighborhood-assoc') {
      // Data-driven style: active associations in teal, inactive in gray.
      // This differentiates reorganizing/inactive neighborhoods without hiding them.
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
    } else if (choropleth) {
      // Build an interpolate expression: null/missing values fall back to grey
      fillColor = [
        'case',
        ['==', ['get', choropleth.property], null], '#cccccc',
        ['<',  ['get', choropleth.property], 0],    '#cccccc',
        [
          'interpolate', ['linear'], ['get', choropleth.property],
          ...choropleth.stops.flat(),
        ],
      ];
    } else {
      fillColor = layer.color || '#7FA843';
    }

    if (layer.slug !== 'neighborhood-assoc') {
      _map.addLayer({
        id: `${sourceId}-fill`,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': fillColor,
          'fill-opacity': choropleth ? 0.75 : 0.18,
        },
      });
      _map.addLayer({
        id: `${sourceId}-outline`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': choropleth ? '#555555' : (layer.color || '#7FA843'),
          'line-opacity': choropleth ? 0.35 : 0.6,
          'line-width': 1,
        },
      });
    }
  }

  // Click popup for features
  const clickLayerId = layer.geometry_type === 'point'
    ? `${sourceId}-circle`
    : `${sourceId}-fill`;

  _map.on('click', clickLayerId, (e) => {
    const feature = e.features[0];
    if (!feature) return;
    showFeaturePopup(e.lngLat, layer, feature.properties);
  });

  _map.on('mouseenter', clickLayerId, () => {
    _map.getCanvas().style.cursor = 'pointer';
  });
  _map.on('mouseleave', clickLayerId, () => {
    _map.getCanvas().style.cursor = '';
  });
}

function showFeaturePopup(lngLat, layer, props) {
  // Remove internal CG properties from display
  const displayProps = Object.fromEntries(
    Object.entries(props).filter(([k]) => !k.startsWith('_'))
  );

  // Choropleth key metric — shown prominently at the top of the popup
  const CHOROPLETH_LABEL = {
    'svi':          { property: 'svi_overall',      label: 'Social Vulnerability',       format: v => `${Math.round(v * 100)}th percentile`, colorFn: v => choroplethColor(v, [[0,'#ffffb2'],[0.25,'#fecc5c'],[0.5,'#fd8d3c'],[0.75,'#f03b20'],[1,'#bd0026']]) },
    'ejscreen':     { property: 'ejscreen_pctile',   label: 'EJ Screen Percentile',       format: v => `${Math.round(v * 100)}th percentile`, colorFn: v => choroplethColor(v, [[0,'#edf8e9'],[0.25,'#bae4b3'],[0.5,'#74c476'],[0.75,'#31a354'],[1,'#006d2c']]) },
    'hud-chas':     { property: 'pct_cost_burdened', label: 'Cost-Burdened Households',   format: v => `${Math.round(v * 100)}%`, colorFn: v => choroplethColor(v, [[0,'#f7fbff'],[0.25,'#9ecae1'],[0.5,'#4292c6'],[0.75,'#2171b5'],[1,'#084594']]) },
    'food-access':  { property: 'lila_flag',         label: 'Low Income & Low Access',    format: v => v === 1 ? 'Yes' : 'No', colorFn: v => v === 1 ? '#31a354' : '#f7fcb9' },
    'eviction-lab': { property: 'eviction_rate',     label: 'Eviction Rate',              format: v => `${(v * 100).toFixed(1)}%`, colorFn: v => choroplethColor(v, [[0,'#fff5f0'],[0.05,'#fcbba1'],[0.10,'#fb6a4a'],[0.15,'#ef3b2c'],[0.20,'#cb181d']]) },
  };

  const choroplethMeta = CHOROPLETH_LABEL[layer.slug];
  let keyMetricHtml = '';

  // Neighborhood associations get a custom header showing status + meeting info
  if (layer.slug === 'neighborhood-assoc') {
    const isActive = props.status === 'ACTIVE';
    const badgeColor  = isActive ? '#2196A5' : '#888';
    const badgeLabel  = isActive ? 'Active' : 'Inactive';
    const meetingInfo = [props.meet_schedule, props.meet_place].filter(Boolean).join(' — ') || null;
    const emailHtml   = props.email
      ? `<a href="mailto:${escHtml(props.email)}" style="color:#2196A5">${escHtml(props.email)}</a>`
      : null;
    keyMetricHtml = `
      <div style="display:flex;align-items:center;gap:8px;background:#f5f5f5;border-radius:4px;padding:6px 8px;margin-bottom:8px">
        <div style="width:16px;height:16px;border-radius:50%;background:${badgeColor};flex-shrink:0"></div>
        <div>
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em">Status</div>
          <div style="font-weight:600;font-size:13px">${escHtml(badgeLabel)}</div>
        </div>
      </div>
      ${props.president ? `<div style="font-size:11px;margin-bottom:4px"><b>President:</b> ${escHtml(props.president)}</div>` : ''}
      ${meetingInfo    ? `<div style="font-size:11px;margin-bottom:4px"><b>Meetings:</b> ${escHtml(meetingInfo)}</div>` : ''}
      ${emailHtml      ? `<div style="font-size:11px;margin-bottom:6px"><b>Contact:</b> ${emailHtml}</div>` : ''}`;
  } else if (choroplethMeta) {
    const raw = props[choroplethMeta.property];
    if (raw != null && raw >= 0) {
      const color = choroplethMeta.colorFn(raw);
      keyMetricHtml = `
        <div style="display:flex;align-items:center;gap:8px;background:#f5f5f5;border-radius:4px;padding:6px 8px;margin-bottom:8px">
          <div style="width:16px;height:16px;border-radius:3px;background:${color};flex-shrink:0;border:1px solid rgba(0,0,0,0.15)"></div>
          <div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em">${escHtml(choroplethMeta.label)}</div>
            <div style="font-weight:600;font-size:13px">${escHtml(choroplethMeta.format(raw))}</div>
          </div>
        </div>`;
    }
  }

  // Exclude the key metric from the general properties list to avoid duplication
  const skipProps = choroplethMeta
    ? new Set([choroplethMeta.property])
    : layer.slug === 'neighborhood-assoc'
      ? new Set(['president', 'email', 'meet_place', 'meet_schedule', 'status', 'is_active', 'jurisdiction', 'source', 'data_year'])
      : new Set();
  const propsHtml = Object.entries(displayProps)
    .filter(([k]) => !skipProps.has(k))
    .slice(0, 12)
    .map(([k, v]) => `<dt style="color:var(--text-muted);font-size:9px;text-transform:uppercase;letter-spacing:0.1em">${escHtml(k)}</dt><dd>${escHtml(String(v))}</dd>`)
    .join('');

  const content = `
    <div class="popup-inner">
      <div class="popup-title">${escHtml(layer.name)}</div>
      ${keyMetricHtml}
      <dl class="popup-props" style="display:grid;grid-template-columns:auto 1fr;gap:2px 8px">${propsHtml}</dl>
    </div>
    <div class="popup-footer">
      <span class="claim-badge claim-${escHtml(layer.claim_type)}">${escHtml(layer.claim_type)}</span>
      <span>Source: ${escHtml(layer.source)}</span>
      <span>Trust: ${'★'.repeat(layer.trust_rating || 0)}</span>
    </div>`;

  new maplibregl.Popup({ maxWidth: '320px', closeButton: true })
    .setLngLat(lngLat)
    .setHTML(content)
    .addTo(_map);
}

/**
 * Interpolate a value (0–1) through a set of color stops [[val, hex], ...].
 * Returns a CSS hex color string.
 */
function choroplethColor(value, stops) {
  if (value <= stops[0][0]) return stops[0][1];
  if (value >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [v0, c0] = stops[i];
    const [v1, c1] = stops[i + 1];
    if (value >= v0 && value <= v1) {
      const t = (value - v0) / (v1 - v0);
      return lerpHex(c0, c1, t);
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
}

function getBbox(map) {
  const b = map.getBounds();
  return `${b.getWest().toFixed(6)},${b.getSouth().toFixed(6)},${b.getEast().toFixed(6)},${b.getNorth().toFixed(6)}`;
}

/**
 * Re-fetch features for all currently enabled layers (called on map moveend).
 * Only updates sources that already exist — no new layers are added here.
 */
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
