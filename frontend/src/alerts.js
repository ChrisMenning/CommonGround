/**
 * alerts.js — alert rendering for sidebar and map popups.
 *
 * DESIGN PRINCIPLE: every alert displayed must show:
 *   - claim_type (DOCUMENTED / MECHANISM / CORRELATION)
 *   - data sources
 *   - created_at timestamp
 *   - caution text (epistemic caveat)
 */
'use strict';
import { apiFetch, bboxFromMap } from './api-client.js';
import { enableLayerBySlug, openDrawerWithContent } from './layers.js';

/* global maplibregl */

let _map = null;
let _alertMarkerMap     = new Map(); // alert.id → Marker for point alerts
let _alertPolygonSources = [];        // MapLibre source IDs for polygon alert layers
let _alertVisible       = new Map(); // alert.id → boolean  (default: true = visible)

const SEVERITY_LABEL = { 1: 'TIER 1 — IMMEDIATE', 2: 'TIER 2 — EMERGING', 3: 'TIER 3 — AWARENESS' };

// Data layers to activate when each alert type is selected
const ALERT_LAYERS = {
  'T1-E01':   ['svi-overall'],
  'T1-H01':   ['eviction-filing-rate'],
  'T1-F01':   ['food-access', 'snap-retailers'],
  'T2-H01':   ['eviction-filing-rate', 'chas-cost-burdened'],
  'T2-F01':   ['food-access', 'snap-retailers'],
  'T2-C01':   ['svi-overall'],
  'T2-ENV01': ['ejscreen-ej-score', 'svi-overall'],
  'T3-S01':   ['fqhc', 'airnow'],
  'T3-I01':   [],
  'T3-R01':   ['svi-overall', 'osm-resources'],
};

let _focusedAlertId = null;

function _setAlertIndicator(active, severity) {
  const el = document.getElementById('alert-indicator');
  if (!el) return;
  if (!active) {
    el.classList.remove('active', 'sev-1', 'sev-2', 'sev-3');
    return;
  }
  el.classList.add('active');
  el.classList.remove('sev-1', 'sev-2', 'sev-3');
  el.classList.add(`sev-${severity}`);
}

export async function initAlerts(map) {
  _map = map;
  await refreshAlerts();
}

export async function refreshAlerts() {
  if (!_map) return;
  const bbox = bboxFromMap(_map);

  let alerts = [];
  try {
    const data = await apiFetch(`/alerts?bbox=${bbox}`);
    alerts = data.alerts || [];
  } catch (err) {
    console.error('[alerts] Failed to load alerts:', err.message);
  }

  renderAlertSidebar(alerts);
  renderAlertMarkers(alerts);
}

function renderAlertSidebar(alerts) {
  const list = document.getElementById('alert-list');
  const badge = document.getElementById('alert-count-badge');

  list.innerHTML = '';

  if (alerts.length === 0) {
    list.innerHTML = '<div id="no-alerts-msg">No active alerts for this area.</div>';
    badge.style.display = 'none';
    _setAlertIndicator(false, 0);
    return;
  }

  badge.style.display = '';
  badge.textContent = String(alerts.length);
  const minSeverity = Math.min(...alerts.map(a => a.severity));
  _setAlertIndicator(true, minSeverity);

  alerts.forEach(alert => {
    const isVisible = _alertVisible.get(alert.id) !== false; // default true
    const item = document.createElement('div');
    item.className = `alert-item alert-severity-${alert.severity}${isVisible ? ' map-visible' : ''}`;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `${SEVERITY_LABEL[alert.severity] || ''}: ${alert.title}. Click to view details.`);
    item.innerHTML = `
      <div class="alert-header">
        <div class="alert-title">${escHtml(alert.title)}</div>
        <div class="alert-map-toggle" role="switch" aria-checked="${isVisible}" aria-label="Show on map" tabindex="0" title="Toggle map visibility"></div>
      </div>
      <div class="alert-meta">
        <span class="claim-badge claim-${escHtml(alert.claim_type)}">${escHtml(alert.claim_type)}</span>
        <span>${escHtml(SEVERITY_LABEL[alert.severity] || `TIER ${alert.severity}`)}</span>
      </div>`;

    // Toggle stops propagation so it doesn't open the detail drawer
    const toggleEl = item.querySelector('.alert-map-toggle');
    const onToggle = (e) => {
      e.stopPropagation();
      const nowVisible = !(_alertVisible.get(alert.id) !== false);
      toggleEl.setAttribute('aria-checked', String(nowVisible));
      toggleAlertMap(alert, item);
    };
    toggleEl.addEventListener('click', onToggle);
    toggleEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(e); }
    });

    item.addEventListener('click', () => showAlertDetail(alert));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); showAlertDetail(alert); }
    });
    list.appendChild(item);
  });
}

function renderAlertMarkers(alerts) {
  // Reset focus tracking before removing all alert layers
  _focusedAlertId = null;

  // Clear existing point markers
  _alertMarkerMap.forEach(m => m.remove());
  _alertMarkerMap = new Map();

  // Clear existing polygon alert layers (including any focus rings)
  _alertPolygonSources.forEach(sourceId => {
    const focusId   = `${sourceId}-focus`;
    const outlineId = `${sourceId}-outline`;
    const fillId    = `${sourceId}-fill`;
    if (_map.getLayer(focusId))   _map.removeLayer(focusId);
    if (_map.getLayer(outlineId)) _map.removeLayer(outlineId);
    if (_map.getLayer(fillId))    _map.removeLayer(fillId);
    if (_map.getSource(sourceId)) _map.removeSource(sourceId);
  });
  _alertPolygonSources = [];

  alerts.forEach(alert => {
    if (!alert.affected_geometry) return;
    const geom = alert.affected_geometry;

    const color = alert.severity === 1 ? '#C0392B'
                : alert.severity === 2 ? '#D4A017'
                : '#5A7A32';

    if (geom.type === 'Point') {
      const [lng, lat] = geom.coordinates;
      const el = document.createElement('div');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', `Alert: ${alert.title}. Click for details.`);
      el.style.cssText = `
        width: 14px; height: 14px;
        border-radius: 50%;
        background: ${color};
        border: 2px solid #1A1208;
        cursor: pointer;
        box-shadow: 0 0 6px rgba(0,0,0,0.5);
      `;
      el.addEventListener('click', () => showAlertDetail(alert));
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showAlertDetail(alert); }
      });
      if (_alertVisible.get(alert.id) === false) el.style.display = 'none';

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(_map);
      _alertMarkerMap.set(alert.id, marker);

    } else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
      const sourceId = `cg-alert-${alert.id}`;
      if (_map.getSource(sourceId)) return; // already added

      _alertPolygonSources.push(sourceId);
      _map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'Feature', geometry: geom, properties: {} },
      });
      _map.addLayer({
        id: `${sourceId}-fill`,
        type: 'fill',
        source: sourceId,
        paint: { 'fill-color': color, 'fill-opacity': 0.15 },
      });
      _map.addLayer({
        id: `${sourceId}-outline`,
        type: 'line',
        source: sourceId,
        paint: { 'line-color': color, 'line-opacity': 0.75, 'line-width': 1.5 },
      });
      _map.on('click', `${sourceId}-fill`, () => showAlertDetail(alert));
      _map.on('mouseenter', `${sourceId}-fill`, () => { _map.getCanvas().style.cursor = 'pointer'; });
      _map.on('mouseleave', `${sourceId}-fill`, () => { _map.getCanvas().style.cursor = ''; });

      // Apply initial visibility based on toggle state
      if (_alertVisible.get(alert.id) === false) {
        _map.setLayoutProperty(`${sourceId}-fill`,    'visibility', 'none');
        _map.setLayoutProperty(`${sourceId}-outline`, 'visibility', 'none');
      }
    }
  });
}

function toggleAlertMap(alert, itemEl) {
  const wasVisible = _alertVisible.get(alert.id) !== false;
  const isVisible  = !wasVisible;
  _alertVisible.set(alert.id, isVisible);
  itemEl.classList.toggle('map-visible', isVisible);

  const vis      = isVisible ? 'visible' : 'none';
  const sourceId = `cg-alert-${alert.id}`;
  if (_map.getLayer(`${sourceId}-fill`))    _map.setLayoutProperty(`${sourceId}-fill`,    'visibility', vis);
  if (_map.getLayer(`${sourceId}-outline`)) _map.setLayoutProperty(`${sourceId}-outline`, 'visibility', vis);

  // Point markers don't use MapLibre layers — toggle display directly
  const marker = _alertMarkerMap.get(alert.id);
  if (marker) marker.getElement().style.display = isVisible ? '' : 'none';
}

function showAlertDetail(alert) {
  // Highlight the affected area on the map and fly to it
  _focusAlert(alert);

  // Open the right-side drawer with alert content
  openDrawerWithContent('Alert Detail', buildAlertDrawerContent(alert), () => {
    _unfocusAlert(alert.id);
  });
}

function _focusAlert(alert) {
  if (!_map || !alert.affected_geometry) return;
  const geom = alert.affected_geometry;
  if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return;

  // Unfocus a different previously focused alert
  if (_focusedAlertId !== null && _focusedAlertId !== alert.id) {
    _unfocusAlert(_focusedAlertId);
  }
  _focusedAlertId = alert.id;

  const sourceId  = `cg-alert-${alert.id}`;
  const outlineId = `${sourceId}-outline`;
  const focusId   = `${sourceId}-focus`;
  const color = alert.severity === 1 ? '#C0392B'
              : alert.severity === 2 ? '#D4A017'
              : '#5A7A32';

  // Thicken the crisp outline ring
  if (_map.getLayer(outlineId)) {
    _map.setPaintProperty(outlineId, 'line-width',   3);
    _map.setPaintProperty(outlineId, 'line-opacity', 1.0);
  }

  // Add a wide blurred glow ring behind the outline
  if (!_map.getLayer(focusId) && _map.getSource(sourceId)) {
    const before = _map.getLayer(outlineId) ? outlineId : undefined;
    _map.addLayer({
      id: focusId, type: 'line', source: sourceId,
      paint: { 'line-color': color, 'line-width': 14, 'line-opacity': 0.28, 'line-blur': 10 },
    }, before);
  }

  // Fly to the alert geometry bounds
  const bounds = _geojsonBounds(geom);
  if (bounds) _map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 600 });
}

function _unfocusAlert(alertId) {
  if (!_map) return;
  const sourceId  = `cg-alert-${alertId}`;
  const outlineId = `${sourceId}-outline`;
  const focusId   = `${sourceId}-focus`;
  if (_map.getLayer(focusId))   _map.removeLayer(focusId);
  if (_map.getLayer(outlineId)) {
    _map.setPaintProperty(outlineId, 'line-width',   1.5);
    _map.setPaintProperty(outlineId, 'line-opacity', 0.75);
  }
  if (_focusedAlertId === alertId) _focusedAlertId = null;
}

function _geojsonBounds(geom) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function walk(c) {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1];
    } else { c.forEach(walk); }
  }
  walk(geom.coordinates);
  return isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
}

function buildAlertDrawerContent(alert) {
  const sources = (alert.sources || []).map(s => `<div>${escHtml(s)}</div>`).join('') || 'N/A';
  const updated  = alert.created_at ? new Date(alert.created_at).toLocaleString() : 'Unknown';
  const expires  = alert.expires_at ? new Date(alert.expires_at).toLocaleString() : null;
  const color    = alert.severity === 1 ? '#C0392B'
                 : alert.severity === 2 ? '#D4A017'
                 : '#5A7A32';

  // Render trigger_conditions as a compact "Why this is firing" grid
  const SKIP_TC = new Set(['dedupe_key', 'nws_event_id', 'food_sources_checked',
                            'affected_zones', 'qualifying_tracts', 'nws_expires']);
  const tc = alert.trigger_conditions || {};
  const tcEntries = Object.entries(tc).filter(([k, v]) => !SKIP_TC.has(k) && v != null);
  const triggerHtml = tcEntries.length > 0 ? `
    <div style="padding:10px 14px">
      <div style="font-family:var(--font-label);font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">Why This Is Firing</div>
      <dl style="display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:9px;line-height:1.6">
        ${tcEntries.map(([k, v]) => {
          const label = k.replace(/_/g, ' ');
          const val = Array.isArray(v)
            ? (v.length > 3 ? `${v.slice(0, 3).join(', ')} +${v.length - 3} more` : v.join(', '))
            : k === 'search_radius_meters' ? `${(v / 1609.34).toFixed(1)} mi`
            : typeof v === 'number' && v > 0 && v < 1 ? `${(v * 100).toFixed(0)}th pctile`
            : String(v).length > 80 ? String(v).slice(0, 77) + '\u2026'
            : String(v);
          return `<dt style="color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap">${escHtml(label)}</dt><dd style="color:var(--text-secondary)">${escHtml(val)}</dd>`;
        }).join('')}
      </dl>
    </div>` : '';

  const div = document.createElement('div');
  div.innerHTML = `
    <div style="padding:12px 14px;border-bottom:1px solid var(--border)">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
        <span class="claim-badge claim-${escHtml(alert.claim_type)}">${escHtml(alert.claim_type)}</span>
        <span style="font-family:var(--font-label);font-size:9px;color:${escHtml(color)};letter-spacing:0.1em">${escHtml(SEVERITY_LABEL[alert.severity] || '')}</span>
      </div>
      <div style="font-family:var(--font-body);font-size:13px;font-weight:600;color:var(--text-primary);line-height:1.4;margin-bottom:6px">${escHtml(alert.title)}</div>
      ${alert.description ? `<p style="font-size:11px;line-height:1.5;color:var(--text-secondary);margin:0">${escHtml(alert.description)}</p>` : ''}
    </div>
    ${alert.recommendation ? `
    <div style="padding:10px 14px;border-bottom:1px solid var(--border)">
      <div style="font-family:var(--font-label);font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:var(--sprout);margin-bottom:5px">Recommended Action</div>
      <p style="font-size:11px;line-height:1.5;color:var(--text-primary);margin:0">${escHtml(alert.recommendation)}</p>
    </div>` : ''}
    <div style="padding:10px 14px;border-bottom:1px solid var(--border)">
      <div style="font-family:var(--font-label);font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:var(--amber);margin-bottom:5px">Epistemic Caution</div>
      <p style="font-size:10px;line-height:1.5;color:var(--text-muted);margin:0;font-style:italic">${escHtml(alert.caution)}</p>
    </div>
    <div style="padding:10px 14px;border-bottom:1px solid var(--border)">
      <div style="font-family:var(--font-label);font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px">Sources</div>
      <div style="font-size:10px;color:var(--text-secondary);line-height:1.7">${sources}</div>
      <div style="margin-top:8px;font-size:9px;color:var(--text-muted)">Last evaluated: ${escHtml(updated)}</div>
      ${expires ? `<div style="font-size:9px;color:var(--text-muted)">Expires: ${escHtml(expires)}</div>` : ''}
    </div>
    ${triggerHtml}
  `;

  // Related data layer activation buttons (DOM-built to respect CSP)
  const relatedSlugs = ALERT_LAYERS[alert.alert_type] || [];
  if (relatedSlugs.length > 0) {
    const sec = document.createElement('div');
    sec.style.cssText = 'padding:10px 14px;border-bottom:1px solid var(--border)';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-family:var(--font-label);font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px';
    lbl.textContent = 'Related Data Layers';
    sec.appendChild(lbl);
    relatedSlugs.forEach(slug => {
      const btn = document.createElement('button');
      btn.style.cssText = 'display:block;width:100%;text-align:left;padding:5px 8px;margin-bottom:3px;font-family:var(--font-label);font-size:10px;color:var(--sprout);background:var(--bark-light);border:1px solid var(--border);border-radius:2px;cursor:pointer';
      btn.textContent = '\u2192\u00a0' + slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      btn.addEventListener('click', () => enableLayerBySlug(slug));
      sec.appendChild(btn);
    });
    div.appendChild(sec);
  }

  return div;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
