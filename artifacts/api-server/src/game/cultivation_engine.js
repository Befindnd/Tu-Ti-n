'use strict';
// @ts-check
/**
 * game/cultivation_engine.js
 * Pure cultivation logic — zero Discord.js dependency.
 *
 * Owns:
 *   - calcTuLuyenResult()  — roll event, compute EXP/cam_ngo gain
 *   - checkDotPha()        — validate breakthrough conditions (wraps checkNgheDotPha)
 *   - calcDotPhaSuccess()  — compute breakthrough success chance
 *   - rollVuotKiepResult() — roll Thiên Kiếp outcome table with modifiers
 *
 * Does NOT own: Discord UI, DB writes.
 */
const { calcEXP_active } = require('./player');
const {
  CANH_GIOI, THIEN_KIEP_NGUONG, THIEN_KIEP_KQ, getThienKiepLoai,
  getNhanQua, getTT, TONG_MON, getNgoTinh,
} = require('../data');
const { CE } = require('../systems/emoji');

// ── Tu Luyện random events ────────────────────────────────────────────────────
// Tổng tỉ lệ = 100. Đã rebalance: bình thường ít hơn, sự kiện hay hơn phổ biến hơn.
const SU_KIEN_TU = [
  {
    id: 'binh_thuong', rate: 28, get emoji() { return CE("ft_tu_luyen","🧘"); }, ten: 'Tu Luyện Bình Thường',
    bonus: 1.0,
    mo_ta: 'Tĩnh tâm nhập định, linh khí len lỏi qua từng kinh mạch tích lũy dần.',
  },
  {
    id: 'linh_khi',    rate: 25, emoji: '✨', ten: 'Linh Khí Sung Mãn',
    bonus: 1.4,
    mo_ta: 'Linh khí bốn phương cuộn về — kinh mạch khai thông, tu vi tăng vọt! *(×1.4)*',
  },
  {
    id: 'khai_ngo',    rate: 18, emoji: `${CE('tip_icon','💡')}`, ten: 'Khai Ngộ Bất Ngờ',
    bonus: 1.7,
    mo_ta: 'Tâm trí bỗng khai ngộ — một mảnh thiên cơ hiển lộ bất ngờ! *(×1.7 + Cảm Ngộ bonus)*',
  },
  {
    id: 'thien_dao',   rate: 12, get emoji() { return CE("tia_set","⚡"); }, ten: 'Cộng Hưởng Thiên Đạo',
    bonus: 2.0,
    mo_ta: 'Thiên đạo cộng hưởng — tu vi bùng phát như sấm sét trút xuống! *(×2.0)*',
  },
  {
    id: 'tam_ma_xam',  rate: 10, get emoji() { return CE("tam_ma","😈"); }, ten: 'Tâm Ma Xâm Nhập',
    bonus: 0.5,
    mo_ta: 'Ma niệm trỗi dậy hung hãn — đạo tâm rung chuyển dữ dội, pháp lực hỗn loạn. *(×0.5)*',
  },
  {
    id: 'dia_linh',    rate: 5,  emoji: '🌿', ten: 'Địa Linh Phun Thiên',
    bonus: 2.2,
    mo_ta: 'Địa linh phun trào bên dưới — linh mạch kỳ diệu cộng hưởng, tu vi bứt phá kèm cảm ngộ! *(×2.2)*',
    extra_cam_ngo: 8,
  },
  {
    id: 'toan_tam',    rate: 2,  emoji: '🌟', ten: 'Toàn Tâm Nhập Đạo',
    bonus: 3.2,
    mo_ta: 'Vạn năm khó gặp! Ngã và đạo trở thành một — tu vi thăng thiên như vũ bão cuốn trời! *(×3.2)*',
  },
];
// Verify sum = 100: 28+25+18+12+10+5+2 = 100 ✓

/**
 * Roll a random cultivation event.
 * @returns {object} event from SU_KIEN_TU
 */
function rollTuLuyenEvent() {
  let acc = 0;
  const r = 100 * Math.random();
  for (const ev of SU_KIEN_TU) {
    acc += ev.rate;
    if (r < acc) return ev;
  }
  return SU_KIEN_TU[0];
}

/**
 * Calculate the result of one cultivation session.
 * Pure — no side effects.
 *
 * @param {object} player  Full player row from DB
 * @returns {{
 *   event, expGain, camNgoGain, newExp, newCamNgo, newTamMa,
 *   isMaxExp, isThienKiep, tamMaDelta, ngoTinhBonus
 * }}
 */
function calcTuLuyenResult(player) {
  const event = rollTuLuyenEvent();

  const s       = getNgoTinh(player.ngo_tinh || 50);
  const ngoBonus = (event.id === 'khai_ngo' || event.id === 'toan_tam' || event.id === 'dia_linh')
    ? 0.35 * s.linh_ngo_bonus
    : 0;

  // Base EXP: 7% of next realm (revert từ 8% — kết hợp sự kiện Địa Linh đã đủ nhanh)
  const baseExp  = calcEXP_active(player);
  const expGain  = Math.floor(baseExp * event.bonus * (1 + ngoBonus));

  const d = TONG_MON[player.tong_mon];
  let tamMaDelta = (d && d.tam_ma_moi_tu) || 0;
  if (event.id === 'tam_ma_xam') tamMaDelta -= 10; // gốc -10, không quá khắc nghiệt

  // Cảm Ngộ: (6-13 range, scaled by ngộ tính) × event bonus + special event bonus
  const baseCamNgo = Math.floor(8 * Math.random()) + 6; // 6-13
  const camNgoScale = 0.5 + ((player.ngo_tinh || 50) / 100) * 0.5;
  const extraCamNgo = event.extra_cam_ngo || 0;
  const camNgoDelta = Math.floor(baseCamNgo * camNgoScale * event.bonus) + extraCamNgo;

  const nextCG     = CANH_GIOI[player.canh_gioi + 1];
  const expCap     = nextCG ? nextCG.exp_can : null;
  let   newExp     = Number(player.exp) + expGain;
  let   isMaxExp   = false;
  let   isThienKiep = false;

  if (expCap !== null && newExp >= expCap) {
    newExp    = expCap;
    isMaxExp  = true;
    isThienKiep = THIEN_KIEP_NGUONG.has(nextCG.cap);
  }

  const newCamNgo = Math.min(100, (player.cam_ngo || 0) + Math.max(1, camNgoDelta));
  const newTamMa  = Math.max(-100, Math.min(100, player.tam_ma + tamMaDelta));

  return {
    event,
    expGain,
    camNgoGain: newCamNgo - (player.cam_ngo || 0),
    newExp,
    newCamNgo,
    newTamMa,
    isMaxExp,
    isThienKiep,
    tamMaDelta,
    ngoTinhBonus: ngoBonus,
  };
}

/**
 * Compute breakthrough (dot pha) success probability.
 *
 * REDESIGN:
 *   - Base raised slightly to 12% (was 15% but formula now scales more aggressively)
 *   - Per-point Cảm Ngộ bonus raised to 0.6% (was 0.4%) — more rewarding to grind CamNgo
 *   - Ngộ Tính bonus raised to 0.4% per point (was 0.3%)
 *   - Cap raised to 55% (was 40%) — high-investment players can reach higher floor
 *
 * @param {object} player
 * @param {object} ngheCheck  Result from checkNgheDotPha(player)
 * @returns {number} probability 0..1
 */
function calcDotPhaSuccess(player, ngheCheck) {
  const a   = player.cam_ngo || 0;
  const s   = getNgoTinh(player.ngo_tinh || 50);
  const camNgoPoints = Math.max(0, a - 60);
  const ngoTinhPoints = Math.round(10 * s.linh_ngo_bonus);
  return Math.min(
    0.40,                       // cap 40% (gốc)
    0.15                        // base 15% (gốc)
    + 0.004 * camNgoPoints      // gốc
    + 0.003 * ngoTinhPoints     // gốc
    + (ngheCheck.bonus || 0) * 0.5,
  );
}

/**
 * Build the modified Thiên Kiếp outcome table for a player.
 *
 * REDESIGN:
 *   - Base table: Thành Công 50% (was 55%), Tẩu Hỏa 30% (was 35%), Ngộ Đạo 20% (was 10%)
 *   - Ngộ Đạo far more common — encourages playing strategically
 *   - Tam Ma penalty more severe: <40 → +20% Tẩu Hỏa (was +15%)
 *   - Thanh Liên Cong Phap: Ngộ Đạo +15% (was +12%) — more identity
 *
 * @param {object} player
 * @param {object} hieu_ung  Result from getThienKiepLoai().hieu_ung_them(player)
 * @returns {object[]}  Modified copy of THIEN_KIEP_KQ
 */
function buildVuotKiepTable(player, hieu_ung) {
  // Clone base table, replacing rates with redesigned values
  const BASE_RATES = { thanh_cong: 35, tau_hoa: 55, ngo_dao: 10 }; // gốc
  const table = THIEN_KIEP_KQ.map(n => ({
    ...n,
    rate: BASE_RATES[n.id] !== undefined ? BASE_RATES[n.id] : n.rate,
  }));

  const clamp = (id, delta) => {
    const row = table.find(n => n.id === id);
    if (row) row.rate = Math.max(1, row.rate + delta);
  };

  // Tâm Ma penalty — harsher
  if (player.tam_ma < 40) {
    clamp('tau_hoa',    +15); // gốc
    clamp('thanh_cong', -15);
  }
  // Additional penalty for deep ma dao
  if (player.tam_ma < 0) {
    clamp('tau_hoa',    +10);
    clamp('thanh_cong', -10);
  }

  // Công Pháp modifiers
  if (player.cong_phap === 'thanh_lien') {
    clamp('ngo_dao',    +15); // was +12
    clamp('thanh_cong', -15);
  }
  if (player.cong_phap === 'diet_tien') {
    clamp('thanh_cong', +8);  // aggressive path: more success
    clamp('ngo_dao',    -8);
  }

  // Huyết Mạch
  if (player.huyet_mach === 'than') {
    clamp('thanh_cong', +8);  // was +6
    clamp('tau_hoa',    -8);
  }
  if (player.huyet_mach === 'tien') {
    clamp('ngo_dao',    +12); // was +10
    clamp('thanh_cong', -12);
  }

  // Nhân Quả karma
  const nq     = getNhanQua(player.nhan_qua || 0);
  const nqDiff = Math.round(0.5 * (nq.kiep_giam || 0)); // was 0.4
  if (nqDiff > 0) {
    clamp('thanh_cong', +nqDiff);
    clamp('tau_hoa',    -nqDiff);
  } else if (nqDiff < 0) {
    clamp('tau_hoa',    -nqDiff);
    clamp('thanh_cong', +nqDiff);
  }

  // hiệu ứng thêm từ vũ khí / đồ trang bị
  if (hieu_ung.thanh_cong_bonus) {
    const n = Math.round(10 * hieu_ung.thanh_cong_bonus);
    clamp('thanh_cong', +n);
    clamp('tau_hoa',    -n);
  }
  if (hieu_ung.hp_bonus) {
    clamp('ngo_dao', Math.round(10 * hieu_ung.hp_bonus));
  }

  // Ngộ Tính — naturally inclines toward Ngộ Đạo
  const s = getNgoTinh(player.ngo_tinh || 50);
  const l = Math.round(10 * s.ngo_dao_rate); // was 8
  clamp('ngo_dao',    +l);
  clamp('thanh_cong', -l);

  return table;
}

/**
 * Roll a Thiên Kiếp outcome from a pre-built table.
 * @param {object[]} table  From buildVuotKiepTable()
 * @returns {object}  One entry from the table
 */
function rollVuotKiepResult(table) {
  let acc = 0;
  const r = 100 * Math.random();
  let picked = table[1];
  for (const row of table) {
    acc += row.rate;
    if (r < acc) { picked = row; break; }
  }
  return picked;
}

module.exports = {
  SU_KIEN_TU,
  rollTuLuyenEvent,
  calcTuLuyenResult,
  calcDotPhaSuccess,
  buildVuotKiepTable,
  rollVuotKiepResult,
};