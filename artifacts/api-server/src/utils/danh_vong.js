'use strict';
/**
 * utils/danh_vong.js
 * Hệ thống Danh Vọng — điểm số tổng hợp mọi hoạt động.
 *
 * DV có thể âm (Ác Danh / Hung Đồ) khi liên tục bị hại.
 * Dùng getDanhVongBonus(dv) để lấy hiệu ứng tại thời điểm hiện tại.
 */
const { db }     = require('../db/pool');
const { logger } = require('./logger');
const log        = logger.child('danh_vong');

// ── Bảng điểm ────────────────────────────────────────────────────────────────
// Tốc độ tích điểm được giảm để cân bằng với tốc độ mất điểm.
// Điểm mất: PVP thua -8, đột phá thất bại -5, bị cướp -5, bị ám sát -5.
const DV_POINTS = {
  PVP_WIN:       8,   // giảm từ 10 → gần với mức thua -8
  MISSION_CLAIM: 2,   // giảm từ 5 → hàng ngày quá dễ kiếm, không nên lớn
  TOWER_FLOOR:  10,   // giảm từ 15
  DOT_PHA:       5,   // giảm từ 8
  VUOT_KIEP:    18,   // giảm từ 25 — vẫn là sự kiện lớn nhất
  CUOP_TUI:      2,   // giảm từ 3
};

// ── Bảng ngưỡng Danh Vọng ────────────────────────────────────────────────────
//   exp      : hệ số nhân EXP tu luyện (0.10 = +10%)
//   dot_pha  : cộng thêm vào xác suất đột phá (0.05 = +5%)
//   pvp_loot : cộng thêm vào tỉ lệ loot PVP (0.03 = +3% linh thạch kẻ thua)
// Ngưỡng âm hạ xuống để tier Ác Danh / Hung Đồ thực sự có thể đạt được.
// Trước: -200 / -9999 → gần như vô hình vì DV bị sàn 0 trong PVP.
// Sau: -80 / -400 → người chơi thua liên tiếp ~10 trận sẽ cảm nhận được debuff.
const DV_TIERS = [
  { min:  5000, label: '👑 Thiên Đạo Chi Chủ', color: 0xF1C40F, exp:  0.20, dot_pha:  0.08, pvp_loot: 0.05 },
  { min:  2000, label: '💎 Thần Cấp',           color: 0x9B59B6, exp:  0.15, dot_pha:  0.05, pvp_loot: 0.03 },
  { min:  1000, label: '🏅 Tôn Giả',            color: 0x3498DB, exp:  0.10, dot_pha:  0.03, pvp_loot: 0.01 },
  { min:   500, label: '🥈 Đại Năng',           color: 0x2ECC71, exp:  0.05, dot_pha:  0.01, pvp_loot: 0.00 },
  { min:   100, label: '🥉 Tu Sĩ',              color: 0x95A5A6, exp:  0.02, dot_pha:  0.00, pvp_loot: 0.00 },
  { min:     0, label: '⬜ Vô Danh',            color: 0x607080, exp:  0.00, dot_pha:  0.00, pvp_loot: 0.00 },
  { min:   -80, label: '🔴 Ác Danh',            color: 0xE74C3C, exp: -0.05, dot_pha: -0.03, pvp_loot: 0.00 },
  { min:  -400, label: '💀 Hung Đồ',            color: 0x2C3E50, exp: -0.15, dot_pha: -0.08, pvp_loot: 0.00 },
];

/**
 * Lấy hiệu ứng Danh Vọng theo điểm hiện tại.
 * @param {number} dv
 * @returns {{ label, color, exp, dot_pha, pvp_loot }}
 */
function getDanhVongBonus(dv) {
  const n = Number(dv ?? 0);
  for (const tier of DV_TIERS) {
    if (n >= tier.min) return tier;
  }
  return DV_TIERS[DV_TIERS.length - 1];
}

/**
 * Tặng / trừ Danh Vọng cho một người chơi.
 * Cho phép DV âm (không có sàn 0).
 * Fire-and-forget — không cần await.
 *
 * @param {string} userId
 * @param {number} points  Dương = thêm, âm = trừ
 */
function awardDanhVong(userId, points) {
  if (!userId || !points) return;
  db(
    'UPDATE players SET danh_vong = COALESCE(danh_vong, 0) + $1 WHERE user_id = $2',
    [points, userId],
  ).catch(e => log.error('awardDanhVong failed:', e.message));
}

module.exports = { DV_POINTS, DV_TIERS, getDanhVongBonus, awardDanhVong };
