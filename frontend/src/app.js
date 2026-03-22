/**
 * app.js — CommonGround frontend entry point.
 *
 * Initializes the MapLibre map, wires up layer controls and alert polling.
 * maplibregl is a global loaded from dist/vendor/maplibre-gl.js (no CDN).
 */
'use strict';
import { config } from './config.js';
import { initLayers, refreshActiveLayers } from './layers.js';
import { initAlerts, refreshAlerts } from './alerts.js';
import { initWeather, refreshWeather } from './weather.js';
import { apiFetch } from './api-client.js';

/* global maplibregl */

// ── Map initialization ────────────────────────────────────────────────────────

const map = new maplibregl.Map({
  container: 'map',
  style: config.tileStyle,
  center: config.mapCenter,
  zoom: config.mapZoom,
  // Accessibility
  localIdeographFontFamily: "'Courier New', monospace",
});

map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-left');
map.addControl(new maplibregl.FullscreenControl(), 'bottom-right');

// ── Load sequence ─────────────────────────────────────────────────────────────

map.on('load', async () => {
  setStatus('Loading layers...');

  await initLayers(map);
  await initAlerts(map);
  await initWeather(map);
  loadOrganizeDirectory();

  // Dismiss loading screen
  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('hidden');

  setStatus('READY');

  // Poll for fresh alerts on interval
  setInterval(async () => {
    await refreshAlerts();
  }, config.alertPollInterval);

  // Reload visible layer data and weather when map moves significantly
  let moveTimer = null;
  map.on('moveend', () => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(async () => {
      await refreshAlerts();
      await refreshActiveLayers();
      await refreshWeather();
    }, 500);
  });
});

map.on('error', (e) => {
  console.error('[map] Error:', e.error?.message || e);
  setStatus('MAP ERROR — check tile source');
});

// ── Coordinates display ───────────────────────────────────────────────────────

const coordsEl = document.getElementById('coords');
map.on('mousemove', (e) => {
  if (!coordsEl) return;
  const lat = e.lngLat.lat.toFixed(5);
  const lon = Math.abs(e.lngLat.lng).toFixed(5);
  const hem = e.lngLat.lng < 0 ? 'W' : 'E';
  coordsEl.textContent = `${lat}° N  ${lon}° ${hem}`;
});

map.on('mouseleave', () => {
  if (coordsEl) coordsEl.textContent = '–';
});

// ── Resource submission form ──────────────────────────────────────────────────

const resourceToggle = document.getElementById('resource-form-toggle');
const resourceForm   = document.getElementById('resource-form');
const resourceMsg    = document.getElementById('resource-form-msg');

if (resourceToggle && resourceForm) {
  resourceToggle.addEventListener('click', () => {
    const hidden = resourceForm.classList.toggle('hidden');
    resourceToggle.textContent = hidden ? '+ Submit Resource' : '− Submit Resource';
    resourceToggle.setAttribute('aria-expanded', String(!hidden));
    if (resourceMsg) resourceMsg.textContent = '';
  });

  resourceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (resourceMsg) { resourceMsg.textContent = ''; resourceMsg.className = 'form-msg'; }

    const fd = new FormData(resourceForm);
    const body = {
      name:        (fd.get('name') || '').trim(),
      type:        fd.get('type'),
      address:     (fd.get('address') || '').trim(),
      description: (fd.get('description') || '').trim() || undefined,
      contact:     (fd.get('contact') || '').trim() || undefined,
    };

    if (!body.name || !body.address) {
      if (resourceMsg) { resourceMsg.textContent = 'Name and address are required.'; resourceMsg.className = 'form-msg form-msg-error'; }
      return;
    }

    try {
      await apiFetch('/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      resourceForm.reset();
      resourceForm.classList.add('hidden');
      resourceToggle.textContent = '+ Submit Resource';
      if (resourceMsg) {
        resourceMsg.textContent = 'Submitted — thank you. It will be reviewed before going live.';
        resourceMsg.className = 'form-msg form-msg-success';
      }
    } catch (err) {
      if (resourceMsg) {
        resourceMsg.textContent = `Submission failed: ${err.message}`;
        resourceMsg.className = 'form-msg form-msg-error';
      }
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setStatus(msg) {
  const el = document.getElementById('status-msg');
  if (el) el.textContent = msg;
}

// ── organize.directory panel ──────────────────────────────────────────────────
// Fetches the Green Bay page from organize.directory and renders a list of
// groups in the sidebar panel. Falls back gracefully if the fetch fails.

async function loadOrganizeDirectory() {
  const list = document.getElementById('organize-list');
  if (!list) return;

  // Fetch via CORS proxy isn't available here — we use the API backend as a
  // simple proxy to avoid mixed-content and CORS issues from the browser.
  // The API proxies GET /organize-directory and returns { groups: [...] }
  let groups = [];
  try {
    const data = await apiFetch('/organize-directory');
    groups = data.groups || [];
  } catch {
    list.innerHTML = '<div style="padding:8px 16px;font-family:var(--font-label);font-size:9px;color:var(--text-muted)">Could not load organize.directory data.</div>';
    return;
  }

  list.innerHTML = '';
  if (groups.length === 0) {
    list.innerHTML = '<div style="padding:8px 16px;font-family:var(--font-label);font-size:9px;color:var(--text-muted)">No groups listed for this area.</div>';
    return;
  }

  for (const g of groups) {
    const item = document.createElement('div');
    item.className = 'organize-item';
    const nameHtml = g.url
      ? `<a href="${encodeURI(g.url)}" target="_blank" rel="noopener noreferrer">${escHtml(g.name)}</a>`
      : `<span style="font-family:var(--font-label);font-size:10px;color:var(--text-secondary)">${escHtml(g.name)}</span>`;
    item.innerHTML = nameHtml + (g.description ? `<p>${escHtml(g.description)}</p>` : '');
    list.appendChild(item);
  }
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
