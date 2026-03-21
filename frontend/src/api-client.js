/**
 * api-client.js — thin wrapper around the CommonGround REST API.
 * All requests go through this module; no fetch calls elsewhere.
 */
'use strict';
import { config } from './config.js';

export async function apiFetch(path, options = {}) {
  const url = `${config.apiBase}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `API error ${res.status}`), { status: res.status });
  }
  return res.json();
}

export function bboxFromMap(map) {
  const b = map.getBounds();
  return `${b.getWest().toFixed(6)},${b.getSouth().toFixed(6)},${b.getEast().toFixed(6)},${b.getNorth().toFixed(6)}`;
}
