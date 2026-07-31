'use strict';
/**
 * core/pvp_channels.js
 * Whitelist kênh PvP — theo TỪNG SERVER (guild) riêng biệt.
 * Nếu whitelist của 1 server rỗng hoặc tắt → PvP dùng được ở mọi kênh của server đó.
 * Lưu vào bot_settings key = 'pvp_channels' dưới dạng { [guildId]: { enabled, ids } }.
 *
 * Hoạt động độc lập với channel whitelist thông thường (allowed_channels):
 * - allowed_channels: giới hạn MỌI lệnh bot
 * - pvp_channels: chỉ giới hạn riêng lệnh PvP
 */
const { db } = require('../db/pool');

/** @type {Map<string, {enabled: boolean, ids: Set<string>}>} guildId -> config */
const _byGuild = new Map();

function _get(guildId) {
  if (!_byGuild.has(guildId)) {
    _byGuild.set(guildId, { enabled: false, ids: new Set() });
  }
  return _byGuild.get(guildId);
}

async function load() {
  try {
    const res = await db(`SELECT value FROM bot_settings WHERE key=$1`, ['pvp_channels']);
    _byGuild.clear();
    if (res.rows.length > 0) {
      const data = res.rows[0].value || {};
      for (const [guildId, cfg] of Object.entries(data)) {
        const ids = Array.isArray(cfg.ids) ? cfg.ids : [];
        _byGuild.set(guildId, { enabled: !!cfg.enabled, ids: new Set(ids) });
      }
    }
  } catch (_) {}
}

async function _save() {
  const payload = {};
  for (const [guildId, cfg] of _byGuild.entries()) {
    payload[guildId] = { enabled: cfg.enabled, ids: [...cfg.ids] };
  }
  await db(
    `INSERT INTO bot_settings(key,value) VALUES($1,$2::jsonb)
     ON CONFLICT(key) DO UPDATE SET value=$2::jsonb`,
    ['pvp_channels', JSON.stringify(payload)],
  ).catch(() => {});
}

async function addChannel(guildId, channelId) {
  const cfg = _get(guildId);
  cfg.ids.add(channelId);
  cfg.enabled = true;
  await _save();
}

async function removeChannel(guildId, channelId) {
  const cfg = _get(guildId);
  cfg.ids.delete(channelId);
  if (cfg.ids.size === 0) cfg.enabled = false;
  await _save();
}

async function setEnabled(guildId, val) {
  const cfg = _get(guildId);
  cfg.enabled = val;
  await _save();
}

function isEnabled(guildId) {
  const cfg = _byGuild.get(guildId);
  return !!(cfg && cfg.enabled && cfg.ids.size > 0);
}

function isAllowed(guildId, channelId) {
  if (!guildId) return true; // DM hoặc không xác định guild — không áp whitelist
  return !isEnabled(guildId) || _byGuild.get(guildId).ids.has(channelId);
}

function list(guildId) {
  const cfg = _byGuild.get(guildId);
  return cfg ? [...cfg.ids] : [];
}

module.exports = { load, addChannel, removeChannel, setEnabled, isEnabled, isAllowed, list };
