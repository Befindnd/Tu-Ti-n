'use strict';
const {
  EmbedBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, ActionRowBuilder, MessageFlags,
} = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer } = require('../db/players');
const { applyGiftcodeRewards, describeRewards } = require('../commands/social');
const antiraid = require('../core/antiraid');
const { logger } = require('../utils/logger');
const log = logger.child('giftcodeHandler');

module.exports = function setupGiftcodeHandler(client) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;
    const id = interaction.customId;

    if (interaction.isButton() && id === 'gc_nhap') {
      try {
        const modal = new ModalBuilder()
          .setCustomId('gc_modal_submit')
          .setTitle('Nhập Giftcode Tu Đạo');
        const input = new TextInputBuilder()
          .setCustomId('gc_code_input')
          .setLabel('Giftcode')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ví dụ: THIENMON2026')
          .setRequired(true)
          .setMaxLength(50);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await interaction.showModal(modal);
      } catch (e) {
        log.error('gc_nhap error:', e?.message || e);
      }
    }

    if (interaction.isButton() && id === 'gc_danhsach') {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const userId = interaction.user.id;
        const result = await db(
          'SELECT code, rewards, max_uses, used_by, expires_at, target_user_id, min_canh_gioi FROM giftcodes ORDER BY created_at DESC LIMIT 30',
        );
        const available = result.rows.filter(row =>
          !(row.expires_at && new Date(row.expires_at) < new Date()) &&
          !(row.used_by || []).includes(userId) &&
          !((row.used_by || []).length >= row.max_uses) &&
          (!row.target_user_id || row.target_user_id === userId),
        );
        if (!available.length)
          return interaction.editReply({ content: '📭 Hiện chưa có code nào dành cho ngươi!' });

        const lines = available.map(row => {
          const remaining = row.max_uses - (row.used_by || []).length;
          const cgNote = (row.min_canh_gioi || 0) > 0 ? ` 🏔️*(cảnh giới ≥${row.min_canh_gioi})*` : '';
          const privateNote = row.target_user_id ? ` ${CE('lock_icon','🔒')}*(riêng bạn)*` : '';
          return `🎁 \`${row.code}\` — ${describeRewards(row.rewards || {})}${cgNote}${privateNote} *(còn ${remaining} lượt)*`;
        });
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('📋 Danh Sách Giftcode Khả Dụng')
              .setColor(15965202)
              .setDescription(lines.join('\n'))
              .setFooter({ text: 'Dùng nút Nhập Giftcode để đổi' }),
          ],
        });
      } catch (e) {
        log.error('gc_danhsach error:', e?.message || e);
        try { await interaction.editReply({ content: '❌ Có lỗi xảy ra khi tải danh sách code!' }); } catch {}
      }
    }

    if (interaction.isModalSubmit() && id === 'gc_modal_submit') {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const userId = interaction.user.id;
        const code = (interaction.fields.getTextInputValue('gc_code_input') || '').toUpperCase().trim();
        if (!code) return interaction.editReply({ content: '❌ Vui lòng nhập mã code!' });

        const player = await getPlayer(userId, interaction.user.username);
        if (!player) return interaction.editReply({ content: '❌ Dùng `-bat_dau` trước khi nhận code!' });

        // ── Kiểm tra tuổi tài khoản (chống farm code bằng acc rác) ────────────
        const acctCheck = antiraid.checkAccountAge(interaction.user);
        if (acctCheck.suspicious)
          return interaction.editReply({
            content: `❌ Tài khoản Discord quá mới (${acctCheck.ageDays.toFixed(1)} ngày) — cần đủ **${antiraid.DEFAULT_MIN_ACCOUNT_AGE_DAYS} ngày** tuổi mới được nhập giftcode (chống farm code bằng acc rác).`,
          });

        const res = await db('SELECT * FROM giftcodes WHERE code=$1', [code]);
        if (!res.rows.length) return interaction.editReply({ content: '❌ Mã code không tồn tại hoặc đã hết hạn!' });

        const row = res.rows[0];
        if (row.expires_at && new Date(row.expires_at) < new Date())
          return interaction.editReply({ content: '⏰ Mã code này đã hết hạn!' });
        if ((row.used_by || []).includes(userId))
          return interaction.editReply({ content: `${CE('warn_icon','⚠️')} Ngươi đã sử dụng code **${code}** rồi!` });
        if ((row.used_by || []).length >= row.max_uses)
          return interaction.editReply({ content: `❌ Code **${code}** đã được sử dụng hết lượt!` });
        if (row.target_user_id && row.target_user_id !== userId)
          return interaction.editReply({ content: `❌ Code này được tạo riêng cho người khác!` });
        if ((row.min_canh_gioi || 0) > 0 && player.canh_gioi < row.min_canh_gioi)
          return interaction.editReply({ content: `❌ Code **${code}** yêu cầu cảnh giới tầng **${row.min_canh_gioi}** trở lên! (Ngươi đang tầng ${player.canh_gioi})` });

        const claimRes = await db(
          `UPDATE giftcodes SET used_by=array_append(used_by,$1) WHERE code=$2 AND NOT (COALESCE(used_by,'{}') @> ARRAY[$1]::text[]) AND COALESCE(array_length(used_by,1),0)<max_uses`,
          [userId, code],
        );
        if (claimRes.rowCount === 0)
          return interaction.editReply({ content: `❌ Code **${code}** vừa hết lượt hoặc ngươi đã dùng rồi!` });

        const rewards = row.rewards || {};
        let lines;
        try {
          lines = await applyGiftcodeRewards(player, userId, rewards);
        } catch (rewardErr) {
          // KHÔNG rollback used_by — phần thưởng có thể đã được phát một phần.
          // Rollback sẽ cho phép người chơi thử lại và nhận thưởng trùng lặp (economy exploit).
          // Thay vào đó: giữ nguyên trạng thái đã dùng, log đầy đủ để admin xử lý thủ công.
          log.error(
            '[giftcode] applyGiftcodeRewards lỗi sau khi đã ghi claim — code=%s userId=%s lỗi=%s',
            code, userId, rewardErr?.message || rewardErr, rewardErr?.stack || '',
          );
          return interaction.editReply({
            content:
              `${CE('warn_icon','⚠️')} Hệ thống xử lý phần thưởng gặp lỗi. Code đã được ghi nhận — vui lòng liên hệ Admin để nhận thủ công!`,
          });
        }

        const remaining = Math.max(0, row.max_uses - (row.used_by || []).length - 1);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🎁 Đổi Code Thành Công!')
              .setColor(3066993)
              .setDescription(`✅ Code **${code}** đã được kích hoạt!\n\n${lines.join('\n')}\n\n*Còn ${remaining} lượt sử dụng.*`)
              .setFooter({ text: interaction.user.username }),
          ],
        });
      } catch (e) {
        log.error('gc_modal_submit error:', e?.message || e);
        try { await interaction.editReply({ content: '❌ Có lỗi xảy ra khi đổi code. Vui lòng thử lại!' }); } catch {}
      }
    }
  });
};
