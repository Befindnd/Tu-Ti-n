'use strict';
/**
 * core/antiraid_log.js
 * Per-guild anti-raid log channel.
 *
 * Khi bot chạy trên nhiều server, chủ bot không thể theo dõi DM cảnh báo
 * cho hàng chục server cùng lúc. Module này cho phép mỗi server tự cài
 * một kênh riêng để nhận cảnh báo raid ngay trong server của họ.
 *
 * Cấu hình: `-antiraid setlog #kênh` (Admin server hoặc chủ bot)
 * Xoá:      `-antiraid clearlog`
 * Lưu vào:  bot_settings.antiraid_log_channels (jsonb: { guildId: channelId })
 */
const { db } = require('../db/pool');

/** @type {Map<string, string>} guildId → channelId */
const _channels = new Map();

/** Tải danh sách kênh log từ DB (gọi một lần lúc boot). */
async function load() {
  try {
    const res = await db(`SELECT value FROM bot_settings WHERE key=$1`, ['antiraid_log_channels']);
    if (res.rows.length > 0) {
      for (const [guildId, channelId] of Object.entries(res.rows[0].value || {})) {
        if (guildId && channelId) _channels.set(String(guildId), String(channelId));
      }
      if (_channels.size > 0) {
        console.log(`[antiraid_log] Đã load kênh log cho ${_channels.size} server.`);
      }
    }
  } catch (_) {}
}

async function _save() {
  await db(
    `INSERT INTO bot_settings(key,value) VALUES($1,$2::jsonb)
     ON CONFLICT(key) DO UPDATE SET value=$2::jsonb`,
    ['antiraid_log_channels', JSON.stringify(Object.fromEntries(_channels))],
  ).catch(() => {});
}

/**
 * Cài kênh log anti-raid cho một server.
 * @param {string} guildId
 * @param {string} channelId
 */
async function setLogChannel(guildId, channelId) {
  _channels.set(guildId, channelId);
  await _save();
}

/**
 * Xoá kênh log của một server.
 * @param {string} guildId
 */
async function clearLogChannel(guildId) {
  _channels.delete(guildId);
  await _save();
}

/**
 * Lấy channelId đang cài cho server (null nếu chưa cài).
 * @param {string} guildId
 * @returns {string|null}
 */
function getLogChannel(guildId) {
  return _channels.get(guildId) || null;
}

/**
 * Gửi embed cảnh báo tới kênh log của guild.
 * Best-effort — lỗi bị bỏ qua hoàn toàn để không crash callback.
 *
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {import('discord.js').EmbedBuilder} embed
 */
async function alertGuild(client, guildId, embed) {
  const channelId = _channels.get(guildId);
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel && channel.isTextBased && channel.isTextBased()) {
      await channel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (_) {}
}

module.exports = { load, setLogChannel, clearLogChannel, getLogChannel, alertGuild };
