/**
 * admin.js — CommonGround admin interface frontend
 *
 * Bundled by esbuild into dist/admin.bundle.js (no MapLibre dependency).
 * Authentication: Bearer token stored in sessionStorage.
 * All data management done through /api/admin/* endpoints.
 */
'use strict';

// ── State ─────────────────────────────────────────────────────────────────────

let _token       = '';
let _activeTab   = 'sources';
let _resourcesFilter = 'pending'; // 'pending' | 'approved'

// Cached modal context for save handler
let _modalCtx = null;

// Cached data — populated on load, reused by edit handlers
let _sourcesCache = [];
let _layersCache  = [];

// ── Token management ──────────────────────────────────────────────────────────

function getToken()    { return sessionStorage.getItem('cg_admin_token') || ''; }
function storeToken(t) { sessionStorage.setItem('cg_admin_token', t); _token = t; }
function clearToken()  { sessionStorage.removeItem('cg_admin_token'); _token = ''; }

// ── API client ────────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${_token}`,
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`/api${path}`, opts);
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ── Toast notifications ───────────────────────────────────────────────────────

function toast(message, isError = false) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast${isError ? ' error' : ''}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 320);
  }, 3200);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(title, bodyHtml, onSave) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  _modalCtx = { onSave };
  document.getElementById('edit-modal').showModal();
}

function closeModal() {
  document.getElementById('edit-modal').close();
  _modalCtx = null;
}

// ── Auth / login ──────────────────────────────────────────────────────────────

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('token-input');
  const errEl = document.getElementById('login-error');
  const btn   = e.target.querySelector('button[type=submit]');
  const token = input.value.trim();

  if (!token) return;

  btn.disabled = true;
  btn.textContent = 'SIGNING IN…';
  errEl.style.display = 'none';

  // Test the token against a lightweight admin endpoint
  storeToken(token);
  try {
    await api('GET', '/admin/sources');
    showApp();
    loadTab('sources');
  } catch (err) {
    clearToken();
    errEl.textContent = err.status === 401 || err.status === 403
      ? 'Invalid token.'
      : err.status === 503
        ? 'Admin interface is not configured on this server (ADMIN_TOKEN not set).'
        : `Error: ${err.message}`;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'SIGN IN';
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  clearToken();
  document.getElementById('token-input').value = '';
  showLogin();
});

// ── Tab navigation ────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab === _activeTab) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    _activeTab = tab;
    loadTab(tab);
  });
});

function loadTab(tab) {
  switch (tab) {
    case 'sources':     loadSources(); break;
    case 'layers':      loadLayers(); break;
    case 'resources':   loadResources(); break;
    case 'signal-runs': loadSignalRuns(); break;
  }
}

// ── Sources tab ───────────────────────────────────────────────────────────────

async function loadSources() {
  const container = document.getElementById('sources-table');
  container.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    const data = await api('GET', '/admin/sources');
    _sourcesCache = data.sources || [];
    renderSourcesTable(_sourcesCache);
  } catch (err) {
    container.innerHTML = `<div class="empty-state text-danger">Error: ${escHtml(err.message)}</div>`;
  }
}

function renderSourcesTable(sources) {
  const container = document.getElementById('sources-table');
  if (!sources.length) {
    container.innerHTML = '<div class="empty-state">No source configs found.</div>';
    return;
  }
  const rows = sources.map(s => `
    <tr>
      <td class="cell-slug">${escHtml(s.slug)}</td>
      <td>${escHtml(s.municipality || '—')}</td>
      <td>${statusBadge(s.status)}</td>
      <td><span class="${s.enabled ? 'badge badge-enabled' : 'badge badge-disabled'}">${s.enabled ? 'ON' : 'OFF'}</span></td>
      <td class="cell-url" title="${escHtml(s.endpoint_url || '')}">${escHtml(s.endpoint_url || '— default —')}</td>
      <td>${escHtml(s.endpoint_format || '')}</td>
      <td class="cell-note" title="${escHtml(s.status_note || '')}">${escHtml(s.status_note || '')}</td>
      <td class="actions">
        <button class="btn btn-sm" data-action="edit-source" data-id="${s.id}">EDIT</button>
        <button class="btn btn-sm btn-danger" data-action="delete-source" data-id="${s.id}" data-slug="${escHtml(s.slug)}">DEL</button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>SLUG</th>
          <th>MUNICIPALITY</th>
          <th>STATUS</th>
          <th>ENABLED</th>
          <th>ENDPOINT URL</th>
          <th>FORMAT</th>
          <th>NOTE</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// Event delegation for sources table
document.getElementById('sources-table').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'edit-source')   editSource(parseInt(btn.dataset.id, 10));
  if (action === 'delete-source') deleteSource(parseInt(btn.dataset.id, 10), btn.dataset.slug);
});

async function editSource(id) {
  try {
    // Use cache; fall back to a fresh fetch if cache is empty
    let src = _sourcesCache.find(s => s.id === id);
    if (!src) {
      const data = await api('GET', '/admin/sources');
      _sourcesCache = data.sources || [];
      src = _sourcesCache.find(s => s.id === id);
    }
    if (!src) {
      toast(`Source with id ${id} not found — try refreshing the page.`, true);
      return;
    }

  openModal('EDIT DATA SOURCE', `
    <div class="form-row">
      <div class="form-group">
        <label>SLUG</label>
        <input type="text" id="m-slug" value="${escHtml(src.slug)}" readonly
               style="opacity:0.6;cursor:default">
      </div>
      <div class="form-group">
        <label>MUNICIPALITY <span class="text-muted">(blank = all)</span></label>
        <input type="text" id="m-municipality" value="${escHtml(src.municipality || '')}"
               placeholder="e.g. green-bay">
      </div>
    </div>
    <div class="form-group">
      <label>ENDPOINT URL <span class="text-muted">(leave blank to use seed-script default)</span></label>
      <input type="url" id="m-endpoint-url" value="${escHtml(src.endpoint_url || '')}"
             placeholder="https://…">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>FORMAT</label>
        <select id="m-format">
          ${['json','csv','geojson','xlsx','arcgis-rest'].map(f =>
            `<option value="${f}" ${src.endpoint_format === f ? 'selected' : ''}>${f}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>STATUS</label>
        <select id="m-status">
          ${['active','degraded','blocked','pending'].map(s =>
            `<option value="${s}" ${src.status === s ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>STATUS NOTE</label>
      <textarea id="m-status-note">${escHtml(src.status_note || '')}</textarea>
    </div>
    <div class="checkbox-row">
      <input type="checkbox" id="m-enabled" ${src.enabled ? 'checked' : ''}>
      <label for="m-enabled">ENABLED (ingest will run when checked)</label>
    </div>
    <div class="form-group">
      <label>EXTRA CONFIG JSON <span class="text-muted">(advanced — must be valid JSON)</span></label>
      <textarea id="m-config-json" style="font-family:monospace;font-size:11px">${escHtml(
        JSON.stringify(src.config_json || {}, null, 2)
      )}</textarea>
    </div>
    <div class="form-group">
      <label>API KEY
        <span class="text-muted" style="font-size:10px;margin-left:4px">${src.api_key_set ? '● currently set' : 'not set'}</span>
      </label>
      <input type="password" id="m-api-key"
             placeholder="${src.api_key_set ? 'Enter new key to replace existing…' : 'Enter API key…'}"
             autocomplete="off">
      <div class="text-muted" style="font-size:10px;margin-top:2px">Leave blank to keep existing key. Enter a value to set or replace.</div>
    </div>
  `, async () => {
    const payload = {
      municipality:    document.getElementById('m-municipality').value.trim(),
      endpoint_url:    document.getElementById('m-endpoint-url').value.trim() || null,
      endpoint_format: document.getElementById('m-format').value,
      status:          document.getElementById('m-status').value,
      status_note:     document.getElementById('m-status-note').value.trim() || null,
      enabled:         document.getElementById('m-enabled').checked,
    };
    const cfgRaw = document.getElementById('m-config-json').value.trim();
    try { payload.config_json = JSON.parse(cfgRaw || '{}'); }
    catch { toast('config_json is not valid JSON — fix and try again.', true); return false; }
    const apiKey = document.getElementById('m-api-key').value.trim();
    if (apiKey) payload.api_key = apiKey;

    await api('PUT', `/admin/sources/${id}`, payload);
    toast('Source config saved.');
    loadSources();
  });
  } catch (err) {
    toast(`Edit failed: ${err.message}`, true);
  }
}

async function deleteSource(id, slug) {
  if (!confirm(`Delete source config for "${slug}"? This cannot be undone.`)) return;
  try {
    await api('DELETE', `/admin/sources/${id}`);
    toast(`Deleted config for ${slug}.`);
    loadSources();
  } catch (err) {
    toast(`Error: ${err.message}`, true);
  }
}

document.getElementById('add-source-btn').addEventListener('click', () => {
  openModal('NEW DATA SOURCE', `
    <div class="form-row">
      <div class="form-group">
        <label>SLUG <span class="text-muted">(lowercase, hyphens only)</span></label>
        <input type="text" id="m-slug" placeholder="e.g. gb-permits">
      </div>
      <div class="form-group">
        <label>MUNICIPALITY <span class="text-muted">(blank = all)</span></label>
        <input type="text" id="m-municipality" placeholder="e.g. green-bay">
      </div>
    </div>
    <div class="form-group">
      <label>ENDPOINT URL <span class="text-muted">(leave blank to use seed-script default)</span></label>
      <input type="url" id="m-endpoint-url" placeholder="https://…">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>FORMAT</label>
        <select id="m-format">
          ${['json','csv','geojson','xlsx','arcgis-rest'].map(f =>
            `<option value="${f}">${f}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>STATUS</label>
        <select id="m-status">
          <option value="active">active</option>
          <option value="pending" selected>pending</option>
          <option value="degraded">degraded</option>
          <option value="blocked">blocked</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>STATUS NOTE</label>
      <textarea id="m-status-note" placeholder="What's the status? Why is it blocked / degraded?"></textarea>
    </div>
    <div class="checkbox-row">
      <input type="checkbox" id="m-enabled">
      <label for="m-enabled">ENABLED (ingest will run when checked)</label>
    </div>
    <div class="form-group">
      <label>EXTRA CONFIG JSON <span class="text-muted">(advanced)</span></label>
      <textarea id="m-config-json" style="font-family:monospace;font-size:11px">{}</textarea>
    </div>
    <div class="form-group">
      <label>API KEY <span class="text-muted">(optional)</span></label>
      <input type="password" id="m-api-key" placeholder="Enter API key…" autocomplete="off">
      <div class="text-muted" style="font-size:10px;margin-top:2px">Leave blank if this source does not require an API key.</div>
    </div>
  `, async () => {
    const slug = document.getElementById('m-slug').value.trim();
    if (!slug) { toast('Slug is required.', true); return false; }

    const payload = {
      slug,
      municipality:    document.getElementById('m-municipality').value.trim(),
      endpoint_url:    document.getElementById('m-endpoint-url').value.trim() || null,
      endpoint_format: document.getElementById('m-format').value,
      status:          document.getElementById('m-status').value,
      status_note:     document.getElementById('m-status-note').value.trim() || null,
      enabled:         document.getElementById('m-enabled').checked,
    };
    const cfgRaw = document.getElementById('m-config-json').value.trim();
    try { payload.config_json = JSON.parse(cfgRaw || '{}'); }
    catch { toast('config_json is not valid JSON.', true); return false; }
    const apiKey = document.getElementById('m-api-key').value.trim();
    if (apiKey) payload.api_key = apiKey;

    await api('POST', '/admin/sources', payload);
    toast('Source config created.');
    loadSources();
  });
});

// ── Layers tab ────────────────────────────────────────────────────────────────

async function loadLayers() {
  const container = document.getElementById('layers-table');
  container.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    const data = await api('GET', '/admin/layers');
    _layersCache = data.layers || [];
    renderLayersTable(_layersCache);
  } catch (err) {
    container.innerHTML = `<div class="empty-state text-danger">Error: ${escHtml(err.message)}</div>`;
  }
}

function renderLayersTable(layers) {
  const container = document.getElementById('layers-table');
  if (!layers.length) {
    container.innerHTML = '<div class="empty-state">No layers found.</div>';
    return;
  }
  const rows = layers.map(l => `
    <tr>
      <td class="cell-slug">${escHtml(l.slug)}</td>
      <td>${escHtml(l.name)}</td>
      <td>${escHtml(l.source || '')}</td>
      <td>${trustStars(l.trust_rating)}</td>
      <td><span class="${l.active ? 'badge badge-active' : 'badge badge-disabled'}">${l.active ? 'ACTIVE' : 'HIDDEN'}</span></td>
      <td class="text-muted">${escHtml(l.data_vintage || '—')}</td>
      <td><span style="color:${escHtml(l.color || '#fff')};font-family:monospace">${escHtml(l.color || '—')}</span></td>
      <td class="actions">
        <button class="btn btn-sm" data-action="edit-layer" data-slug="${escHtml(l.slug)}">EDIT</button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>SLUG</th>
          <th>NAME</th>
          <th>SOURCE</th>
          <th>TRUST</th>
          <th>STATUS</th>
          <th>VINTAGE</th>
          <th>COLOR</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// Event delegation for layers table
document.getElementById('layers-table').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'edit-layer') editLayer(btn.dataset.slug);
});

async function editLayer(slug) {
  try {
    let layer = _layersCache.find(l => l.slug === slug);
    if (!layer) {
      const data = await api('GET', '/admin/layers');
      _layersCache = data.layers || [];
      layer = _layersCache.find(l => l.slug === slug);
    }
    if (!layer) {
      toast(`Layer "${slug}" not found — try refreshing the page.`, true);
      return;
    }

  openModal(`EDIT LAYER — ${slug}`, `
    <div class="form-group">
      <label>NAME</label>
      <input type="text" id="m-name" value="${escHtml(layer.name)}">
    </div>
    <div class="form-group">
      <label>SOURCE LABEL</label>
      <input type="text" id="m-source" value="${escHtml(layer.source || '')}">
    </div>
    <div class="form-group">
      <label>SOURCE URL</label>
      <input type="url" id="m-source-url" value="${escHtml(layer.source_url || '')}" placeholder="https://…">
    </div>
    <div class="form-row-3">
      <div class="form-group">
        <label>TRUST RATING (1–5)</label>
        <select id="m-trust">
          ${[1,2,3,4,5].map(n =>
            `<option value="${n}" ${layer.trust_rating === n ? 'selected' : ''}>${n}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>CLAIM TYPE</label>
        <select id="m-claim">
          ${['DOCUMENTED','CORRELATION','MECHANISM'].map(c =>
            `<option value="${c}" ${layer.claim_type === c ? 'selected' : ''}>${c}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>COLOR (#RRGGBB)</label>
        <input type="text" id="m-color" value="${escHtml(layer.color || '#7FA843')}"
               placeholder="#7FA843" style="font-family:monospace">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>UPDATE FREQUENCY</label>
        <input type="text" id="m-frequency" value="${escHtml(layer.update_frequency || '')}"
               placeholder="e.g. annual, monthly">
      </div>
      <div class="form-group">
        <label>DATA VINTAGE</label>
        <input type="text" id="m-vintage" value="${escHtml(layer.data_vintage || '')}"
               placeholder="e.g. 2022">
      </div>
    </div>
    <div class="form-group">
      <label>DESCRIPTION</label>
      <textarea id="m-description">${escHtml(layer.description || '')}</textarea>
    </div>
    <div class="checkbox-row">
      <input type="checkbox" id="m-active" ${layer.active ? 'checked' : ''}>
      <label for="m-active">ACTIVE (visible on public map)</label>
    </div>
  `, async () => {
    const color = document.getElementById('m-color').value.trim();
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      toast('Color must be a hex string, e.g. #7FA843.', true);
      return false;
    }
    const payload = {
      name:             document.getElementById('m-name').value.trim(),
      source:           document.getElementById('m-source').value.trim(),
      source_url:       document.getElementById('m-source-url').value.trim() || null,
      trust_rating:     parseInt(document.getElementById('m-trust').value, 10),
      claim_type:       document.getElementById('m-claim').value,
      color:            color || null,
      update_frequency: document.getElementById('m-frequency').value.trim() || null,
      data_vintage:     document.getElementById('m-vintage').value.trim() || null,
      description:      document.getElementById('m-description').value.trim() || null,
      active:           document.getElementById('m-active').checked,
    };
    await api('PUT', `/admin/layers/${slug}`, payload);
    toast('Layer updated.');
    loadLayers();
  });
  } catch (err) {
    toast(`Edit failed: ${err.message}`, true);
  }
}

// ── Resources tab ─────────────────────────────────────────────────────────────

document.getElementById('show-pending-btn').addEventListener('click', () => {
  _resourcesFilter = 'pending';
  document.getElementById('show-pending-btn').style.borderColor = 'var(--sprout)';
  document.getElementById('show-approved-btn').style.borderColor = '';
  loadResources();
});

document.getElementById('show-approved-btn').addEventListener('click', () => {
  _resourcesFilter = 'approved';
  document.getElementById('show-approved-btn').style.borderColor = 'var(--sprout)';
  document.getElementById('show-pending-btn').style.borderColor = '';
  loadResources();
});

async function loadResources() {
  const container = document.getElementById('resources-table');
  container.innerHTML = '<div class="empty-state">Loading…</div>';
  const approved = _resourcesFilter === 'approved';
  try {
    const data = await api('GET', `/admin/resources?approved=${approved}`);
    // Update pending count badge
    if (!approved) {
      const el = document.getElementById('resources-count');
      if (data.resources.length > 0) {
        el.textContent = data.resources.length;
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    }
    renderResourcesTable(data.resources);
  } catch (err) {
    container.innerHTML = `<div class="empty-state text-danger">Error: ${escHtml(err.message)}</div>`;
  }
}

function renderResourcesTable(resources) {
  const container = document.getElementById('resources-table');
  if (!resources.length) {
    container.innerHTML = `<div class="empty-state">No ${_resourcesFilter} submissions.</div>`;
    return;
  }
  const rows = resources.map(r => `
    <tr>
      <td class="text-muted" style="font-size:11px">${r.id}</td>
      <td><strong>${escHtml(r.name)}</strong></td>
      <td>${escHtml(r.type)}</td>
      <td>${escHtml(r.address || '—')}</td>
      <td class="cell-note">${escHtml(r.description || '—')}</td>
      <td class="text-muted" style="font-size:11px;white-space:nowrap">${fmtDate(r.submitted_at)}</td>
      <td class="actions">
        ${!r.approved ? `<button class="btn btn-sm btn-primary" data-action="approve-resource" data-id="${r.id}">APPROVE</button>` : ''}
        <button class="btn btn-sm btn-danger" data-action="delete-resource" data-id="${r.id}">DELETE</button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>NAME</th>
          <th>TYPE</th>
          <th>ADDRESS</th>
          <th>DESCRIPTION</th>
          <th>SUBMITTED</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  // Event delegation — attached fresh each render since the table is replaced
  container.querySelector('tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    if (btn.dataset.action === 'approve-resource') approveResource(id);
    if (btn.dataset.action === 'delete-resource')  deleteResource(id);
  });
}

async function approveResource(id) {
  try {
    await api('POST', `/admin/resources/${id}/approve`);
    toast('Resource approved and visible on map.');
    loadResources();
  } catch (err) {
    toast(`Error: ${err.message}`, true);
  }
}

async function deleteResource(id) {
  if (!confirm('Delete this resource submission? This cannot be undone.')) return;
  try {
    await api('DELETE', `/admin/resources/${id}`);
    toast('Resource deleted.');
    loadResources();
  } catch (err) {
    toast(`Error: ${err.message}`, true);
  }
};

// ── Signal runs tab ───────────────────────────────────────────────────────────

document.getElementById('runs-days-select').addEventListener('change', loadSignalRuns);

async function loadSignalRuns() {
  const container = document.getElementById('signal-runs-table');
  const days = document.getElementById('runs-days-select').value;
  container.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    const data = await api('GET', `/admin/signal-runs?days=${days}`);
    renderSignalRunsTable(data.signal_runs);
  } catch (err) {
    container.innerHTML = `<div class="empty-state text-danger">Error: ${escHtml(err.message)}</div>`;
  }
}

function renderSignalRunsTable(runs) {
  const container = document.getElementById('signal-runs-table');
  if (!runs.length) {
    container.innerHTML = '<div class="empty-state">No signal runs in this window.</div>';
    return;
  }
  const rows = runs.map(r => `
    <tr>
      <td class="cell-slug">${escHtml(r.alert_type)}</td>
      <td class="text-muted" style="font-size:11px;white-space:nowrap">${fmtDatetime(r.run_at)}</td>
      <td style="text-align:center">${r.triggered > 0 ? `<strong style="color:var(--amber)">${r.triggered}</strong>` : `<span class="text-muted">0</span>`}</td>
      <td style="text-align:center"><span class="text-muted">${r.expired}</span></td>
      <td>${r.error ? `<span class="run-error" title="${escHtml(r.error)}">${escHtml(r.error.slice(0, 80))}${r.error.length > 80 ? '…' : ''}</span>` : ''}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>ALERT TYPE</th>
          <th>RAN AT</th>
          <th style="text-align:center">TRIGGERED</th>
          <th style="text-align:center">EXPIRED</th>
          <th>ERROR</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── Modal save / cancel wiring ────────────────────────────────────────────────

document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

document.getElementById('modal-save-btn').addEventListener('click', async () => {
  if (!_modalCtx) return;
  const btn = document.getElementById('modal-save-btn');
  btn.disabled = true;
  btn.textContent = 'SAVING…';
  try {
    const result = await _modalCtx.onSave();
    if (result !== false) closeModal();
  } catch (err) {
    toast(`Save failed: ${err.message}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'SAVE';
  }
});

// Close modal on backdrop click
document.getElementById('edit-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// Prevent modal form submission from reloading page
document.getElementById('edit-modal').addEventListener('submit', (e) => e.preventDefault());

// ── Utility functions ─────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusBadge(status) {
  const cls = { active: 'badge-active', degraded: 'badge-degraded',
                blocked: 'badge-blocked', pending: 'badge-pending' };
  return `<span class="badge ${cls[status] || ''}">${escHtml(status)}</span>`;
}

function trustStars(rating) {
  const n = parseInt(rating, 10) || 0;
  const filled = '★'.repeat(n);
  const empty  = '☆'.repeat(5 - n);
  return `<span style="color:var(--amber);letter-spacing:2px">${filled}</span>` +
         `<span style="color:var(--text-muted);letter-spacing:2px">${empty}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDatetime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

(function init() {
  _token = getToken();
  if (_token) {
    // Verify token is still valid before showing the app
    api('GET', '/admin/sources')
      .then(() => { showApp(); loadTab('sources'); })
      .catch(() => { clearToken(); showLogin(); });
  } else {
    showLogin();
  }
})();
