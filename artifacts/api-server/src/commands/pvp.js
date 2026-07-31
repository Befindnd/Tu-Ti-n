'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer, awardBiPhap, awardLinhThao } = require('../db/players');
const { CE } = require('../systems/emoji');
const {
  DAI_CANH_GIOI, CANH_GIOI, NGO_TINH_PHAM, getDaiCanhGioiIndex, getDCGDiff,
  LINH_CAN, LINH_CAN_MO_TA, HUYET_MACH, CO_THU,
  CONG_PHAP, BI_PHAP, NGHE, VU_KHI, BAO_BOI, LINH_THAO,
  NGOC_GIAN_DATA, DAN_DUOC, DAN_PHAM, REN_LUYEN_CAP, calcDanTyLe, PHU_LUC_DATA,
  THIEN_KIEP_KQ, THIEN_KIEP_NGUONG, getThienKiepLoai,
  PHONG_THUY_VAN, DONG_PHU, TRUYEN_THUA_LIST,
  TONG_MON_CAP_BAC, TONG_MON, CO_DUYEN_EVENTS,
  BI_CANH_SESSIONS, BI_CANH_CD_H, BI_CANH_LUA_CHON,
  NHIEM_VU_LIST,
  CP_GIA, BP_GIA,
  CG_EMOJI, getNgoTinh, getKhiVanBonus, getNhanQua, getTT,
} = require('../data');
const {
  getDailyMissionState,
  BAG_WEIGHTS, getDanKg, getBagCapacity, calcBagWeight, canAddToBag,
  DONATE_DATA, findDonateGoi, buildDonateEmbed, buildDonateButtons, buildDonateCatSelect,
  fmt, getCG, pBar, fTime, cdRem, cdRemMin, cdTsMin, embedClr,
  randomLC, randomHM, getTamMa,
  SEP, SEP2, SEP3, errE, warnE, okE,
  CHIEU_THUC, getChieu,
  tinhCS, calcEXP_active,
  COMMANDS, reg, RATE_LIMIT, checkRateLimit,
  DT_TEN, DT_HIEU, PHI_TU_CHUA, PHI_DUOC_SU, CD_TU_H, CD_DS_TU_H, CD_DS_NGUOI,
} = require('../utils');
const {
  COMBAT_SESSIONS, RECENTLY_ENDED, markRecentlyEnded, wasRecentlyEnded,
  BP_COMBAT, hpBar, hpHeart, makeCombatEmbed,
  makePVPInviteRow, makePVPInviteRowDisabled, makePVPCombatRow,
  resolveCombatTurn, endCombat, scheduleTurnTimeout, applyCombatStats,
} = require('../game/combat');
const { checkNgheDotPha } = require('./cultivation');
const ADMIN_ID = process.env.ADMIN_ID || '';

// ── -pvp: Thách đấu tỷ thí hoặc chọn hành động trong trận ────────────────
reg('pvp', ['ty_thi', 'dau'], async (msg, args) => {
  const userId = msg.author.id;
  const subCmd = (args[0] || '').toLowerCase();
  const channel = msg.channel;

  // ── Chấp nhận lời thách đấu ───────────────────────────────────────────
  if (subCmd === 'nhan') {
    const inviteSession = COMBAT_SESSIONS.get(userId);
    if (!inviteSession || !inviteSession.pending_accept || inviteSession.p2_id !== userId)
      return msg.reply({ embeds: [warnE('Không có lời thách đấu nào dành cho ngươi!')] });

    if (inviteSession.accept_timeout) {
      clearTimeout(inviteSession.accept_timeout);
      inviteSession.accept_timeout = null;
    }
    inviteSession.pending_accept = false;

    const [p1, p2] = await Promise.all([getPlayer(inviteSession.p1_id), getPlayer(userId)]);
    if (!p1 || !p2) {
      COMBAT_SESSIONS.delete(inviteSession.p1_id);
      COMBAT_SESSIONS.delete(inviteSession.p2_id);
      return msg.reply({ embeds: [errE('Lỗi tải dữ liệu người chơi! Trận chiến bị hủy.')] });
    }

    applyCombatStats(inviteSession, p1, p2, channel);
    inviteSession.combat_msg = await msg.reply({
      embeds: [makeCombatEmbed(inviteSession)],
      components: [makePVPCombatRow(inviteSession.p1_id)],
    });
    scheduleTurnTimeout(inviteSession);
    return;
  }

  // ── Từ chối lời thách đấu ─────────────────────────────────────────────
  if (subCmd === 'tu_choi') {
    const inviteSession = COMBAT_SESSIONS.get(userId);
    if (!inviteSession || !inviteSession.pending_accept || inviteSession.p2_id !== userId)
      return msg.reply({ embeds: [warnE('Không có lời thách đấu nào để từ chối!')] });

    if (inviteSession.accept_timeout) clearTimeout(inviteSession.accept_timeout);
    if (inviteSession.invite_msg) {
      inviteSession.invite_msg.edit({ components: [makePVPInviteRowDisabled(inviteSession.p1_id)] }).catch(() => {});
    }
    COMBAT_SESSIONS.delete(inviteSession.p1_id);
    COMBAT_SESSIONS.delete(inviteSession.p2_id);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(9807270)
          .setDescription(`**${msg.author.username}** từ chối lời thách đấu của **${inviteSession.p1_name}**.`),
      ],
    });
  }

  // ── Đang trong trận — chọn hành động ─────────────────────────────────
  const activeSession = COMBAT_SESSIONS.get(userId);
  if (activeSession && !activeSession.pending_accept) {
    const session = activeSession;
    if (session.ended)
      return msg.reply({ embeds: [warnE('Trận chiến vừa kết thúc! Xem kết quả bên trên.')] });

    const isP1       = session.p1_id === userId;
    const myActionKey  = isP1 ? 'p1_action' : 'p2_action';
    const oppActionKey = isP1 ? 'p2_action' : 'p1_action';
    const oppName      = isP1 ? session.p2_name : session.p1_name;

    if (session[myActionKey])
      return msg.reply({ embeds: [warnE(`Đã chọn hành động rồi! Đang chờ **${oppName}**... ${CE("cd_timer","⏳")}`)] });

    // Xác định hành động
    let action = null;
    if (subCmd && subCmd !== 'danh') {
      if (subCmd === 'bao_kich') {
        action = { type: 'bao_kich' };
      } else if (subCmd === 'phong_thu') {
        const myCD = isP1 ? session.p1_action_cd : session.p2_action_cd;
        if ((myCD.phong_thu || 0) > 0)
          return msg.reply({ embeds: [warnE(`**Hộ Thể** đang hồi chiêu! Còn **${myCD.phong_thu} lượt** nữa.`)] });
        action = { type: 'phong_thu' };
      } else if (subCmd === 'hoi_khi') {
        const myCD = isP1 ? session.p1_action_cd : session.p2_action_cd;
        if ((myCD.hoi_khi || 0) > 0)
          return msg.reply({ embeds: [warnE(`**Hồi Linh Khí** đang hồi chiêu! Còn **${myCD.hoi_khi} lượt** nữa.`)] });
        action = { type: 'hoi_khi' };
      } else if (subCmd === 'chay') {
        action = { type: 'chay' };
      } else if (subCmd === 'bi_phap') {
        const bpId = (args[1] || '').toLowerCase();
        if (!bpId) return msg.reply({ embeds: [errE('Cú pháp: `-pvp bi_phap <id>`')] });
        if (!BP_COMBAT[bpId]) return msg.reply({ embeds: [errE(`Bí Pháp \`${bpId}\` không tồn tại!`)] });
        const myPlayerData = isP1 ? session.p1_data : session.p2_data;
        if (!(myPlayerData.bi_phap || []).includes(bpId))
          return msg.reply({ embeds: [errE(`Ngươi chưa học **${BI_PHAP.find(b => b.id === bpId)?.ten || bpId}**!`)] });
        const bpCooldowns = isP1 ? session.p1_bp_cd : session.p2_bp_cd;
        if ((bpCooldowns[bpId] || 0) > 0)
          return msg.reply({ embeds: [warnE(`**${BI_PHAP.find(b => b.id === bpId)?.ten}** đang hồi chiêu! (còn **${bpCooldowns[bpId]}** lượt)`)] });
        action = { type: 'bi_phap', bp_id: bpId };
      } else {
        return msg.reply({ embeds: [errE('Hành động không hợp lệ!\n`danh` · `bao_kich` · `phong_thu` · `hoi_khi` · `bi_phap <id>` · `chay`')] });
      }
    } else {
      action = { type: 'danh' };
    }

    if (session.resolving)
      return msg.reply({ embeds: [warnE('Đang xử lý lượt đánh, xin chờ...')] });

    session[myActionKey] = action;

    // Cả hai đã chọn — giải quyết lượt
    if (session[oppActionKey]) {
      if (session.resolving) {
        session[myActionKey] = null;
        return msg.reply({ embeds: [warnE('Đang xử lý lượt đánh, xin chờ...')] });
      }
      session.resolving = true;

      let turnResult;
      try {
        turnResult = await resolveCombatTurn(session);
      } catch (err) {
        session.resolving = false;
        session[myActionKey] = null;
        session[oppActionKey] = null;
        return msg.reply({ embeds: [errE('Có lỗi xử lý lượt đánh! Thử lại.')] });
      }

      const battleChannel = session.channel || channel;
      if (turnResult.done) {
        await endCombat(session, battleChannel);
      } else {
        session.resolving = false;
        if (session.combat_msg) {
          await session.combat_msg
            .edit({ embeds: [makeCombatEmbed(session, turnResult.tl)], components: [makePVPCombatRow(session.p1_id)] })
            .catch(() => {});
        } else {
          session.combat_msg = await battleChannel.send({
            embeds: [makeCombatEmbed(session, turnResult.tl)],
            components: [makePVPCombatRow(session.p1_id)],
          });
        }
        scheduleTurnTimeout(session);
      }
    } else {
      // Chỉ một người chọn — chờ đối thủ
      if (session.combat_msg) {
        await session.combat_msg
          .edit({ embeds: [makeCombatEmbed(session)], components: [makePVPCombatRow(session.p1_id)] })
          .catch(() => {});
      }
      await msg.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(3447003)
            .setDescription(`✅ Đã chọn! Đang chờ **${oppName}** ra chiêu... ${CE("cd_timer","⏳")}`),
        ],
      });
    }
    return;
  }

  // ── Gửi lời thách đấu mới ─────────────────────────────────────────────
  const targetUser = msg.mentions.users.first();
  if (!targetUser) return msg.reply({ embeds: [errE('Cú pháp: `-pvp @người_chơi`')] });
  if (targetUser.id === userId || targetUser.bot)
    return msg.reply({ embeds: [errE('Không thể thách đấu chính mình hoặc bot!')] });

  const [challenger, targetPlayer] = await Promise.all([getPlayer(userId), getPlayer(targetUser.id)]);
  if (!challenger) return msg.reply({ embeds: [errE('Ngươi chưa tu tiên! Dùng `-bat_dau`.')] });
  if (!targetPlayer) return msg.reply({ embeds: [errE(`**${targetUser.username}** chưa tu tiên!`)] });

  const challengerCDLeft = cdRemMin(challenger.pvp_cd, 15);
  if (challengerCDLeft > 0)
    return msg.reply({ embeds: [warnE(`Vừa tỷ thí xong! Hết CD ${cdTsMin(challenger.pvp_cd, 15)}.`)] });

  const targetCDLeft = cdRemMin(targetPlayer.pvp_cd, 15);
  if (targetCDLeft > 0)
    return msg.reply({ embeds: [warnE(`**${targetUser.username}** vừa tỷ thí xong! Hết CD ${cdTsMin(targetPlayer.pvp_cd, 15)}.`)] });

  if (COMBAT_SESSIONS.has(userId))
    return msg.reply({ embeds: [warnE('Đang trong trận chiến! Dùng `-pvp chay` để rút lui.')] });
  if (COMBAT_SESSIONS.has(targetUser.id))
    return msg.reply({ embeds: [warnE(`**${targetUser.username}** đang trong trận chiến khác!`)] });

  const dcgDiff = getDCGDiff(challenger.canh_gioi, targetPlayer.canh_gioi);
  if (dcgDiff >= 3) {
    const challengerIsStronger = challenger.canh_gioi > targetPlayer.canh_gioi;
    const strongerName  = challengerIsStronger ? msg.author.username : targetUser.username;
    const weakerName    = challengerIsStronger ? targetUser.username : msg.author.username;
    const strongerPlayer = challengerIsStronger ? challenger : targetPlayer;
    const weakerPlayer   = challengerIsStronger ? targetPlayer : challenger;
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(9109504)
          .setDescription(
            `${CE("tia_set","⚡")} **${strongerName}** (${getCG(strongerPlayer.canh_gioi).ten}) vs **${weakerName}** (${getCG(weakerPlayer.canh_gioi).ten})\n` +
            `Chênh **${dcgDiff} đại cảnh giới** — không thể tỷ thí!`,
          ),
      ],
    });
  }

  const maxLevelDiff = challenger.cong_phap === 'diet_tien' || targetPlayer.cong_phap === 'diet_tien' ? 15 : 10;
  if (Math.abs(challenger.canh_gioi - targetPlayer.canh_gioi) > maxLevelDiff)
    return msg.reply({
      embeds: [
        warnE(
          `Chênh lệch cảnh giới quá lớn (tối đa ${maxLevelDiff} tầng)!\n` +
          `**${msg.author.username}**: ${getCG(challenger.canh_gioi).ten}\n` +
          `**${targetUser.username}**: ${getCG(targetPlayer.canh_gioi).ten}`,
        ),
      ],
    });

  const cs1 = tinhCS(challenger);
  const cs2 = tinhCS(targetPlayer);
  const hm1 = HUYET_MACH[challenger.huyet_mach];
  const hm2 = HUYET_MACH[targetPlayer.huyet_mach];

  const newSession = {
    p1_id:   userId,
    p2_id:   targetUser.id,
    p1_name: msg.author.username,
    p2_name: targetUser.username,
    p1_hp: 0, p2_hp: 0,
    p1_hp_max: 0, p2_hp_max: 0,
    p1_atk_mod: 0, p2_atk_mod: 0,
    p1_def_mod: 0, p2_def_mod: 0,
    p1_action: null, p2_action: null,
    p1_bp_cd: {}, p2_bp_cd: {},
    p1_action_cd: { phong_thu: 0, hoi_khi: 0 },
    p2_action_cd: { phong_thu: 0, hoi_khi: 0 },
    p1_data: challenger,
    p2_data: targetPlayer,
    kc1: false, kc2: false,
    turn: 1,
    max_turns: 25,
    log: [],
    pending_accept: true,
    turn_timeout: null,
    accept_timeout: null,
    channel: null,
    combat_msg: null,
    resolving: false,
  };

  COMBAT_SESSIONS.set(userId, newSession);
  COMBAT_SESSIONS.set(targetUser.id, newSession);
  await db('UPDATE players SET pvp_cd=$1 WHERE user_id=$2', [Date.now(), userId]).catch(() => {});

  newSession.invite_msg = await msg.reply({
    content: `<@${targetUser.id}>`,
    embeds: [
      new EmbedBuilder()
        .setTitle(`${CE('tuatk','⚔️')} Thách Đấu Tỷ Thí`)
        .setColor(12597547)
        .setDescription(`<@${targetUser.id}> — nhấn **Chấp Nhận** trong 60 giây`)
        .addFields(
          {
            name: `${CE(hm1?.ce_name || 'hm_pham', hm1?.emoji || '⚔️')} ${msg.author.username}`,
            value: `*${getCG(challenger.canh_gioi).ten}*\n${CE('tuatk','⚔️')} **${fmt(cs1.atk)}** · ${CE('tudef','🛡️')} **${fmt(cs1.def)}** · ${CE('tuhp','💜')} **${fmt(cs1.hp_max)}**`,
            inline: true,
          },
          {
            name: `${CE(hm2?.ce_name || 'hm_pham', hm2?.emoji || '⚔️')} ${targetUser.username}`,
            value: `*${getCG(targetPlayer.canh_gioi).ten}*\n${CE('tuatk','⚔️')} **${fmt(cs2.atk)}** · ${CE('tudef','🛡️')} **${fmt(cs2.def)}** · ${CE('tuhp','💜')} **${fmt(cs2.hp_max)}**`,
            inline: true,
          },
        )
        .setFooter({ text: 'Tấn Công · Bí Pháp · Hộ Thể · Hồi Khí · Đầu Hàng · Tối đa 25 lượt' }),
    ],
    components: [makePVPInviteRow(userId)],
  });

  newSession.accept_timeout = setTimeout(async () => {
    if (COMBAT_SESSIONS.has(userId)) {
      COMBAT_SESSIONS.delete(userId);
      COMBAT_SESSIONS.delete(targetUser.id);
      if (newSession.invite_msg) {
        newSession.invite_msg.edit({ components: [makePVPInviteRowDisabled(userId)] }).catch(() => {});
      }
      channel.send({
        embeds: [warnE(`⏰ **${targetUser.username}** không phản hồi thách đấu trong 60 giây!`)],
      });
    }
  }, 60_000);
});

// ── -cuong_chien: Ép 2 người chơi vào solo ngay lập tức (admin only) ─────
reg('cuong_chien', ['ep_solo', 'bat_solo', 'forcepvp'], async (msg, args) => {
  if (!ADMIN_ID || msg.author.id !== ADMIN_ID)
    return msg.reply({ embeds: [errE('❌ Chỉ Admin mới có thể dùng lệnh này!')] });

  const channel = msg.channel;
  const mentioned = msg.mentions.users;

  if (mentioned.size < 2)
    return msg.reply({ embeds: [errE('Cú pháp: `-cuong_chien @người1 @người2`\nBắt buộc 2 người vào solo ngay, không thể từ chối!')] });

  const [u1, u2] = mentioned.first(2);
  if (u1.id === u2.id || u1.bot || u2.bot)
    return msg.reply({ embeds: [errE('Không hợp lệ! Cần 2 người chơi khác nhau, không phải bot.')] });

  const [p1, p2] = await Promise.all([getPlayer(u1.id, u1.username), getPlayer(u2.id, u2.username)]);
  if (!p1) return msg.reply({ embeds: [errE(`**${u1.username}** chưa tu tiên!`)] });
  if (!p2) return msg.reply({ embeds: [errE(`**${u2.username}** chưa tu tiên!`)] });

  if (COMBAT_SESSIONS.has(u1.id))
    return msg.reply({ embeds: [warnE(`**${u1.username}** đang trong trận chiến khác!`)] });
  if (COMBAT_SESSIONS.has(u2.id))
    return msg.reply({ embeds: [warnE(`**${u2.username}** đang trong trận chiến khác!`)] });

  const hm1 = HUYET_MACH[p1.huyet_mach];
  const hm2 = HUYET_MACH[p2.huyet_mach];
  const cs1 = tinhCS(p1);
  const cs2 = tinhCS(p2);

  const session = {
    p1_id: u1.id, p2_id: u2.id,
    p1_name: u1.username, p2_name: u2.username,
    p1_hp: 0, p2_hp: 0,
    p1_hp_max: 0, p2_hp_max: 0,
    p1_atk_mod: 0, p2_atk_mod: 0,
    p1_def_mod: 0, p2_def_mod: 0,
    p1_action: null, p2_action: null,
    p1_bp_cd: {}, p2_bp_cd: {},
    p1_action_cd: { phong_thu: 0, hoi_khi: 0 },
    p2_action_cd: { phong_thu: 0, hoi_khi: 0 },
    p1_data: p1, p2_data: p2,
    kc1: false, kc2: false,
    turn: 1, max_turns: 25, log: [],
    pending_accept: false,
    turn_timeout: null, accept_timeout: null,
    channel, combat_msg: null, resolving: false,
    forced: true,
  };

  COMBAT_SESSIONS.set(u1.id, session);
  COMBAT_SESSIONS.set(u2.id, session);
  applyCombatStats(session, p1, p2, channel);

  await msg.reply({
    content: `<@${u1.id}> <@${u2.id}>`,
    embeds: [
      new EmbedBuilder()
        .setTitle(`${CE('tuatk','⚔️')} CƯỠNG CHIẾN LỆNH — Không Thể Từ Chối!`)
        .setColor(0xe74c3c)
        .setDescription(
          `🔴 **Admin** đã ban hành **Cưỡng Chiến Lệnh**!\n` +
          `<@${u1.id}> vs <@${u2.id}> — hai người **bắt buộc phải đấu**, không có lựa chọn từ chối!`,
        )
        .addFields(
          {
            name: `${CE(hm1?.ce_name || 'hm_pham', hm1?.emoji || '⚔️')} ${u1.username}`,
            value: `*${getCG(p1.canh_gioi).ten}*\n${CE('tuatk','⚔️')} **${fmt(cs1.atk)}** · ${CE('tudef','🛡️')} **${fmt(cs1.def)}** · ${CE('tuhp','💜')} **${fmt(cs1.hp_max)}**`,
            inline: true,
          },
          {
            name: `${CE(hm2?.ce_name || 'hm_pham', hm2?.emoji || '⚔️')} ${u2.username}`,
            value: `*${getCG(p2.canh_gioi).ten}*\n${CE('tuatk','⚔️')} **${fmt(cs2.atk)}** · ${CE('tudef','🛡️')} **${fmt(cs2.def)}** · ${CE('tuhp','💜')} **${fmt(cs2.hp_max)}**`,
            inline: true,
          },
        )
        .setFooter({ text: 'Trận chiến bắt đầu ngay!' }),
    ],
  });

  session.combat_msg = await channel.send({
    embeds: [makeCombatEmbed(session)],
    components: [makePVPCombatRow(u1.id)],
  });
  scheduleTurnTimeout(session);
});
