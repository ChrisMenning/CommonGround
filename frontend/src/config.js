/**
 * config.js — runtime configuration
 * Values can be overridden by injecting window.CG_CONFIG before this script.
 */
'use strict';

const _override = (typeof window !== 'undefined' && window.CG_CONFIG) || {};

export const config = {
  // API base URL — proxied through nginx so requests stay same-origin (no CSP issues).
  // nginx forwards /api/* -> api container:3000/*
  apiBase: _override.apiBase || '/api',

  // Map tile style — must be a publicly accessible MapLibre style JSON.
  // Default: OpenFreeMap "Liberty" style (open-source, no API key required).
  // For self-hosted tiles use a local Protomaps/OpenMapTiles style URL.
  tileStyle: _override.tileStyle || 'https://tiles.openfreemap.org/styles/liberty',

  // Green Bay, WI — pilot geography center
  mapCenter: _override.mapCenter || [-88.0133, 44.5133],
  mapZoom:   _override.mapZoom   || 11,

  // Alert polling interval (ms)
  alertPollInterval: _override.alertPollInterval || 5 * 60 * 1000,
};
