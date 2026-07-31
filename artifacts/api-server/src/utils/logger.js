'use strict';
/**
 * utils/logger.js
 * Structured console logger with prefix and level support.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL || 'info'];

function log(level, prefix, ...args) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const tag = `[${ts}] [${level.toUpperCase()}]${prefix ? ` [${prefix}]` : ''}`;
  if (level === 'error') console.error(tag, ...args);
  else if (level === 'warn') console.warn(tag, ...args);
  else console.log(tag, ...args);
}

const logger = {
  debug: (...a) => log('debug', null, ...a),
  info:  (...a) => log('info',  null, ...a),
  warn:  (...a) => log('warn',  null, ...a),
  error: (...a) => log('error', null, ...a),
  child: (prefix) => ({
    debug: (...a) => log('debug', prefix, ...a),
    info:  (...a) => log('info',  prefix, ...a),
    warn:  (...a) => log('warn',  prefix, ...a),
    error: (...a) => log('error', prefix, ...a),
  }),
};

module.exports = { logger };
