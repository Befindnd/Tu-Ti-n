'use strict';
/**
 * core/channel_penalty.js
 * Hình phạt leo thang cho hành vi dùng lệnh SAI KÊNH (allowed_channels, pvp_channels,
 * ttl_channels, san_channels, dv_channels — bất kỳ whitelist kênh nào).
 *
 * Mỗi lần người dùng bị bắt gõ lệnh sai kênh, họ bị khóa TOÀN BỘ bot trong một khoảng
 * thời gian. Lần đầu chỉ 5 phút (nhắc nhở nhẹ), các lần sau tăng dần để răn những ai
 * lặp lại nhiều lần. Nếu không vi phạm trong OFFENSE_DECAY_MS thì lịch sử bị xóa và
 * người dùng "sạch" lại từ đầu.
 *
 * State hoàn toàn in-memory — không cần bảng DB riêng, tự prune theo interval.
 */

/**
 * Thời gian khóa theo số lần vi phạm sai kênh (leo thang):
 *   Lần 1:  5 phút
 *   Lần 2:  15 phút
 *   Lần 3:  30 phút
 *   Lần 4:  1 giờ
 *   Lần 5:  3 giờ
 *   Lần 6:  6 giờ
 *   Lần 7+: 12 giờ
 */
const LOCKOUT_STEPS = [
  5 * 60_000,        // lần 1
  15 * 60_000,       // lần 2
  30 * 60_000,       // lần 3
  60 * 60_000,       // lần 4
  3 * 3_600_000,     // lần 5
  6 * 3_600_000,     // lần 6
  12 * 3_600_000,    // lần 7+
];

/** Không vi phạm trong 24h liên tiếp → reset lịch sử vi phạm về 0. */
const OFFENSE_DECAY_MS = 24 * 3_600_000;

/** @type {Map<string, {count:number, lastOffense:number}>} userId -> lịch sử vi phạm */
const _offenseHistory = new Map();

/** @type {Map<string, number>} userId -> lock-until timestamp (ms) */
const _locks = new Map();

/**
 * Định dạng ms thành nhãn thời gian dễ đọc bằng tiếng Việt.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const minutes = ms / 60_000;
  if (minutes < 60) return `${Math.ceil(minutes)} phút`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.ceil(hours)} giờ`;
  return `${Math.ceil(hours / 24)} ngày`;
}

/**
 * Ghi nhận một lần vi phạm sai kênh cho userId và áp khóa leo thang.
 * @param {string} userId
 * @returns {{ ms: number, count: number, label: string }} thời gian khóa vừa áp dụng
 */
function recordOffense(userId) {
  const now = Date.now();
  let rec = _offenseHistory.get(userId);
  if (!rec || (now - rec.lastOffense) > OFFENSE_DECAY_MS) {
    rec = { count: 0, lastOffense: now };
  }
  rec.count++;
  rec.lastOffense = now;
  _offenseHistory.set(userId, rec);

  const idx = Math.min(rec.count - 1, LOCKOUT_STEPS.length - 1);
  const ms = LOCKOUT_STEPS[idx];
  _locks.set(userId, now + ms);

  return { ms, count: rec.count, label: formatDuration(ms) };
}

/**
 * @param {string} userId
 * @returns {number} ms còn lại trong lệnh khóa (0 = không bị khóa).
 */
function getLockRemaining(userId) {
  const until = _locks.get(userId) || 0;
  const rem = until - Date.now();
  if (rem <= 0) {
    if (until) _locks.delete(userId);
    return 0;
  }
  return rem;
}

/**
 * Số lần vi phạm sai kênh tích lũy (trong vòng 24h gần nhất).
 * @param {string} userId
 * @returns {number}
 */
function getOffenseCount(userId) {
  const rec = _offenseHistory.get(userId);
  if (!rec || (Date.now() - rec.lastOffense) > OFFENSE_DECAY_MS) return 0;
  return rec.count;
}

/**
 * Mở khóa thủ công một user (admin override).
 * @param {string} userId
 * @param {{resetOffenses?: boolean}} [opts]
 */
function unlock(userId, { resetOffenses = false } = {}) {
  _locks.delete(userId);
  if (resetOffenses) _offenseHistory.delete(userId);
  return true;
}

// Prune định kỳ để tránh phình memory theo thời gian.
setInterval(() => {
  const now = Date.now();
  for (const [id, until] of _locks) if (until < now) _locks.delete(id);
  for (const [id, rec] of _offenseHistory) {
    if ((now - rec.lastOffense) > OFFENSE_DECAY_MS) _offenseHistory.delete(id);
  }
}, 60_000);

module.exports = {
  recordOffense,
  getLockRemaining,
  getOffenseCount,
  unlock,
  formatDuration,
};
