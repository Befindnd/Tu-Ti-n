'use strict';
const { EmbedBuilder } = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer } = require('../db/players');
const { DAO_TU } = require('../data');
const { fmt, errE, warnE, okE, reg, SEP2 } = require('../utils');
const { CE } = require('../systems/emoji');

// ── -dao_tu_chon [xem | list | chon <id>] ────────────────────────────────
// Đạo Tu chỉ chọn được 1 lần duy nhất — sau khi chọn sẽ bị khóa vĩnh viễn.
reg('dao_tu_chon', ['chon_dao_tu', 'daotu', 'dao_tu_info'], async (msg, args) => {
  const userId = msg.author.id;
  const player = await getPlayer(userId);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });

  const sub = (args[0] || 'xem').toLowerCase();

  // ── Xem thông tin Đạo Tu hiện tại ──────────────────────────────────────
  if (sub === 'xem' || sub === 'info') {
    const dt = DAO_TU[player.dao_tu];
    if (!dt) {
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE('tt_hon_don','🌀')} Đạo Tu — Chưa Chọn`)
            .setColor(0x888888)
            .setDescription(
              `*Ngươi chưa xác định con đường tu luyện...*\n\n${SEP2}\n\n` +
              `Có **8 Đạo Tu** để lựa chọn, mỗi con đường mang đặc tính và sức mạnh riêng.\n` +
              `Dùng \`-dao_tu_chon list\` để xem tất cả, hoặc \`-dao_tu_chon chon <id>\` để chọn ngay!\n\n` +
              `${CE('warn_icon','⚠️')} **Chú ý:** Đạo Tu chỉ được chọn **1 lần duy nhất** và không thể thay đổi sau đó!\n` +
              `✅ **Miễn phí** — không tốn Linh Thạch khi chọn lần đầu.\n\n` +
              `🗺️ Đạo Tu sẽ ảnh hưởng đến **Bí Cảnh**, **Cơ Duyên** và **chiến đấu**!`
            )
            .setFooter({ text: `Dùng: -dao_tu_chon list | -dao_tu_chon chon <id>` }),
        ],
      });
    }
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${dt.emoji} Đạo Tu — ${dt.ten}`)
          .setColor(0x9b59b6)
          .setDescription(
            `*${dt.mo_ta}*\n\n${SEP2}\n\n` +
            `**✦ Chỉ Số Thụ Động:**\n${dt.dac_diem}\n\n` +
            `**${CE('tunt','🎯')} Thụ Động Chiến Đấu:** ${dt.combat_passive}\n\n` +
            `${SEP2}\n\n` +
            `${CE('lock_icon','🔒')} **Đạo Tu đã được khóa** — không thể thay đổi sau khi chọn.\n` +
            `Dùng \`-dao_tu_chon list\` để xem tất cả 8 con đường.`
          )
          .setFooter({ text: `🔒 ${dt.ten} (vĩnh viễn) · Ảnh hưởng Bí Cảnh & Cơ Duyên` }),
      ],
    });
  }

  // ── Danh sách 8 Đạo Tu ─────────────────────────────────────────────────
  if (sub === 'list' || sub === 'danh_sach') {
    const lines = Object.entries(DAO_TU).map(([id, d]) => {
      const isCurrent = player.dao_tu === id;
      const bonusStr = Object.entries(d.bonus).map(([k, v]) => {
        const sign = v >= 0 ? '+' : '';
        const pct  = Math.round(v * 100);
        const label = { atk_bonus: `${CE("tuatk","⚔️")}ATK`, def_bonus: `${CE("tudef","🛡️")}DEF`, hp_bonus: `${CE("tuhp","❤️")}HP`, exp_bonus: `${CE("tutv","📈")}EXP` }[k] || k;
        return `${label} ${sign}${pct}%`;
      }).join(' · ');
      return `${isCurrent ? '▶ ' : ''}${d.emoji} **${d.ten}** (\`${id}\`)\n` +
             `${bonusStr}\n` +
             `*${d.mo_ta}*`;
    }).join('\n\n');

    const lockedNote = player.dao_tu
      ? `▶ **Đạo Tu hiện tại:** ${DAO_TU[player.dao_tu]?.emoji} ${DAO_TU[player.dao_tu]?.ten} *(đã khóa ${CE('lock_icon','🔒')})*`
      : `${CE('warn_icon','⚠️')} Chưa chọn Đạo Tu!\n\`-dao_tu_chon chon <id>\` *(miễn phí, chỉ 1 lần duy nhất)*`;

    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${CE('tt_hon_don','🌀')} Tám Đại Đạo Tu`)
          .setColor(0x9b59b6)
          .setDescription(
            `*Chọn con đường phù hợp với thiên tư của ngươi...*\n\n${SEP2}\n\n${lines}\n\n${SEP2}\n\n` +
            lockedNote
          )
          .setFooter({ text: `${CE('warn_icon','⚠️')} Chỉ chọn 1 lần! Ảnh hưởng Bí Cảnh & Cơ Duyên · VD: -dao_tu_chon chon kiem_tu` }),
      ],
    });
  }

  // ── Chọn Đạo Tu (chỉ 1 lần, vĩnh viễn) ────────────────────────────────
  if (sub === 'chon' || sub === 'doi') {
    // Đã có Đạo Tu → khóa, không cho đổi
    if (player.dao_tu) {
      const cur = DAO_TU[player.dao_tu];
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE('lock_icon','🔒')} Đạo Tu Đã Bị Khóa`)
            .setColor(0xe74c3c)
            .setDescription(
              `Ngươi đã chọn **${cur?.emoji || ''} ${cur?.ten || player.dao_tu}** từ trước.\n\n` +
              `Đạo Tu là con đường tu luyện cả đời — **không thể thay đổi** sau khi đã định.\n\n` +
              `*"Một khi đã chọn đạo, dù thiên địa sụp đổ cũng không hồi đầu."*`
            )
            .setFooter({ text: 'Dùng -dao_tu_chon xem để xem chi tiết Đạo Tu của ngươi' }),
        ],
      });
    }

    const targetId = (args[1] || '').toLowerCase();
    const target   = DAO_TU[targetId];

    if (!target) {
      const ids = Object.keys(DAO_TU).map(k => `\`${k}\``).join(' · ');
      return msg.reply({
        embeds: [warnE(`ID Đạo Tu không hợp lệ!\n\n**Các ID hợp lệ:**\n${ids}\n\nVí dụ: \`-dao_tu_chon chon kiem_tu\``)],
      });
    }

    // Lưu vào DB — hoàn toàn miễn phí, 1 lần duy nhất
    await db('UPDATE players SET dao_tu=$1 WHERE user_id=$2', [targetId, userId]);

    const bonusLines = Object.entries(target.bonus).map(([k, v]) => {
      const sign = v >= 0 ? '+' : '';
      const pct  = Math.round(v * 100);
      const label = { atk_bonus: `${CE("tuatk","⚔️")} ATK`, def_bonus: `${CE("tudef","🛡️")} DEF`, hp_bonus: `${CE("tuhp","❤️")} HP`, exp_bonus: `${CE("tutv","📈")} EXP` }[k] || k;
      return `${label} **${sign}${pct}%**`;
    }).join(' · ') + (target.crit_bonus > 0 ? `\n${CE('ft_am_sat','🗡️')} Bạo Kích **+${Math.round(target.crit_bonus * 100)}%**` : '');

    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${target.emoji} Đạo Tu Đã Định — ${target.ten}!`)
          .setColor(0x00cc88)
          .setDescription(
            `*${target.mo_ta}*\n\n${SEP2}\n\n` +
            `**✦ Chỉ Số Thụ Động:**\n${bonusLines}\n\n` +
            `**✦ Đặc Tính:**\n${target.dac_diem}\n\n` +
            `**${CE('tunt','🎯')} Thụ Động Chiến Đấu:**\n${target.combat_passive}\n\n` +
            `${SEP2}\n\n` +
            `✅ **Miễn phí** — Đạo Tu đã được **khóa vĩnh viễn**.\n` +
            `🗺️ Đạo Tu sẽ thay đổi kết quả **Bí Cảnh** và **Cơ Duyên** theo sở trường của ngươi!`
          )
          .setFooter({ text: '🔒 Đạo Tu khóa vĩnh viễn · Ảnh hưởng Bí Cảnh & Cơ Duyên & chiến đấu' }),
      ],
    });
  }

  return msg.reply({
    embeds: [warnE(
      '**Cú pháp Đạo Tu:**\n' +
      '`-dao_tu_chon xem` — Xem Đạo Tu hiện tại\n' +
      '`-dao_tu_chon list` — Danh sách 8 Đạo Tu\n' +
      '`-dao_tu_chon chon <id>` — Chọn Đạo Tu *(1 lần, miễn phí, vĩnh viễn)*'
    )],
  });
});
