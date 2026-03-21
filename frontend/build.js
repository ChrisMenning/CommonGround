/**
 * build.js — esbuild bundler for CommonGround frontend
 *
 * MapLibre GL JS is vendored (copied from node_modules) rather than
 * bundled, avoiding web-worker complications and keeping build simple.
 * The app source files are bundled into dist/app.bundle.js.
 *
 * Usage:
 *   node build.js           — production build
 *   node build.js --watch   — rebuild on change
 */
'use strict';
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');
const isProd = process.env.NODE_ENV === 'production';

// Resolve maplibre dist directory
const maplibrePkg = require.resolve('maplibre-gl/package.json');
const maplibreDir = path.join(path.dirname(maplibrePkg), 'dist');

// Ensure output directories exist
fs.mkdirSync('dist/vendor', { recursive: true });

// Copy MapLibre JS and CSS into dist/vendor (no CDN, fully self-hosted)
fs.copyFileSync(path.join(maplibreDir, 'maplibre-gl.js'), 'dist/vendor/maplibre-gl.js');
fs.copyFileSync(path.join(maplibreDir, 'maplibre-gl.css'), 'dist/vendor/maplibre-gl.css');
console.log('[build] Vendored maplibre-gl.js + maplibre-gl.css');

const buildOptions = {
  entryPoints: ['src/app.js'],
  bundle: true,
  outfile: 'dist/app.bundle.js',
  platform: 'browser',
  format: 'iife',
  // maplibregl is loaded as a global from dist/vendor/maplibre-gl.js
  // so we declare it external and tell esbuild its global name
  external: ['maplibre-gl'],
  globalName: 'CG',
  minify: isProd,
  sourcemap: !isProd,
  target: ['es2020', 'chrome90', 'firefox90', 'safari14'],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
};

if (watch) {
  esbuild.context(buildOptions).then(ctx => {
    ctx.watch();
    console.log('[build] Watching for changes...');
  });
} else {
  esbuild.build(buildOptions).then(() => {
    console.log('[build] dist/app.bundle.js — done');
  }).catch(() => process.exit(1));
}
