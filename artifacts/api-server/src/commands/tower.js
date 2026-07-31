'use strict';
/**
 * commands/tower.js
 * Discord command handler for Tháp Thí Luyện (Tower of Trials).
 *
 * Data  → data/tower_data.js   (challenges, enemy pools, enemy skills)
 * Logic → game/tower_engine.js (enemy gen, turn resolution, reward helpers)
 * This file owns: session Map, Discord UI builders, DB writes, button routing.
 */
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer } = require('../db/players');
const { CE, CEu } = require("../systems/emoji");
const {
  fmt, getCG, fTime, cdRemMin, cdTsMin, errE, warnE, okE, SEP, SEP2, SEP3,
  COMMANDS, reg, tinhCS, calcMaxLinhThach,
} = require('../utils');
const { BP_COMBAT, hpBar, hpHeart } = require('../game/combat');
const { BI_PHAP, getTT }            = require('../data');

// ── Engine imports ────────────────────────────────────────────────────────────
const {
  TOWER_CHALLENGES,
} = require('../data/tower_data');
const {
  getFloorReward,
  getWrongAnswerPenalty,
  getBetweenFloorRecovery,
  getTowerEnemy,
  resolveTowerTurn,
} = require('../game/tower_engine');

// ── Constants ─────────────────────────────────────────────────────────────────
const ADMIN_ID         = process.env.ADMIN_ID || '';
const TOWER_CD_MIN     = 45;
const TOWER_MAX_FLOOR  = 30;
const TOWER_SESSIONS   = new Map();
const TOWER_TIMEOUT_MS = 5 * 60 * 1000;
const TOWER_TT_ID      = 'tu_luyen_chi_thuat';

function hasTowerTT(player) {
  return (Array.isArray(player.than_thong) ? player.than_thong : []).includes(TOWER_TT_ID);
}

// ── HP display helpers ────────────────────────────────────────────────────────
function towerHpBar(cur, max) {
  const filled = Math.round(Math.max(0, Math.min(10, (cur / max) * 10)));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
function towerHpHeart(cur, max) {
  const pct = cur / max;
  return pct > 0.6 ? '❤️' : pct > 0.3 ? '🧡' : '💔';
}

// ── Floor label helper ────────────────────────────────────────────────────────
function floorLabel(floor) {
  if (floor === 10) return '⭐ Tầng 10';
  if (floor === 15) return '💫 Tầng 15';
  if (floor === 20) return '🌟 Tầng 20';
  if (floor === 25) return '💎 Tầng 25';
  if (floor === 30) return '👑 Tầng 30 — CUỐI CÙNG';
  if (floor > 25)   return `🔱 Tầng ${floor}`;
  if (floor > 20)   return `💀 Tầng ${floor}`;
  if (floor > 15)   return `🌟 Tầng ${floor}`;
  return `Tầng ${floor}`;
}

// ── Session timeout helpers ───────────────────────────────────────────────────
function clearSessionTimeout(session) {
  if (session._timeout) { clearTimeout(session._timeout); session._timeout = null; }
}
function resetSessionTimeout(session) {
  clearSessionTimeout(session);
  session._timeout = setTimeout(async () => {
    if (!TOWER_SESSIONS.has(session.userId)) return;
    TOWER_SESSIONS.delete(session.userId);
    try {
      const embed = new EmbedBuilder()
        .setColor(0x888888)
        .setTitle('⏰ Tháp Thí Luyện — Hết Thời Gian')
        .setDescription(
          `*Ngươi đứng quá lâu trong tháp, linh lực dần tiêu tán...*\n\n` +
          `Đã thoát khỏi tháp sau tầng **${session.floor - 1}**.\n${CE('tult','💠')} Linh thạch tích lũy: **${fmt(session.rewards)}**`,
        );
      if (session.msg) await session.msg.edit({ embeds: [embed], components: [] }).catch(() => {});
    } catch (_) {}
  }, TOWER_TIMEOUT_MS);
}

// ── Embed builders ────────────────────────────────────────────────────────────
function makeChallengeEmbed(session) {
  const ch        = session.challenge;
  const label     = floorLabel(session.floor);
  const penalty   = Math.round(getWrongAnswerPenalty(session.floor) * 100);
  const tierColor = session.floor > 25 ? 0xFF0000
    : session.floor > 20 ? 0xAA00AA
    : session.floor > 15 ? 0xFF6600
    : 0x6A0DAD;
  return new EmbedBuilder()
    .setColor(tierColor)
    .setTitle(`🏯 Tháp Thí Luyện — ${label}`)
    .setDescription(
      `*Cánh cửa tầng ${session.floor} mở ra, ánh linh quang lóe sáng...*\n\n` +
      `**${CE('warn_icon','⚠️')} Thử Thách Trước Khi Chiến Đấu**\n\n` +
      `${ch.question}\n\n` +
      ch.options.map(o => `> ${o}`).join('\n') + '\n\n' +
      `✅ Trả lời đúng → vào chiến đấu với HP đầy đủ\n` +
      `❌ Trả lời sai → mất **${penalty}% HP** trước khi chiến đấu`,
    )
    .setFooter({ text: `⏱️ Timeout 5 phút · ${label} / ${TOWER_MAX_FLOOR} · Tích lũy: ${fmt(session.rewards)} ${CEu("tult","💠")}` });
}

function makeChallengeRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tower_ans_${userId}_a`).setLabel('A').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`tower_ans_${userId}_b`).setLabel('B').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`tower_ans_${userId}_c`).setLabel('C').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`tower_ans_${userId}_d`).setLabel('D').setStyle(ButtonStyle.Primary),
  );
}

function makeCombatEmbed(session) {
  const e          = session.enemy;
  const pHp        = Math.max(0, session.playerHp);
  const eHp        = Math.max(0, e.hp);
  const pPct       = Math.round((pHp / session.playerHpMax) * 100);
  const ePct       = Math.round((eHp / e.hp_max) * 100);
  const log        = session.combatLog.slice(-4).join('\n') || '*⚔️ Trận chiến bắt đầu!*';
  const label      = floorLabel(session.floor);
  const tierColor  = session.floor > 25 ? 0xCC0000
    : session.floor > 20 ? 0x880088
    : session.floor > 15 ? 0xCC4400
    : 0xA0001A;
  const debuffNote = session.playerDebuffTurns > 0 ? ` · ${CE('warn_icon','⚠️')} ATK -30% (${session.playerDebuffTurns}L)` : '';
  const eSkillNote = session.floor >= 7
    ? ` · Thủ Vệ Bí Kỹ CD: ${(session.enemySkillCd || 0) > 0 ? session.enemySkillCd + 'L' : '✓'}`
    : '';
  return new EmbedBuilder()
    .setColor(tierColor)
    .setTitle(`🏯 Tháp Thí Luyện — ${label} · Chiến Đấu · Lượt ${session.turn}`)
    .setDescription(
      `${towerHpHeart(pHp, session.playerHpMax)} **Ngươi**\n` +
      `\`${towerHpBar(pHp, session.playerHpMax)}\` **${pPct}%** — ${fmt(pHp)}/${fmt(session.playerHpMax)} HP\n\n` +
      `${towerHpHeart(eHp, e.hp_max)} **${e.name}**\n` +
      `\`${towerHpBar(eHp, e.hp_max)}\` **${ePct}%** — ${fmt(eHp)}/${fmt(e.hp_max)} HP\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n${log}`,
    )
    .setFooter({
      text: `Tích lũy: ${fmt(session.rewards)} ${CEu("tult","💠")} · BP CD: ${session.bpCd > 0 ? session.bpCd + 'L' : '✓'} · Hộ CD: ${session.defCd > 0 ? session.defCd + 'L' : '✓'} · Hồi CD: ${session.healCd > 0 ? session.healCd + 'L' : '✓'}${debuffNote}${eSkillNote}`,
    });
}

function makeCombatRow(userId, session) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tower_atk_${userId}`).setLabel('⚔️ Tấn Công').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`tower_bp_${userId}`).setLabel('📜 Bí Pháp').setStyle(ButtonStyle.Danger).setDisabled(session.bpCd > 0 || !session.hasBp),
    new ButtonBuilder().setCustomId(`tower_def_${userId}`).setLabel('🔰 Hộ Thể').setStyle(ButtonStyle.Secondary).setDisabled(session.defCd > 0),
    new ButtonBuilder().setCustomId(`tower_heal_${userId}`).setLabel('💫 Hồi Linh Khí').setStyle(ButtonStyle.Success).setDisabled(session.healCd > 0),
    new ButtonBuilder().setCustomId(`tower_retreat_${userId}`).setLabel('🏳️ Rút Lui').setStyle(ButtonStyle.Secondary),
  );
}

function makeDisabledCombatRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tower_atk_${userId}`).setLabel('⚔️ Tấn Công').setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId(`tower_bp_${userId}`).setLabel('📜 Bí Pháp').setStyle(ButtonStyle.Danger).setDisabled(true),
    new ButtonBuilder().setCustomId(`tower_def_${userId}`).setLabel('🔰 Hộ Thể').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`tower_heal_${userId}`).setLabel('💫 Hồi Linh Khí').setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId(`tower_retreat_${userId}`).setLabel('🏳️ Rút Lui').setStyle(ButtonStyle.Secondary).setDisabled(true),
  );
}

function makeBpSelectRow(userId, session) {
  const availBps = (session.playerBps || []).filter(id => BP_COMBAT[id]);
  const options  = availBps.map(id => {
    const bpData = BP_COMBAT[id];
    const bpInfo = BI_PHAP.find(b => b.id === id);
    const typeLabel = bpData.type === 'atk'
      ? `⚔️ Tấn Công ×${bpData.mult}${bpData.cost_hp > 0 ? ` (HP -${Math.round(bpData.cost_hp * 100)}%)` : ''}`
      : bpData.type === 'shield'
        ? `🛡️ Phòng Thủ — nhận ${Math.round(bpData.mult * 100)}% sát thương`
        : `💚 Hồi Phục +${Math.round(bpData.mult * 100)}% HP`;
    return new StringSelectMenuOptionBuilder()
      .setLabel(bpInfo?.ten || id)
      .setDescription(`${typeLabel} · CD: ${bpData.cd} lượt`)
      .setValue(id);
  });
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`tower_bpsel_${userId}`)
    .setPlaceholder('📜 Chọn Bí Pháp muốn thi triển...')
    .addOptions(options);
  return new ActionRowBuilder().addComponents(menu);
}

function makeBpCancelRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tower_bpcancel_${userId}`)
      .setLabel('↩️ Huỷ — Tấn Công Thường')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ── Floor lifecycle ───────────────────────────────────────────────────────────
function startFloor(session) {
  if (!session.usedQuestions) session.usedQuestions = new Set();
  let available = TOWER_CHALLENGES.filter((_, i) => !session.usedQuestions.has(i));
  if (available.length === 0) {
    session.usedQuestions.clear();
    available = [...TOWER_CHALLENGES];
  }
  const pickIdx = Math.floor(Math.random() * available.length);
  const picked  = available[pickIdx];
  const origIdx = TOWER_CHALLENGES.indexOf(picked);
  session.usedQuestions.add(origIdx);
  session.challenge = picked;

  session.phase             = 'waiting';
  session.combatLog         = [];
  session.turn              = 1;
  session.bpCd              = 0;
  session.defCd             = 0;
  session.healCd            = 0;
  session.enemySkillCd      = 0;
  session.playerDebuffTurns = 0;
  session._enemyIgnoreDef   = 0;
}

// ── DB write: save results and give rewards ───────────────────────────────────
async function endSession(session, success) {
  clearSessionTimeout(session);
  TOWER_SESSIONS.delete(session.userId);

  const userId   = session.userId;
  const rewards  = session.rewards;
  const topFloor = session.floor - 1;
  const now      = Date.now();

  const player = await getPlayer(userId).catch(() => null);
  if (!player) return;

  const currentTop = Number(player.thap_tang || 0);
  const newTop     = Math.max(currentTop, topFloor);
  const extras     = [];

  // One-time milestone rewards
  const already10 = currentTop >= 10;
  let grantTT = false;
  if (topFloor >= 10 && !already10 && !hasTowerTT(player)) {
    grantTT = true;
    extras.push('✨ **Thần Thông mới:** *Tu Luyện Chi Thuật* — giảm 10% CD tu luyện, +10% Tu Vi!');
  }

  const already15 = currentTop >= 15;
  let grantBag = false;
  if (topFloor >= 15 && !already15) {
    grantBag = true;
    extras.push('🎒 **Túi Trữ Vật** nâng cấp **+15 kg** vĩnh viễn!');
  }

  const already20 = currentTop >= 20;
  let bonus20 = 0;
  if (topFloor >= 20 && !already20) {
    bonus20 = 22782; // 33750 * 0.675 = -25% -10%
    extras.push(`💰 **Thưởng Tầng 20:** +${fmt(bonus20)} Linh Thạch đặc biệt!`);
  }

  const already25 = currentTop >= 25;
  let grantBag25 = false;
  if (topFloor >= 25 && !already25) {
    grantBag25 = true;
    extras.push('🎒 **Túi Trữ Vật** nâng cấp thêm **+15 kg** vĩnh viễn!');
  }

  const already30 = currentTop >= 30;
  let bonus30 = 0;
  let grantThienLongNTA = false;
  if (topFloor >= 30 && !already30) {
    bonus30 = 68344; // 101250 * 0.675 = -25% -10%
    extras.push(`👑 **THƯỞNG CHINH PHỤC THÁP:** +${fmt(bonus30)} Linh Thạch!`);
    // Nội tại ẩn: Thiên Long Chí Tôn — mở khoá khi chinh phục tầng 30
    if (player.huyet_mach === 'thien_long' && !player.noi_tai_an_unlocked) {
      grantThienLongNTA = true;
      extras.push(`🐲 **NỘI TẠI ẨN THỨC TỈNH:** *Thiên Long Uy Linh* hiển lộ — ATK +45%, DEF +40%, EXP +25% · Miễn khắc chế · Bạo kích +20% · Hồi 10% HP/lượt!`);
    }
  }

  const totalRewards = rewards + bonus20 + bonus30;
  const ltAward      = calcMaxLinhThach(player, totalRewards);
  const totalBag     = (grantBag ? 15 : 0) + (grantBag25 ? 15 : 0);

  // Cảm Ngộ gain: 1 điểm/tầng vượt qua, tối đa 25 — liên kết Tháp → Đột Phá
  const camNgoGain = topFloor > 0 ? Math.min(25, topFloor) : 0;

  try {
    let setClause = `linh_thach = linh_thach + $1, thap_thi_cd = $2, thap_tang = $3`;
    const params  = [ltAward, now, newTop];
    let pidx      = 4;
    if (grantTT)           { setClause += `, than_thong = array_append(COALESCE(than_thong, '{}'), $${pidx})`; params.push(TOWER_TT_ID); pidx++; }
    if (totalBag > 0)      { setClause += `, bag_bonus_kg = bag_bonus_kg + $${pidx}`; params.push(totalBag); pidx++; }
    if (camNgoGain > 0)    { setClause += `, cam_ngo = LEAST(100, COALESCE(cam_ngo,0) + $${pidx})`; params.push(camNgoGain); pidx++; }
    if (grantThienLongNTA) { setClause += `, noi_tai_an_unlocked = TRUE`; }
    params.push(userId);
    await db(`UPDATE players SET ${setClause} WHERE user_id = $${pidx}`, params);
  } catch (err) {
    console.error('❌ Tower DB error:', err?.message || err);
  }

  const color = success ? 0xFFD700 : 0x8B0000;
  const title = success
    ? (topFloor >= 30 ? '👑 CHINH PHỤC HOÀN TOÀN THÁP THÍ LUYỆN!'
      : topFloor >= 20 ? `🌟 Thoát Tháp — Đã Vượt ${topFloor} Tầng!`
      : `🏆 Thoát Tháp — Đã Vượt ${topFloor} Tầng!`)
    : `💀 Thất Bại Tháp Thí Luyện — Tầng ${topFloor > 0 ? topFloor : 0}`;

  const desc = [
    success
      ? `*Linh lực bùng phát, đột phá từng tầng thử thách — thực lực được kiểm chứng!*`
      : `*Sức đã cạn kiệt, ý chí lung lay — lui về dưỡng thương rồi tái chiến!*`,
    '',
    `🏯 **Tầng cao nhất đạt được:** ${topFloor}/${TOWER_MAX_FLOOR}`,
    ltAward < totalRewards
      ? `${CE('tult','💠')} **Linh thạch nhận được:** ${fmt(ltAward)} Linh Thạch *(túi quá nặng — bỏ lỡ ${fmt(totalRewards - ltAward)})*`
      : `${CE('tult','💠')} **Linh thạch nhận được:** ${fmt(ltAward)} Linh Thạch`,
    ...(extras.length ? ['', '🌟 **Phần Thưởng Đặc Biệt:**', ...extras.map(e => `  • ${e}`)] : []),
    '',
    `⏰ CD: **${TOWER_CD_MIN} phút** · Kỷ lục: **Tầng ${newTop}**`,
  ].join('\n');

  const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc);
  try {
    if (session.msg) await session.msg.edit({ embeds: [embed], components: [] }).catch(() => {});
  } catch (_) {}
}

// ── Shared combat result handler ──────────────────────────────────────────────
async function _editMsg(interaction, session, payload) {
  try {
    await interaction.editReply(payload);
  } catch (_) {
    try { await session.msg.edit(payload); } catch (__) {
      console.error('[tower] msg edit failed:', __.message);
    }
  }
}

async function _handleCombatResult(interaction, session, userId, result) {
  if (result.win || result.lose || result.draw) {
    if (result.win) {
      const floorReward = getFloorReward(session.floor);
      session.rewards  += floorReward;

      const winLog = [
        ...session.combatLog.slice(-3),
        ``,
        `🏆 **${floorLabel(session.floor)} chinh phục!** +${fmt(floorReward)} ${CE('tult','💠')}`,
      ].join('\n');

      if (session.floor >= TOWER_MAX_FLOOR) {
        session.floor++;
        const embed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle(`👑 TẦNG ${session.floor - 1} — CHINH PHỤC HOÀN TOÀN!`)
          .setDescription(winLog);
        await _editMsg(interaction, session, { embeds: [embed], components: [] });
        await endSession(session, true);
      } else {
        session.floor++;
        const recovRate  = getBetweenFloorRecovery(session.floor);
        const recovery   = Math.floor(session.playerHpMax * recovRate);
        session.playerHp = Math.min(session.playerHpMax, session.playerHp + recovery);
        startFloor(session);

        const winEmbed = new EmbedBuilder()
          .setColor(0x00C851)
          .setTitle(`✅ Tầng ${session.floor - 1} Thắng Lợi!`)
          .setDescription(
            winLog + `\n\n💚 Hồi phục **${fmt(recovery)}** HP (${Math.round(recovRate * 100)}%)\n\n*Chuẩn bị bước vào ${floorLabel(session.floor)}...*`,
          );
        const nextRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`tower_next_${userId}`)
            .setLabel(`➡️ Vào ${floorLabel(session.floor)}`)
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`tower_retreat_${userId}`)
            .setLabel('🏳️ Rút Lui (giữ phần thưởng)')
            .setStyle(ButtonStyle.Secondary),
        );
        await _editMsg(interaction, session, { embeds: [winEmbed], components: [nextRow] });
      }
    } else {
      const loseLog = [
        ...session.combatLog.slice(-3),
        '',
        `💀 **Ngươi thất bại tại ${floorLabel(session.floor)}!**`,
      ].join('\n');
      const loseEmbed = new EmbedBuilder()
        .setColor(0x8B0000)
        .setTitle(`💀 ${floorLabel(session.floor)} — Thất Bại`)
        .setDescription(loseLog);
      await _editMsg(interaction, session, { embeds: [loseEmbed], components: [makeDisabledCombatRow(userId)] });
      await endSession(session, false);
    }
  } else {
    const embed = makeCombatEmbed(session);
    const row   = makeCombatRow(userId, session);
    await _editMsg(interaction, session, { embeds: [embed], components: [row] });
  }
}

// ── Button interaction router ─────────────────────────────────────────────────
async function handleTowerButton(interaction) {
  const customId = interaction.customId;
  const userId   = interaction.user.id;

  // Challenge answer
  if (customId.startsWith('tower_ans_')) {
    const parts   = customId.split('_');
    const ownerId = parts[2];
    const opt     = parts[3];
    if (ownerId !== userId) {
      return interaction.reply({ content: '❌ Đây không phải thử thách của ngươi!', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    const session = TOWER_SESSIONS.get(userId);
    if (!session) {
      interaction.message?.edit({ components: [] }).catch(() => {});
      return interaction.reply({ content: '⏱️ Phiên Tháp đã kết thúc (bot khởi động lại). Dùng `-ttl` để vào Tháp lại!', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    if (session.phase === 'waiting') {
      return interaction.reply({ content: '❌ Hãy bấm nút **Vào Tầng** trước khi trả lời!', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    if (session.phase !== 'challenge') {
      return interaction.reply({ content: '❌ Không có thử thách đang chờ!', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    resetSessionTimeout(session);
    await interaction.deferUpdate().catch(() => {});

    const correct = opt === session.challenge.correct;
    if (!correct) {
      const penaltyRate = getWrongAnswerPenalty(session.floor);
      const penalty     = Math.floor(session.playerHpMax * penaltyRate);
      session.playerHp  = Math.max(1, session.playerHp - penalty);
      session.combatLog = [`❌ Trả lời sai! Mất **${fmt(penalty)}** HP (${Math.round(penaltyRate * 100)}%) trước khi chiến đấu!`];
    } else {
      session.combatLog = [`✅ Trả lời đúng! Vào chiến đấu với HP đầy đủ!`];
    }

    const freshPlayer  = await getPlayer(userId).catch(() => null) || session.playerData;
    session.playerData = freshPlayer;
    session.enemy      = getTowerEnemy(session.floor, freshPlayer);
    session.phase      = 'combat';

    const playerBps   = (freshPlayer.bi_phap || []).filter(id => BP_COMBAT[id]);
    session.hasBp     = playerBps.length > 0;
    session.playerBps = playerBps;

    const embed = makeCombatEmbed(session);
    const row   = makeCombatRow(userId, session);
    await _editMsg(interaction, session, { embeds: [embed], components: [row] });
    return;
  }

  // Bí Pháp select menu
  if (interaction.isStringSelectMenu() && customId.startsWith('tower_bpsel_')) {
    const ownerId = customId.replace('tower_bpsel_', '');
    if (ownerId !== userId) {
      return interaction.reply({ content: '❌ Đây không phải trận chiến của ngươi!', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    const session = TOWER_SESSIONS.get(userId);
    if (!session) {
      interaction.message?.edit({ components: [] }).catch(() => {});
      return interaction.reply({ content: '⏱️ Phiên Tháp đã kết thúc (bot khởi động lại). Dùng `-ttl` để vào Tháp lại!', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    if (session.phase !== 'combat') {
      return interaction.deferUpdate().catch(() => {});
    }
    resetSessionTimeout(session);
    await interaction.deferUpdate().catch(() => {});
    if (session.resolving) return;
    session.resolving = true;
    try {
      const selectedBpId = interaction.values[0];
      const result = resolveTowerTurn(session, 'bp', selectedBpId, BP_COMBAT, BI_PHAP);
      await _handleCombatResult(interaction, session, userId, result);
    } catch (e) {
      console.error('[tower] bpsel turn error:', e.message);
      try { await _editMsg(interaction, session, { embeds: [makeCombatEmbed(session)], components: [makeCombatRow(userId, session)] }); } catch (_) {}
    } finally {
      session.resolving = false;
    }
    return;
  }

  // Bí Pháp cancel (fallback to normal attack)
  if (customId.startsWith('tower_bpcancel_')) {
    const ownerId = customId.replace('tower_bpcancel_', '');
    if (ownerId !== userId) {
      return interaction.reply({ content: '❌ Đây không phải trận chiến của ngươi!', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    const session = TOWER_SESSIONS.get(userId);
    if (!session) {
      interaction.message?.edit({ components: [] }).catch(() => {});
      return interaction.reply({ content: '⏱️ Phiên Tháp đã kết thúc (bot khởi động lại). Dùng `-ttl` để vào Tháp lại!', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    if (session.phase !== 'combat') {
      return interaction.deferUpdate().catch(() => {});
    }
    resetSessionTimeout(session);
    await interaction.deferUpdate().catch(() => {});
    if (session.resolving) return;
    session.resolving = true;
    try {
      const result = resolveTowerTurn(session, 'atk', null, BP_COMBAT, BI_PHAP);
      await _handleCombatResult(interaction, session, userId, result);
    } catch (e) {
      console.error('[tower] bpcancel turn error:', e.message);
      try { await _editMsg(interaction, session, { embeds: [makeCombatEmbed(session)], components: [makeCombatRow(userId, session)] }); } catch (_) {}
    } finally {
      session.resolving = false;
    }
    return;
  }

  // Combat action buttons
  if (
    customId.startsWith('tower_atk_')  || customId.startsWith('tower_bp_') ||
    customId.startsWith('tower_def_')  || customId.startsWith('tower_heal_') ||
    customId.startsWith('tower_retreat_')
  ) {
    const actionParts = customId.split('_');
    const ownerId     = actionParts[2];
    if (ownerId !== userId) {
      return interaction.reply({ content: '❌ Đây không phải trận chiến của ngươi!', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    const session = TOWER_SESSIONS.get(userId);
    if (!session) {
      interaction.message?.edit({ components: [] }).catch(() => {});
      return interaction.reply({ content: '⏱️ Phiên Tháp đã kết thúc (bot khởi động lại). Dùng `-ttl` để vào Tháp lại!', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    resetSessionTimeout(session);
    await interaction.deferUpdate().catch(() => {});

    let action = 'atk';
    if (customId.startsWith('tower_bp_'))      action = 'bp_menu';
    else if (customId.startsWith('tower_def_')) action = 'def';
    else if (customId.startsWith('tower_heal_')) action = 'heal';
    else if (customId.startsWith('tower_retreat_')) action = 'retreat';

    if (action === 'retreat') {
      await endSession(session, true);
      return;
    }
    if (session.phase !== 'combat') return;

    if (action === 'bp_menu') {
      const availBps = (session.playerBps || []).filter(id => BP_COMBAT[id]);
      if (availBps.length === 0) {
        return interaction.reply({ content: '❌ Ngươi chưa có Bí Pháp chiến đấu nào! Học thêm qua `-bp`.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      const bpRow    = makeBpSelectRow(userId, session);
      const cancelRow= makeBpCancelRow(userId);
      const embed    = makeCombatEmbed(session);
      embed.setFooter({ text: '📜 Chọn Bí Pháp muốn thi triển — hoặc huỷ để tấn công thường' });
      await _editMsg(interaction, session, { embeds: [embed], components: [bpRow, cancelRow] });
      return;
    }

    if (session.resolving) return;
    session.resolving = true;
    try {
      const result = resolveTowerTurn(session, action, null, BP_COMBAT, BI_PHAP);
      await _handleCombatResult(interaction, session, userId, result);
    } catch (e) {
      console.error('[tower] combat turn error:', e.message);
      try { await _editMsg(interaction, session, { embeds: [makeCombatEmbed(session)], components: [makeCombatRow(userId, session)] }); } catch (_) {}
    } finally {
      session.resolving = false;
    }
    return;
  }

  // Next floor button
  if (customId.startsWith('tower_next_')) {
    const ownerId = customId.replace('tower_next_', '');
    if (ownerId !== userId) {
      return interaction.reply({ content: '❌ Đây không phải tháp của ngươi!', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    const session = TOWER_SESSIONS.get(userId);
    if (!session) {
      interaction.message?.edit({ components: [] }).catch(() => {});
      return interaction.reply({ content: '⏱️ Phiên Tháp đã kết thúc (bot khởi động lại). Dùng `-ttl` để vào Tháp lại!', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    if (session.phase !== 'waiting') {
      return interaction.deferUpdate().catch(() => {});
    }
    session.phase = 'challenge';
    resetSessionTimeout(session);
    await interaction.deferUpdate().catch(() => {});

    const embed = makeChallengeEmbed(session);
    const row   = makeChallengeRow(userId);
    await _editMsg(interaction, session, { embeds: [embed], components: [row] });
    return;
  }
}


// ── Difficulty display embed ───────────────────────────────────────────────────
function makeDifficultyEmbed(player) {
  const kyluc = player ? Number(player.thap_tang || 0) : 0;

  const TIERS = [
    {
      label: 'Tầng 1–5',
      icon: '🌿',
      tag: 'CƠ BẢN',
      diff: '🟩⬛⬛⬛⬛⬛',
      color: 'Dễ',
      enemy: 'Yêu Hồ Tử · Thạch Tinh Quái · Hỏa Linh Thú...',
      atkRange: '0.56× – 0.84×',
      defRange: '0.47× – 0.67×',
      hpRange:  '0.74× – 1.15×',
      penalty: '−12% HP',
      recover: '+35% HP',
      rewards: `57–860 ${CE('tult','💠')}/tầng`,
      mechanic: null,
      startFloor: 1,
    },
    {
      label: 'Tầng 6–10',
      icon: '🔵',
      tag: 'TRUNG CẤP',
      diff: '🟩🟩⬛⬛⬛⬛',
      color: 'Trung bình',
      enemy: 'Địa Yêu Tu Sĩ · Hắc Ám Tu Sĩ · Phong Vân Kiếm Khách...',
      atkRange: '0.93× – 1.32×',
      defRange: '0.73× – 0.99×',
      hpRange:  '1.26× – 1.71×',
      penalty: '−12% HP',
      recover: '+35% HP',
      rewards: `344–860 ${CE('tult','💠')}/tầng`,
      mechanic: `${CE('warn_icon','⚠️')} Tầng 7+: Thủ vệ bắt đầu dùng **Bí Kỹ** (×1.35 ATK, CD 4 lượt)`,
      startFloor: 6,
    },
    {
      label: 'Tầng 11–15',
      icon: '🟡',
      tag: 'KHÓ',
      diff: '🟨🟨🟨⬛⬛⬛',
      color: 'Khó',
      enemy: 'Thiên Kiêu Tu Sĩ · Kiếm Đạo Cao Thủ · Hỗn Nguyên Tu Sĩ...',
      atkRange: '1.42× – 2.03×',
      defRange: '1.07× – 1.49×',
      hpRange:  '1.85× – 2.63×',
      penalty: '−20% HP',
      recover: '+35%→+20% HP',
      rewards: `631–860 ${CE('tult','💠')}/tầng`,
      mechanic: `${CE('warn_icon','⚠️')} Tầng 12+: Bí Kỹ ×1.5 gây **Debuff ATK −30%** lượt sau`,
      startFloor: 11,
    },
    {
      label: 'Tầng 16–20',
      icon: '🟠',
      tag: 'CAO CẤP',
      diff: '🟧🟧🟧🟧⬛⬛',
      color: 'Rất khó',
      enemy: 'Thiên Kiếp Sứ Giả ☄️ · Cổ Thần Linh Vệ 🌟 · Huyền Cơ Thánh Giả ✨',
      atkRange: '2.25× – 2.98×',
      defRange: '1.61× – 2.07×',
      hpRange:  '3.08× – 4.21×',
      penalty: '−20% HP',
      recover: '+20% HP',
      rewards: `459–573 ${CE('tult','💠')}/tầng`,
      mechanic: `${CE('warn_icon','⚠️')} Tầng 20+: Bí Kỹ ×1.88 + **tự hồi 10% HP** sau khi tung`,
      startFloor: 16,
    },
    {
      label: 'Tầng 21–25',
      icon: '🔴',
      tag: 'CHUYÊN GIA',
      diff: '🟥🟥🟥🟥🟥⬛',
      color: 'Cực khó',
      enemy: 'Cổ Đại Thần Ma 💀 · Thiên Đạo Phán Quan ⚖️ · Vô Thượng Linh Vương 👁️',
      atkRange: '3.27× – 4.28×',
      defRange: '2.24× – 2.79×',
      hpRange:  '4.63× – 6.16×',
      penalty: '−28% HP',
      recover: '+12% HP',
      rewards: `1,204–1,434 ${CE('tult','💠')}/tầng`,
      mechanic: `${CE('warn_icon','⚠️')} Tầng 26+: Bí Kỹ ×2.25 **xuyên 50% phòng thủ** — cực kỳ nguy hiểm!`,
      startFloor: 21,
    },
    {
      label: 'Tầng 26–30',
      icon: '☠️',
      tag: 'HUYỀN THÁNH',
      diff: '💀💀💀💀💀💀',
      color: '地獄 Địa ngục',
      enemy: 'Thiên Đế Hiện Thân 👑 · Vô Cực Đạo Tôn ♾️ · Hỗn Nguyên Thánh Ma ☠️',
      atkRange: '4.69× – 6.16×',
      defRange: '2.98× – 3.71×',
      hpRange:  '6.85× – 9.45×',
      penalty: '−28% HP',
      recover: '+12% HP',
      rewards: `2,983–3,442 ${CE('tult','💠')}/tầng`,
      mechanic: `${CE('warn_icon','⚠️')} Bạo Kích ×2.8 · Bí Kỹ ×2.25 xuyên 50% DEF · Tỷ lệ kỹ năng 38%/lượt`,
      startFloor: 26,
    },
  ];

  const lines = TIERS.map((t) => {
    let mark = '';
    if (player) {
      mark = kyluc >= t.startFloor ? ' ✅' : kyluc >= t.startFloor - 1 ? ' ⚔️' : ` ${CE('lock_icon','🔒')}`;
    }
    const parts = [
      t.icon + ' **' + t.label + '** — `' + t.tag + '`' + mark,
      '> 📊 `' + t.diff + '` ' + t.color,
      '> ⚔️ ATK thủ vệ: `' + t.atkRange + '` · 🛡️ DEF: `' + t.defRange + '` · ❤️ HP: `' + t.hpRange + '`',
      '> ❌ Trả lời sai: `' + t.penalty + '` · 💚 Hồi giữa tầng: `' + t.recover + '`',
      '> ' + CE('tult','💠') + ' Phần thưởng: `' + t.rewards + '`',
    ];
    if (t.mechanic) parts.push('> ' + t.mechanic);
    return parts.join('\n');
  });

  const kylucLine = player
    ? '\n\n───────────────────────\n📊 **Kỷ lục của ngươi:** Tầng **' + kyluc + '**/' + TOWER_MAX_FLOOR
      + (kyluc === 0 ? ' — *Chưa từng vào tháp!*' : kyluc >= TOWER_MAX_FLOOR ? ' 👑 *Đã chinh phục hoàn toàn!*' : '')
    : `\n\n───────────────────────\n${CE('tip_icon','💡')} Dùng \`-ttl\` để nhập tháp!`;

  return new EmbedBuilder()
    .setColor(0x6A0DAD)
    .setTitle('🏯 Tháp Thí Luyện — Độ Khó Từng Tầng')
    .setDescription(
      '*Nghiên cứu kỹ trước khi nhập tháp — kiến thức là sức mạnh!*\n\n'
      + lines.join('\n\n')
      + kylucLine,
    )
    .setFooter({ text: 'Gợi ý: -ttl dokho · Dùng Hộ Thể & Bí Pháp để sống sót tầng cao · Tầng 20+ cực kỳ nguy hiểm' });
}

// ── Main command: -thap ───────────────────────────────────────────────────────

reg('thap_thi_luyen', ['ttl', 'thi_luyen', 'tower'], async (msg, args) => {
  // Subcommand: xem độ khó từng tầng → -ttl dokho
  const sub = (args && args[0] ? args[0] : '').toLowerCase();
  if (['dokho', 'do_kho', 'kho', 'difficulty', 'info', 'thongtin'].includes(sub)) {
    if (msg.author.id !== ADMIN_ID)
      return msg.reply({ embeds: [errE(`${CE('lock_icon','🔒')} Lệnh này chỉ dành cho **Admin**!`)] });
    const player = await getPlayer(msg.author.id).catch(() => null);
    return msg.reply({ embeds: [makeDifficultyEmbed(player)] });
  }

  const userId = msg.author.id;

  if (TOWER_SESSIONS.has(userId)) {
    const session = TOWER_SESSIONS.get(userId);
    // Re-send current combat state with fresh buttons (fixes missing buttons bug)
    if (session.phase === 'combat') {
      resetSessionTimeout(session);
      const embed = makeCombatEmbed(session);
      const row   = makeCombatRow(userId, session);
      const fresh = await msg.reply({ embeds: [embed], components: [row] });
      session.msg = fresh;
      return;
    }
    if (session.phase === 'challenge') {
      resetSessionTimeout(session);
      const embed = makeChallengeEmbed(session);
      const row   = makeChallengeRow(userId);
      const fresh = await msg.reply({ embeds: [embed], components: [row] });
      session.msg = fresh;
      return;
    }
    if (session.phase === 'waiting') {
      resetSessionTimeout(session);
      const embed = new EmbedBuilder()
        .setColor(0x6A0DAD)
        .setTitle(`🏯 Tháp Thí Luyện — Tiếp Tục`)
        .setDescription(`*Phiên tháp vẫn còn đang chờ — bấm nút để vào tầng tiếp theo!*`);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tower_next_${userId}`).setLabel(`➡️ Vào ${floorLabel(session.floor)}`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`tower_retreat_${userId}`).setLabel('🏳️ Rút Lui').setStyle(ButtonStyle.Secondary),
      );
      const fresh = await msg.reply({ embeds: [embed], components: [row] });
      session.msg = fresh;
      return;
    }
    return msg.reply({ embeds: [warnE('Ngươi đang trong **Tháp Thí Luyện**!\nDùng các nút bên trên để tiếp tục hoặc rút lui.')] });
  }

  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` để bắt đầu tu tiên!')] });

  if (Number(player.canh_gioi || 0) < 7) {
    return msg.reply({
      embeds: [errE(
        `**Tháp Thí Luyện** yêu cầu **Cảnh Giới Tầng 7** trở lên!\n` +
        `Cảnh giới của ngươi: **${getCG(player.canh_gioi).ten}** (Tầng ${player.canh_gioi})`,
      )],
    });
  }

  const cdMin = hasTowerTT(player) ? TOWER_CD_MIN * 0.9 : TOWER_CD_MIN;
  const rem   = cdRemMin(player.thap_thi_cd, cdMin);
  if (rem > 0) {
    return msg.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('⏰ Tháp Thí Luyện — CD Chưa Hết')
        .setDescription(
          `*Thân thể cần hồi phục sau lần thử trước...*\n\n⏱️ Hết CD ${cdTsMin(player.thap_thi_cd, cdMin)}\n` +
          `📊 Kỷ lục: **Tầng ${player.thap_tang || 0}**/${TOWER_MAX_FLOOR}` +
          (hasTowerTT(player) ? '\n✨ *Tu Luyện Chi Thuật: CD giảm 10%*' : ''),
        )],
    });
  }

  const cs      = tinhCS(player);
  const session = {
    userId,
    playerData:        player,
    floor:             1,
    phase:             'challenge',
    challenge:         null,
    enemy:             null,
    playerHp:          cs.hp_max,
    playerHpMax:       cs.hp_max,
    rewards:           0,
    combatLog:         [],
    turn:              1,
    bpCd:              0,
    defCd:             0,
    healCd:            0,
    enemySkillCd:      0,
    enemyHealCd:       0,
    enemyPowerCd:      0,
    playerDebuffTurns: 0,
    _enemyIgnoreDef:   0,
    hasBp:             false,
    playerBps:         [],
    usedQuestions:     new Set(),
    msg:               null,
    _timeout:          null,
    resolving:         false,
  };
  startFloor(session);
  TOWER_SESSIONS.set(userId, session);

  const embed = new EmbedBuilder()
    .setColor(0x6A0DAD)
    .setTitle('🏯 Tháp Thí Luyện — Nhập Tháp!')
    .setDescription(
      `*Tháp linh cổ đại vươn cao tận thiên đỉnh, từng tầng ẩn chứa thử thách và cơ duyên bất ngờ...*\n\n` +
      `**📋 Thông Tin Tháp (${TOWER_MAX_FLOOR} Tầng):**\n` +
      `⚔️ Mỗi tầng: **1 thử thách kiến thức** + **1 trận chiến**\n` +
      `❌ Trả lời sai → mất **20-40% HP** (tăng theo tầng)\n` +
      `💚 Hồi phục giữa tầng: **25% → 12% → 6%** (giảm dần)\n\n` +
      `**${CE('tult','💠')} Phần Thưởng:**\n` +
      `> Tầng 1-15: 100 → 1,500 ${CE('tult','💠')}/tầng\n` +
      `> Tầng 16-20: 800 → 1,000 ${CE('tult','💠')}/tầng\n` +
      `> Tầng 21-25: 2,100 → 2,500 ${CE('tult','💠')}/tầng\n` +
      `> Tầng 26-30: 5,200 → 6,000 ${CE('tult','💠')}/tầng\n\n` +
      `**🎁 Thưởng Đặc Biệt (mỗi mốc chỉ nhận 1 lần):**\n` +
      `> ⭐ **Tầng 10:** Thần Thông *Tu Luyện Chi Thuật*\n` +
      `> 💫 **Tầng 15:** Túi +15 kg\n` +
      `> 🌟 **Tầng 20:** +22,782 Linh Thạch\n` +
      `> 💎 **Tầng 25:** Túi +15 kg\n` +
      `> 👑 **Tầng 30:** +68,344 Linh Thạch\n\n` +
      `❤️ **HP:** ${fmt(cs.hp_max)} | 📊 **Kỷ lục:** Tầng ${player.thap_tang || 0}/${TOWER_MAX_FLOOR}`,
    )
    .setFooter({ text: `CD: 45 phút/lần · Tầng 16+ cực kỳ khó · Tầng 7+: Thủ Vệ dùng Bí Kỹ riêng · Tự chọn Bí Pháp khi chiến đấu` });

  const startRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tower_next_${userId}`)
      .setLabel(`${CEu("tia_set","⚡")} Bước Vào Tầng 1`)
      .setStyle(ButtonStyle.Success),
  );

  const sentMsg = await msg.reply({ embeds: [embed], components: [startRow] });
  session.msg   = sentMsg;
  resetSessionTimeout(session);
});


module.exports = { TOWER_SESSIONS, handleTowerButton };
