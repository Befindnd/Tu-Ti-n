'use strict';
/**
 * utils/danh_vong.js
 * Hệ thống Danh Vọng — điểm số tổng hợp mọi hoạt động trong game.
 *
 * Điểm Danh Vọng (DV) tăng từ: PVP thắng, nhận nhiệm vụ, vượt tầng Tower,
 * đột phá cảnh giới, cướp thành công, vượt kiếp thành công.
 *
 * Dùng: awardDanhVong(userId, points) — fire-and-forget, không cần await.
 */
const { db } = require('../db/pool');
const { logger } = require('./logger');
const log = logger.child('danh_vong');

// ── Bảng điểm ────────────────────────────────────────────────────────────────
const DV_POINTS = {
  PVP_WIN:          10,   // Thắng PVP
  MISSION_CLAIM:     5,   // Nhận thưởng nhiệm vụ ngày
  TOWER_FLOOR:      15,   // Vượt tầng Tower mới cao nhất (milestone)
  DOT_PHA:           8,   // Đột phá cảnh giới thành công
  VUOT_KIEP:        25,   // Vượt Thiên Kiếp thành công
  CUOP_TUI:          3,   // Cướp túi đồ thành công
};

/**
 * Tặng Danh Vọng cho một người chơi.
 * Fire-and-forget — gọi mà không cần await trong command handlers.
 *
 * @param {string} userId  Discord user ID
 * @param {number} points  Số điểm tặng (dương = thêm, âm = trừ)
 */
function awardDanhVong(userId, points) {
  if (!userId || !points) return;
  db(
    'UPDATE players SET danh_vong = GREATEST(0, COALESCE(danh_vong, 0) + $1) WHERE user_id = $2',
    [points, userId],
  ).catch(e => log.error('awardDanhVong failed:', e.message));
}

module.exports = { DV_POINTS, awardDanhVong };
