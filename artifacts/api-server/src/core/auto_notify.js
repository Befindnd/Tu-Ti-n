'use strict';
/**
 * core/auto_notify.js
 * Tự động gửi thống kê server vào lúc 0:00 giờ VN (UTC+7) mỗi ngày.
 *
 * Config lưu vào bot_settings key = 'auto_notify':
 * { enabled: boolean, channelId: string | null }
 */
const { EmbedBuilder } = require('discord.js');
const { db }           = require('../db/pool');
const { getStats }     = require('./server_stats');

const DB_KEY = 'auto_notify';

let _cfg = { enabled: false, channelId: null };
let _client  = null;
let _timeout = null;

// ── Persistence ───────────────────────────────────────────────────────────

async function load() {
  try {
    const res = await db('SELECT value FROM bot_settings WHERE key=$1', [DB_KEY]);
    if (res.rows.length > 0) _cfg = { ..._cfg, ...res.rows[0].value };
  } catch (_) {}
}

async function _save() {
  await db(
    `INSERT INTO bot_settings(key,value) VALUES($1,$2::jsonb)
     ON CONFLICT(key) DO UPDATE SET value=$2::jsonb`,
    [DB_KEY, JSON.stringify(_cfg)],
  ).catch(e => console.warn('[auto_notify] Lưu DB lỗi:', e.message));
}

// ── Setters ───────────────────────────────────────────────────────────────

async function setChannel(id)  { _cfg.channelId = id;  await _save(); }
async function setEnabled(val) { _cfg.enabled = val;   await _save(); }
function getConfig()           { return { ..._cfg }; }

// ── Embed ─────────────────────────────────────────────────────────────────

function vnTime(date) {
  return new Date(date.getTime() + 7 * 3600_000)
    .toISOString().replace('T', ' ').slice(0, 16) + ' (VN)';
}

async function buildStatsEmbed(guild) {
  const { messages, uniqueUsers, since } = getStats();
  const now          = new Date();
  const totalMembers = guild?.memberCount ?? '?';

  return new EmbedBuilder()
    .setTitle('📊 Thống Kê Server — 24 Giờ Qua')
    .setColor(0x5865F2)
    .setDescription(`*Từ **${vnTime(since)}** → **${vnTime(now)}***`)
    .addFields(
      { name: '💬 Tin Nhắn (24h)',          value: `**${messages.toLocaleString('vi-VN')}** tin`,      inline: true },
      { name: '🧑‍💻 Người Hoạt Động (24h)', value: `**${uniqueUsers.toLocaleString('vi-VN')}** người`, inline: true },
      { name: '👥 Tổng Thành Viên',         value: `**${totalMembers}** người`,                        inline: true },
    )
    .setFooter({ text: 'Tự động gửi lúc 0:00 VN mỗi ngày • Tu Tiên Bot' })
    .setTimestamp();
}

// ── Gửi ──────────────────────────────────────────────────────────────────

async function sendNow(isManual = false) {
  if (!_client || !_cfg.channelId) return false;
  try {
    const channel = await _client.channels.fetch(_cfg.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return false;
    const embed = await buildStatsEmbed(channel.guild || null);
    await channel.send({ embeds: [embed] });
    if (!isManual) console.log('[auto_notify] Đã gửi thống kê lúc 0:00 VN.');
    return true;
  } catch (err) {
    console.warn('[auto_notify] Gửi thất bại:', err.message);
    return false;
  }
}

// ── Scheduler 0:00 VN ─────────────────────────────────────────────────────

/**
 * Tính số ms còn lại đến 0:00 VN tiếp theo.
 * VN = UTC+7 → midnight VN = 17:00 UTC ngày hôm trước.
 */
function _msUntilMidnightVN() {
  const nowUtc = Date.now();
  // Thời điểm hiện tại quy về "phút trong ngày VN"
  const vnNow   = new Date(nowUtc + 7 * 3600_000);
  // Midnight VN tiếp theo: đặt giờ/phút/giây/ms = 0, cộng thêm 1 ngày
  const nextMidnightVN = new Date(Date.UTC(
    vnNow.getUTCFullYear(),
    vnNow.getUTCMonth(),
    vnNow.getUTCDate() + 1, // ngày mai
    0, 0, 0, 0,             // 0:00:00 VN = tức là UTC ngày này - 7h
  ));
  // nextMidnightVN.getTime() là UTC tương ứng 0:00 VN ngày mai
  // cần trừ đi 7h để về UTC thật
  return (nextMidnightVN.getTime() - 7 * 3600_000) - nowUtc;
}

function _scheduleNext() {
  if (_timeout) clearTimeout(_timeout);
  const delay = _msUntilMidnightVN();
  console.log(`[auto_notify] Lần gửi tiếp theo sau ${Math.round(delay / 60_000)} phút.`);
  _timeout = setTimeout(async () => {
    if (_cfg.enabled && _cfg.channelId) {
      await sendNow(false).catch(() => {});
    }
    _scheduleNext(); // lên lịch cho ngày hôm sau
  }, delay);
}

async function start(client) {
  _client = client;
  await load();
  _scheduleNext();
  console.log('[auto_notify] Scheduler 0:00 VN đã khởi động.');
}

module.exports = { start, load, getConfig, setChannel, setEnabled, sendNow };
