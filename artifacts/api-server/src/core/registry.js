'use strict';
/**
 * core/registry.js
 * Command registry and per-user rate-limiting.
 *
 * Commands are registered once at startup (when each command module is
 * require()'d) and looked up in O(1) from the message handler.
 */

// ── Command map ───────────────────────────────────────────────────────────
/** @type {Map<string, Function>} primary-name and alias → handler */
const COMMANDS = new Map();

/**
 * Register a command handler under a primary name and zero or more aliases.
 * @param {string}    name     Primary command name (without the "-" prefix)
 * @param {string[]}  aliases  Additional names that invoke the same handler
 * @param {Function}  handler  async (msg, args, client) => void
 */
function reg(name, aliases, handler) {
  COMMANDS.set(name, handler);
  aliases.forEach((alias) => COMMANDS.set(alias, handler));
}

// ── Rate limit ────────────────────────────────────────────────────────────
const RATE_LIMIT_MS = 3_000;

/** @type {Map<string, number>} userId → last-command timestamp (ms) */
const RATE_LIMIT = new Map();

/**
 * Check whether a user is allowed to run a command right now.
 * Records the current timestamp if allowed.
 * @returns {boolean} true = allowed, false = still on cooldown
 */
function checkRateLimit(userId) {
  const now = Date.now();
  if (now - (RATE_LIMIT.get(userId) || 0) < RATE_LIMIT_MS) return false;
  RATE_LIMIT.set(userId, now);
  return true;
}

// Purge entries older than 60 s every 10 minutes to prevent memory growth.
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [id, ts] of RATE_LIMIT) {
    if (ts < cutoff) RATE_LIMIT.delete(id);
  }
}, 600_000);

// ── Daily missions ────────────────────────────────────────────────────────
/**
 * Return today's daily-mission state for a player, resetting if the date
 * has rolled over.
 * @param {{ daily_missions?: object }} player
 * @returns {{ date: string, claimed: string[] }}
 */
function getDailyMissionState(player) {
  // Dùng giờ Việt Nam (UTC+7) để reset đúng lúc 00:00 VN
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const missions = player.daily_missions || {};
  return missions.date !== today ? { date: today, claimed: [] } : missions;
}

module.exports = { COMMANDS, reg, RATE_LIMIT, checkRateLimit, getDailyMissionState };
