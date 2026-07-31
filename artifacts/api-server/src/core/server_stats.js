'use strict';
/**
 * core/server_stats.js
 * Theo dõi thống kê server Discord theo thời gian thực.
 *
 * - Đếm tổng tin nhắn trong 24h qua (rolling window)
 * - Đếm số người dùng duy nhất gửi tin trong 24h qua
 * - Lưu trong memory, tự dọn sạch entry cũ trong cả recordMessage lẫn getStats
 * - Hard cap 50 000 entry để tránh memory leak ngay cả khi getStats không được gọi
 */

const WINDOW_MS  = 24 * 60 * 60 * 1000; // 24 giờ tính bằng ms
const MAX_EVENTS = 50_000;               // giới hạn cứng để tránh phình heap

/**
 * Mỗi entry: { ts: number, userId: string }
 * @type {Array<{ts: number, userId: string}>}
 */
const _events = [];

/** Xoá các entry cũ hơn WINDOW_MS khỏi đầu mảng. */
function _prune() {
  const cutoff = Date.now() - WINDOW_MS;
  while (_events.length > 0 && _events[0].ts < cutoff) {
    _events.shift();
  }
}

/**
 * Ghi nhận một tin nhắn mới.
 * Tự dọn entry cũ mỗi 200 lần ghi để tránh memory leak.
 * @param {string} userId  Discord user ID của người gửi
 * @param {string} msgId   Discord message ID dùng để de-dup
 */
let _recordCount = 0;
const _seenMsgIds = new Set();

function recordMessage(userId, msgId) {
  // De-dup: Discord đôi khi fire messageCreate 2 lần cùng message
  if (msgId) {
    if (_seenMsgIds.has(msgId)) return;
    _seenMsgIds.add(msgId);
    // Giữ set ở mức hợp lý (xoá 500 cũ nhất sau mỗi 2000 entry mới)
    if (_seenMsgIds.size > 2_000) {
      const iter = _seenMsgIds.values();
      for (let i = 0; i < 500; i++) _seenMsgIds.delete(iter.next().value);
    }
  }

  _events.push({ ts: Date.now(), userId });

  // Dọn định kỳ để tránh phình bộ nhớ khi getStats ít được gọi
  _recordCount++;
  if (_recordCount % 200 === 0) _prune();

  // Hard cap: nếu vẫn quá nhiều, xoá 10% từ đầu mảng
  if (_events.length > MAX_EVENTS) {
    _events.splice(0, MAX_EVENTS / 10);
  }
}

/**
 * Lọc sự kiện trong 24h qua và trả về thống kê.
 * @returns {{ messages: number, uniqueUsers: number, since: Date }}
 */
function getStats() {
  _prune(); // dọn sạch entry cũ trước khi tính

  const uniqueUsers = new Set(_events.map(e => e.userId)).size;

  return {
    messages:    _events.length,
    uniqueUsers,
    since:       new Date(Date.now() - WINDOW_MS),
  };
}

module.exports = { recordMessage, getStats };
