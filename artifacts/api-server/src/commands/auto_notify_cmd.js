'use strict';
/**
 * commands/auto_notify_cmd.js
 * Lệnh -thongke_auto — Admin setup thống kê server tự động.
 *
 *   -thongke_auto xem        — Xem cấu hình hiện tại
 *   -thongke_auto kenh #kênh — Chọn kênh nhận thống kê
 *   -thongke_auto bat        — Bật tự động (gửi lúc 0:00 VN mỗi ngày)
 *   -thongke_auto tat        — Tắt tự động
 *   -thongke_auto gui        — Gửi thử ngay
 */
const { EmbedBuilder } = require('discord.js');
const { reg }          = require('../utils/commands');
const notify           = require('../core/auto_notify');

const ADMIN_ID = process.env.ADMIN_ID || '';

reg('thongke_auto', ['tka', 'tkstats'], async (msg, args) => {
  if (msg.author.id !== ADMIN_ID) {
    return msg.reply({
      embeds: [new EmbedBuilder().setColor(0xED4245)
        .setDescription(`${CE('lock_icon','🔒')} **Lệnh này chỉ dành cho Admin!**`)],
    }).catch(() => {});
  }

  const sub = (args[0] || 'xem').toLowerCase();

  // ── XEM ──────────────────────────────────────────────────────────────
  if (sub === 'xem') {
    const cfg = notify.getConfig();
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('📊 Cấu Hình Thống Kê Tự Động')
          .setColor(cfg.enabled ? 0x57F287 : 0xED4245)
          .setDescription('Bot tự gửi thống kê **lúc 0:00 VN mỗi ngày** vào kênh đã chọn.')
          .addFields(
            { name: '🟢 Trạng Thái', value: cfg.enabled ? '**Đang bật**' : '**Đang tắt**',          inline: true },
            { name: '📣 Kênh',       value: cfg.channelId ? `<#${cfg.channelId}>` : '*Chưa đặt*', inline: true },
            { name: '🕛 Lịch Gửi',  value: '**0:00 VN** mỗi ngày',                                inline: true },
          )
          .setFooter({ text: 'Dùng -thongke_auto help để xem tất cả lệnh' }),
      ],
    }).catch(() => {});
  }

  // ── CHỌN KÊNH ────────────────────────────────────────────────────────
  if (sub === 'kenh') {
    const chId = msg.mentions.channels.first()?.id || args[1]?.replace(/\D/g, '');
    if (!chId) {
      return msg.reply({
        embeds: [new EmbedBuilder().setColor(0xFEE75C)
          .setDescription(`${CE('warn_icon','⚠️')} Dùng: \`-thongke_auto kenh #tên-kênh\``)],
      }).catch(() => {});
    }
    await notify.setChannel(chId);
    return msg.reply({
      embeds: [new EmbedBuilder().setColor(0x57F287)
        .setDescription(`✅ Kênh thống kê đã đặt thành <#${chId}>`)],
    }).catch(() => {});
  }

  // ── BẬT ──────────────────────────────────────────────────────────────
  if (sub === 'bat') {
    const cfg = notify.getConfig();
    if (!cfg.channelId) {
      return msg.reply({
        embeds: [new EmbedBuilder().setColor(0xFEE75C)
          .setDescription(`${CE('warn_icon','⚠️')} Chưa đặt kênh! Dùng \`-thongke_auto kenh #kênh\` trước.`)],
      }).catch(() => {});
    }
    await notify.setEnabled(true);
    return msg.reply({
      embeds: [new EmbedBuilder().setColor(0x57F287)
        .setDescription(
          `✅ **Đã bật thống kê tự động!**\n` +
          `📣 Kênh: <#${cfg.channelId}>\n` +
          `🕛 Bot sẽ tự gửi lúc **0:00 VN mỗi ngày**`,
        )],
    }).catch(() => {});
  }

  // ── TẮT ──────────────────────────────────────────────────────────────
  if (sub === 'tat') {
    await notify.setEnabled(false);
    return msg.reply({
      embeds: [new EmbedBuilder().setColor(0xED4245)
        .setDescription('🔕 **Đã tắt thống kê tự động.**')],
    }).catch(() => {});
  }

  // ── GỬI THỬ NGAY ─────────────────────────────────────────────────────
  if (sub === 'gui') {
    const cfg = notify.getConfig();
    if (!cfg.channelId) {
      return msg.reply({
        embeds: [new EmbedBuilder().setColor(0xFEE75C)
          .setDescription(`${CE('warn_icon','⚠️')} Chưa đặt kênh! Dùng \`-thongke_auto kenh #kênh\` trước.`)],
      }).catch(() => {});
    }
    const ok = await notify.sendNow(true);
    return msg.reply({
      embeds: [new EmbedBuilder()
        .setColor(ok ? 0x57F287 : 0xED4245)
        .setDescription(ok
          ? `✅ Đã gửi thống kê vào <#${cfg.channelId}>!`
          : `❌ Gửi thất bại! Bot có thể không có quyền gửi tin trong kênh <#${cfg.channelId}>.`)],
    }).catch(() => {});
  }

  // ── HELP ─────────────────────────────────────────────────────────────
  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('📊 Thống Kê Server Tự Động')
        .setColor(0x5865F2)
        .setDescription('Bot tự gửi thống kê **số tin nhắn 24h + người hoạt động** lúc **0:00 VN mỗi ngày**.')
        .addFields({
          name: '📋 Lệnh',
          value: [
            '`-thongke_auto xem` — Xem cấu hình hiện tại',
            '`-thongke_auto kenh #kênh` — Chọn kênh nhận thống kê',
            '`-thongke_auto bat` — Bật tự động',
            '`-thongke_auto tat` — Tắt tự động',
            '`-thongke_auto gui` — Gửi thử ngay',
          ].join('\n'),
        })
        .setFooter({ text: 'Chỉ Admin mới dùng được' }),
    ],
  }).catch(() => {});
});
