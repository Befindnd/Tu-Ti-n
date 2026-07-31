'use strict';
/**
 * commands/thong_ke_server.js
 * Lệnh thống kê server — CHỈ ADMIN dùng được.
 * Lệnh: -thong_ke_server | -tks
 */
const { EmbedBuilder } = require('discord.js');
const { reg }          = require('../utils/commands');
const { getStats }     = require('../core/server_stats');

const ADMIN_ID = process.env.ADMIN_ID || '';

function vnTime(date) {
  return new Date(date.getTime() + 7 * 3600_000)
    .toISOString().replace('T', ' ').slice(0, 16) + ' (VN)';
}

reg('thong_ke_server', ['tks', 'servestats', 'svstats'], async (msg) => {
  if (msg.author.id !== ADMIN_ID) {
    return msg.reply({
      embeds: [new EmbedBuilder().setColor(0xED4245)
        .setDescription(`${CE('lock_icon','🔒')} **Lệnh này chỉ dành cho Admin!**`)],
    }).catch(() => {});
  }

  const { messages, uniqueUsers, since } = getStats();
  const now   = new Date();
  const guild = msg.guild;

  // guild.memberCount có sẵn từ GatewayIntentBits.Guilds — không cần intent đặc biệt
  const totalMembers = guild?.memberCount ?? '?';

  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('📊 Thống Kê Server — 24 Giờ Qua')
        .setColor(0x5865F2)
        .setDescription(`*Từ **${vnTime(since)}** → **${vnTime(now)}***`)
        .addFields(
          { name: '💬 Tin Nhắn (24h)',           value: `**${messages.toLocaleString('vi-VN')}** tin`,     inline: true },
          { name: '🧑‍💻 Người Hoạt Động (24h)',  value: `**${uniqueUsers.toLocaleString('vi-VN')}** người`, inline: true },
          { name: '👥 Tổng Thành Viên',           value: `**${totalMembers}** người`,                       inline: true },
        )
        .setFooter({ text: `Chỉ Admin thấy lệnh này • ${vnTime(now)}` })
        .setTimestamp(),
    ],
  }).catch(() => {});
});
