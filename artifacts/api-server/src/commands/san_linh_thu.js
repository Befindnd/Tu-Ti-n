'use strict';
/**
 * commands/san_linh_thu.js
 * Tính năng Săn Linh Thú — đội tối đa 3 người.
 *
 * Flow:
 *   1. `-san mo [tier]`  — mở phiên săn, hiện invite embed + nút
 *   2. Người chơi click "Tham Gia" (tối đa 3 người)
 *   3. Đội trưởng click "Bắt Đầu Săn"
 *   4. Chiến đấu theo lượt — mỗi người chọn hành động qua nút
 *   5. Khi tất cả đã chọn → giải quyết lượt tự động
 *
 * Session state được quản lý bởi SAN_SESSIONS (Map keyed by leaderId).
 * Button interactions → handlers/sanHandler.js.
 */
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, AttachmentBuilder,
} = require('discord.js');
const { db }          = require('../db/pool');
const { getPlayer }   = require('../db/players');
const { CE, getLinhThuAttachment } = require('../systems/emoji');
const {
  fmt, getCG, fTime, cdRemMin, errE, warnE, okE, SEP, SEP2, SEP3,
  reg, tinhCS, calcMaxLinhThach, canAddToBag,
} = require('../utils');
const { BI_PHAP, CANH_GIOI, getTT } = require('../data');
const { BP_COMBAT }           = require('../game/combat');
const {
  LINH_THU_TIERS, LINH_THU_LIST, LINH_THU_REWARDS,
  LINH_THU_LOOT_ITEMS,
} = require('../data/linh_thu_data');
const { generateBeast, resolveSanTurn, calcSanRewards, calcSanLoot } = require('../game/linh_thu_engine');

// ── Constants ─────────────────────────────────────────────────────────────────
const ADMIN_ID = process.env.ADMIN_ID || '';

// ── Session state ─────────────────────────────────────────────────────────────
/** Map leaderId → session */
const SAN_SESSIONS = new Map();
/** Map userId → leaderId (reverse lookup) */
const SAN_MEMBER_INDEX = new Map();

const SAN_TIMEOUT_WAIT_MS   = 5 * 60 * 1000;   // 5 phút chờ đội
const SAN_TIMEOUT_COMBAT_MS = 90 * 1000;        // 90 giây mỗi lượt
const MAX_TEAM_SIZE         = 3;

// ── Helpers: HP bar ───────────────────────────────────────────────────────────
function hpBar(cur, max) {
  const filled = Math.round(Math.max(0, Math.min(10, (cur / max) * 10)));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
function hpHeart(cur, max) {
  const r = cur / max;
  return r > 0.6 ? '❤️' : r > 0.3 ? '🧡' : '💔';
}
function beastBar(cur, max) {
  const filled = Math.round(Math.max(0, Math.min(14, (cur / max) * 14)));
  return '▰'.repeat(filled) + '▱'.repeat(14 - filled);
}

// ── Embed builders ────────────────────────────────────────────��───────────────
function makeInviteEmbed(session) {
  const td   = LINH_THU_TIERS[session.tier];
  const memberList = session.members.map((m, i) => {
    const icon = i === 0 ? '👑' : '⚔️';
    return `${icon} **${m.name}** — ${getCG(m.data.canh_gioi).ten}`;
  }).join('\n') || '*(Chưa có ai)*';

  return new EmbedBuilder()
    .setTitle(`${td.emoji} Phiên Săn Linh Thú — ${td.ten}`)
    .setColor(
      session.tier === 'than_thu'     ? 0x111111 :
      session.tier === 'huyen_thoai'  ? 0xCC2200 :
      session.tier === 'su_thi'       ? 0x7B1FA2 :
      session.tier === 'hiem'         ? 0x1565C0 : 0x388E3C
    )
    .setDescription([
      `**Đội trưởng:** <@${session.leaderId}>`,
      `**Yêu cầu cảnh giới:** Từ **${getCG(td.min_canh_gioi).ten}** trở lên`,
      `**Thành viên (${session.members.length}/${MAX_TEAM_SIZE}):**`,
      memberList,
      '',
      SEP3,
      `${td.emoji} Cần **1–${MAX_TEAM_SIZE} người** · Đội trưởng bấm **Bắt Đầu Săn** khi sẵn sàng`,
    ].join('\n'))
    .setFooter({ text: '⏱️ Phiên sẽ tự hủy sau 5 phút nếu không bắt đầu' });
}

function makeInviteRow(leaderId, memberCount) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`san_join_${leaderId}`)
      .setLabel('Tham Gia')
      .setStyle(ButtonStyle.Success)
      .setEmoji('⚔️')
      .setDisabled(memberCount >= MAX_TEAM_SIZE),
    new ButtonBuilder()
      .setCustomId(`san_leave_${leaderId}`)
      .setLabel('Rời Đội')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🚪'),
    new ButtonBuilder()
      .setCustomId(`san_start_${leaderId}`)
      .setLabel('Bắt Đầu Săn')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🏹'),
    new ButtonBuilder()
      .setCustomId(`san_cancel_${leaderId}`)
      .setLabel('Hủy')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌'),
  );
}

function makeInviteRowDisabled(leaderId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`san_join_${leaderId}`).setLabel('Tham Gia').setStyle(ButtonStyle.Success).setEmoji('⚔️').setDisabled(true),
    new ButtonBuilder().setCustomId(`san_leave_${leaderId}`).setLabel('Rời Đội').setStyle(ButtonStyle.Secondary).setEmoji('🚪').setDisabled(true),
    new ButtonBuilder().setCustomId(`san_start_${leaderId}`).setLabel('Bắt Đầu Săn').setStyle(ButtonStyle.Primary).setEmoji('🏹').setDisabled(true),
    new ButtonBuilder().setCustomId(`san_cancel_${leaderId}`).setLabel('Hủy').setStyle(ButtonStyle.Danger).setEmoji('❌').setDisabled(true),
  );
}

function makeCombatEmbed(session, turnLog) {
  const beast = session.beast;
  const td    = LINH_THU_TIERS[session.tier];
  const bHpPct = Math.round((beast.hp / beast.hp_max) * 100);

  const memberLines = session.members.map(m => {
    const hpPct  = Math.round((m.hp / m.hp_max) * 100);
    const status = !m.alive ? '💀 Đã ngã' : m.action ? '✅ Đã chọn' : `${CE("cd_timer","⏳")} Chờ...`;
    const effects = [];
    if (m.frozen    > 0) effects.push(`❄️×${m.frozen}`);
    if (m.stun      > 0) effects.push(`💫×${m.stun}`);
    if (m.burn      > 0) effects.push(`🔥×${m.burn}`);
    if (m.atk_reduced > 0) effects.push(`⬇️ATK`);
    if (m.def_reduced > 0) effects.push(`⬇️DEF`);
    const effStr = effects.length ? ` ${effects.join(' ')}` : '';
    return [
      `${m.alive ? hpHeart(m.hp, m.hp_max) : '💀'} **${m.name}**${effStr}  ·  ${status}`,
      `\`${hpBar(m.hp, m.hp_max)}\` **${hpPct}%** — ${fmt(Math.max(0, m.hp))}/${fmt(m.hp_max)} HP`,
    ].join('\n');
  });

  const beastEffects = [];
  if (beast.atk_boost  > 0) beastEffects.push(`⬆️ATK×${beast.atk_boost}`);
  if (beast.def_boost  > 0) beastEffects.push(`🛡️DEF×${beast.def_boost}`);
  if (beast.invincible > 0) beastEffects.push(`✨Bất Tử`);
  if (beast.phase2)          beastEffects.push(`${CE('warn_icon','⚠️')}Phase 2`);
  const bEffStr = beastEffects.length ? `  ${beastEffects.join(' ')}` : '';

  const log    = (turnLog || session.log).slice(-4);
  const logStr = log.length
    ? log.join('\n')
    : `*🏹 Cuộc săn bắt đầu! Hãy hạ gục **${beast.mu} ${beast.ten}**!*`;

  const desc = [
    `${beast.mu} **${beast.ten}** ${td.emoji} *${td.ten}*${bEffStr}`,
    `\`${beastBar(beast.hp, beast.hp_max)}\` **${bHpPct}%** — ${fmt(Math.max(0, beast.hp))}/${fmt(beast.hp_max)} HP`,
    '',
    SEP,
    memberLines.join('\n'),
    '',
    SEP3,
    logStr,
  ].join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`🏹 Săn Linh Thú · Lượt ${session.turn}/${session.max_turns}`)
    .setColor(
      session.tier === 'than_thu'    ? 0x111111 :
      session.tier === 'huyen_thoai' ? 0xCC2200 :
      session.tier === 'su_thi'      ? 0x7B1FA2 :
      session.tier === 'hiem'        ? 0x1565C0 : 0x388E3C
    )
    .setDescription(desc)
    .setFooter({ text: '⏱️ 90 giây/lượt · Không chọn → tự động Tấn Công' });
  if (session._beastImgAttached) embed.setThumbnail('attachment://lt_beast.png');
  return embed;
}

function makeCombatRow(leaderId, disabled = false) {
  const d = disabled;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`san_danh_${leaderId}`).setLabel('Tấn Công').setStyle(ButtonStyle.Primary).setEmoji('⚔️').setDisabled(d),
    new ButtonBuilder().setCustomId(`san_biphap_${leaderId}`).setLabel('Bí Pháp').setStyle(ButtonStyle.Danger).setEmoji('📜').setDisabled(d),
    new ButtonBuilder().setCustomId(`san_the_${leaderId}`).setLabel('Hộ Thể').setStyle(ButtonStyle.Secondary).setEmoji('🛡️').setDisabled(d),
    new ButtonBuilder().setCustomId(`san_hoikhi_${leaderId}`).setLabel('Hồi Linh Khí').setStyle(ButtonStyle.Success).setEmoji('💫').setDisabled(d),
    new ButtonBuilder().setCustomId(`san_chay_${leaderId}`).setLabel('Rút Lui').setStyle(ButtonStyle.Secondary).setEmoji('🏳️').setDisabled(d),
  );
}

// ── Session timeout helpers ───────────────────────────────────────────────────
function clearSessionTimeout(session) {
  if (session._timeout) { clearTimeout(session._timeout); session._timeout = null; }
}

function scheduleWaitTimeout(session) {
  clearSessionTimeout(session);
  session._timeout = setTimeout(async () => {
    if (!SAN_SESSIONS.has(session.leaderId)) return;
    _cleanupSession(session.leaderId);
    try {
      if (session.invite_msg) {
        await session.invite_msg.edit({
          embeds: [warnE('⏱️ Phiên săn đã hết thời gian chờ và bị hủy!')],
          components: [makeInviteRowDisabled(session.leaderId)],
        }).catch(() => {});
      }
    } catch (_) {}
  }, SAN_TIMEOUT_WAIT_MS);
}

function scheduleTurnTimeout(session) {
  clearSessionTimeout(session);
  session._timeout = setTimeout(async () => {
    if (!SAN_SESSIONS.has(session.leaderId) || session.status !== 'combat') return;
    // Ai chưa chọn → tự động Tấn Công
    for (const m of session.members) {
      if (m.alive && !m.action) m.action = { type: 'danh' };
    }
    try {
      await _resolveTurn(session);
    } catch (e) {
      console.error('[san] turn timeout error:', e.message);
    }
  }, SAN_TIMEOUT_COMBAT_MS);
}

// ── Session cleanup ───────────────────────────────────────────────────────────
function _cleanupSession(leaderId) {
  const session = SAN_SESSIONS.get(leaderId);
  if (!session) return;
  clearSessionTimeout(session);
  for (const m of session.members) SAN_MEMBER_INDEX.delete(m.id);
  SAN_SESSIONS.delete(leaderId);
}

// ── Resolve turn (shared between handler & timeout) ──────────────────────────
async function _resolveTurn(session) {
  if (session.resolving) return;
  session.resolving = true;

  try {
    const result = await Promise.resolve(resolveSanTurn(session));
    const ch = session.channel;
    if (!ch) { session.resolving = false; return; }

    if (result.done) {
      await endSanCombat(session, result.win, result.log, ch);
    } else {
      session.resolving = false;
      session.log.push(...result.log);
      if (session.log.length > 30) session.log = session.log.slice(-30);

      if (session.combat_msg) {
        await session.combat_msg.edit({
          embeds:     [makeCombatEmbed(session, result.log)],
          components: [makeCombatRow(session.leaderId)],
        }).catch(() => {});
      }
      scheduleTurnTimeout(session);
    }
  } catch (e) {
    console.error('[san] _resolveTurn error:', e.message);
    session.resolving = false;
  }
}

// ── Kết thúc chiến đấu ────────────────────────────────────────────────────────
async function endSanCombat(session, win, lastLog, channel) {
  _cleanupSession(session.leaderId);

  const td = LINH_THU_TIERS[session.tier];

  if (win) {
    // Tính loot chung cho cả đội (1 bộ drop cho toàn đội)
    const teamLoot = calcSanLoot(session.tier, session.members.length);

    // Phát phần thưởng cho từng thành viên còn sống
    const rewardLines = [];
    for (const m of session.members) {
      const { exp_add } = calcSanRewards(
        session.tier, session.members.length, m.data,
      );

      const cg      = CANH_GIOI[m.data.canh_gioi] || CANH_GIOI[0];
      const expCap  = cg?.exp_next || 10000;
      const safeExp = Math.min(exp_add, expCap);


      await db(
        'UPDATE players SET exp = exp + $1 WHERE user_id = $2',
        [safeExp, m.id],
      ).catch((e) => console.error('[san] reward write failed:', e.message));


      const itemLine = '';

      // Dùng bộ loot chung của đội (đã tính ở trên) — không gọi lại RNG per thành viên
      // để tránh đội 3 người nhận 3× loot so với đi đơn
      const memberLoot = teamLoot.slice();
      const receivedLoot = [];
      const rejectedLoot = [];

      if (memberLoot.length > 0) {
        const freshPlayer = await db('SELECT * FROM players WHERE user_id=$1', [m.id])
          .then(r => r.rows[0])
          .catch(() => m.data);

        for (const itemId of memberLoot) {
          const li = LINH_THU_LOOT_ITEMS[itemId];
          if (!li) continue;

          const bagOk = canAddToBag(freshPlayer, 'vat_pham', 1, itemId);

          if (!bagOk) {
            rejectedLoot.push(`${li.emoji} **${li.ten}** — túi đầy (${li.kg}kg)`);
            continue;
          }

          await db(
            `UPDATE players SET vat_pham = jsonb_set(
               COALESCE(vat_pham,'{}'),
               '{${itemId}}',
               to_jsonb(COALESCE((vat_pham->>'${itemId}')::int,0) + 1)
             ) WHERE user_id = $1`,
            [m.id],
          ).catch((e) => console.error('[san] vat_pham write failed:', e.message));

          if (freshPlayer.vat_pham) {
            freshPlayer.vat_pham[itemId] = (freshPlayer.vat_pham[itemId] || 0) + 1;
          } else {
            freshPlayer.vat_pham = { [itemId]: 1 };
          }

          receivedLoot.push(`${li.emoji} **${li.ten}** *(+${li.kg}kg)*`);
        }
      }

      const lootPart = receivedLoot.length > 0
        ? '\n  🎒 ' + receivedLoot.join(' · ')
        : '';
      const rejectedPart = rejectedLoot.length > 0
        ? `\n  ${CE('warn_icon','⚠️')} Túi đầy — bỏ lỡ: ` + rejectedLoot.join(', ')
        : '';


      rewardLines.push(
        `⚔️ **${m.name}**: +${fmt(safeExp)} EXP${itemLine}${lootPart}${rejectedPart}`,
      );
    }

    // Set cooldown cho tất cả thành viên sau khi thắng
    const cooldownH = LINH_THU_TIERS[session.tier].cd_h;
    const now = Date.now();
    for (const m of session.members) {
      const cdReduce = getTT(m.data || {}, 'cd_reduce');
      const effectiveCdMs = cooldownH * 3_600_000 * (1 - cdReduce);
      await db(
        'UPDATE players SET san_linh_thu_cd = $1 WHERE user_id = $2',
        [now + effectiveCdMs, m.id],
      ).catch((e) => console.error('[san] cd write failed (win):', e.message));
    }

    // Loot chung của đội (để hiển thị thêm nếu cần — tổng hợp từ teamLoot)
    const teamLootStr = teamLoot.length > 0
      ? '\n🎒 **Chiến lợi phẩm đội:** ' + teamLoot.map(id => {
          const li = LINH_THU_LOOT_ITEMS[id];
          return li ? `${li.emoji} ${li.ten}` : id;
        }).join(' · ')
      : '';

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Săn Thành Công! — ${session.beast.mu} ${session.beast.ten} đã bị hạ!`)
      .setColor(0xFFD700)
      .setDescription([
        `${td.emoji} **${td.ten}** · Lượt ${session.turn - 1}`,
        '',
        SEP,
        ...rewardLines,
        '',
        `⏱️ Hồi chiêu **${cooldownH}h** trước lần săn tiếp theo.`,
        '',
        SEP3,
        ...(lastLog || []).slice(-3),
      ].join('\n'));

    try {
      if (session.combat_msg) {
        const edited = await session.combat_msg.edit({ embeds: [embed], components: [makeCombatRow(session.leaderId, true)] }).catch(() => null);
        if (!edited) await channel.send({ embeds: [embed] }).catch(() => {});
      } else {
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (_) {}

  } else {
    // Thua
    const cooldownH = LINH_THU_TIERS[session.tier].cd_h;
    const now = Date.now();
    for (const m of session.members) {
      const cdReduce = getTT(m.data || {}, 'cd_reduce');
      const effectiveCdMs = cooldownH * 3_600_000 * (1 - cdReduce);
      await db(
        'UPDATE players SET san_linh_thu_cd = $1 WHERE user_id = $2',
        [now + effectiveCdMs, m.id],
      ).catch((e) => console.error('[san] cd write failed (lose):', e.message));
    }

    const embed = new EmbedBuilder()
      .setTitle(`💀 Đội bị đánh bại! — ${session.beast.mu} ${session.beast.ten} vẫn còn sống!`)
      .setColor(0x880000)
      .setDescription([
        `Cả đội đã bị đánh bại bởi **${session.beast.mu} ${session.beast.ten}** (${td.emoji} ${td.ten}).`,
        `HP linh thú còn lại: **${Math.round((session.beast.hp / session.beast.hp_max) * 100)}%**`,
        '',
        `⏱️ Hồi chiêu **${cooldownH}h** trước lần săn tiếp theo.`,
        '',
        SEP3,
        ...(lastLog || []).slice(-3),
      ].join('\n'));

    try {
      if (session.combat_msg) {
        const edited = await session.combat_msg.edit({ embeds: [embed], components: [makeCombatRow(session.leaderId, true)] }).catch(() => null);
        if (!edited) await channel.send({ embeds: [embed] }).catch(() => {});
      } else {
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (_) {}
  }
}

// ── Khởi tạo session ──────────────────────────────────────────────────────────
async function _startCombat(session, message) {
  // Lấy dữ liệu player mới nhất cho tất cả thành viên
  const rows = await Promise.all(session.members.map(m => getPlayer(m.id)));
  for (let i = 0; i < session.members.length; i++) {
    const p  = rows[i];
    if (!p) continue;
    const cs = tinhCS(p);
    const m  = session.members[i];
    m.data    = p;
    m.hp      = cs.hp_max;
    m.hp_max  = cs.hp_max;
    m.atk     = cs.atk;
    m.def     = cs.def;
    m.bp_cd   = {};
    m.action_cd = { the: 0, hoikhi: 0 };
    m.frozen  = 0;
    m.stun    = 0;
    m.burn    = 0;
    m.atk_reduced = 0;
    m.def_reduced = 0;
    m.alive   = true;
    m.action  = null;
    m.defending = false;
    m.shield_mult = null;
  }

  const tier = LINH_THU_TIERS[session.tier];
  session.beast       = generateBeast(session.tier, rows.filter(Boolean));
  session.status      = 'combat';
  session.turn        = 1;
  session.max_turns   = tier.max_turns;
  session.log         = [];
  session.channel     = message.channel;
  session.BP_COMBAT_DATA = BP_COMBAT;

  // Tắt invite embed
  if (session.invite_msg) {
    await session.invite_msg.edit({
      embeds:     [makeInviteEmbed(session)],
      components: [makeInviteRowDisabled(session.leaderId)],
    }).catch(() => {});
  }

  const beast = session.beast;
  const teamNames = session.members.map(m => `**${m.name}**`).join(', ');
  const openingLog = [
    `🏹 Cuộc săn bắt đầu! ${teamNames} đối mặt **${beast.mu} ${beast.ten}**!`,
    `⚔️ Kỹ năng: *${beast.skill_desc}*`,
    `${beast.passive_desc || ''}`,
  ].filter(Boolean);
  session.log = openingLog;

  const beastImgFile = getLinhThuAttachment(session.beast.id);
  if (beastImgFile) {
    session._beastImgAttached = true;
  }
  const combatSendOpts = {
    content: session.members.map(m => `<@${m.id}>`).join(' '),
    embeds:  [makeCombatEmbed(session, openingLog)],
    components: [makeCombatRow(session.leaderId)],
  };
  if (beastImgFile) combatSendOpts.files = [new AttachmentBuilder(beastImgFile.attachment, { name: 'lt_beast.png' })];
  session.combat_msg = await message.channel.send(combatSendOpts);

  scheduleTurnTimeout(session);
}


// ── Nhanh xem thông tin các bậc linh thú ─────────────────────────────────────
function makeSanInfoEmbed(player) {
  const cg = player ? Number(player.canh_gioi || 0) : -1;

  const TIERS_INFO = [
    {
      key: 'pho_thong',
      ten: 'Phổ Thông', emoji: '🟢',
      diff: '🟩⬛⬛⬛⬛',
      tag: 'DỄ',
      min_cg: 0,
      atk: '0.77×–1.13×', def: '0.59×–0.86×', hp: '1.80×–2.70×',
      cd: '15 ph\u00fat', max_turns: 20,
      thuong: 'EXP +4–8%',
      loot: 'Da linh th\u00fa \u00b7 L\u00f4ng linh th\u00fa \u00b7 R\u0103ng vu\u1ed1t',
      beasts: '\u0110\u1ed9c Lang \ud83d\udc3a \u00b7 H\u1ecfa H\u1ed3 \ud83e\udd8a \u00b7 B\u0103ng H\u00f9ng \ud83d\udc3b \u00b7 \u0110\u1ecba Nha \ud83e\udd8e',
      note: null,
    },
    {
      key: 'hiem',
      ten: 'Hi\u1ebfm', emoji: '\ud83d\udd35',
      diff: '\ud83d\udfe9\ud83d\udfe9\u2b1b\u2b1b\u2b1b',
      tag: 'TRUNG B\u00ccNH',
      min_cg: 5,
      atk: '1.44×–1.98×', def: '1.13×–1.58×', hp: '3.60×–5.40×',
      cd: '30 ph\u00fat', max_turns: 20,
      thuong: 'EXP +6–12%',
      loot: 'X\u01b0\u01a1ng linh th\u00fa \u00b7 Tinh th\u1ea1ch nh\u1ecf \ud83d\udc8e',
      beasts: 'L\u00f4i B\u00e1o \ud83d\udc06 \u00b7 \u0110\u1ecba Long \ud83d\udc09 \u00b7 Phong \u01afng \ud83e\udd85 \u00b7 \u00c1m Th\u01b0\u1edbc \ud83e\udd9c',
      note: '\u26a0\ufe0f L\u00f4i B\u00e1o c\u00f3 th\u1ec3 cho\u00e1ng to\u00e0n \u0111\u1ed9i \u00b7 Phong \u01afng \u0111\u00e1nh 2 l\u1ea7n/l\u01b0\u1ee3t',
    },
    {
      key: 'su_thi',
      ten: 'S\u1eed Thi', emoji: '\ud83d\udfe3',
      diff: '\ud83d\udfe8\ud83d\udfe8\ud83d\udfe8\u2b1b\u2b1b',
      tag: 'KH\u00d3',
      min_cg: 10,
      atk: '2.16×–3.06×', def: '1.71×–2.39×', hp: '6.12×–9.18×',
      cd: '45 ph\u00fat', max_turns: 25,
      thuong: 'EXP +10–18%',
      loot: 'Nanh linh th\u00fa \u00b7 Tinh th\u1ea1ch trung \ud83d\udca0',
      beasts: 'Huy\u1ebft S\u01b0 \ud83e\udd81 \u00b7 B\u0103ng Ph\u01b0\u1ee3ng \ud83e\udd9a \u00b7 \u0110\u1ecba Ng\u1ee5c Qu\u1ef7 \ud83d\udc7f \u00b7 Kim T\u01b0\u1edbc \ud83d\udc26',
      note: '\u26a0\ufe0f B\u0103ng Ph\u01b0\u1ee3ng \u0111\u00f3ng b\u0103ng li\u00ean t\u1ee5c \u00b7 \u0110\u1ecba Ng\u1ee5c Qu\u1ef7 gi\u1ea3m ATK to\u00e0n \u0111\u1ed9i m\u1ed7i l\u01b0\u1ee3t',
    },
    {
      key: 'huyen_thoai',
      ten: 'Huy\u1ec1n Tho\u1ea1i', emoji: '\ud83d\udd34',
      diff: '\ud83d\udfe7\ud83d\udfe7\ud83d\udfe7\ud83d\udfe7\u2b1b',
      tag: 'R\u1ea4T KH\u00d3',
      min_cg: 15,
      atk: '3.47×–5.22×', def: '2.61×–3.69×', hp: '12.15×–18.45×',
      cd: '1 ti\u1ebfng', max_turns: 30,
      thuong: 'EXP +15–26%',
      loot: 'X\u01b0\u01a1ng huy\u1ec1n linh \ud83c\udf00 \u00b7 V\u1ea3y linh long \ud83d\udc09',
      beasts: 'C\u1eedu V\u1ef9 H\u1ed3 \ud83e\udd8a \u00b7 Thanh Long \ud83d\udc09 \u00b7 B\u1ea1ch H\u1ed5 \ud83d\udc2f \u00b7 Huy\u1ec1n V\u0169 \ud83d\udc22 \u00b7 Chu T\u01b0\u1edbc \ud83e\udd9a',
      note: '\u26a0\ufe0f B\u1ea1ch H\u1ed5 c\u00f3 th\u1ec3 one-shot khi HP < 25% \u00b7 Huy\u1ec1n V\u0169 b\u1ea5t t\u1eed 2 l\u01b0\u1ee3t',
    },
    {
      key: 'than_thu',
      ten: 'Th\u1ea7n Th\u00fa', emoji: '\u26ab',
      diff: '\ud83d\udfe5\ud83d\udfe5\ud83d\udfe5\ud83d\udfe5\ud83d\udfe5',
      tag: '\u0110\u1ecaA NG\u1ee4C',
      min_cg: 20,
      atk: '6.12×–8.82×', def: '4.59×–6.53×', hp: '22.95×–38.25×',
      cd: '1.5 ti\u1ebfng', max_turns: 35,
      thuong: 'EXP +22–40%',
      loot: 'Tinh th\u1ea1ch th\u1ea7n \u2b50 \u00b7 Tim th\u1ea7n th\u00fa \u2764\ufe0f\u200d\ud83d\udd25 \u00b7 Linh h\u1ed3n th\u1ea7n th\u00fa \ud83d\udc7b',
      beasts: 'H\u1ed7n \u0110\u1ed9n Th\u00fa \ud83d\udc7e \u00b7 Th\u00e1i C\u1ed5 Long \ud83d\udc32 \u00b7 Ti\u00ean Linh \u2728',
      note: '\u26a0\ufe0f C\u1ef1c k\u1ef3 nguy hi\u1ec3m! Th\u00e1i C\u1ed5 Long h\u1ed3i 45% HP \u00b7 Ti\u00ean Linh v\u00f4 hi\u1ec7u h\u00e0nh \u0111\u1ed9ng 28%/l\u01b0\u1ee3t',
    },
  ];

  const lines = TIERS_INFO.map(function(t) {
    var mark = '';
    if (player) {
      mark = cg >= t.min_cg ? ' \u2705' : ' \ud83d\udd12 *(Ch\u01b0a \u0111\u1ee7 c\u1ea3nh gi\u1edbi)*';
    }
    var parts = [
      t.emoji + ' **' + t.ten + '** \u2014 `' + t.tag + '`' + mark,
      '> \ud83d\udcca `' + t.diff + '` \u00b7 \u23f1\ufe0f CD: `' + t.cd + '` \u00b7 T\u1ed1i \u0111a `' + t.max_turns + '` l\u01b0\u1ee3t',
      '> \u2694\ufe0f ATK: `' + t.atk + '` \u00b7 \ud83d\udee1\ufe0f DEF: `' + t.def + '` \u00b7 \u2764\ufe0f HP: `' + t.hp + '`',
      '> \ud83d\udca0 Th\u01b0\u1edfng: `' + t.thuong + '`',
      '> \ud83c\udf81 Loot: ' + t.loot,
      '> \ud83d\udc3e Linh th\u00fa: ' + t.beasts,
    ];
    if (t.note) parts.push('> ' + t.note);
    return parts.join('\n');
  });

  var kylucLine = player
    ? '\n\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\ud83d\udcca **C\u1ea3nh gi\u1edbi c\u1ee7a ng\u01b0\u01a1i:** T\u1ea7ng **' + cg + '**'
    : '\n\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\ud83d\udca1 D\u00f9ng `-san mo [b\u1eadc]` \u0111\u1ec3 b\u1eaft \u0111\u1ea7u s\u0103n!';

  var aliasLine = '\n\n**C\u00e1ch d\u00f9ng:** `-san mo pho_thong` \u00b7 `-san mo hiem` \u00b7 `-san mo su_thi` \u00b7 `-san mo huyen_thoai` \u00b7 `-san mo than_thu`';

  return new EmbedBuilder()
    .setColor(0x1565C0)
    .setTitle('\ud83d\udc3e S\u0103n Linh Th\u00fa \u2014 Th\u00f4ng Tin C\u00e1c B\u1eadc')
    .setDescription(
      '*Ch\u1ecdn b\u1eadc ph\u00f9 h\u1ee3p v\u1edbi c\u1ea3nh gi\u1edbi v\u00e0 \u0111\u1ed9i h\u00ecnh c\u1ee7a ng\u01b0\u01a1i!*\n\n'
      + lines.join('\n\n')
      + kylucLine
      + aliasLine,
    )
    .setFooter({ text: 'T\u1ed1i \u0111a 3 ng\u01b0\u1eddi/\u0111\u1ed9i \u00b7 HP th\u00fa t\u0103ng theo s\u1ed1 th\u00e0nh vi\u00ean \u00b7 -san join \u0111\u1ec3 v\u00e0o \u0111\u1ed9i ng\u01b0\u1eddi kh\u00e1c' });
}


// ── Command handler ───────────────────────────────────────────────────────────
reg('san', ['san_linh_thu', 'hunt'], async (msg, args) => {
  const userId   = msg.author.id;
  const sub      = (args[0] || 'mo').toLowerCase();

  // Tra cứu session hiện tại của user
  const myLeaderId = SAN_MEMBER_INDEX.get(userId);
  const mySession  = myLeaderId ? SAN_SESSIONS.get(myLeaderId) : null;

  // ── Nhanh xem thông tin bậc linh thú (-san nx) ───────────────────────────
  if (sub === 'nx' || sub === 'nhanh' || sub === 'tiers' || sub === 'bac') {
    if (msg.author.id !== ADMIN_ID)
      return msg.reply({ embeds: [errE(`${CE('lock_icon','🔒')} Lệnh này chỉ dành cho **Admin**!`)] });
    const player = await getPlayer(userId).catch(() => null);
    return msg.reply({ embeds: [makeSanInfoEmbed(player)] });
  }

  // ── Xem thông tin session ────────────────────────────────────────────────
  if (sub === 'xem' || sub === 'info') {
    if (!mySession) return msg.reply({ embeds: [warnE('Ngươi hiện không có phiên săn nào!')] });
    return msg.reply({ embeds: [
      mySession.status === 'waiting' ? makeInviteEmbed(mySession) : makeCombatEmbed(mySession),
    ]});
  }

  // ── Rời đội (trước khi bắt đầu) ────────────────────────────────────────
  if (sub === 'roi' || sub === 'leave') {
    if (!mySession) return msg.reply({ embeds: [warnE('Ngươi không ở trong phiên săn nào!')] });
    if (mySession.status !== 'waiting') return msg.reply({ embeds: [warnE('Chiến đấu đang diễn ra, không thể rời!')] });
    if (mySession.leaderId === userId) return msg.reply({ embeds: [warnE('Đội trưởng không thể rời! Dùng `-san huy` để hủy phiên.')] });

    mySession.members = mySession.members.filter(m => m.id !== userId);
    SAN_MEMBER_INDEX.delete(userId);
    await msg.reply({ embeds: [okE(`**${msg.author.username}** đã rời đội!`)] });
    if (mySession.invite_msg) {
      await mySession.invite_msg.edit({
        embeds: [makeInviteEmbed(mySession)],
        components: [makeInviteRow(mySession.leaderId, mySession.members.length)],
      }).catch(() => {});
    }
    return;
  }

  // ── Hủy phiên (đội trưởng) ──────────────────────────────────────────────
  if (sub === 'huy' || sub === 'cancel') {
    if (!mySession) return msg.reply({ embeds: [warnE('Ngươi không có phiên săn nào!')] });
    if (mySession.leaderId !== userId) return msg.reply({ embeds: [warnE('Chỉ đội trưởng mới có thể hủy!')] });

    // Chặn hủy khi đang trong combat — phải dùng nút Rút Lui trong trận
    if (mySession.status === 'combat') {
      return msg.reply({ embeds: [warnE('⚔️ Đang trong trận chiến! Dùng nút **🏳️ Rút Lui** trong embed chiến đấu để thoát.')] });
    }

    // Áp cooldown ngắn (10 phút) khi hủy từ giai đoạn chờ để chặn spam
    const cancelCd = Date.now() + 10 * 60_000;
    db('UPDATE players SET san_linh_thu_cd = $1 WHERE user_id = $2', [cancelCd, userId])
      .catch((e) => console.error('[san] cancel cd write failed:', e.message));

    _cleanupSession(mySession.leaderId);
    if (mySession.invite_msg) {
      await mySession.invite_msg.edit({ components: [makeInviteRowDisabled(mySession.leaderId)] }).catch(() => {});
    }
    return msg.reply({ embeds: [okE('Phiên săn đã bị hủy! ⏱️ Cooldown 10 phút trước lần săn tiếp theo.')] });
  }

  // ── Mở phiên mới ────────────────────────────────────────────────────────
  if (sub === 'mo' || sub === 'open' || sub === 'bat_dau' || !['tham','join'].includes(sub)) {

    // Kiểm tra đã trong session khác chưa
    if (mySession) return msg.reply({ embeds: [warnE('Ngươi đang trong một phiên săn! Gõ `-san huy` để hủy trước.')] });

    const player = await getPlayer(userId, msg.author.username);
    if (!player) return msg.reply({ embeds: [errE('Chưa có hồ sơ! Gõ `-bat_dau` để tạo.')] });

    // Chọn tier
    let tier = (args[1] || args[0] || 'pho_thong').toLowerCase();
    // Remap alias
    if (tier === 'mo' || tier === 'open') tier = 'pho_thong';
    if (!LINH_THU_TIERS[tier]) {
      return msg.reply({ embeds: [warnE(
        `Tier không hợp lệ! Các tier: \`pho_thong\` 🟢 · \`hiem\` 🔵 · \`su_thi\` 🟣 · \`huyen_thoai\` 🔴 · \`than_thu\` ⚫`
      )]});
    }

    const td = LINH_THU_TIERS[tier];
    if (player.canh_gioi < td.min_canh_gioi) {
      return msg.reply({ embeds: [warnE(
        `Ngươi cần ít nhất **${getCG(td.min_canh_gioi).ten}** để săn tier **${td.ten}**!`
      )]});
    }

    // Kiểm tra cooldown
    const cd = Number(player.san_linh_thu_cd || 0);
    if (Date.now() < cd) {
      return msg.reply({ embeds: [warnE(`⏱️ Hồi chiêu săn linh thú: hết CD <t:${Math.floor(cd / 1000)}:R> (lúc <t:${Math.floor(cd / 1000)}:t>)!`)] });
    }

    // Tạo session
    const cs = tinhCS(player);
    const session = {
      leaderId:    userId,
      channelId:   msg.channel.id,
      guildId:     msg.guild?.id,
      tier,
      members: [{
        id:      userId,
        name:    msg.author.username,
        hp:      cs.hp_max,
        hp_max:  cs.hp_max,
        atk:     cs.atk,
        def:     cs.def,
        data:    player,
        action:  null,
        bp_cd:   {},
        action_cd: { the: 0, hoikhi: 0 },
        frozen: 0, stun: 0, burn: 0,
        atk_reduced: 0, def_reduced: 0,
        alive:   true,
        defending: false, shield_mult: null,
      }],
      beast:       null,
      status:      'waiting',
      turn:        0,
      max_turns:   td.max_turns,
      log:         [],
      invite_msg:  null,
      combat_msg:  null,
      channel:     msg.channel,
      resolving:   false,
      _timeout:    null,
    };

    SAN_SESSIONS.set(userId, session);
    SAN_MEMBER_INDEX.set(userId, userId);

    session.invite_msg = await msg.reply({
      embeds:     [makeInviteEmbed(session)],
      components: [makeInviteRow(userId, 1)],
    });

    scheduleWaitTimeout(session);
    return;
  }

  // ── Tham gia phiên ──────────────────────────────────────────────────────
  if (sub === 'tham' || sub === 'join') {
    if (mySession) return msg.reply({ embeds: [warnE('Ngươi đang trong một phiên săn!')] });

    const player = await getPlayer(userId, msg.author.username);
    if (!player) return msg.reply({ embeds: [errE('Chưa có hồ sơ!')] });

    // Tìm phiên đang chờ trong channel này
    let targetSession = null;
    for (const [lid, sess] of SAN_SESSIONS) {
      if (sess.channelId === msg.channel.id && sess.status === 'waiting') {
        targetSession = sess;
        break;
      }
    }

    if (!targetSession) return msg.reply({ embeds: [warnE('Không có phiên săn nào đang chờ trong kênh này!')] });
    if (targetSession.members.length >= MAX_TEAM_SIZE) return msg.reply({ embeds: [warnE('Đội đã đầy (3/3)!')] });

    const td = LINH_THU_TIERS[targetSession.tier];
    if (player.canh_gioi < td.min_canh_gioi) {
      return msg.reply({ embeds: [warnE(`Cần ít nhất **${getCG(td.min_canh_gioi).ten}** để tham gia tier **${td.ten}**!`)] });
    }

    const cs = tinhCS(player);
    targetSession.members.push({
      id:      userId,
      name:    msg.author.username,
      hp:      cs.hp_max,
      hp_max:  cs.hp_max,
      atk:     cs.atk,
      def:     cs.def,
      data:    player,
      action:  null,
      bp_cd:   {},
      action_cd: { the: 0, hoikhi: 0 },
      frozen: 0, stun: 0, burn: 0,
      atk_reduced: 0, def_reduced: 0,
      alive:   true,
      defending: false, shield_mult: null,
    });
    SAN_MEMBER_INDEX.set(userId, targetSession.leaderId);

    await msg.reply({ embeds: [okE(`**${msg.author.username}** đã tham gia đội săn!`)] });
    if (targetSession.invite_msg) {
      await targetSession.invite_msg.edit({
        embeds: [makeInviteEmbed(targetSession)],
        components: [makeInviteRow(targetSession.leaderId, targetSession.members.length)],
      }).catch(() => {});
    }
    return;
  }
});

// ── Exports cho sanHandler.js ─────────────────────────────────────────────────
module.exports = {
  SAN_SESSIONS,
  SAN_MEMBER_INDEX,
  makeInviteEmbed,
  makeInviteRow,
  makeInviteRowDisabled,
  makeCombatEmbed,
  makeCombatRow,
  scheduleWaitTimeout,
  scheduleTurnTimeout,
  _cleanupSession,
  _startCombat,
  _resolveTurn,
  endSanCombat,
  BP_COMBAT,
  LINH_THU_TIERS,
};
