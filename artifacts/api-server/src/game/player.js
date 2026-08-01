'use strict';
/**
 * game/player.js
 * Pure player-stat calculations — zero Discord.js dependency.
 *
 * These functions are safe to call from anywhere: command handlers,
 * combat engine, tests, or utility scripts.
 */
const {
  CANH_GIOI, LINH_CAN, HUYET_MACH, CONG_PHAP, NGHE, DAO_TU, DONG_PHU,
  REN_LUYEN_CAP, VU_KHI, BAO_BOI, TONG_MON_CAP_BAC, getTT,
} = require('../data');
const { getCG } = require('../utils/format');
const { CE } = require('../systems/emoji');

/**
 * Calculate all derived combat stats for a player record.
 *
 * @param {object} player  Full player row from the database
 * @returns {{ atk: number, def: number, hp_max: number, exp_rate: number, dao_thuong: number }}
 */
function tinhCS(player) {
  const cg   = getCG(player.canh_gioi);
  const lc   = LINH_CAN[player.linh_can]  || LINH_CAN.moc;
  const hm   = HUYET_MACH[player.huyet_mach] || HUYET_MACH.pham;
  const cp   = CONG_PHAP.find((c) => c.id === player.cong_phap) || CONG_PHAP[0];
  const nghe = NGHE[player.nghe];
  const dt_path = DAO_TU[player.dao_tu] || null;
  const dtAtkBonus = dt_path?.bonus?.atk_bonus || 0;
  const dtDefBonus = dt_path?.bonus?.def_bonus || 0;
  const dtHpBonus  = dt_path?.bonus?.hp_bonus  || 0;
  const dtExpBonus = dt_path?.bonus?.exp_bonus  || 0;
  const dp   = (player.dong_phu && DONG_PHU.find((d) => d.id === player.dong_phu)) || null;

  // Tam Ma modifiers — REDESIGN: more thresholds, more extreme peaks
  const tamMa    = player.tam_ma || 100;
  let atkMod = 1, defMod = 1, expMod = 1;
  if (tamMa >= 90)      { expMod = 1.25; defMod = 1.15; atkMod = 1.05; } // Thiên Thanh: big purity reward
  else if (tamMa >= 80) { expMod = 1.15; defMod = 1.10; }                 // unchanged
  else if (tamMa <  0)  { atkMod = 1.45; defMod = 0.75; expMod = 0.90; } // Ma Đạo: extreme offense, weak defense
  else if (tamMa < 40)  { atkMod = 1.20; defMod = 0.90; }                 // unchanged

  // Weapon / equipment
  const renLuyen = REN_LUYEN_CAP.find((r) => r.cap === (player.vu_khi_cap || 0));
  const vuKhi    = VU_KHI.find((v) => v.id === (player.vu_khi || 'kiem_go')) || VU_KHI[0];
  const linhThuong = vuKhi?.id === 'linh_thuong' ? 1.1 : 1;
  const nhuYCon    = vuKhi?.id === 'nhu_y_con'   ? 1.2 : 1;

  // Bao boi bonuses
  const baoBois  = (player.bao_boi || []).map((id) => BAO_BOI.find((b) => b.id === id)).filter(Boolean);
  const baoBoisAtk = baoBois.reduce((sum, b) => sum + (b.atk || 0), 0);
  const baoBoisDef = baoBois.reduce((sum, b) => sum + (b.def || 0), 0);

  // Dong phu bonuses
  const dpAtkBonus = dp ? 1 + (dp.atk_bonus || 0) : 1;
  const dpDefBonus = dp ? 1 + (dp.def_bonus || 0) : 1;
  const dpExpBonus = dp ? 1 + (dp.exp_bonus || 0) : 1;

  // Tong mon bonus
  const tmCap  = TONG_MON_CAP_BAC.find((t) => t.id === (player.tong_mon_cap || 'ngoai_mon')) || TONG_MON_CAP_BAC[0];
  const tmMult = player.tong_mon ? tmCap.bonus_mult : 1;

  const dt    = Math.min(3, Math.max(0, player.dao_thuong || 0));
  const dtAtk = dt === 1 ? 0.85 : dt === 2 ? 0.70 : dt === 3 ? 0.50 : 1;
  const dtDef = dt === 2 ? 0.90 : dt === 3 ? 0.80 : 1;
  const dtExp = dt === 1 ? 0.70 : dt === 2 ? 0.45 : dt === 3 ? 0.30 : 1;

  // Thần thông bonuses
  const ttAtk = getTT(player, 'atk');
  const ttDef = getTT(player, 'def');
  const ttHp  = getTT(player, 'hp');
  const ttExp = getTT(player, 'exp');

  const renAtkBonus = (renLuyen ? renLuyen.atk_bonus : 0) * (player.dao_tu === 'khi_tu' ? 1.30 : 1);

  const baAtk = 1;
  const baDef = 1;
  const baHp  = 1;
  const baExp = 1;

  const nta = player.noi_tai_an_unlocked;
  const ntaAtkMult = (nta && player.huyet_mach === 'thien_long') ? 1.45
                   : (nta && player.huyet_mach === 'hon_don_the') ? 1.60
                   : 1;
  const ntaDefMult = (nta && player.huyet_mach === 'thien_long') ? 1.40
                   : (nta && player.huyet_mach === 'co_than')    ? 1.20
                   : (nta && player.huyet_mach === 'hon_don_the') ? 1.50
                   : 1;
  const ntaExpMult = (nta && player.huyet_mach === 'thien_long') ? 1.25
                   : (nta && player.huyet_mach === 'hon_don_the') ? 1.30
                   : 1;

  return {
    atk:
      Math.floor(
        cg.cong_luc
          * hm.multiplier
          * (1 + lc.bonus_atk)
          * (1 + cp.atk_bonus)
          * atkMod
          * (nghe?.bonus?.atk_bonus ? 1 + nghe.bonus.atk_bonus : 1)
          * (1 + renAtkBonus)
          * dpAtkBonus
          * tmMult
          * linhThuong
          * (1 + dtAtkBonus)
          * dtAtk
          * (1 + ttAtk)
          * baAtk
          * ntaAtkMult,
      ) + Math.floor((vuKhi?.atk || 0) * (dt_path?.combat_passive === 'phi_khi_quyen' ? 1.30 : 1)) + baoBoisAtk,

    def:
      Math.floor(
        cg.thu_luc
          * hm.multiplier
          * (1 + lc.bonus_def)
          * (1 + cp.def_bonus)
          * defMod
          * (nghe?.bonus?.def_bonus ? 1 + nghe.bonus.def_bonus : 1)
          * (hm.dac_tinh === 'phong_thu' ? 1.3 : 1)
          * ntaDefMult
          * dpDefBonus
          * tmMult
          * nhuYCon
          * (1 + dtDefBonus)
          * dtDef
          * (1 + ttDef)
          * baDef
          * (1 + (player.linh_tu_def_bonus || 0)),
      ) + baoBoisDef,

    hp_max: Math.floor(cg.linh_luc * hm.multiplier * (1 + dtHpBonus) * (1 + ttHp) * baHp * (1 + (player.linh_tu_hp_bonus || 0)) + getTT(player, 'hp_flat')),

    exp_rate:
      (1 + lc.bonus_exp)
        * (1 + cp.exp_bonus)
        * expMod
        * (nghe?.bonus?.exp_bonus ? 1 + nghe.bonus.exp_bonus : 1)
        * (1 + dtExpBonus)
        * dpExpBonus
        * dtExp
        * ntaExpMult
        * (1 + ttExp)
        * baExp,

    dao_thuong: dt,
  };
}

/**
 * Calculate EXP gained from one active cultivation session.
 * @param {object} player  Full player row from the database
 * @returns {number}
 */
function calcEXP_active(player) {
  const stats   = tinhCS(player);
  const nextCG  = CANH_GIOI[player.canh_gioi + 1];
  // Khi đã đạt cảnh giới tối đa, không còn cảnh giới tiếp theo → trả về 0
  // (trước đây dùng thisCG.exp_can gây flood EXP vô hạn ở max realm)
  if (!nextCG) return 0;
  const baseExp = Math.floor(0.08 * nextCG.exp_can);
  return Math.floor(baseExp * stats.exp_rate);
}

// ── Dao thuong (injury) constants ─────────────────────────────────────────
/** Display names for each injury level (index 0–3). */
const DT_TEN = [
  '✅ Lành Mạnh',
  `${CE('dt_nhe','🟡')} Đạo Thương Nhẹ`,
  `${CE('dt_trung','🟠')} Đạo Thương Trung`,
  `${CE('dt_nang','🔴')} Đạo Thương Nặng`,
];

/** Effect descriptions for each injury level (index 0–3). */
const DT_HIEU = [
  'Chiến lực bình thường.',
  'ATK -15% | Tu Vi nhận vào -30%',
  'ATK -30%, DEF -10% | Tu Vi nhận vào -55%',
  'ATK -50%, DEF -20% | Tu Vi nhận vào -70% | 🔒 Bị khóa mọi lệnh',
];

/** Self-heal cost in Linh Thach per injury level. */
const PHI_TU_CHUA  = [0, 8_000, 20_000, 45_000];
/** Healer (Duoc Su) cost in Linh Thach per injury level. */
const PHI_DUOC_SU  = [0, 5_000, 12_000, 28_000];
/** Self-heal cooldown in hours. */
const CD_TU_H      = 5;
/** Healer cooldown on healer (hours). */
const CD_DS_TU_H   = 3;
/** Healer cooldown on patient (minutes). */
const CD_DS_NGUOI  = 45;

module.exports = {
  tinhCS,
  calcEXP_active,
  DT_TEN,
  DT_HIEU,
  PHI_TU_CHUA,
  PHI_DUOC_SU,
  CD_TU_H,
  CD_DS_TU_H,
  CD_DS_NGUOI,
};
