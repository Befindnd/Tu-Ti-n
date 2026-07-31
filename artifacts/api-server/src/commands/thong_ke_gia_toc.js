'use strict';
const { EmbedBuilder } = require('discord.js');
const { db } = require('../db/pool');
const { GIA_TOC, GIA_TOC_MAU, GIA_TOC_DO_QUY_EMOJI } = require('../data');
const { reg } = require('../utils');
const { CE } = require('../systems/emoji');
const { genGiaTocImage } = require('../utils/genGiaTocImage');

const DO_QUY_ORDER  = ['huyen_thoai', 'su_thi', 'quy', 'thuong', 'pham'];
const DO_QUY_LABEL  = {
  huyen_thoai: 'Huyền Thoại',
  su_thi:      'Sử Thi',
  quy:         'Quý',
  thuong:      'Thường',
  pham:        'Phàm',
};

const TOTAL_WEIGHT = GIA_TOC.reduce((s, g) => s + g.weight, 0);

function pBar(val, max, len = 10) {
  if (max === 0) return '░'.repeat(len);
  const filled = Math.round((val / max) * len);
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

function fmtPct(n, total) {
  if (!total) return '0.0%';
  return ((n / total) * 100).toFixed(1) + '%';
}

function bonusSummary(gt) {
  const parts = [];
  if (gt.atk_bonus   > 0) parts.push(`⚔️+${Math.round(gt.atk_bonus   * 100)}%`);
  if (gt.def_bonus   > 0) parts.push(`🛡️+${Math.round(gt.def_bonus   * 100)}%`);
  if (gt.hp_bonus    > 0) parts.push(`💜+${Math.round(gt.hp_bonus    * 100)}%`);
  if (gt.crit_bonus  > 0) parts.push(`💥+${Math.round(gt.crit_bonus  * 100)}%`);
  if (gt.tu_vi_bonus > 0) parts.push(`📿+${Math.round(gt.tu_vi_bonus * 100)}%`);
  return parts.length ? parts.join(' ') : '—';
}

reg('thong_ke_gia_toc', ['tkgt', 'giatoc_tk', 'gt_tk'], async (msg) => {
  await msg.channel.sendTyping().catch(() => {});

  const [cntRes, noRes] = await Promise.all([
    db(`SELECT gia_toc, COUNT(*)::int AS cnt FROM players WHERE gia_toc IS NOT NULL GROUP BY gia_toc`),
    db(`SELECT COUNT(*)::int AS cnt FROM players WHERE gia_toc IS NULL`),
  ]);

  const countMap = {};
  let totalPlayers = 0;
  for (const r of cntRes.rows) {
    countMap[r.gia_toc] = r.cnt;
    totalPlayers += r.cnt;
  }
  const noGiaToc = noRes.rows[0]?.cnt || 0;

  // ── Thử tạo ảnh PNG ────────────────────────────────────────────────────
  let imgBuffer = null;
  try {
    imgBuffer = await genGiaTocImage(countMap, totalPlayers);
  } catch (e) {
    console.warn('[GT_TK] genGiaTocImage lỗi:', e.message);
  }

  if (imgBuffer) {
    return msg.reply({
      content: `🏯 **Thống Kê Gia Tộc Tu Tiên** — ${totalPlayers} tu sĩ · ${noGiaToc} chưa có gia tộc`,
      files: [{ attachment: imgBuffer, name: 'gia_toc_thongke.png' }],
    });
  }

  // ── Fallback: text embeds nếu canvas chưa cài ───────────────────────────
  const maxCount = Math.max(...GIA_TOC.map(g => countMap[g.id] || 0), 1);

  const embeds = [];

  // Overview embed
  const summaryLines = [];
  for (const dq of DO_QUY_ORDER) {
    const list   = GIA_TOC.filter(g => g.do_quy === dq);
    const cnt    = list.reduce((s, g) => s + (countMap[g.id] || 0), 0);
    const wt     = list.reduce((s, g) => s + g.weight, 0);
    const dropP  = ((wt / TOTAL_WEIGHT) * 100).toFixed(1);
    const bar    = pBar(cnt, totalPlayers || 1, 12);
    summaryLines.push(
      `${GIA_TOC_DO_QUY_EMOJI[dq]} **${DO_QUY_LABEL[dq]}** — ${cnt} người *(${fmtPct(cnt, totalPlayers)})* · Drop ${dropP}%\n${bar}`
    );
  }

  embeds.push(
    new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏯 Thống Kê Toàn Bộ Gia Tộc Tu Tiên')
      .setDescription(
        `👥 **Tổng tu sĩ có gia tộc:** ${totalPlayers}\n` +
        `❓ **Chưa có gia tộc:** ${noGiaToc}\n` +
        `🏅 **Tổng số gia tộc:** ${GIA_TOC.length}\n\n` +
        `✦ ══════════════════════════ ✦\n\n` +
        summaryLines.join('\n\n')
      )
      .setTimestamp()
      .setFooter({ text: 'Tu Tiên Bot · -thong_ke_gia_toc' })
  );

  // One embed per rarity
  for (const dq of DO_QUY_ORDER) {
    const list    = GIA_TOC.filter(g => g.do_quy === dq);
    const dqEmoji = GIA_TOC_DO_QUY_EMOJI[dq];
    const dqClr   = GIA_TOC_MAU[dq] ?? 0x888888;
    const dqTotal = list.reduce((s, g) => s + (countMap[g.id] || 0), 0);
    const dqDrop  = ((list.reduce((s, g) => s + g.weight, 0) / TOTAL_WEIGHT) * 100).toFixed(1);
    const lines   = [];

    for (const gt of list) {
      const cnt     = countMap[gt.id] || 0;
      const drop    = ((gt.weight / TOTAL_WEIGHT) * 100).toFixed(1);
      const bar     = pBar(cnt, maxCount, 10);
      lines.push(
        `${dqEmoji} **${CE(gt.ce_name, gt.emoji)} ${gt.ten}**`,
        `┣ 👥 **${cnt}** người *(${fmtPct(cnt, totalPlayers)})* · 🎲 Drop **${drop}%**`,
        `┣ ✨ ${bonusSummary(gt)}`,
        `┣ 🩸 *${gt.bi_phap_ten}* (CG ${gt.bi_phap_yc})`,
        `┗ ${bar}`,
        '',
      );
    }

    embeds.push(
      new EmbedBuilder()
        .setColor(dqClr)
        .setTitle(`${dqEmoji} ${DO_QUY_LABEL[dq]} Tộc`)
        .setDescription(lines.join('\n').trim())
        .addFields({ name: '📊 Tổng cộng', value: `${list.length} gia tộc · ${dqTotal} người · Drop rate ${dqDrop}%` })
        .setFooter({ text: `Trang ${DO_QUY_ORDER.indexOf(dq) + 1}/${DO_QUY_ORDER.length}` })
    );
  }

  for (let i = 0; i < embeds.length; i += 3) {
    const chunk = embeds.slice(i, i + 3);
    if (i === 0) await msg.reply({ embeds: chunk });
    else await msg.channel.send({ embeds: chunk });
  }
});
