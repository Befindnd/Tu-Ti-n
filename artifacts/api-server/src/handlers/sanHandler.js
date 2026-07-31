'use strict';
/**
 * handlers/sanHandler.js
 * Xử lý button interactions cho tính năng Săn Linh Thú.
 *
 * Button ID format:
 *   san_join_<leaderId>    — tham gia đội
 *   san_leave_<leaderId>   — rời đội
 *   san_start_<leaderId>   — bắt đầu săn (đội trưởng)
 *   san_cancel_<leaderId>  — hủy phiên (đội trưởng)
 *   san_danh_<leaderId>    — tấn công
 *   san_the_<leaderId>     — hộ thể
 *   san_biphap_<leaderId>  — chọn bí pháp (mở select menu)
 *   san_hoikhi_<leaderId>  — hồi linh khí
 *   san_chay_<leaderId>    — rút lui
 *   san_bp_pick_<leaderId> — select menu bí pháp
 */
const {
  EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { getPlayer }    = require('../db/players');
const { tinhCS, getCG, okE, warnE, errE } = require('../utils');
const { BI_PHAP, CANH_GIOI } = require('../data');
const {
  SAN_SESSIONS, SAN_MEMBER_INDEX,
  makeInviteEmbed, makeInviteRow, makeInviteRowDisabled,
  makeCombatEmbed, makeCombatRow,
  scheduleWaitTimeout, scheduleTurnTimeout,
  _cleanupSession, _startCombat, _resolveTurn,
  LINH_THU_TIERS,
} = require('../commands/san_linh_thu');
const { CE, CEu } = require('../systems/emoji');

const MAX_TEAM_SIZE = 3;

module.exports = function setupSanHandler(client) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    const id     = interaction.customId;
    const userId = interaction.user.id;

    // ── Chỉ xử lý các interaction của Săn Linh Thú ────────────────────────
    if (!id.startsWith('san_')) return;

    // ── Select menu chọn Bí Pháp ─────────────────────────────────────────
    if (interaction.isStringSelectMenu() && id.startsWith('san_bp_pick_')) {
      const leaderId = id.replace('san_bp_pick_', '');
      const session  = SAN_SESSIONS.get(leaderId);

      if (!session || session.status !== 'combat') {
        return interaction.update({ content: '❌ Phiên chiến đấu không còn tồn tại!', components: [] }).catch(() => {});
      }

      const member = session.members.find(m => m.id === userId && m.alive);
      if (!member) {
        return interaction.update({ content: '❌ Ngươi không trong đội này hoặc đã ngã xuống!', components: [] }).catch(() => {});
      }
      if (member.action) {
        return interaction.update({ content: `${CE("cd_timer","⏳")} Đã chọn hành động rồi! Đang chờ đồng đội...`, components: [] }).catch(() => {});
      }

      const bpId  = interaction.values[0];
      const myCD  = member.bp_cd || {};
      if ((myCD[bpId] || 0) > 0) {
        const bp = BI_PHAP.find(b => b.id === bpId);
        return interaction.update({ content: `${CE("cd_timer","⏳")} **${bp?.ten || bpId}** đang hồi chiêu (còn ${myCD[bpId]} lượt)!`, components: [] }).catch(() => {});
      }

      const bp = BI_PHAP.find(b => b.id === bpId);
      member.action = { type: 'bi_phap', bp_id: bpId };

      const allChosen = session.members.filter(m => m.alive).every(m => !!m.action);
      if (allChosen) {
        await interaction.update({ content: `✅ Thi triển **${bp?.ten || bpId}**! Đang xử lý...`, components: [] }).catch(() => {});
        if (!session.resolving) await _resolveTurn(session);
      } else {
        const waiting = session.members.filter(m => m.alive && !m.action).map(m => `**${m.name}**`).join(', ');
        await interaction.update({ content: `✅ Thi triển **${bp?.ten || bpId}**! Đang chờ ${waiting}...`, components: [] }).catch(() => {});
        if (session.combat_msg) {
          await session.combat_msg.edit({
            embeds:     [makeCombatEmbed(session)],
            components: [makeCombatRow(leaderId)],
          }).catch(() => {});
        }
      }
      return;
    }

    if (!interaction.isButton()) return;

    // ── Tham Gia ──────────────────────────────────────────────────────────
    if (id.startsWith('san_join_')) {
      const leaderId = id.replace('san_join_', '');
      const session  = SAN_SESSIONS.get(leaderId);

      if (!session || session.status !== 'waiting') {
        return interaction.reply({ content: '❌ Phiên săn không còn tồn tại! Nếu bot vừa khởi động lại, hãy mở phiên mới với `-san mo`.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      if (SAN_MEMBER_INDEX.has(userId)) {
        return interaction.reply({ content: '❌ Ngươi đang trong một phiên săn khác!', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      if (session.members.find(m => m.id === userId)) {
        return interaction.reply({ content: '❌ Ngươi đã ở trong đội rồi! Dùng nút **Rời Đội** nếu muốn rời.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      if (session.members.length >= MAX_TEAM_SIZE) {
        return interaction.reply({ content: '❌ Đội đã đầy (3/3)!', flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      const player = await getPlayer(userId, interaction.user.username);
      if (!player) {
        return interaction.reply({ content: '❌ Chưa có hồ sơ! Gõ `-bat_dau` để tạo.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      const td = LINH_THU_TIERS[session.tier];
      if (player.canh_gioi < td.min_canh_gioi) {
        return interaction.reply({
          content: `❌ Cần ít nhất **${getCG(td.min_canh_gioi).ten}** để tham gia tier **${td.ten}**!`,
          flags:   MessageFlags.Ephemeral,
        }).catch(() => {});
      }

      const cs = tinhCS(player);
      session.members.push({
        id:      userId,
        name:    interaction.user.username,
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
      SAN_MEMBER_INDEX.set(userId, leaderId);

      await interaction.update({
        embeds:     [makeInviteEmbed(session)],
        components: [makeInviteRow(leaderId, session.members.length)],
      }).catch(() => {});
      return;
    }

    // ── Rời Đội ──────────────────────────────────────────────────────────
    if (id.startsWith('san_leave_')) {
      const leaderId = id.replace('san_leave_', '');
      const session  = SAN_SESSIONS.get(leaderId);

      if (!session || session.status !== 'waiting') {
        return interaction.reply({ content: '❌ Phiên săn không còn tồn tại! Nếu bot vừa khởi động lại, hãy mở phiên mới với `-san mo`.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      if (userId === leaderId) {
        return interaction.reply({ content: '❌ Đội trưởng không thể rời! Bấm **Hủy** để giải tán đội.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      if (!session.members.find(m => m.id === userId)) {
        return interaction.reply({ content: '❌ Ngươi không ở trong đội này!', flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      session.members = session.members.filter(m => m.id !== userId);
      SAN_MEMBER_INDEX.delete(userId);

      await interaction.update({
        embeds:     [makeInviteEmbed(session)],
        components: [makeInviteRow(leaderId, session.members.length)],
      }).catch(() => {});
      return;
    }

    // ── Bắt Đầu Săn ──────────────────────────────────────────────────────
    if (id.startsWith('san_start_')) {
      const leaderId = id.replace('san_start_', '');
      const session  = SAN_SESSIONS.get(leaderId);

      if (!session || session.status !== 'waiting') {
        return interaction.reply({ content: '❌ Phiên săn không còn tồn tại!', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      if (userId !== leaderId) {
        return interaction.reply({ content: '❌ Chỉ đội trưởng mới có thể bắt đầu!', flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      await interaction.deferUpdate().catch(() => {});
      await _startCombat(session, interaction);
      return;
    }

    // ── Hủy Phiên ─────────────────────────────────────────────────────────
    if (id.startsWith('san_cancel_')) {
      const leaderId = id.replace('san_cancel_', '');
      const session  = SAN_SESSIONS.get(leaderId);

      if (!session) {
        return interaction.reply({ content: '❌ Phiên săn không còn tồn tại!', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      if (userId !== leaderId) {
        return interaction.reply({ content: '❌ Chỉ đội trưởng mới có thể hủy!', flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      _cleanupSession(leaderId);
      await interaction.update({
        embeds:     [new EmbedBuilder().setColor(0x999999).setDescription('❌ Phiên săn đã bị hủy!')],
        components: [makeInviteRowDisabled(leaderId)],
      }).catch(() => {});
      return;
    }

    // ─── Các nút chiến đấu — kiểm tra chung ─────────────────────────────
    if (
      id.startsWith('san_danh_') || id.startsWith('san_the_') ||
      id.startsWith('san_biphap_') || id.startsWith('san_hoikhi_') ||
      id.startsWith('san_chay_')
    ) {
      const leaderId = id.split('_').slice(2).join('_');  // phần sau san_<action>_
      const session  = SAN_SESSIONS.get(leaderId);

      if (!session || session.status !== 'combat') {
        // Tắt nút trên message cũ (bot có thể đã restart, session bị mất)
        await interaction.update({
          components: [makeCombatRow(leaderId, true)],
        }).catch(() => {
          interaction.reply({ content: '❌ Phiên chiến đấu đã kết thúc hoặc bot vừa khởi động lại!', flags: MessageFlags.Ephemeral }).catch(() => {});
        });
        return;
      }

      const member = session.members.find(m => m.id === userId && m.alive);
      if (!member) {
        return interaction.reply({ content: '❌ Ngươi không trong đội này hoặc đã ngã xuống!', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      if (member.action) {
        return interaction.reply({ content: `${CE("cd_timer","⏳")} Đã chọn rồi! Đang chờ đồng đội ra chiêu...`, flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      // ── Tấn Công ────────────────────────────────────────────────────────
      if (id.startsWith('san_danh_')) {
        member.action = { type: 'danh' };
        const allChosen = session.members.filter(m => m.alive).every(m => !!m.action);
        if (allChosen) {
          await interaction.reply({ content: '⚔️ Tấn công! Đang xử lý lượt...', flags: MessageFlags.Ephemeral }).catch(() => {});
          if (!session.resolving) await _resolveTurn(session);
        } else {
          const waiting = session.members.filter(m => m.alive && !m.action).map(m => `**${m.name}**`).join(', ');
          await interaction.reply({ content: `⚔️ Tấn công! Đang chờ ${waiting}...`, flags: MessageFlags.Ephemeral }).catch(() => {});
          if (session.combat_msg) {
            await session.combat_msg.edit({ embeds: [makeCombatEmbed(session)], components: [makeCombatRow(leaderId)] }).catch(() => {});
          }
        }
        return;
      }

      // ── Hộ Thể ──────────────────────────────────────────────────────────
      if (id.startsWith('san_the_')) {
        if ((member.action_cd.the || 0) > 0) {
          return interaction.reply({ content: `${CE("cd_timer","⏳")} Hộ Thể đang hồi chiêu (còn ${member.action_cd.the} lượt)!`, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        member.action = { type: 'the' };
        const allChosen = session.members.filter(m => m.alive).every(m => !!m.action);
        if (allChosen) {
          await interaction.reply({ content: '🛡️ Hộ Thể! Đang xử lý lượt...', flags: MessageFlags.Ephemeral }).catch(() => {});
          if (!session.resolving) await _resolveTurn(session);
        } else {
          const waiting = session.members.filter(m => m.alive && !m.action).map(m => `**${m.name}**`).join(', ');
          await interaction.reply({ content: `🛡️ Khai Hộ Thể Công! Đang chờ ${waiting}...`, flags: MessageFlags.Ephemeral }).catch(() => {});
          if (session.combat_msg) {
            await session.combat_msg.edit({ embeds: [makeCombatEmbed(session)], components: [makeCombatRow(leaderId)] }).catch(() => {});
          }
        }
        return;
      }

      // ── Hồi Linh Khí ────────────────────────────────────────────────────
      if (id.startsWith('san_hoikhi_')) {
        if ((member.action_cd.hoikhi || 0) > 0) {
          return interaction.reply({ content: `${CE("cd_timer","⏳")} Hồi Linh Khí đang hồi chiêu (còn ${member.action_cd.hoikhi} lượt)!`, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        member.action = { type: 'hoikhi' };
        const allChosen = session.members.filter(m => m.alive).every(m => !!m.action);
        if (allChosen) {
          await interaction.reply({ content: '💫 Hồi Linh Khí! Đang xử lý lượt...', flags: MessageFlags.Ephemeral }).catch(() => {});
          if (!session.resolving) await _resolveTurn(session);
        } else {
          const waiting = session.members.filter(m => m.alive && !m.action).map(m => `**${m.name}**`).join(', ');
          await interaction.reply({ content: `💫 Thu công tụ linh! Đang chờ ${waiting}...`, flags: MessageFlags.Ephemeral }).catch(() => {});
          if (session.combat_msg) {
            await session.combat_msg.edit({ embeds: [makeCombatEmbed(session)], components: [makeCombatRow(leaderId)] }).catch(() => {});
          }
        }
        return;
      }

      // ── Bí Pháp — mở select menu ────────────────────────────────────────
      if (id.startsWith('san_biphap_')) {
        const myBP = (member.data.bi_phap || [])
          .map(bpId => BI_PHAP.find(b => b.id === bpId))
          .filter(Boolean);

        if (myBP.length === 0) {
          return interaction.reply({ content: '❌ Ngươi chưa học bí pháp nào!', flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        const bpCd = member.bp_cd || {};
        const options = myBP.map(bp => {
          const cdLeft = bpCd[bp.id] || 0;
          return new StringSelectMenuOptionBuilder()
            .setValue(bp.id)
            .setLabel(`${bp.ten}${cdLeft > 0 ? ` [CD: ${cdLeft}]` : ''}`)
            .setDescription(bp.mo_ta?.slice(0, 100) || bp.loai || '?')
            .setEmoji(cdLeft > 0 ? CE("cd_timer","⏳") : '✨');
        });

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`san_bp_pick_${leaderId}`)
            .setPlaceholder('Chọn bí pháp thi triển...')
            .addOptions(options),
        );

        return interaction.reply({
          content:    '📜 Chọn bí pháp:',
          components: [row],
          flags:      MessageFlags.Ephemeral,
        }).catch(() => {});
      }

      // ── Rút Lui ─────────────────────────────────────────────────────────
      if (id.startsWith('san_chay_')) {
        // Rút lui: 40% thành công, nếu đội trưởng thì hủy cả phiên
        const escaped = Math.random() < 0.40;
        if (escaped) {
          if (userId === leaderId) {
            // Đội trưởng thoát → hủy cả phiên
            _cleanupSession(leaderId);
            await interaction.reply({ content: '🏳️ Đội trưởng rút lui — phiên săn bị hủy!', flags: MessageFlags.Ephemeral }).catch(() => {});
            if (session.combat_msg) {
              await session.combat_msg.edit({
                embeds:     [new EmbedBuilder().setColor(0x888888).setDescription(`🏳️ **${interaction.user.username}** (đội trưởng) đã rút lui — phiên săn kết thúc!`)],
                components: [makeCombatRow(leaderId, true)],
              }).catch(() => {});
            }
          } else {
            // Thành viên thoát khỏi đội
            member.alive  = false;
            member.action = null;
            SAN_MEMBER_INDEX.delete(userId);
            session.members = session.members.filter(m => m.id !== userId);
            await interaction.reply({ content: '🏳️ Ngươi đã rút lui khỏi trận chiến!', flags: MessageFlags.Ephemeral }).catch(() => {});

            // Kiểm tra còn ai không
            if (session.members.filter(m => m.alive).length === 0) {
              _cleanupSession(leaderId);
            } else {
              // Nếu tất cả người còn lại đã chọn hành động → tiến hành giải lượt ngay
              const allChosen = session.members.filter(m => m.alive).every(m => !!m.action);
              if (allChosen && !session.resolving) {
                await _resolveTurn(session);
              } else if (session.combat_msg) {
                await session.combat_msg.edit({ embeds: [makeCombatEmbed(session)], components: [makeCombatRow(leaderId)] }).catch(() => {});
              }
            }
          }
        } else {
          member.action = { type: 'danh' };  // thất bại → tự động tấn công
          const allChosen = session.members.filter(m => m.alive).every(m => !!m.action);
          await interaction.reply({ content: `🏳️ Cố thoát nhưng bị ngăn cản! Tự động tấn công...`, flags: MessageFlags.Ephemeral }).catch(() => {});
          if (allChosen && !session.resolving) await _resolveTurn(session);
          else if (session.combat_msg) {
            await session.combat_msg.edit({ embeds: [makeCombatEmbed(session)], components: [makeCombatRow(leaderId)] }).catch(() => {});
          }
        }
        return;
      }
    }
  });
};
