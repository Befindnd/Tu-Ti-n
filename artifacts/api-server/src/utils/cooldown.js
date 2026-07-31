'use strict';
/**
 * utils/cooldown.js
 * Cooldown management helpers — check, apply, and format cooldowns.
 */

/**
 * Check if a timestamp-based cooldown has expired.
 * @param {number|string} ts     Timestamp (ms) when cooldown started
 * @param {number}        hours  Cooldown duration in hours
 * @returns {boolean} true if cooldown is still active
 */
function isOnCooldown(ts, hours) {
  return (Date.now() - Number(ts || 0)) / 3_600_000 < hours;
}

/**
 * Remaining seconds on an hour-based cooldown. Returns 0 if expired.
 */
function cdRemH(ts, hours) {
  const rem = 3600 * hours - (Date.now() - Number(ts || 0)) / 1e3;
  return rem > 0 ? Math.ceil(rem) : 0;
}

/**
 * Remaining seconds on a minute-based cooldown. Returns 0 if expired.
 */
function cdRemM(ts, minutes) {
  const rem = 60 * minutes - (Date.now() - Number(ts || 0)) / 1e3;
  return rem > 0 ? Math.ceil(rem) : 0;
}

/**
 * Format seconds into a human-readable string.
 */
function fmtCD(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}h ${m}p` : m > 0 ? `${m}p ${s}s` : `${s}s`;
}

module.exports = { isOnCooldown, cdRemH, cdRemM, fmtCD };
