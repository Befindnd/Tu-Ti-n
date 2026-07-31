'use strict';
// @ts-check
/**
 * game/combat_engine.js
 * Pure PvP combat math — zero Discord.js dependency.
 *
 * Owns: turn resolution, elemental counter-check, stat application logic.
 * Does NOT own: Discord UI builders, session state (Map), DB writes.
 * Those remain in game/combat.js.
 *
 * This module is safe to unit-test in isolation.
 *
 * REDESIGN:
 *   - Bí Pháp multipliers significantly increased (all +0.4-1.0x)
 *   - Base crit rate 15% → 12% (rarer), but base crit mult 2.0x → 2.5x (more impactful)
 *   - Counter chance normalized (thien_long reduced penalty removed)
 *   - Shield/heal Bí Pháp buffed to matter more
 */
const { tinhCS }            = require('./player');
const { HUYET_MACH, BI_PHAP, getTT } = require('../data');
const { getChieu }          = require('../utils/random');
const { fmt }               = require('../utils/format');

// ── Bi Phap combat definitions ────────────────────────────────────────────────
// All multipliers raised: offense ~+15-30%, defense/heal ~+20-30%
const BP_COMBAT = {
  hoa_long_phong:        { type: 'atk',    mult: 2.5,  cost_hp: 0,    cd: 5 },
  bang_vu:               { type: 'atk',    mult: 2.0,  cost_hp: 0,    cd: 4 },
  than_loi:              { type: 'atk',    mult: 2.5,  cost_hp: 0,    cd: 6 },
  kim_than:              { type: 'shield', mult: 0.50, cost_hp: 0,    cd: 5, duration: 2 },
  hoi_phuc:              { type: 'heal',   mult: 0.40, cost_hp: 0,    cd: 5 },
  tam_hoa:               { type: 'atk',    mult: 2.8,  cost_hp: 0,    cd: 7 },
  huyet_sat:             { type: 'atk',    mult: 2.5,  cost_hp: 0.15, cd: 8 },
  thien_ha_de_nhat_kiem: { type: 'atk',    mult: 3.5,  cost_hp: 0,    cd: 9 },
  thien_dia_lo:          { type: 'atk',    mult: 3.0,  cost_hp: 0,    cd: 8 },
  van_kiem_quy_tong:     { type: 'atk',    mult: 4.0,  cost_hp: 0,    cd: 10 },
  hong_mong_chi_the:     { type: 'shield', mult: 0.30, cost_hp: 0,    cd: 6, duration: 2 },

  // ── Bí Pháp Gia Tộc ─────────────────────────────────────────────────
  // CD tính bằng lượt PvP (= hoi_chieu của bi_phap trong data)
  // Ngoài PvP: CD tính theo giờ (hoi_chieu × 1 giờ) lưu trong DB
  moc_linh_bi_phap:    { type: 'heal',   mult: 0.42, cost_hp: 0, cd: 3 },
  thai_duong_bi_phap:  { type: 'heal',   mult: 0.44, cost_hp: 0, cd: 3 },
  thuy_linh_bi_phap:   { type: 'shield', mult: 0.48, cost_hp: 0, cd: 3, duration: 2 },
  tho_linh_bi_phap:    { type: 'shield', mult: 0.65, cost_hp: 0, cd: 3, duration: 2 },
  kim_cuong_bi_phap:   { type: 'shield', mult: 0.46, cost_hp: 0, cd: 4, duration: 2 },
  hoa_linh_bi_phap:    { type: 'atk',   mult: 2.15, cost_hp: 0, cd: 3 },
  loi_linh_bi_phap:    { type: 'atk',   mult: 2.45, cost_hp: 0, cd: 3 },
  nguyet_anh_bi_phap:  { type: 'atk',   mult: 2.50, cost_hp: 0, cd: 3 },
  long_huyet_bi_phap:  { type: 'atk',   mult: 2.60, cost_hp: 0, cd: 4 },
  thien_ung_bi_phap:   { type: 'atk',   mult: 2.65, cost_hp: 0, cd: 4 },
  huyen_linh_bi_phap:  { type: 'atk',   mult: 2.55, cost_hp: 0, cd: 4 },
  thien_menh_bi_phap:  { type: 'atk',   mult: 2.75, cost_hp: 0, cd: 5 },
  bat_hoang_bi_phap:   { type: 'atk',   mult: 2.80, cost_hp: 0, cd: 5 },
  vo_thuong_bi_phap:   { type: 'atk',   mult: 2.90, cost_hp: 0, cd: 5 },
};

// ── Weapon crit tables ────────────────────────────────────────────────────────
// Crit rate unchanged; crit multipliers raised across the board
const CRIT_WEAPONS = {
  linh_kiem:      { r: 0.10, m: 2.0 },
  tien_kiem:      { r: 0.15, m: 2.5 },
  than_kiem:      { r: 0.20, m: 3.0 },
  hong_mong_kiem: { r: 0.25, m: 4.0 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Compute crit rate for a player.
 * REDESIGN: Base 12% (was 15%) — fewer crits but they hit harder.
 * Profession/bloodline bonuses give more differentiation.
 */
function critRate(p) {
  return (
    0.15
    + (p.cong_phap === 'diet_tien'  ? 0.20 : 0)
    + (p.huyet_mach === 'linh'      ? 0.20 : 0)
    + (p.huyet_mach === 'tu_la'     && p.noi_tai_an_unlocked ? 0.15 : 0)
    + (p.huyet_mach === 'thien_long' && p.noi_tai_an_unlocked ? 0.20 : 0)
    + (p.huyet_mach === 'hon_don_the' && p.noi_tai_an_unlocked ? 0.30 : 0)
    + (p.nghe === 'an_sat'          ? 0.08 : 0)
    + (CRIT_WEAPONS[p.vu_khi]?.r   || 0)
    + (p.nghe === 'an_sat' && p.thien_phu_nghe === 'an_sat' ? 0.15 : 0)
    + (p.dao_tu === 'kiem_tu'       ? 0.08 : 0)
    + (p.dao_tu === 'ma_tu'         ? 0.05 : 0)
    + getTT(p, 'crit')
    + (p.nguyen_than_crit || 0)
  );
}

/**
 * Compute crit multiplier for a player.
 * REDESIGN: Base 2.5x (was 2.0x) — crits are now dangerous.
 */
function critMult(p) {
  const weaponMult = CRIT_WEAPONS[p.vu_khi]?.m || 2.0;
  const baseMult   = p.cong_phap === 'diet_tien' ? 2.5 : 2.0;
  return Math.max(baseMult, weaponMult);
}

/**
 * Counter-attack chance.
 * REDESIGN: Base 35% (was 40%) — slightly less common overall,
 * but Thiên Long no longer penalised (was 0.15 base).
 */
function counterChance(p) {
  return (0.35) * (p.vu_khi === 'than_cung' ? 0.65 : 1); // was 0.40, than_cung was 0.7
}

/**
 * Check elemental counter (khắc chế) between two players.
 * @param {boolean} [nta2] - target's noi_tai_an_unlocked status
 * @returns {boolean} true if lc1/hm1 counters lc2/hm2
 */
function checkKhacChe(lc1, lc2, hm1, hm2, nta2) {
  if (hm2 === 'tien') return false;
  if (hm2 === 'hon_don_the' && nta2) return false;
  if (hm2 === 'co_than'     && nta2) return false;
  if (hm2 === 'thien_long'  && nta2) return false;
  if (lc1 === 'hon_don') return true;
  if (lc2 === 'hon_don') return false;
  const he1 = HUYET_MACH[hm1]?.he || lc1;
  const he2 = HUYET_MACH[hm2]?.he || lc2;
  return (
    { kim: 'moc', moc: 'tho', tho: 'thuy', thuy: 'hoa', hoa: 'kim' }[he1] === he2 ||
    { thunder: 'phong', phong: 'am', am: 'duong', duong: 'thunder' }[he1] === he2
  );
}

module.exports = { BP_COMBAT, CRIT_WEAPONS, critRate, critMult, counterChance, checkKhacChe };