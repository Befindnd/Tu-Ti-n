'use strict';
/**
 * commands/thien_dao_bang.js
 * Thiên Đạo Bảng — bảng xếp hạng Danh Vọng toàn server.
 *
 * Lệnh: -thien_dao_bang | -tdb | -bxh_dv
 *
 * Danh Vọng tích lũy từ: thắng PVP (+10), nhận nhiệm vụ ngày (+5),
 * vượt tầng Tower milestone (+15), đột phá (+8), vượt kiếp (+25),
 * cướp túi thành công (+3).
 */
const { EmbedBuilder } = require('discord.js');
const { db }           = require('../db/pool');
const { getPlayer }    = require('../db/players');
const { CE }           = require('../systems/emoji');
const {
  fmt, getCG, SEP,
  errE,
  COMMANDS, reg,
} = require('../utils');
const { DV_POINTS, DV_TIERS, getDanhVongBonus } = require('../utils/danh_vong');

// Huy hiệu theo ngưỡng
function getDVBadge(dv) {
  if (dv >= 5000) return '👑';
  if (dv >= 2000) return '💎';
  if (dv >= 1000) return '🏅';
  if (dv >= 500)  return '🥈';
  if (dv >= 100)  return '🥉';
  return '⬜';
}

function getDVTitle(dv) {
  if (dv >= 5000) return 'Thiên Đạo Chi Chủ';
  if (dv >= 2000) return 'Thần Cấp';
  if (dv >= 1000) return 'Tôn Giả';
  if (dv >= 500)  return 'Đại Năng';
  if (dv >= 100)  return 'Tu Sĩ';
  return 'Vô Danh';
}

reg('thien_dao_bang', ['tdb', 'bxh_dv', 'danhvong'], async (msg) => {
  const userId = msg.author.id;

  // Lấy top 10 toàn server
  const { rows: top } = await db(
    `SELECT user_id, username, canh_gioi, danh_vong, pvp_wins
     FROM players
     WHERE danh_vong > 0
     ORDER BY danh_vong DESC
     LIMIT 10`,
  );

  // Lấy rank của người dùng hiện tại
  const { rows: rankRows } = await db(
    `SELECT COUNT(*) + 1 AS rank
     FROM players
     WHERE danh_vong > (SELECT COALESCE(danh_vong,0) FROM players WHERE user_id=$1)`,
    [userId],
  );
  const myRank = Number(rankRows[0]?.rank || '?');
  const me = await getPlayer(userId);

  const rankMedals = ['🥇', '🥈', '🥉'];
  const lines = top.map((p, i) => {
    const medal  = rankMedals[i] || `**${i + 1}.**`;
    const badge  = getDVBadge(Number(p.danh_vong || 0));
    const cgName = getCG(p.canh_gioi || 0)?.ten || 'Phàm Nhân';
    const dv     = fmt(Number(p.danh_vong || 0));
    const isMe   = p.user_id === userId ? ' ← **ngươi**' : '';
    return `${medal} ${badge} **${p.username}** — 🏆 **${dv} DV** · ${cgName}${isMe}`;
  });

  const myDV    = Number(me?.danh_vong || 0);
  const myBadge = getDVBadge(myDV);
  const myTitle = getDVTitle(myDV);

  const embed = new EmbedBuilder()
    .setTitle('🏆 Thiên Đạo Bảng — Danh Vọng Toàn Server')
    .setColor(0xF1C40F)
    .setDescription(
      lines.length > 0
        ? lines.join('\n')
        : '*Chưa có ai tích lũy Danh Vọng — hãy là người đầu tiên!*',
    )
    .addFields(
      {
        name: `${myBadge} Vị Trí Của Ngươi`,
        value: `Hạng **#${myRank}** · 🏆 **${fmt(myDV)} DV** · Danh Hiệu: *${myTitle}*`,
        inline: false,
      },
      {
        name: `${CE('tip_icon','💡')} Cách Kiếm / Mất Danh Vọng`,
        value: [
          `⚔️ Thắng PVP **+${DV_POINTS.PVP_WIN}** · Thua PVP **−8**`,
          `📋 Nhận nhiệm vụ ngày **+${DV_POINTS.MISSION_CLAIM}**`,
          `🏯 Vượt tầng Tower mới **+${DV_POINTS.TOWER_FLOOR}**`,
          `💥 Đột phá thành công **+${DV_POINTS.DOT_PHA}** · Thất bại **−5**`,
          `⚡ Vượt Thiên Kiếp thành công **+${DV_POINTS.VUOT_KIEP}** · Thất bại **−12**`,
          `🗡️ Cướp túi thành công **+${DV_POINTS.CUOP_TUI}** · Bị cướp **−5** · Bị ám sát **−5**`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '📊 Hiệu Ứng Theo Ngưỡng',
        value: DV_TIERS.map(t => {
          const parts = [];
          if (t.exp    !== 0) parts.push(`EXP ${t.exp > 0 ? '+' : ''}${Math.round(t.exp * 100)}%`);
          if (t.dot_pha !== 0) parts.push(`Đột Phá ${t.dot_pha > 0 ? '+' : ''}${Math.round(t.dot_pha * 100)}%`);
          if (t.pvp_loot !== 0) parts.push(`Loot PVP +${Math.round(t.pvp_loot * 100)}%`);
          const eff = parts.length ? parts.join(', ') : '*Không có hiệu ứng*';
          // Lấy ngưỡng trên = min của tier ngay trên trong mảng (index - 1)
          const idx = DV_TIERS.indexOf(t);
          const minStr = t.min < 0
            ? `< ${DV_TIERS[idx - 1]?.min ?? 0}`
            : `≥ ${t.min}`;
          return `${t.label} *(${minStr} DV)*: ${eff}`;
        }).join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: 'Thiên Đạo ghi nhận tất cả — từng trận chiến, từng đột phá, từng nhiệm vụ' });

  return msg.reply({ embeds: [embed] });
});
