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

/* global maplibregl */

let _map = null;
let _alertMarkers = [];
let _alertPolygonSources = [];  // track MapLibre source IDs for polygon alerts

const SEVERITY_LABEL = { 1: 'TIER 1 — IMMEDIATE', 2: 'TIER 2 — EMERGING', 3: 'TIER 3 — AWARENESS' };

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
    return;
  }

  badge.style.display = '';
  badge.textContent = String(alerts.length);

  alerts.forEach(alert => {
    const item = document.createElement('div');
    item.className = `alert-item alert-severity-${alert.severity}`;
    item.innerHTML = `
      <div class="alert-title">${escHtml(alert.title)}</div>
      <div class="alert-meta">
        <span class="claim-badge claim-${escHtml(alert.claim_type)}">${escHtml(alert.claim_type)}</span>
        <span>${escHtml(SEVERITY_LABEL[alert.severity] || `TIER ${alert.severity}`)}</span>
      </div>`;

    item.addEventListener('click', () => showAlertDetail(alert));
    list.appendChild(item);
  });
}

function renderAlertMarkers(alerts) {
  // Clear existing point markers
  _alertMarkers.forEach(m => m.remove());
  _alertMarkers = [];

  // Clear existing polygon alert layers
  _alertPolygonSources.forEach(sourceId => {
    const fillId    = `${sourceId}-fill`;
    const outlineId = `${sourceId}-outline`;
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
      el.style.cssText = `
        width: 14px; height: 14px;
        border-radius: 50%;
        background: ${color};
        border: 2px solid #1A1208;
        cursor: pointer;
        box-shadow: 0 0 6px rgba(0,0,0,0.5);
      `;
      el.addEventListener('click', () => showAlertDetail(alert));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(_map);
      _alertMarkers.push(marker);

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
    }
  });
}

function showAlertDetail(alert) {
  const sources = (alert.sources || []).map(s => escHtml(s)).join(', ') || 'N/A';
  const updated = alert.created_at
    ? new Date(alert.created_at).toLocaleString()
    : 'Unknown';

  const content = `
    <div class="popup-inner">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
        <span class="claim-badge claim-${escHtml(alert.claim_type)}">${escHtml(alert.claim_type)}</span>
        <span style="font-family:var(--font-label);font-size:9px;color:var(--text-muted)">${escHtml(SEVERITY_LABEL[alert.severity] || '')}</span>
      </div>
      <div class="popup-title">${escHtml(alert.title)}</div>
      ${alert.description ? `<p style="font-size:12px;margin:6px 0;color:var(--text-secondary)">${escHtml(alert.description)}</p>` : ''}
      ${alert.recommendation ? `<p style="font-size:12px;margin:6px 0;color:var(--sprout)"><strong>Action:</strong> ${escHtml(alert.recommendation)}</p>` : ''}
      <div class="popup-alert-caution">${escHtml(alert.caution)}</div>
    </div>
    <div class="popup-footer">
      <span>Sources: ${sources}</span>
      <span>Updated: ${escHtml(updated)}</span>
    </div>`;

  // If we have geometry, show popup at centroid; otherwise center of map
  let lngLat;
  if (alert.affected_geometry?.type === 'Point') {
    lngLat = alert.affected_geometry.coordinates;
  } else {
    lngLat = _map.getCenter().toArray();
  }

  new maplibregl.Popup({ maxWidth: '340px', closeButton: true })
    .setLngLat(lngLat)
    .setHTML(content)
    .addTo(_map);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
