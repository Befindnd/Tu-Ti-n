'use strict';
/**
 * game/combat.js
 * Turn-based PvP combat engine.
 *
 * This module owns the full combat lifecycle:
 *   - Session management (COMBAT_SESSIONS map)
 *   - Turn resolution (resolveCombatTurn)
 *   - Auto-timeout scheduling (scheduleTurnTimeout)
 *   - End-of-combat DB writes and reward distribution (endCombat)
 *   - Discord UI builders (embed + button row helpers)
 *
 * NOTE: Discord.js is required here for the UI layer.
 * Pure combat maths live in game/player.js (tinhCS, etc.).
 */
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { CE }     = require('../systems/emoji');
const { db, pool } = require('../db/pool');
const { logger } = require('../utils/logger');
const log = logger.child('combat');
const { getPlayer } = require('../db/players');
const {
  CANH_GIOI, LINH_CAN, HUYET_MACH, CONG_PHAP, BI_PHAP, VU_KHI, BAO_BOI, NGHE,
  TONG_MON, CG_EMOJI, getTT, PHONG_THUY_VAN, CO_DUYEN_EVENTS,
  getDaiCanhGioiIndex,
} = require('../data');
const {
  fmt, getCG, errE, SEP2, SEP3, tinhCS, CHIEU_THUC, getChieu, DT_TEN, DT_HIEU, calcMaxLinhThach,
} = require('../utils');

// ── Session state ─────────────────────────────────────────────────────────
const COMBAT_SESSIONS  = new Map();
const RECENTLY_ENDED   = new Map();

function markRecentlyEnded(p1Id, p2Id) {
  const now = Date.now();
  RECENTLY_ENDED.set(p1Id, now);
  RECENTLY_ENDED.set(p2Id, now);
  setTimeout(() => {
    RECENTLY_ENDED.delete(p1Id);
    RECENTLY_ENDED.delete(p2Id);
  }, 15_000);
}

function wasRecentlyEnded(userId) {
  const ts = RECENTLY_ENDED.get(userId);
  return !!ts && Date.now() - ts < 15_000;
}

// ── Bi Phap combat definitions (source of truth: game/combat_engine.js) ──
const {
  BP_COMBAT,
  critRate, critMult, counterChance,
  checkKhacChe,
} = require('./combat_engine');

// ── HP display helpers ────────────────────────────────────────────────────
function hpBar(cur, max) {
  const filled = Math.round(Math.max(0, Math.min(10, (cur / max) * 10)));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function hpHeart(cur, max) {
  const ratio = cur / max;
  return ratio > 0.6 ? '❤️' : ratio > 0.3 ? '🧡' : '💔';
}

// ── Embed builder ─────────────────────────────────────────────────────────
function makeCombatEmbed(session, turnLog) {
  const p1hp   = Math.max(0, Math.floor(session.p1_hp));
  const p2hp   = Math.max(0, Math.floor(session.p2_hp));
  const p1pct  = Math.round((p1hp / session.p1_hp_max) * 100);
  const p2pct  = Math.round((p2hp / session.p2_hp_max) * 100);
  const p1st   = session.p1_action ? '✅ Đã chọn' : `${CE("cd_timer","⏳")} Chờ...`;
  const p2st   = session.p2_action ? '✅ Đã chọn' : `${CE("cd_timer","⏳")} Chờ...`;
  const cg1    = getCG(session.p1_data?.canh_gioi ?? 0).ten;
  const cg2    = getCG(session.p2_data?.canh_gioi ?? 0).ten;
  const log    = (turnLog || session.log).slice(-4);
  const logStr = log.length
    ? log.join('\n')
    : '*⚔️ Kiếm khí tung hoành, sát ý ngập không trung — trận chiến bắt đầu!*';

  const desc = [
    `${hpHeart(p1hp, session.p1_hp_max)} **${session.p1_name}** · *${cg1}*`,
    `\`${hpBar(p1hp, session.p1_hp_max)}\` **${p1pct}%** — ${fmt(p1hp)}/${fmt(session.p1_hp_max)} HP  ·  ${p1st}`,
    '',
    `${hpHeart(p2hp, session.p2_hp_max)} **${session.p2_name}** · *${cg2}*`,
    `\`${hpBar(p2hp, session.p2_hp_max)}\` **${p2pct}%** — ${fmt(p2hp)}/${fmt(session.p2_hp_max)} HP  ·  ${p2st}`,
    '',
    SEP3,
    logStr,
  ].join('\n');

  return new EmbedBuilder()
    .setTitle(`${CE('tuatk', '⚔️')} Tỷ Thí · ${session.p1_name} ✦ ${session.p2_name} · Lượt ${session.turn}/${session.max_turns}`)
    .setColor(9109504)
    .setDescription(desc)
    .setFooter({ text: '⏱️ 90 giây/lượt · Không chọn → tự động Tấn Công' });
}

// ── Button row builders ───────────────────────────────────────────────────
function makePVPInviteRow(challengerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pvp_nhan_${challengerId}`).setLabel('Nhận Chiến').setStyle(ButtonStyle.Success).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId(`pvp_tuchoi_${challengerId}`).setLabel('Từ Chối').setStyle(ButtonStyle.Danger).setEmoji('❌'),
  );
}

function makePVPInviteRowDisabled(challengerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pvp_nhan_${challengerId}`).setLabel('Nhận Chiến').setStyle(ButtonStyle.Success).setEmoji('⚔️').setDisabled(true),
    new ButtonBuilder().setCustomId(`pvp_tuchoi_${challengerId}`).setLabel('Từ Chối').setStyle(ButtonStyle.Danger).setEmoji('❌').setDisabled(true),
  );
}

function makePVPCombatRow(sessionKey, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pvp_danh_${sessionKey}`).setLabel('Tấn Công').setStyle(ButtonStyle.Primary).setEmoji('⚔️').setDisabled(disabled),
    new ButtonBuilder().setCustomId(`pvp_biphap_${sessionKey}`).setLabel('Bí Pháp').setStyle(ButtonStyle.Danger).setEmoji('📜').setDisabled(disabled),
    new ButtonBuilder().setCustomId(`pvp_the_${sessionKey}`).setLabel('Hộ Thể').setStyle(ButtonStyle.Secondary).setEmoji('🔰').setDisabled(disabled),
    new ButtonBuilder().setCustomId(`pvp_hoikhi_${sessionKey}`).setLabel('Hồi Linh Khí').setStyle(ButtonStyle.Success).setEmoji('💫').setDisabled(disabled),
    new ButtonBuilder().setCustomId(`pvp_thua_${sessionKey}`).setLabel('Đầu Hàng').setStyle(ButtonStyle.Secondary).setEmoji('🏳️').setDisabled(disabled),
  );
}

// ── Turn resolution ───────────────────────────────────────────────────────
async function resolveCombatTurn(session) {
  session.turn_timeout && (clearTimeout(session.turn_timeout), (session.turn_timeout = null));
  session.p1_action || (session.p1_action = { type: 'danh' });
  session.p2_action || (session.p2_action = { type: 'danh' });

  const act1 = session.p1_action;
  const act2 = session.p2_action;
  const log  = [];

  // critRate / critMult / counterChance are imported from combat_engine above
  const p1data = session.p1_data;
  const p2data = session.p2_data;
  let p1AtkMult = 1, p2AtkMult = 1, p1DefMult = 1, p2DefMult = 1;
  let p1Heal = 0, p2Heal = 0;
  let p1Fled = false, p2Fled = false;

  // Apply persisted shield from previous turn(s)
  if ((session.p1_shield_turns || 0) > 0) p1DefMult = session.p1_shield_mult || 0.5;
  if ((session.p2_shield_turns || 0) > 0) p2DefMult = session.p2_shield_mult || 0.5;

  // Process each player's chosen action
  for (const [side, action] of [[1, act1], [2, act2]]) {
    const isP1   = side === 1;
    const name   = isP1 ? session.p1_name : session.p2_name;
    const hpMax  = isP1 ? session.p1_hp_max : session.p2_hp_max;
    const bpCd   = isP1 ? session.p1_bp_cd  : session.p2_bp_cd;
    const actCd  = isP1 ? session.p1_action_cd : session.p2_action_cd;

    if (action.type === 'phong_thu') {
      isP1 ? ((p1AtkMult = 0), (p1DefMult = 0.40)) : ((p2AtkMult = 0), (p2DefMult = 0.40));
      const healAmt = Math.floor(0.08 * hpMax);
      isP1 ? (p1Heal = healAmt) : (p2Heal = healAmt);
      actCd.phong_thu = 2;
      log.push(`🔰 **${name}** khai Hộ Thể Công — nhận 40% sát thương & hồi +**${fmt(healAmt)}** HP *(CD: 2 lượt)*`);

    } else if (action.type === 'bao_kich') {
      isP1 ? ((p1AtkMult = 1.5), (p1DefMult = 1.40)) : ((p2AtkMult = 1.5), (p2DefMult = 1.40));
      log.push(`🌀 **${name}** vận Thần Thông — Công Lực ×1.5 nhưng phòng thủ suy giảm!`);

    } else if (action.type === 'bi_phap') {
      const bpDef  = BP_COMBAT[action.bp_id];
      const bpData = BI_PHAP.find((b) => b.id === action.bp_id);
      if (bpDef && bpData) {
        if (bpDef.type === 'atk') {
          const phapBonus = (isP1 ? p1data : p2data)?.dao_tu === 'phap_tu' ? 1.20 : 1;
          isP1 ? (p1AtkMult = bpDef.mult * phapBonus) : (p2AtkMult = bpDef.mult * phapBonus);
          if (bpDef.cost_hp > 0) {
            const cost = Math.floor(hpMax * bpDef.cost_hp);
            isP1 ? (session.p1_hp -= cost) : (session.p2_hp -= cost);
            log.push(`☠️ **${name}** trả **${fmt(cost)}** HP → tung **${bpData.ten}**!`);
          } else {
            log.push(`✨ **${name}** tung **${bpData.ten}**!`);
          }
        } else if (bpDef.type === 'shield') {
          const dur = bpDef.duration || 1;
          if (isP1) {
            p1AtkMult = 0; p1DefMult = bpDef.mult;
            session.p1_shield_turns = dur;
            session.p1_shield_mult  = bpDef.mult;
          } else {
            p2AtkMult = 0; p2DefMult = bpDef.mult;
            session.p2_shield_turns = dur;
            session.p2_shield_mult  = bpDef.mult;
          }
          const durTxt = dur > 1 ? ` *(${dur} lượt)*` : '';
          log.push(`${CE('tudef', '🛡️')} **${name}** khai **${bpData.ten}** — nhận chỉ ${Math.round(100 * bpDef.mult)}% sát thương${durTxt}!`);
        } else if (bpDef.type === 'heal') {
          const healAmt = Math.floor(hpMax * bpDef.mult);
          isP1 ? ((p1Heal = healAmt), (p1AtkMult = 0)) : ((p2Heal = healAmt), (p2AtkMult = 0));
          log.push(`💚 **${name}** khai **${bpData.ten}** — hồi +**${fmt(healAmt)}** HP!`);
        }
        bpCd[action.bp_id] = bpDef.cd + 1;
      }

    } else if (action.type === 'hoi_khi') {
      isP1 ? (p1AtkMult = 0) : (p2AtkMult = 0);
      const healAmt = Math.floor(0.15 * hpMax);
      isP1 ? (p1Heal = healAmt) : (p2Heal = healAmt);
      actCd.hoi_khi = 2;
      log.push(`💫 **${name}** thu công tụ linh — Hồi Linh Khí +**${fmt(healAmt)}** HP! *(CD: 2 lượt)*`);

    } else if (action.type === 'chay') {
      if (Math.random() < 0.40) {
        isP1 ? (p1Fled = true) : (p2Fled = true);
        log.push(`🏳️ **${name}** đầu hàng rút lui! *(bại trận)*`);
      } else {
        log.push(`🏳️ **${name}** cố rút lui nhưng bị ngăn cản!`);
      }
    }
  }

  // Tụ Linh Phủ / Tinh Thạch Hồi Linh Bát / Thần Thú Tâm Tinh Ngọc passive regen
  for (const [isP1, nameKey, hpMaxKey, hpKey, baoBoiKey] of [
    [true,  'p1_name', 'p1_hp_max', 'p1_hp', 'p1_data'],
    [false, 'p2_name', 'p2_hp_max', 'p2_hp', 'p2_data'],
  ]) {
    const bb = session[baoBoiKey]?.bao_boi || [];
    if (bb.includes('tien_phu')) {
      const regen = Math.floor(0.02 * session[hpMaxKey]);
      isP1 ? (p1Heal += regen) : (p2Heal += regen);
      log.push(`✨ **${session[nameKey]}** hồi **+${fmt(regen)}** HP *(Tụ Linh Phủ)*`);
    }
    if (bb.includes('than_thu_tam_ngoc')) {
      const regen = Math.floor(0.05 * session[hpMaxKey]);
      isP1 ? (p1Heal += regen) : (p2Heal += regen);
      log.push(`🌟 **${session[nameKey]}** hồi **+${fmt(regen)}** HP *(Thần Thú Tâm Ngọc)*`);
    } else if (bb.includes('tinh_thach_hoi_linh')) {
      const regen = Math.floor(0.04 * session[hpMaxKey]);
      isP1 ? (p1Heal += regen) : (p2Heal += regen);
      log.push(`🔮 **${session[nameKey]}** hồi **+${fmt(regen)}** HP *(Tinh Thạch Hồi Linh)*`);
    }
  }

  // Hồi Xuân — passive HP regen after each round
  for (const [dataKey, hpKey, hpMaxKey, nameKey] of [
    ['p1_data', 'p1_hp', 'p1_hp_max', 'p1_name'],
    ['p2_data', 'p2_hp', 'p2_hp_max', 'p2_name'],
  ]) {
    const regenPct = getTT(session[dataKey], 'regen_pct');
    if (regenPct > 0) {
      const regenAmt = Math.floor(session[hpMaxKey] * regenPct);
      session[hpKey] = Math.min(session[hpMaxKey], session[hpKey] + regenAmt);
      log.push(`${session[nameKey]} [🌸Hồi Xuân] +${regenAmt} HP`);
    }
  }

  // Nội Tại Ẩn — HP regen per turn (thien_long 10%, hon_don_the 15%)
  for (const [dataKey, hpKey, hpMaxKey, nameKey] of [
    ['p1_data', 'p1_hp', 'p1_hp_max', 'p1_name'],
    ['p2_data', 'p2_hp', 'p2_hp_max', 'p2_name'],
  ]) {
    const pd = session[dataKey];
    if (pd?.noi_tai_an_unlocked) {
      let ntaRegen = 0, ntaLabel = '';
      if (pd.huyet_mach === 'thien_long') { ntaRegen = 0.10; ntaLabel = '👑Thiên Long Uy Linh'; }
      else if (pd.huyet_mach === 'hon_don_the') { ntaRegen = 0.15; ntaLabel = '🌀Hỗn Độn Khai Thiên'; }
      if (ntaRegen > 0) {
        const regenAmt = Math.floor(session[hpMaxKey] * ntaRegen);
        session[hpKey] = Math.min(session[hpMaxKey], session[hpKey] + regenAmt);
        log.push(`✨ **${session[nameKey]}** [${ntaLabel}] hồi **+${fmt(regenAmt)}** HP!`);
      }
    }
  }

  // Apply heals
  if (p1Heal > 0) session.p1_hp = Math.min(session.p1_hp_max, session.p1_hp + p1Heal);
  if (p2Heal > 0) session.p2_hp = Math.min(session.p2_hp_max, session.p2_hp + p2Heal);

  if (!p1Fled && !p2Fled) {
    // Van Thuy counter-attack chance
    const p1counter = p1data.cong_phap === 'van_thuy' ? 0.15 : 0;
    const p2counter = p2data.cong_phap === 'van_thuy' ? 0.15 : 0;

    // Kien Long Giap / Thanh / craft bao boi / Vo Bien Nhan defence reduction
    const p1defMod =
      (p1data.huyet_mach === 'thanh' ? 0.8 : 1) *
      ((p1data.bao_boi || []).includes('kien_long_giap') ? 0.8 : 1) *
      ((p1data.bao_boi || []).includes('linh_thu_ho_tam') ? 0.88 : 1) *
      ((p1data.bao_boi || []).includes('vo_bien_nhan') ? 0.80 : 1);
    const p2defMod =
      (p2data.huyet_mach === 'thanh' ? 0.8 : 1) *
      ((p2data.bao_boi || []).includes('kien_long_giap') ? 0.8 : 1) *
      ((p2data.bao_boi || []).includes('linh_thu_ho_tam') ? 0.88 : 1) *
      ((p2data.bao_boi || []).includes('vo_bien_nhan') ? 0.80 : 1);

    // Ma Dao blood-burst
    if (p1data.cong_phap === 'ma_dao' && session.p1_hp < 0.3 * session.p1_hp_max) {
      p1AtkMult = 1.10 * Math.max(p1AtkMult, 1);
      const burn = Math.floor(0.05 * session.p1_hp_max);
      session.p1_hp = Math.max(0, session.p1_hp - burn);
      log.push(`🩸 **${session.p1_name}** Huyết Thức bùng cháy! ATK+10% nhưng hao **${fmt(burn)}** HP`);
    }
    if (p2data.cong_phap === 'ma_dao' && session.p2_hp < 0.3 * session.p2_hp_max) {
      p2AtkMult = 1.10 * Math.max(p2AtkMult, 1);
      const burn = Math.floor(0.05 * session.p2_hp_max);
      session.p2_hp = Math.max(0, session.p2_hp - burn);
      log.push(`🩸 **${session.p2_name}** Huyết Thức bùng cháy! ATK+10% nhưng hao **${fmt(burn)}** HP`);
    }

    // ── Đạo Tu passives ─────────────────────────────────────────────────────
    // Cương Thể (Thể Tu): HP < 30% → ATK +25%
    for (const [side, data, nameKey] of [[1, p1data, 'p1_name'], [2, p2data, 'p2_name']]) {
      if (data.dao_tu === 'the_tu') {
        const hp    = side === 1 ? session.p1_hp : session.p2_hp;
        const hpMax = side === 1 ? session.p1_hp_max : session.p2_hp_max;
        if (hp < 0.30 * hpMax) {
          if (side === 1) p1AtkMult = Math.max(p1AtkMult, 1) * 1.25;
          else            p2AtkMult = Math.max(p2AtkMult, 1) * 1.25;
          log.push(`💪 **${session[nameKey]}** [Cương Thể] bùng phát! ATK +25%!`);
        }
      }
    }
    // Ma Bùng (Ma Tu): HP < 50% → ATK +30%, DEF ×0.85, hao 4% HP
    for (const [side, data, nameKey] of [[1, p1data, 'p1_name'], [2, p2data, 'p2_name']]) {
      if (data.dao_tu === 'ma_tu') {
        const hp    = side === 1 ? session.p1_hp : session.p2_hp;
        const hpMax = side === 1 ? session.p1_hp_max : session.p2_hp_max;
        if (hp < 0.50 * hpMax) {
          if (side === 1) { p1AtkMult = Math.max(p1AtkMult, 1) * 1.30; p1DefMult *= 0.85; }
          else            { p2AtkMult = Math.max(p2AtkMult, 1) * 1.30; p2DefMult *= 0.85; }
          const burn = Math.floor(0.04 * hpMax);
          if (side === 1) session.p1_hp = Math.max(0, session.p1_hp - burn);
          else            session.p2_hp = Math.max(0, session.p2_hp - burn);
          log.push(`🔥 **${session[nameKey]}** [Ma Bùng] ATK+30%, DEF-15%, hao **${fmt(burn)}** HP!`);
        }
      }
    }
    // Linh Đan (Đan Tu): hồi 5% HP mỗi lượt
    if (p1data.dao_tu === 'dan_tu') {
      const regen = Math.floor(0.05 * session.p1_hp_max);
      session.p1_hp = Math.min(session.p1_hp_max, session.p1_hp + regen);
      log.push(`🌿 **${session.p1_name}** [Linh Đan] hồi +${fmt(regen)} HP!`);
    }
    if (p2data.dao_tu === 'dan_tu') {
      const regen = Math.floor(0.05 * session.p2_hp_max);
      session.p2_hp = Math.min(session.p2_hp_max, session.p2_hp + regen);
      log.push(`🌿 **${session.p2_name}** [Linh Đan] hồi +${fmt(regen)} HP!`);
    }
    // Yêu Năng (Yêu Tu): hồi 3% HP mỗi lượt
    if (p1data.dao_tu === 'yeu_tu') {
      const regen = Math.floor(0.03 * session.p1_hp_max);
      session.p1_hp = Math.min(session.p1_hp_max, session.p1_hp + regen);
    }
    if (p2data.dao_tu === 'yeu_tu') {
      const regen = Math.floor(0.03 * session.p2_hp_max);
      session.p2_hp = Math.min(session.p2_hp_max, session.p2_hp + regen);
    }
    // Trận Pháp (Trận Tu): 15% phong ấn 1 lượt + nhận sát thương -10%
    if (p1data.dao_tu === 'tran_tu' && p2AtkMult > 0 && Math.random() < 0.15) {
      p2AtkMult = 0;
      log.push(`🧿 **${session.p1_name}** [Trận Pháp] phong ấn! **${session.p2_name}** mất lượt tấn công!`);
    }
    if (p2data.dao_tu === 'tran_tu' && p1AtkMult > 0 && Math.random() < 0.15) {
      p1AtkMult = 0;
      log.push(`🧿 **${session.p2_name}** [Trận Pháp] phong ấn! **${session.p1_name}** mất lượt tấn công!`);
    }

    // P1 attacks P2
    if (p1AtkMult > 0) {
      const p1bb = p1data.bao_boi || [];
      const p2bb = p2data.bao_boi || [];
      const dodgedBatQua = p2bb.includes('bat_qua_kinh') && Math.random() < 0.25;
      const dodgedBB = !dodgedBatQua && p2bb.includes('ho_than_kinh') && Math.random() < 0.30;
      const dodgedTT = !dodgedBatQua && !dodgedBB && getTT(p2data, 'dodge') > 0 && Math.random() < getTT(p2data, 'dodge');
      const dodged   = dodgedBatQua || dodgedBB || dodgedTT;

      if (dodgedBatQua) log.push(`💨 **${session.p2_name}** **né tránh** đòn! *(Bát Quái Kính)*`);
      else if (dodgedBB) log.push(`💨 **${session.p2_name}** **né tránh** đòn! *(Hộ Pháp Kính)*`);
      else if (dodgedTT) log.push(`🌊 **${session.p2_name}** **khinh công né tránh** đòn! *(Thần Thông)*`);

      if (!dodged) {
        const rawDmg  = Math.floor(session.p1_atk_mod * p1AtkMult);
        const netDmg  = Math.max(1, rawDmg - session.p2_def_mod);
        const isCrit  = !(p2data.huyet_mach === 'hon_don_the' && p2data.noi_tai_an_unlocked) &&
                        !(p2data.huyet_mach === 'co_than'    && p2data.noi_tai_an_unlocked) &&
                        Math.random() < critRate(p1data);
        const isLHC   = p1bb.includes('loi_hoa_cau') && Math.random() < 0.20;
        // Craft bảo bối bạo kích (kích hoạt 1 cái mạnh nhất)
        const isBBCrit =
          (p1bb.includes('linh_hon_am_khi') && Math.random() < 0.22) ? 'linh_hon_am_khi' :
          (p1bb.includes('huyen_long_tam_chau') && Math.random() < 0.20) ? 'huyen_long_tam_chau' :
          (p1bb.includes('da_thu_sat_khi') && Math.random() < 0.15) ? 'da_thu_sat_khi' : null;
        const bbCritMult = isBBCrit === 'linh_hon_am_khi' ? 3.2 : isBBCrit === 'huyen_long_tam_chau' ? 2.2 : 1.8;
        let dmg       = Math.floor((isCrit ? netDmg * critMult(p1data) : netDmg) * p2DefMult * p2defMod);
        if (isLHC) dmg = Math.floor(1.5 * dmg);
        if (isBBCrit) dmg = Math.floor(bbCritMult * dmg);
        if (session.p2_shield > 0) dmg = Math.floor(dmg * (1 - session.p2_shield));
        const dmgReduce = getTT(p2data, 'dmg_reduce');
        if (dmgReduce > 0) dmg = Math.floor(dmg * (1 - dmgReduce));

        const countered = Math.random() < p2counter;
        const shieldTag = session.p2_shield > 0 ? '📜*Phù Hộ*' : '';
        const bbCritLabel = isBBCrit === 'linh_hon_am_khi' ? '💀*Âm Khí Bạo Kích*' : isBBCrit === 'huyen_long_tam_chau' ? '🐉*Long Tâm Bạo Kích*' : isBBCrit ? '🐾*Sát Khí Bạo Kích*' : '';
        const tags = [
          isCrit  ? `${CE("tia_set","⚡")}*Bạo Kích*`  : '',
          isLHC   ? `${CE("tia_set","⚡")}🔥*Lôi Hỏa*` : '',
          bbCritLabel,
          session.kc1 ? '🔥*Khắc Chế*' : '',
          countered   ? '↩️*Phản Đòn*' : '',
          shieldTag,
        ].filter(Boolean).join(' ');

        log.push(`${CE('tuatk', '⚔️')} **${session.p1_name}** *${getChieu(p1data.cong_phap)}* → **-${fmt(dmg)}** HP ${tags}`);
        session.p2_hp -= dmg;

        // Phản kích bảo bối — Thiên Long Giáp 20%, Âm Dương Bài 15%
        const reflectPct = p2bb.includes('thien_long_giap') ? 0.20 : p2bb.includes('am_duong_bai') ? 0.15 : 0;
        if (reflectPct > 0 && dmg > 0) {
          const reflectDmg = Math.floor(reflectPct * dmg);
          session.p1_hp -= reflectDmg;
          log.push(`  ☯️ *Phản Kích* [${p2bb.includes('thien_long_giap') ? 'Thiên Long Giáp' : 'Âm Dương Bài'}] → **-${fmt(reflectDmg)}** HP phản lại!`);
        }

        // Hấp thụ linh lực — Hồng Mông Huyền Thiên Châu: phục hồi 30% sát thương nhận được
        if (p2bb.includes('hong_mong_chu') && dmg > 0) {
          const vampHeal = Math.floor(0.30 * dmg);
          session.p2_hp = Math.min(session.p2_hp_max, session.p2_hp + vampHeal);
          log.push(`  🌀 *Hồng Mông* hấp thụ **+${fmt(vampHeal)}** HP!`);
        }

        if (countered) {
          const counterDmg = Math.floor(0.40 * session.p2_atk_mod * p1defMod);
          log.push(`  ↩️ *Phản Đòn* → **-${fmt(counterDmg)}** HP!`);
          session.p1_hp -= counterDmg;
        }
      }
    }

    // P2 attacks P1
    if (p2AtkMult > 0) {
      const p1bb = p1data.bao_boi || [];
      const p2bb = p2data.bao_boi || [];
      const dodgedBatQua = p1bb.includes('bat_qua_kinh') && Math.random() < 0.25;
      const dodgedBB = !dodgedBatQua && p1bb.includes('ho_than_kinh') && Math.random() < 0.30;
      const dodgedTT = !dodgedBatQua && !dodgedBB && getTT(p1data, 'dodge') > 0 && Math.random() < getTT(p1data, 'dodge');
      const dodged   = dodgedBatQua || dodgedBB || dodgedTT;

      if (dodgedBatQua) log.push(`💨 **${session.p1_name}** **né tránh** đòn! *(Bát Quái Kính)*`);
      else if (dodgedBB) log.push(`💨 **${session.p1_name}** **né tránh** đòn! *(Hộ Pháp Kính)*`);
      else if (dodgedTT) log.push(`🌊 **${session.p1_name}** **khinh công né tránh** đòn! *(Thần Thông)*`);

      if (!dodged) {
        const rawDmg  = Math.floor(session.p2_atk_mod * p2AtkMult);
        const netDmg  = Math.max(1, rawDmg - session.p1_def_mod);
        const isCrit  = !(p1data.huyet_mach === 'hon_don_the' && p1data.noi_tai_an_unlocked) &&
                        !(p1data.huyet_mach === 'co_than'    && p1data.noi_tai_an_unlocked) &&
                        Math.random() < critRate(p2data);
        const isLHC   = p2bb.includes('loi_hoa_cau') && Math.random() < 0.20;
        // Craft bảo bối bạo kích (kích hoạt 1 cái mạnh nhất)
        const isBBCrit =
          (p2bb.includes('linh_hon_am_khi') && Math.random() < 0.22) ? 'linh_hon_am_khi' :
          (p2bb.includes('huyen_long_tam_chau') && Math.random() < 0.20) ? 'huyen_long_tam_chau' :
          (p2bb.includes('da_thu_sat_khi') && Math.random() < 0.15) ? 'da_thu_sat_khi' : null;
        const bbCritMult = isBBCrit === 'linh_hon_am_khi' ? 3.2 : isBBCrit === 'huyen_long_tam_chau' ? 2.2 : 1.8;
        let dmg       = Math.floor((isCrit ? netDmg * critMult(p2data) : netDmg) * p1DefMult * p1defMod);
        if (isLHC) dmg = Math.floor(1.5 * dmg);
        if (isBBCrit) dmg = Math.floor(bbCritMult * dmg);
        if (session.p1_shield > 0) dmg = Math.floor(dmg * (1 - session.p1_shield));
        const dmgReduce = getTT(p1data, 'dmg_reduce');
        if (dmgReduce > 0) dmg = Math.floor(dmg * (1 - dmgReduce));

        const countered = Math.random() < p1counter;
        const shieldTag = session.p1_shield > 0 ? '📜*Phù Hộ*' : '';
        const bbCritLabel = isBBCrit === 'linh_hon_am_khi' ? '💀*Âm Khí Bạo Kích*' : isBBCrit === 'huyen_long_tam_chau' ? '🐉*Long Tâm Bạo Kích*' : isBBCrit ? '🐾*Sát Khí Bạo Kích*' : '';
        const tags = [
          isCrit  ? `${CE("tia_set","⚡")}*Bạo Kích*`  : '',
          isLHC   ? `${CE("tia_set","⚡")}🔥*Lôi Hỏa*` : '',
          bbCritLabel,
          session.kc2 ? '🔥*Khắc Chế*' : '',
          countered   ? '↩️*Phản Đòn*' : '',
          shieldTag,
        ].filter(Boolean).join(' ');

        log.push(`🌀 **${session.p2_name}** *${getChieu(p2data.cong_phap)}* → **-${fmt(dmg)}** HP ${tags}`);
        session.p1_hp -= dmg;

        // Phản kích bảo bối — Thiên Long Giáp 20%, Âm Dương Bài 15%
        const reflectPct = p1bb.includes('thien_long_giap') ? 0.20 : p1bb.includes('am_duong_bai') ? 0.15 : 0;
        if (reflectPct > 0 && dmg > 0) {
          const reflectDmg = Math.floor(reflectPct * dmg);
          session.p2_hp -= reflectDmg;
          log.push(`  ☯️ *Phản Kích* [${p1bb.includes('thien_long_giap') ? 'Thiên Long Giáp' : 'Âm Dương Bài'}] → **-${fmt(reflectDmg)}** HP phản lại!`);
        }

        // Hấp thụ linh lực — Hồng Mông Huyền Thiên Châu: phục hồi 30% sát thương nhận được
        if (p1bb.includes('hong_mong_chu') && dmg > 0) {
          const vampHeal = Math.floor(0.30 * dmg);
          session.p1_hp = Math.min(session.p1_hp_max, session.p1_hp + vampHeal);
          log.push(`  🌀 *Hồng Mông* hấp thụ **+${fmt(vampHeal)}** HP!`);
        }

        if (countered) {
          const counterDmg = Math.floor(0.40 * session.p1_atk_mod * p2defMod);
          log.push(`  ↩️ *Phản Đòn* → **-${fmt(counterDmg)}** HP!`);
          session.p2_hp -= counterDmg;
        }
      }
    }
  }

  // Tick down cooldowns
  for (const key in session.p1_bp_cd)     if (session.p1_bp_cd[key]     > 0) session.p1_bp_cd[key]--;
  for (const key in session.p2_bp_cd)     if (session.p2_bp_cd[key]     > 0) session.p2_bp_cd[key]--;
  for (const key in session.p1_action_cd) if (session.p1_action_cd[key] > 0) session.p1_action_cd[key]--;
  for (const key in session.p2_action_cd) if (session.p2_action_cd[key] > 0) session.p2_action_cd[key]--;

  // Tick down persistent shield duration
  if ((session.p1_shield_turns || 0) > 0) session.p1_shield_turns--;
  if ((session.p2_shield_turns || 0) > 0) session.p2_shield_turns--;

  session.log.push(...log);

  const p1Out = session.p1_hp <= 0 || p1Fled;
  const p2Out = session.p2_hp <= 0 || p2Fled;

  if (p1Out || p2Out || session.turn >= session.max_turns) {
    return { done: true, p1_out: p1Out, p2_out: p2Out, tl: log };
  }

  session.turn++;
  session.p1_action = null;
  session.p2_action = null;
  return { done: false, tl: log };
}

// ── Turn timeout ──────────────────────────────────────────────────────────
function scheduleTurnTimeout(session) {
  session.turn_timeout && clearTimeout(session.turn_timeout);
  session.turn_timeout = setTimeout(async () => {
    if (!COMBAT_SESSIONS.has(session.p1_id)) return;
    if (session.resolving || session.ended) return;
    session.resolving = true;
    session.p1_action || (session.p1_action = { type: 'danh' });
    session.p2_action || (session.p2_action = { type: 'danh' });

    const ch = session.channel;
    if (!ch) {
      COMBAT_SESSIONS.delete(session.p1_id);
      COMBAT_SESSIONS.delete(session.p2_id);
      return;
    }

    try {
      const result = await resolveCombatTurn(session);
      if (result.done) {
        await endCombat(session, ch);
      } else {
        session.resolving = false;
        if (session.combat_msg) {
          await session.combat_msg.edit({
            embeds: [makeCombatEmbed(session, result.tl)],
            components: [makePVPCombatRow(session.p1_id)],
          }).catch(() => {});
        } else {
          session.combat_msg = await ch.send({
            embeds: [makeCombatEmbed(session, result.tl)],
            components: [makePVPCombatRow(session.p1_id)],
          });
        }
        scheduleTurnTimeout(session);
      }
    } catch (err) {
      log.error('Turn timeout error — session cleaned up:', err?.message || err);
      COMBAT_SESSIONS.delete(session.p1_id);
      COMBAT_SESSIONS.delete(session.p2_id);
      ch.send({ embeds: [{ description: '❌ Lỗi hệ thống trong trận chiến — phiên đã bị huỷ.', color: 0xe74c3c }] }).catch(() => {});
    }
  }, 90_000);
}

// ── End combat ────────────────────────────────────────────────────────────
async function endCombat(session, channel) {
  session.ended = true;
  session.turn_timeout && (clearTimeout(session.turn_timeout), (session.turn_timeout = null));

  try {
    const p1wins  = session.p1_hp / session.p1_hp_max >= session.p2_hp / session.p2_hp_max;
    const winnerId  = p1wins ? session.p1_id   : session.p2_id;
    const loserId   = p1wins ? session.p2_id   : session.p1_id;
    const winnerName= p1wins ? session.p1_name : session.p2_name;
    const loserName = p1wins ? session.p2_name : session.p1_name;

    const [loserPlayer, winnerPlayer] = await Promise.all([getPlayer(loserId), getPlayer(winnerId)]);

    const loot         = Math.floor(0.03 * Math.max(0, Number(loserPlayer?.linh_thach || 0)));
    const winnerHpLeft = Math.max(1, Math.floor(p1wins ? session.p1_hp : session.p2_hp));
    const loserHpLeft  = Math.max(1, Math.floor(p1wins ? session.p2_hp : session.p1_hp));
    const loserRatio   = loserHpLeft / (p1wins ? session.p2_hp_max : session.p1_hp_max);

    // Injury roll for loser
    let newDT = Math.min(3, Math.max(0, loserPlayer?.dao_thuong || 0));
    let gotInjured = false;
    if (newDT < 3) {
      const injuryChance = loserRatio < 0.05 ? 0.65 : loserRatio < 0.15 ? 0.40 : loserRatio < 0.25 ? 0.20 : 0;
      if (injuryChance > 0 && Math.random() < injuryChance) {
        newDT = Math.min(3, newDT + 1);
        gotInjured = true;
      }
    }

    const safeLoot       = calcMaxLinhThach(winnerPlayer || {}, Math.max(0, Math.floor(Number(loot) || 0)));
    const safeWinnerHp   = Math.max(1, Math.floor(Number(winnerHpLeft) || 1));
    const safeLoserHp    = Math.max(1, Math.floor(Number(loserHpLeft) || 1));
    const now            = Date.now();
    const safeDaoThuong  = Math.min(3, Math.max(0, Math.floor(Number(newDT) || 0)));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
      'UPDATE players SET pvp_wins=pvp_wins+1, linh_thach=linh_thach+$1, pvp_cd=$2, hp=GREATEST(1,$3), tam_ma=LEAST(100,COALESCE(tam_ma,100)+3) WHERE user_id=$4',
        [safeLoot, now, safeWinnerHp, winnerId],
      );
      await client.query(
      'UPDATE players SET pvp_losses=pvp_losses+1, linh_thach=GREATEST(0,linh_thach-$1), pvp_cd=$2, hp=GREATEST(1,$3), dao_thuong=$4, dao_thuong_at=CASE WHEN $4>0 THEN $5::BIGINT ELSE 0::BIGINT END, tam_ma=GREATEST(-100,COALESCE(tam_ma,100)-5) WHERE user_id=$6',
        [safeLoot, now, safeLoserHp, safeDaoThuong, now, loserId],
      );
      await client.query(
        'UPDATE players SET nhan_qua=GREATEST(-100,nhan_qua-1), ma_khi=LEAST(9999,ma_khi+3) WHERE user_id=$1',
        [winnerId],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    // ── Nội tại ẩn: Tu La — mở khoá sau 30 PvP wins ─────────────────────
    const winnerNewWins = (winnerPlayer?.pvp_wins || 0) + 1;
    const unlockTuLa = winnerPlayer?.huyet_mach === 'tu_la' && !winnerPlayer.noi_tai_an_unlocked && winnerNewWins >= 30;
    const unlockHonDon = winnerPlayer?.huyet_mach === 'hon_don_the' && !winnerPlayer.noi_tai_an_unlocked && winnerNewWins >= 100;

    const client2 = await pool.connect();
    try {
      await client2.query('BEGIN');
      if (unlockTuLa || unlockHonDon) {
        await client2.query('UPDATE players SET noi_tai_an_unlocked=TRUE WHERE user_id=$1', [winnerId]);
      }
      await client2.query('COMMIT');
    } catch (e) {
      await client2.query('ROLLBACK').catch(() => {});
      log.error('Nội Tại Ẩn unlock failed:', e.message);
    } finally {
      client2.release();
    }

    if (unlockTuLa) {
      channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🔥 NỘI TẠI ẨN — THỨC TỈNH!')
            .setColor(0xFF4500)
            .setDescription(
              `<@${winnerId}>\n\n` +
              `*Trăm trận thư hùng, sát khí ngập trời — Tu La Huyết trong ngươi rốt cuộc đã thức tỉnh!*\n\n` +
              `${CE('hm_tu_la', '🔥')} **Tu La Huyết** · Nội Tại Ẩn Hiển Lộ:\n\n` +
              `> ⚔️ **Bạo Sát Chi Bản**\n` +
              `> *Thiên kiếp không khuất phục, Tu La bước từ máu lửa mà đến.*\n` +
              `> ✦ Bạo kích cộng thêm **+15%** vĩnh viễn!`
            )
            .setFooter({ text: 'Nội tại ẩn đã khai mở — thực lực thật sự của ngươi hiện ra!' })
        ],
      }).catch(() => {});
    }

    // ── Nội tại ẩn: Hỗn Độn Chi Thể — mở khoá sau 100 PvP wins ──────────
    if (unlockHonDon) {
      channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🌀 NỘI TẠI ẨN — KHAI THIÊN!')
            .setColor(0x6600CC)
            .setDescription(
              `<@${winnerId}>\n\n` +
              `*Trăm trận đẫm máu, hỗn độn khai thiên — bản nguyên hỗn mang trong ngươi rốt cuộc đã hiển lộ!*\n\n` +
              `${CE('hm_hon_don', '🌀')} **Hỗn Độn Chi Thể** · Nội Tại Ẩn Hiển Lộ:\n\n` +
              `> 🌌 **Hỗn Độn Khai Thiên**\n` +
              `> *Trước khi trời đất phân chia, chỉ có hỗn độn — ngươi là hiện thân của thủy tổ vạn vật.*\n` +
              `> ✦ ATK **+60%**, DEF **+50%**, EXP **+30%** · Miễn mọi khắc chế · Không thể bị crit · Bạo kích **+30%** · Hồi **15% HP**/lượt!`
            )
            .setFooter({ text: 'Nội tại ẩn đã khai mở — thực lực hỗn mang của ngươi hiện ra!' })
        ],
      }).catch(() => {});
    }

    const p1pct = Math.round((Math.max(0, session.p1_hp) / session.p1_hp_max) * 100);
    const p2pct = Math.round((Math.max(0, session.p2_hp) / session.p2_hp_max) * 100);

    const resultEmbed = new EmbedBuilder()
      .setTitle(`🏆 ${winnerName} ĐẮC THẮNG!`)
      .setColor(15844367)
      .setDescription(
        session.log.slice(-3).join('\n') +
        `\n\n${SEP2}\n\n` +
        `${hpHeart(Math.max(0, session.p1_hp), session.p1_hp_max)} **${session.p1_name}**: \`${hpBar(Math.max(0, session.p1_hp), session.p1_hp_max)}\` **${p1pct}%**\n` +
        `${hpHeart(Math.max(0, session.p2_hp), session.p2_hp_max)} **${session.p2_name}**: \`${hpBar(Math.max(0, session.p2_hp), session.p2_hp_max)}\` **${p2pct}%**\n\n` +
        `${SEP3}\n\n` +
        `${CE('tuatk', '⚔️')} **${winnerName}** khải hoàn, đoạt **${fmt(loot)} ${CE('tult', '💠')}** từ tay ${loserName}!\n` +
        (gotInjured ? `\n🩸 **${loserName}** chịu **Đạo Thương Cấp ${newDT}** — dùng \`-chua_thuong\` điều trị!\n` : '') +
        '\n*🩹 HP tồn lại được lưu — dưỡng thương trước khi xuất chiêu tiếp!*',
      )
      .setFooter({ text: `⏱️ CD: 30 phút · ${session.turn} lượt · ${session.p1_name} ✦ ${session.p2_name}` });

    let edited = false;
    if (session.combat_msg) {
      try {
        await session.combat_msg.edit({ embeds: [resultEmbed], components: [makePVPCombatRow(session.p1_id, true)] });
        edited = true;
      } catch (_) {}
    }
    if (!edited) await channel.send({ embeds: [resultEmbed] }).catch(() => {});

  } catch (err) {
    log.error('endCombat DB error:', err?.message || err, err?.stack || '');
    await channel.send({ content: `${CE('warn_icon','⚠️')} Đã xảy ra lỗi khi lưu kết quả trận đấu! Trận chiến bị hủy.` }).catch(() => {});
  } finally {
    markRecentlyEnded(session.p1_id, session.p2_id);
    COMBAT_SESSIONS.delete(session.p1_id);
    COMBAT_SESSIONS.delete(session.p2_id);
  }
}

// checkKhacChe imported from combat_engine above

// ── Apply combat stat modifiers to a new session ──────────────────────────
const PVP_CD_MIN = 15;

function applyCombatStats(session, p1data, p2data, channel) {
  session.p1_data = p1data;
  session.p2_data = p2data;
  if (channel) session.channel = channel;

  const cs1 = tinhCS(p1data);
  const cs2 = tinhCS(p2data);

  // Realm-tier gap penalty
  const tier1 = getDaiCanhGioiIndex(p1data.canh_gioi);
  const tier2 = getDaiCanhGioiIndex(p2data.canh_gioi);
  const tierGap = Math.abs(tier1 - tier2);
  let atk1 = cs1.atk, atk2 = cs2.atk;
  // REDESIGN: Tier gap penalty softened — 75%/30% (was 70%/20%) so fights aren't instant losses
  if (tierGap === 1) {
    tier1 < tier2 ? (atk1 = Math.floor(0.75 * atk1)) : (atk2 = Math.floor(0.75 * atk2));
  } else if (tierGap >= 2) {
    tier1 < tier2 ? (atk1 = Math.floor(0.30 * atk1)) : (atk2 = Math.floor(0.30 * atk2));
  }

  // Level gap reduction (≤40% cap)
  const levelPenalty = Math.min(0.40, 0.10 * Math.floor(Math.abs(p1data.canh_gioi - p2data.canh_gioi) / 3));
  if (p1data.canh_gioi > p2data.canh_gioi) atk2 = Math.floor(atk2 * (1 - levelPenalty));
  else if (p2data.canh_gioi > p1data.canh_gioi) atk1 = Math.floor(atk1 * (1 - levelPenalty));

  // Elemental counter
  const kc1 = checkKhacChe(p1data.linh_can, p2data.linh_can, p1data.huyet_mach, p2data.huyet_mach, p2data.noi_tai_an_unlocked);
  const kc2 = checkKhacChe(p2data.linh_can, p1data.linh_can, p2data.huyet_mach, p1data.huyet_mach, p1data.noi_tai_an_unlocked);
  // REDESIGN: Elemental counter 1.30x (was 1.20x) — nguyên tố khắc chế có ý nghĩa hơn
  if (kc1) atk1 = Math.floor(1.30 * atk1);
  if (kc2) atk2 = Math.floor(1.30 * atk2);

  // Vô Biên Kiền Khôn Nhẫn: +20% Công Lực trong chiến đấu
  const voBienP1 = (p1data.bao_boi || []).includes('vo_bien_nhan');
  const voBienP2 = (p2data.bao_boi || []).includes('vo_bien_nhan');
  if (voBienP1) atk1 = Math.floor(1.20 * atk1);
  if (voBienP2) atk2 = Math.floor(1.20 * atk2);

  // Buff: Sắc Bén
  const b1 = typeof p1data.buff_active === 'object' && p1data.buff_active ? p1data.buff_active : {};
  const b2 = typeof p2data.buff_active === 'object' && p2data.buff_active ? p2data.buff_active : {};

  let sacBen1 = false, sacBen2 = false;
  if ((b1.sac_ben_charges || 0) > 0) {
    atk1 = Math.floor(1.20 * atk1); sacBen1 = true;
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b1, sac_ben_charges: (b1.sac_ben_charges || 1) - 1 }), p1data.user_id]).catch(() => {});
  }
  if ((b2.sac_ben_charges || 0) > 0) {
    atk2 = Math.floor(1.20 * atk2); sacBen2 = true;
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b2, sac_ben_charges: (b2.sac_ben_charges || 1) - 1 }), p2data.user_id]).catch(() => {});
  }

  // Buff: Vô Trang (disarm)
  let voTrang1 = false, voTrang2 = false;
  if ((b1.vo_trang || 0) > 0) {
    atk1 = Math.floor(0.70 * atk1); voTrang1 = true;
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b1, vo_trang: 0 }), p1data.user_id]).catch(() => {});
  }
  if ((b2.vo_trang || 0) > 0) {
    atk2 = Math.floor(0.70 * atk2); voTrang2 = true;
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b2, vo_trang: 0 }), p2data.user_id]).catch(() => {});
  }

  // Buff: Phù Bảo Hộ (shield)
  let phuBaoHo1 = false, phuBaoHo2 = false;
  if ((b1.phu_bao_ho || 0) > 0) {
    session.p1_shield = 0.30; phuBaoHo1 = true;
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b1, phu_bao_ho: 0 }), p1data.user_id]).catch(() => {});
  }
  if ((b2.phu_bao_ho || 0) > 0) {
    session.p2_shield = 0.30; phuBaoHo2 = true;
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b2, phu_bao_ho: 0 }), p2data.user_id]).catch(() => {});
  }

  // Buff: Hộ Thân Phù
  if ((b1.ho_than_phu || 0) > 0) {
    session.p1_shield = Math.max(session.p1_shield || 0, 0.25);
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b1, ho_than_phu: 0 }), p1data.user_id]).catch(() => {});
    session.log.push(`🛡️ **${session.p1_name}** kích hoạt **Hộ Thân Phù** — Giảm 25% sát thương nhận trận này!`);
  }
  if ((b2.ho_than_phu || 0) > 0) {
    session.p2_shield = Math.max(session.p2_shield || 0, 0.25);
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b2, ho_than_phu: 0 }), p2data.user_id]).catch(() => {});
    session.log.push(`🛡️ **${session.p2_name}** kích hoạt **Hộ Thân Phù** — Giảm 25% sát thương nhận trận này!`);
  }

  // Buff: Sát Phong Phù
  if ((b1.sat_phong_phu || 0) > 0) {
    atk1 = Math.floor(1.30 * atk1);
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b1, sat_phong_phu: 0 }), p1data.user_id]).catch(() => {});
    session.log.push(`⚔️ **${session.p1_name}** kích hoạt **Sát Phong Phù** — Công Lực +30% trận này!`);
  }
  if ((b2.sat_phong_phu || 0) > 0) {
    atk2 = Math.floor(1.30 * atk2);
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b2, sat_phong_phu: 0 }), p2data.user_id]).catch(() => {});
    session.log.push(`⚔️ **${session.p2_name}** kích hoạt **Sát Phong Phù** — Công Lực +30% trận này!`);
  }

  // Buff MỚI: Bổ Khí (Phi Khí Sư) — +15% ATK
  if ((b1.bo_khi_charges || 0) > 0) {
    atk1 = Math.floor(1.15 * atk1);
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b1, bo_khi_charges: 0 }), p1data.user_id]).catch(() => {});
    session.log.push(`🔱 **${session.p1_name}** được **Bổ Khí** từ Phi Khí Sư — Công Lực +15% trận này!`);
  }
  if ((b2.bo_khi_charges || 0) > 0) {
    atk2 = Math.floor(1.15 * atk2);
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b2, bo_khi_charges: 0 }), p2data.user_id]).catch(() => {});
    session.log.push(`🔱 **${session.p2_name}** được **Bổ Khí** từ Phi Khí Sư — Công Lực +15% trận này!`);
  }

  // Buff MỚI: Sát Ý (Ám Vệ) — +12% Crit (đã active theo thời gian)
  let satY1 = false, satY2 = false;
  if (Number(b1.sat_y_until || 0) > Date.now()) {
    session.p1_crit_bonus = (session.p1_crit_bonus || 0) + 0.12;
    satY1 = true;
  }
  if (Number(b2.sat_y_until || 0) > Date.now()) {
    session.p2_crit_bonus = (session.p2_crit_bonus || 0) + 0.12;
    satY2 = true;
  }

  // Buff MỚI: Phong An Phù (Phù Lục Sư) — giảm sát thương nhận vào
  let phongAn1 = false, phongAn2 = false;
  if (Number(b1.phong_an_until || 0) > Date.now()) {
    const defPct = Number(b1.phong_an_def || 0.20);
    session.p1_shield = Math.max(session.p1_shield || 0, defPct);
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b1, phong_an_until: 0, phong_an_def: 0 }), p1data.user_id]).catch(() => {});
    phongAn1 = true;
  }
  if (Number(b2.phong_an_until || 0) > Date.now()) {
    const defPct = Number(b2.phong_an_def || 0.20);
    session.p2_shield = Math.max(session.p2_shield || 0, defPct);
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b2, phong_an_until: 0, phong_an_def: 0 }), p2data.user_id]).catch(() => {});
    phongAn2 = true;
  }

  // Debuff MỚI: Chế Độc (Dược Sư) — ATK và DEF debuff
  let docDeb1 = false, docDeb2 = false;
  if ((b1.doc_charges || 0) > 0) {
    const atkDeb = Number(b1.doc_atk_deb || 0.20);
    const defDeb = Number(b1.doc_def_deb || 0.15);
    atk1 = Math.floor(atk1 * (1 - atkDeb));
    session.p1_def_mod_extra = -(defDeb);
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b1, doc_charges: 0, doc_atk_deb: 0, doc_def_deb: 0 }), p1data.user_id]).catch(() => {});
    docDeb1 = true;
  }
  if ((b2.doc_charges || 0) > 0) {
    const atkDeb = Number(b2.doc_atk_deb || 0.20);
    const defDeb = Number(b2.doc_def_deb || 0.15);
    atk2 = Math.floor(atk2 * (1 - atkDeb));
    session.p2_def_mod_extra = -(defDeb);
    db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify({ ...b2, doc_charges: 0, doc_atk_deb: 0, doc_def_deb: 0 }), p2data.user_id]).catch(() => {});
    docDeb2 = true;
  }

  Object.assign(session, {
    p1_atk_mod:   atk1,
    p2_atk_mod:   atk2,
    p1_def_mod:   cs1.def,
    p2_def_mod:   cs2.def,
    p1_hp:        cs1.hp_max,
    p2_hp:        cs2.hp_max,
    p1_hp_max:    cs1.hp_max,
    p2_hp_max:    cs2.hp_max,
    kc1,
    kc2,
    channel,
  });

  if (levelPenalty > 0) session.log.push(`👁️ **Uy Áp** — kẻ yếu bị giảm **${Math.round(100 * levelPenalty)}%** Công Lực`);
  if (kc1)       session.log.push(`🔥 **${session.p1_name}** khắc chế ngũ hành của **${session.p2_name}**! +20% Công Lực`);
  if (kc2)       session.log.push(`🔥 **${session.p2_name}** khắc chế ngũ hành của **${session.p1_name}**! +20% Công Lực`);
  if (voBienP1)  session.log.push(`💍 **${session.p1_name}** [Vô Biên Kiền Khôn Nhẫn] Công Lực +20% & Thủ Lực +20%!`);
  if (voBienP2)  session.log.push(`💍 **${session.p2_name}** [Vô Biên Kiền Khôn Nhẫn] Công Lực +20% & Thủ Lực +20%!`);
  if (sacBen1)   session.log.push(`🔱 **${session.p1_name}** kích hoạt **Sắc Bén** — Công Lực +20% trận này!`);
  if (sacBen2)   session.log.push(`🔱 **${session.p2_name}** kích hoạt **Sắc Bén** — Công Lực +20% trận này!`);
  if (voTrang1)  session.log.push(`🔱 **${session.p1_name}** bị **Phong Tỏa Phi Khí** — Công Lực -30% trận này! *(Phi Khí Sư trù dập)*`);
  if (voTrang2)  session.log.push(`🔱 **${session.p2_name}** bị **Phong Tỏa Phi Khí** — Công Lực -30% trận này! *(Phi Khí Sư trù dập)*`);
  if (phuBaoHo1) session.log.push(`📜 **${session.p1_name}** được **Phù Bảo Hộ** — Giảm 30% sát thương nhận vào trận này!`);
  if (phuBaoHo2) session.log.push(`📜 **${session.p2_name}** được **Phù Bảo Hộ** — Giảm 30% sát thương nhận vào trận này!`);
  if (satY1)    session.log.push(`🌑 **${session.p1_name}** đang **Sát Ý** — +12% Bạo Kích trận này!`);
  if (satY2)    session.log.push(`🌑 **${session.p2_name}** đang **Sát Ý** — +12% Bạo Kích trận này!`);
  if (phongAn1) session.log.push(`📜 **${session.p1_name}** được **Phong An Phù** — Giảm ${Math.round((Number(b1.phong_an_def||0.20))*100)}% sát thương nhận vào!`);
  if (phongAn2) session.log.push(`📜 **${session.p2_name}** được **Phong An Phù** — Giảm ${Math.round((Number(b2.phong_an_def||0.20))*100)}% sát thương nhận vào!`);
  if (docDeb1)  session.log.push(`☠️ **${session.p1_name}** trúng **Độc Dược** — ATK -${Math.round((Number(b1.doc_atk_deb||0.20))*100)}%, DEF -${Math.round((Number(b1.doc_def_deb||0.15))*100)}% trận này!`);
  if (docDeb2)  session.log.push(`☠️ **${session.p2_name}** trúng **Độc Dược** — ATK -${Math.round((Number(b2.doc_atk_deb||0.20))*100)}%, DEF -${Math.round((Number(b2.doc_def_deb||0.15))*100)}% trận này!`);

}

module.exports = {
  COMBAT_SESSIONS,
  RECENTLY_ENDED,
  markRecentlyEnded,
  wasRecentlyEnded,
  BP_COMBAT,
  hpBar,
  hpHeart,
  makeCombatEmbed,
  makePVPInviteRow,
  makePVPInviteRowDisabled,
  makePVPCombatRow,
  resolveCombatTurn,
  endCombat,
  scheduleTurnTimeout,
  applyCombatStats,
};
