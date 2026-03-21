'use strict';
/**
 * Minimal logger with timestamps and level prefixes.
 */
function log(level, ...args) {
  const ts = new Date().toISOString();
  process.stdout.write(`[${ts}] [${level}] ${args.join(' ')}\n`);
}

module.exports = {
  info:  (...a) => log('INFO ', ...a),
  warn:  (...a) => log('WARN ', ...a),
  error: (...a) => log('ERROR', ...a),
  debug: (...a) => { if (process.env.DEBUG) log('DEBUG', ...a); },
};
