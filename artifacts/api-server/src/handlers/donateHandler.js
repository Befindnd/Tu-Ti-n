'use strict';
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { CE } = require('../systems/emoji');
const {
  fmt, findDonateGoi,
  buildDonateEmbed, buildDonateButtons, buildDonateCatSelect,
} = require('../utils');
const { getPlayer } = require('../db/players');
const { createPendingPayment } = require('../server');

const BANK_ID   = () => process.env.DONATE_BANK_ID   || 'MB';
const ACCT_NO   = () => process.env.DONATE_ACCOUNT_NO   || '';
const ACCT_NAME = () => process.env.DONATE_ACCOUNT_NAME || '';

function makeQrUrl(bankId, acctNo, acctName, amount, note) {
  return (
    `https://img.vietqr.io/image/${bankId}-${acctNo}-compact2.png` +
    `?amount=${amount}&addInfo=${encodeURIComponent(note)}&accountName=${encodeURIComponent(acctName)}`
  );
}

module.exports = function setupDonateHandler(client) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    const id = interaction.customId;
    const userId = interaction.user.id;

    // ── Category select ───────────────────────────────────────────────
    if (interaction.isStringSelectMenu() && id === 'donate_cat_select') {
      await interaction.deferUpdate();
      const cat = interaction.values[0];
      const embed = buildDonateEmbed(cat);
      if (!embed) return interaction.editReply({ content: '❌ Danh mục không hợp lệ!' });
      return interaction.editReply({
        components: [buildDonateCatSelect(cat), ...buildDonateButtons(cat, 0)],
        embeds: [embed],
      });
    }

    // ── Page navigation ───────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('donate_page_')) {
      await interaction.deferUpdate();
      const parts = id.split('_');
      const page = parseInt(parts[parts.length - 1]) || 0;
      const cat = parts.slice(2, parts.length - 1).join('_');
      return interaction.editReply({
        components: [buildDonateCatSelect(cat), ...buildDonateButtons(cat, page)],
        embeds: [buildDonateEmbed(cat)],
      });
    }

    if (!interaction.isButton()) return;

    // ── Buy button → tạo mã + VietQR ─────────────────────────────────
    if (id.startsWith('donate_buy_')) {
      const goiId = id.replace('donate_buy_', '');
      const found = findDonateGoi(goiId);
      if (!found) return interaction.reply({ flags: MessageFlags.Ephemeral, content: '❌ Gói không tồn tại!' });

      const { cat, goi } = found;

      // Kiểm tra gói mua 1 lần
      if (cat.lan_dau) {
        const player = await getPlayer(userId, interaction.user.username);
        if (player && (player.lan_dau_mua || []).includes(goiId)) {
          return interaction.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [
              new EmbedBuilder()
                .setTitle(`${CE('warn_icon','⚠️')} Đã Mua Gói Này Rồi!`)
                .setColor(15158332)
                .setDescription(
                  `*Gói **${goi.ten}** chỉ mua được **1 lần** — ngươi đã kích hoạt gói này trước đó rồi!*\n\n${CE("tip_icon","💡")} Xem các gói khác để tiếp tục tu luyện.`,
                ),
            ],
          });
        }
      }

      const amount = parseInt((goi.gia || '0').replace(/[^0-9]/g, '')) * 1000;

      let payCode;
      try {
        payCode = await createPendingPayment({
          userId,
          username: interaction.user.username,
          guildId:   interaction.guildId,
          channelId: interaction.channelId,
          goiId,
          amount,
        });
      } catch (e) {
        return interaction.reply({ flags: MessageFlags.Ephemeral, content: `❌ ${e.message}` });
      }

      const bankId   = BANK_ID();
      const acctNo   = ACCT_NO();
      const acctName = ACCT_NAME();
      const hasQr    = !!acctNo;
      const qrUrl    = hasQr ? makeQrUrl(bankId, acctNo, acctName, amount, payCode) : null;

      const embed = new EmbedBuilder()
        .setTitle('🛒 Thanh Toán Chuyển Khoản')
        .setColor(0xf5a623)
        .setDescription(
          [
            `Bạn đã chọn **${goi.emoji} ${goi.ten}**`,
            '',
            hasQr ? '**Quét QR bên dưới** hoặc chuyển khoản thủ công:' : '**Thông tin chuyển khoản:**',
            `🏦 **Ngân hàng:** \`${bankId}\``,
            acctNo ? `💳 **STK:** \`${acctNo}\`` : '',
            acctName ? `👤 **Chủ TK:** ${acctName}` : '',
            `💰 **Số tiền:** \`${goi.gia}\``,
            '',
            `${CE('warn_icon','⚠️')} **Nội dung chuyển khoản (bắt buộc ghi đúng):**`,
            `\`\`\`${payCode}\`\`\``,
            `**Phần thưởng:** ${goi.phan_thuong || fmt((goi.rewards || {}).linh_thach || 0) + ' Linh Thạch'}`,
            '',
            '_Đồ tự cộng sau ~30 giây khi thanh toán xác nhận ✅_',
            '_Mã hết hạn sau 24h · Chỉ bạn mới thấy tin nhắn này_',
          ].filter(Boolean).join('\n'),
        );

      if (qrUrl) embed.setImage(qrUrl);

      return interaction.reply({ flags: MessageFlags.Ephemeral, embeds: [embed] });
    }

    // ── Admin-only packages ───────────────────────────────────────────
    if (id.startsWith('donate_admin_')) {
      const found = findDonateGoi(id.replace('donate_admin_', ''));
      const contact = process.env.DONATE_CONTACT || 'Admin';
      const goi = found?.goi;
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          new EmbedBuilder()
            .setTitle(`${goi?.emoji || '🏔️'} Gói Đặc Biệt — Liên Hệ ADMIN`)
            .setColor(10181046)
            .setDescription(
              `**${goi?.ten || 'Gói Đặc Biệt'}**\n${goi?.phan_thuong || ''}\n\n*Gói này được mở bán theo sự kiện, đấu giá hoặc cơ duyên đặc biệt.*\n\n📬 Liên hệ **${contact}** để biết thêm thông tin và điều kiện nhận.`,
            ),
        ],
      });
    }
  });
};
