'use strict';
const { EmbedBuilder } = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer } = require('../db/players');
const { BI_PHAP } = require('../data');
const { GIA_TOC } = require('../data/gia_toc');
const { errE, reg, SEP } = require('../utils');

const ADMIN_ID = process.env.ADMIN_ID || '';

// Tất cả bí pháp gia tộc (gia_toc_only: true)
const GIA_TOC_BP_IDS = BI_PHAP.filter(bp => bp.gia_toc_only).map(bp => bp.id);

// Map: gia_toc_id → bi_phap_id hợp lệ
const GT_BP_MAP = {};
for (const gt of GIA_TOC) {
  if (gt.bi_phap_id) GT_BP_MAP[gt.id] = gt.bi_phap_id;
}

reg('thu_hoi', ['thuhoi', 'revoke_bp'], async (msg, args) => {
  if (msg.author.id !== ADMIN_ID)
    return msg.reply({ embeds: [errE('❌ Chỉ admin mới dùng được lệnh này!')] });

  const sub = (args[0] || '').toLowerCase();

  // ── Thu hồi hàng loạt tất cả player ─────────────────────────────────
  if (sub === 'tat_ca' || sub === 'all') {
    const statusMsg = await msg.reply({
      embeds: [new EmbedBuilder().setColor(0xFFA500).setDescription('⏳ Đang quét toàn bộ người chơi... vui lòng đợi.')],
    });

    // Lấy tất cả player có ít nhất 1 bi_phap gia tộc
    const rows = await db(
      `SELECT user_id, gia_toc, bi_phap FROM players WHERE bi_phap && $1::text[]`,
      [GIA_TOC_BP_IDS],
    );
    const players = rows.rows || rows;

    let fixed = 0, skipped = 0;
    const details = [];

    for (const player of players) {
      const biPhap = player.bi_phap || [];
      const validGtBp = GT_BP_MAP[player.gia_toc] || null;

      // Bí pháp gia tộc SAI: có trong mảng nhưng không phải của gia tộc mình
      const wrongBps = biPhap.filter(id => GIA_TOC_BP_IDS.includes(id) && id !== validGtBp);
      if (wrongBps.length === 0) { skipped++; continue; }

      const newBiPhap = biPhap.filter(id => !wrongBps.includes(id));
      await db('UPDATE players SET bi_phap=$1 WHERE user_id=$2', [newBiPhap, player.user_id]);

      fixed++;
      const bpLabels = wrongBps.map(id => {
        const bp = BI_PHAP.find(x => x.id === id);
        return bp ? bp.ten : id;
      });
      details.push(`<@${player.user_id}>: xóa ${bpLabels.join(', ')}`);
    }

    const desc = [
      `✅ **Thu hồi hoàn tất!**`,
      ``,
      `👥 Đã quét: **${players.length}** người có bí pháp gia tộc`,
      `🔧 Đã thu hồi: **${fixed}** người`,
      `⏭️ Bỏ qua (không sai): **${skipped}** người`,
      details.length > 0
        ? `\n${SEP}\n**Chi tiết (${details.length} người):**\n` + details.slice(0, 20).join('\n')
        : '',
      details.length > 20 ? `\n*...và ${details.length - 20} người khác*` : '',
    ].filter(Boolean).join('\n');

    return statusMsg.edit({
      embeds: [
        new EmbedBuilder()
          .setColor(fixed > 0 ? 0xE74C3C : 0x2ECC71)
          .setTitle('🩸 Thu Hồi Bí Pháp Gia Tộc — Hàng Loạt')
          .setDescription(desc)
          .setFooter({ text: `Thực hiện bởi ${msg.author.tag}` }),
      ],
    });
  }

  // ── Thu hồi từ một người cụ thể ─────────────────────────────────────
  const target = msg.mentions.users.first();
  if (!target)
    return msg.reply({
      embeds: [errE(
        '**Cú pháp:**\n' +
        '`-thu_hoi @người` — Thu hồi bí pháp gia tộc sai của 1 người\n' +
        '`-thu_hoi tat_ca` — Thu hồi hàng loạt toàn bộ server'
      )],
    });

  const player = await getPlayer(target.id);
  if (!player)
    return msg.reply({ embeds: [errE(`**${target.username}** chưa có dữ liệu trong game!`)] });

  const biPhap = player.bi_phap || [];
  const validGtBp = GT_BP_MAP[player.gia_toc] || null;
  const wrongBps = biPhap.filter(id => GIA_TOC_BP_IDS.includes(id) && id !== validGtBp);

  if (wrongBps.length === 0)
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ECC71)
          .setDescription(`✅ **${target.username}** không có bí pháp gia tộc sai — không cần xử lý.`),
      ],
    });

  const newBiPhap = biPhap.filter(id => !wrongBps.includes(id));
  await db('UPDATE players SET bi_phap=$1 WHERE user_id=$2', [newBiPhap, target.id]);

  const bpNames = wrongBps.map(id => {
    const bp = BI_PHAP.find(x => x.id === id);
    return bp ? `**${bp.ten}** (\`${id}\`)` : `\`${id}\``;
  });

  const gtName = player.gia_toc
    ? (GIA_TOC.find(x => x.id === player.gia_toc)?.ten || player.gia_toc)
    : 'Chưa có';

  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('🩸 Thu Hồi Bí Pháp Gia Tộc')
        .setDescription(
          `✅ Đã thu hồi bí pháp gia tộc sai của **${target.username}**\n\n` +
          `🗑️ **Bí pháp đã xóa:**\n${bpNames.join('\n')}\n\n` +
          `🏷️ Gia tộc của họ: **${gtName}**\n` +
          `✅ Bí pháp gia tộc hợp lệ: ${validGtBp ? `\`${validGtBp}\`` : '*không có*'}`
        )
        .setFooter({ text: `Thu hồi bởi ${msg.author.tag}` }),
    ],
  });
});
