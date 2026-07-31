'use strict';
const {
  EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const {
  COMBAT_SESSIONS, wasRecentlyEnded, resolveCombatTurn, endCombat,
  scheduleTurnTimeout, applyCombatStats,
  makeCombatEmbed, makePVPCombatRow, makePVPInviteRowDisabled,
  BP_COMBAT,
} = require('../game/combat');
const { BI_PHAP } = require('../data');
const { getPlayer } = require('../db/players');
const { logger } = require('../utils/logger');
const { CE, CEu } = require('../systems/emoji');
const log = logger.child('pvpHandler');

module.exports = function setupPVPHandler(client) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    const id = interaction.customId;
    const userId = interaction.user.id;
    try {

    if (interaction.isStringSelectMenu() && id.startsWith('pvp_bp_pick_')) {
      const session = COMBAT_SESSIONS.get(userId);
      if (!session || session.pending_accept || session.ended) {
        const msg = (session || wasRecentlyEnded(userId))
          ? '✅ Trận chiến vừa kết thúc! Xem kết quả bên trên.'
          : '❌ Không có trận chiến nào đang diễn ra!';
        return interaction.update({ content: msg, components: [] }).catch(() => {});
      }
      const isP1 = session.p1_id === userId;
      if (!isP1 && session.p2_id !== userId)
        return interaction.update({ content: '❌ Ngươi không tham gia trận này!', components: [] }).catch(() => {});

      const myAction  = isP1 ? 'p1_action' : 'p2_action';
      const oppAction = isP1 ? 'p2_action' : 'p1_action';
      const oppName   = isP1 ? session.p2_name : session.p1_name;
      if (session[myAction])
        return interaction.update({ content: `${CE("cd_timer","⏳")} Đã chọn rồi! Đang chờ **${oppName}** ra chiêu...`, components: [] }).catch(() => {});

      const bpId = interaction.values[0];
      const myCD = isP1 ? session.p1_bp_cd || {} : session.p2_bp_cd || {};
      if ((myCD[bpId] || 0) > 0) {
        const bp = BI_PHAP.find(b => b.id === bpId);
        return interaction.update({ content: `${CE("cd_timer","⏳")} **${bp?.ten || bpId}** vẫn đang hồi chiêu (còn ${myCD[bpId]} lượt)!`, components: [] }).catch(() => {});
      }

      const bp = BI_PHAP.find(b => b.id === bpId);
      session[myAction] = { type: 'bi_phap', bp_id: bpId };

      if (session[oppAction]) {
        if (session.resolving)
          return interaction.update({ content: `${CE("cd_timer","⏳")} Đang xử lý lượt đánh, xin chờ...`, components: [] }).catch(() => {});
        session.resolving = true;
        await interaction.update({ content: `✅ Thi triển **${bp?.ten || bpId}**! Đang xử lý...`, components: [] }).catch(() => {});
        const result = await resolveCombatTurn(session);
        const ch = session.channel || interaction.channel;
        if (result.done) {
          await endCombat(session, ch);
        } else {
          session.resolving = false;
          if (session.combat_msg) {
            await session.combat_msg.edit({ embeds: [makeCombatEmbed(session, result.tl)], components: [makePVPCombatRow(session.p1_id)] }).catch(() => {});
          } else {
            session.combat_msg = await ch.send({ embeds: [makeCombatEmbed(session, result.tl)], components: [makePVPCombatRow(session.p1_id)] });
          }
          scheduleTurnTimeout(session);
        }
      } else {
        if (session.combat_msg) {
          await session.combat_msg.edit({ embeds: [makeCombatEmbed(session)], components: [makePVPCombatRow(session.p1_id)] }).catch(() => {});
        }
        await interaction.update({ content: `✅ Thi triển **${bp?.ten || bpId}**! Đang chờ **${oppName}** ra chiêu... ${CE("cd_timer","⏳")}`, components: [] }).catch(() => {});
      }
      return;
    }

    if (!interaction.isButton()) return;

    if (id.startsWith('pvp_nhan_') || id.startsWith('pvp_tuchoi_')) {
      const sessionKey = id.replace(/^pvp_(nhan|tuchoi)_/, '');
      const session = COMBAT_SESSIONS.get(sessionKey);
      if (!session || !session.pending_accept)
        return interaction.reply({ content: '⏰ Lời thách đấu đã hết hạn!', flags: MessageFlags.Ephemeral }).catch(() => {});

      if (id.startsWith('pvp_tuchoi_')) {
        if (userId !== session.p2_id && userId !== session.p1_id)
          return interaction.reply({ content: '❌ Đây không phải lời mời của ngươi!', flags: MessageFlags.Ephemeral }).catch(() => {});
        if (session.accept_timeout) clearTimeout(session.accept_timeout);
        COMBAT_SESSIONS.delete(session.p1_id);
        COMBAT_SESSIONS.delete(session.p2_id);
        await interaction.update({ components: [makePVPInviteRowDisabled(sessionKey)] }).catch(() => {});
        await interaction.channel.send({
          embeds: [new EmbedBuilder().setColor(9807270).setDescription(`**${interaction.user.username}** đã từ chối lời thách đấu của **${session.p1_name}**!`)],
        }).catch(() => {});
        return;
      }

      if (userId !== session.p2_id)
        return interaction.reply({ content: '❌ Lời mời này không dành cho ngươi!', flags: MessageFlags.Ephemeral }).catch(() => {});

      await interaction.update({ components: [makePVPInviteRowDisabled(sessionKey)] }).catch(() => {});
      if (session.accept_timeout) { clearTimeout(session.accept_timeout); session.accept_timeout = null; }
      session.pending_accept = false;

      const [p1, p2] = await Promise.all([getPlayer(session.p1_id), getPlayer(userId)]);
      if (!p1 || !p2) {
        COMBAT_SESSIONS.delete(session.p1_id);
        COMBAT_SESSIONS.delete(session.p2_id);
        await interaction.channel.send({ content: '❌ Lỗi tải dữ liệu người chơi! Trận chiến bị hủy.' }).catch(() => {});
        return;
      }
      applyCombatStats(session, p1, p2, interaction.channel);
      session.combat_msg = await interaction.channel.send({ embeds: [makeCombatEmbed(session)], components: [makePVPCombatRow(session.p1_id)] });
      scheduleTurnTimeout(session);
      return;
    }

    if (id.startsWith('pvp_biphap_')) {
      const session = COMBAT_SESSIONS.get(userId);
      if (!session || session.pending_accept) {
        const p1Id = id.replace('pvp_biphap_', '');
        await interaction.update({ components: [makePVPCombatRow(p1Id, true)] }).catch(() => {
          const msg = wasRecentlyEnded(userId)
            ? '✅ Trận chiến vừa kết thúc! Xem kết quả bên trên.'
            : '❌ Phiên chiến đấu đã kết thúc hoặc bot vừa khởi động lại!';
          interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
        });
        return;
      }
      if (session.ended)
        return interaction.reply({ content: '✅ Trận chiến vừa kết thúc!', flags: MessageFlags.Ephemeral }).catch(() => {});
      const isP1 = session.p1_id === userId;
      if (!isP1 && session.p2_id !== userId)
        return interaction.reply({ content: '❌ Ngươi không tham gia trận này!', flags: MessageFlags.Ephemeral }).catch(() => {});
      const myAction = isP1 ? 'p1_action' : 'p2_action';
      const oppName  = isP1 ? session.p2_name : session.p1_name;
      if (session[myAction])
        return interaction.reply({ content: `${CE("cd_timer","⏳")} Đã chọn rồi! Đang chờ **${oppName}** ra chiêu...`, flags: MessageFlags.Ephemeral }).catch(() => {});

      const player = await getPlayer(userId);
      const myBP = player?.bi_phap || [];
      if (!myBP.length)
        return interaction.reply({ content: `📜 Ngươi chưa học Bí Pháp nào!\n${CE('tip_icon','💡')} Dùng \`-bp\` → tab **Có Thể Học** hoặc học qua \`-linh_ngo ke_thua\`.`, flags: MessageFlags.Ephemeral }).catch(() => {});

      const myCD = isP1 ? session.p1_bp_cd || {} : session.p2_bp_cd || {};
      const options = myBP.map(bpId => {
        const bp     = BI_PHAP.find(b => b.id === bpId);
        const combat = BP_COMBAT[bpId];
        const cd     = myCD[bpId] || 0;
        const cdText = cd > 0 ? ` [CD: ${cd} lượt]` : '';
        const desc = combat
          ? combat.type === 'atk'    ? `Công Kích ×${combat.mult}`
            : combat.type === 'shield' ? `Hộ Thể -${Math.round(100 * combat.mult)}% tổn thương`
              : `Hồi Phục ${Math.round(100 * combat.mult)}% HP`
          : 'Bí Pháp';
        return new StringSelectMenuOptionBuilder()
          .setLabel(`${bp?.ten || bpId}${cdText}`)
          .setDescription(`${desc}${cd > 0 ? ' — Hồi chiêu!' : ' — Sẵn sàng!'}`)
          .setValue(bpId)
          .setEmoji(cd > 0 ? CE("cd_timer","⏳") : '✨');
      });

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`pvp_bp_pick_${session.p1_id}`)
        .setPlaceholder('Chọn Bí Pháp để thi triển...')
        .addOptions(options);

      return interaction.reply({
        content:    '📜 **Bí Pháp — Thi Triển:**',
        components: [new ActionRowBuilder().addComponents(menu)],
        flags:      MessageFlags.Ephemeral,
      }).catch(() => {});
    }

    if (id.startsWith('pvp_danh_') || id.startsWith('pvp_the_') || id.startsWith('pvp_hoikhi_') || id.startsWith('pvp_thua_')) {
      const session = COMBAT_SESSIONS.get(userId);
      if (!session || session.pending_accept) {
        const p1Id = id.split('_').slice(2).join('_');
        await interaction.update({ components: [makePVPCombatRow(p1Id, true)] }).catch(() => {
          const msg = wasRecentlyEnded(userId)
            ? '✅ Trận chiến vừa kết thúc! Xem kết quả bên trên.'
            : '❌ Phiên chiến đấu đã kết thúc hoặc bot vừa khởi động lại!';
          interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
        });
        return;
      }
      if (session.ended)
        return interaction.reply({ content: '✅ Trận chiến vừa kết thúc! Xem kết quả bên trên.', flags: MessageFlags.Ephemeral }).catch(() => {});

      const isP1 = session.p1_id === userId;
      if (!isP1 && session.p2_id !== userId)
        return interaction.reply({ content: '❌ Ngươi không tham gia trận này!', flags: MessageFlags.Ephemeral }).catch(() => {});

      const myAction  = isP1 ? 'p1_action' : 'p2_action';
      const oppAction = isP1 ? 'p2_action' : 'p1_action';
      const oppName   = isP1 ? session.p2_name : session.p1_name;
      if (session[myAction])
        return interaction.reply({ content: `${CE("cd_timer","⏳")} Đã chọn rồi! Đang chờ **${oppName}** ra chiêu...`, flags: MessageFlags.Ephemeral }).catch(() => {});

      let actionType;
      if (id.startsWith('pvp_danh_'))        actionType = 'danh';
      else if (id.startsWith('pvp_the_'))    actionType = 'phong_thu';
      else if (id.startsWith('pvp_hoikhi_')) actionType = 'hoi_khi';
      else                                   actionType = 'chay';

      const myCD = isP1 ? session.p1_action_cd : session.p2_action_cd;
      if (actionType === 'phong_thu' && (myCD.phong_thu || 0) > 0)
        return interaction.reply({ content: `${CE("cd_timer","⏳")} **Hộ Thể** đang hồi chiêu! Còn **${myCD.phong_thu} lượt** nữa.`, flags: MessageFlags.Ephemeral }).catch(() => {});
      if (actionType === 'hoi_khi' && (myCD.hoi_khi || 0) > 0)
        return interaction.reply({ content: `${CE("cd_timer","⏳")} **Hồi Linh Khí** đang hồi chiêu! Còn **${myCD.hoi_khi} lượt** nữa.`, flags: MessageFlags.Ephemeral }).catch(() => {});

      const actionNames = { danh: '⚔️ Tấn Công', phong_thu: '🔰 Hộ Thể', hoi_khi: '💫 Hồi Linh Khí', chay: '🏳️ Đầu Hàng' };
      session[myAction] = { type: actionType };

      if (session[oppAction]) {
        if (session.resolving)
          return interaction.reply({ content: `${CE("cd_timer","⏳")} Đang xử lý lượt đánh, xin chờ...`, flags: MessageFlags.Ephemeral }).catch(() => {});
        session.resolving = true;
        await interaction.deferUpdate().catch(() => {});
        const result = await resolveCombatTurn(session);
        const ch = session.channel || interaction.channel;
        if (result.done) {
          await endCombat(session, ch);
        } else {
          session.resolving = false;
          if (session.combat_msg) {
            await session.combat_msg.edit({ embeds: [makeCombatEmbed(session, result.tl)], components: [makePVPCombatRow(session.p1_id)] }).catch(() => {});
          } else {
            session.combat_msg = await ch.send({ embeds: [makeCombatEmbed(session, result.tl)], components: [makePVPCombatRow(session.p1_id)] });
          }
          scheduleTurnTimeout(session);
        }
      } else {
        if (session.combat_msg) {
          await session.combat_msg.edit({ embeds: [makeCombatEmbed(session)], components: [makePVPCombatRow(session.p1_id)] }).catch(() => {});
        }
        await interaction.reply({ content: `✅ Đã chọn **${actionNames[actionType]}**! Đang chờ **${oppName}** ra chiêu... ${CE("cd_timer","⏳")}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      return;
    }
    } catch (err) {
      log.error('Lỗi xử lý interaction:', err?.message || err);
      const _errSession = COMBAT_SESSIONS.get(userId);
      if (_errSession) {
        if (_errSession.resolving) {
          _errSession.resolving = false;
          _errSession.p1_action = null;
          _errSession.p2_action = null;
        }
        // If combat has not started yet (no combat_msg), session is stuck in limbo.
        // Clean it up so both players are not permanently locked out of PvP.
        if (!_errSession.ended && !_errSession.pending_accept && !_errSession.combat_msg) {
          log.warn('Session stuck pre-combat — cleaning up p1=%s p2=%s', _errSession.p1_id, _errSession.p2_id);
          COMBAT_SESSIONS.delete(_errSession.p1_id);
          COMBAT_SESSIONS.delete(_errSession.p2_id);
        }
      }
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Có lỗi xảy ra, thử lại sau!', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
      } catch {}
    }
  });
};
