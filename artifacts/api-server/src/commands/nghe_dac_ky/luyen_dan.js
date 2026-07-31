'use strict';
// ── ⚗️   Luyện Đan — Đặc Kỹ Mới ──
'use strict';
/**
 * nghe_dac_ky_moi.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tính năng đặc kỹ MỚI cho tất cả 7 nghề:
 *   🗡️  Ám Vệ      — trinh_sat, xa_tinh, sat_y
 *   🔱  Phi Khí Sư — bo_khi, linh_bieu
 *   📜  Phù Lục Sư — phu_pham, ve_phong_an
 *   🧭  Phong Thủy — tien_tri, tran_van
 *   💉  Dược Sư    — che_doc, giai_doc
 *   ⚗️  Luyện Đan  — dan_kho, tang_dan
 *   🌀  Ngộ Đạo Sư — cong_huong, dao_kinh
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db }        = require('../../db/pool');
const { getPlayer } = require('../../db/players');
const { CE }        = require('../../systems/emoji');
const {
  CANH_GIOI, VU_KHI, LINH_THAO, DAN_DUOC, DAN_PHAM, DAN_PHAM_ORDER, KHOANG_VAT,
  PHU_LUC_DATA, NGHE,
} = require('../../data');
const {
  fmt, fTime, cdRem, cdRemMin, cdTs,
  errE, warnE, okE,
  tinhCS, calcEXP_active, calcMaxLinhThach,
  reg, SEP,
} = require('../../utils');


// ═══════════════════════════════════════════════════════════════════════════════
// ⚗️  LUYỆN ĐAN SƯ — TÍNH NĂNG MỚI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * -dan_kho
 * Hiển thị kho đan dược chi tiết với đầy đủ thông tin phẩm chất và tác dụng.
 */
reg('dan_kho', ['dankho', 'dk_dan', 'xem_dan'], async (msg) => {
  const userId = msg.author.id;
  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'luyen_dan')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **⚗️ Luyện Đan Sư**!')] });

  const kho    = player.dan_duoc || {};
  const hasTP  = player.thien_phu_nghe === 'luyen_dan';

  // Nhóm đan theo phẩm
  const groups = { cuc: [], thuong: [], trung: [], ha: [] };
  for (const dan of DAN_DUOC) {
    const qty = kho[dan.id] || 0;
    if (qty <= 0) continue;
    if (dan.id.endsWith('_cuc')) groups.cuc.push({ dan, qty });
    else if (dan.pham === 'thuong') groups.thuong.push({ dan, qty });
    else if (dan.pham === 'trung')  groups.trung.push({ dan, qty });
    else                             groups.ha.push({ dan, qty });
  }

  const tongDan = Object.values(kho).reduce((s, v) => s + Number(v || 0), 0);
  const coCuc   = groups.cuc.length > 0;

  const formatGroup = (list, label) =>
    list.length > 0
      ? `**${label}:**\n` + list.map(({ dan, qty }) => `${dan.emoji} ${dan.ten} ×${qty} — *${dan.mo_ta || ''}*`).join('\n')
      : null;

  const lines = [
    formatGroup(groups.cuc, '✨ Cực Phẩm Đan'),
    formatGroup(groups.thuong, '🔮 Thượng Phẩm Đan'),
    formatGroup(groups.trung, `${CE('tult','💠')} Trung Phẩm Đan`),
    formatGroup(groups.ha, '🌿 Hạ Phẩm Đan'),
  ].filter(Boolean);

  const embed = new EmbedBuilder()
    .setTitle(`⚗️ Đan Dược Tàng Khố — ${msg.author.username}`)
    .setColor(0xe67e22)
    .setDescription(
      (tongDan > 0
        ? `*Lò đan hương khói, đan dược ${tongDan} viên sắp xếp ngay ngắn trong tàng khố...*`
        : `*Tàng khố trống không — lò đan nguội lạnh chờ thảo dược!*\nDùng \`-luyen_dan\` để luyện đan!`) +
      '\n\n' +
      (lines.length ? lines.join('\n\n') : '') +
      `\n\n**━━━ Đặc Kỹ Luyện Đan Sư ━━━**\n` +
      `\`-luyen_dan\` Luyện đan · \`-dung_dan <id>\` Dùng đan\n` +
      `\`-ban_dan <id>\` Bán đan · \`-tang_dan @người\` *(MỚI)* Tặng đan\n` +
      (hasTP ? `✨ **Đan Vương Thiên Phú** — 50% cơ hội nhận Cực Phẩm!\n` : '') +
      (coCuc ? `\n⭐ **Có Cực Phẩm Đan** — Bonus đột phá +8%!` : ''),
    )
    .setFooter({ text: `Luyện Đan Sư | Tổng: ${tongDan} viên đan | ${coCuc ? '✨ Có Cực Phẩm!' : 'Chưa có Cực Phẩm'}` });

  return msg.reply({ embeds: [embed] });
});

/**
 * -tang_dan @người [số lượng]
 * Tặng đan dược cho đồng đạo từ kho của bản thân.
 * CD 2h | Miễn phí
 */
reg('tang_dan', ['tangdan', 'td', 'td_dan', 'cho_dan'], async (msg, args) => {
  const userId = msg.author.id;
  const target = msg.mentions.users.first();
  if (!target || target.bot || target.id === userId)
    return msg.reply({ embeds: [errE('Cú pháp: `-tang_dan @người <id_dan> [số_lượng]`')] });

  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'luyen_dan')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **⚗️ Luyện Đan Sư**!')] });

  const buff   = typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};
  const cdLeft = cdRem(buff.tang_dan_cd, 2);
  if (cdLeft) return msg.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Cần thời gian sau khi tặng đan! Hết CD ${cdTs(buff.tang_dan_cd, 2)}`)] });

  // Lấy id đan và số lượng
  const argsClean = args.filter(a => !a.startsWith('<@'));
  const danId = argsClean[0]?.toLowerCase();
  const qty   = Math.min(5, Math.max(1, parseInt(argsClean[1]) || 1));

  if (!danId) {
    const kho = player.dan_duoc || {};
    const list = DAN_DUOC.filter(d => (kho[d.id] || 0) > 0)
      .map(d => `${d.emoji} \`${d.id}\` × ${kho[d.id]}`).join('\n');
    return msg.reply({
      embeds: [new EmbedBuilder()
        .setTitle('⚗️ Chọn Đan Để Tặng')
        .setColor(0xe67e22)
        .setDescription(
          `Cú pháp: \`-tang_dan @người <id> [1-5]\`\n\n**Đan trong kho của bạn:**\n${list || 'Kho trống!'}`,
        )],
    });
  }

  const danInfo = DAN_DUOC.find(d => d.id === danId);
  if (!danInfo) return msg.reply({ embeds: [errE(`Không tìm thấy đan \`${danId}\`!`)] });

  const kho = player.dan_duoc || {};
  if ((kho[danId] || 0) < qty)
    return msg.reply({ embeds: [errE(`Không đủ ${danInfo.emoji} **${danInfo.ten}**! Cần ${qty}, có ${kho[danId] || 0}.`)] });

  const tgt = await getPlayer(target.id);
  if (!tgt) return msg.reply({ embeds: [errE(`**${target.username}** chưa tu tiên!`)] });

  // Trừ đan của người tặng
  const newKho    = { ...kho, [danId]: (kho[danId] || 0) - qty };
  if (newKho[danId] <= 0) delete newKho[danId];

  // Thêm đan cho người nhận
  const tgtKho = tgt.dan_duoc || {};
  const newTgtKho = { ...tgtKho, [danId]: (tgtKho[danId] || 0) + qty };

  await db('UPDATE players SET dan_duoc=$1, buff_active=$2 WHERE user_id=$3',
    [JSON.stringify(newKho), JSON.stringify({ ...buff, tang_dan_cd: Date.now() }), userId]);
  await db('UPDATE players SET dan_duoc=$1 WHERE user_id=$2', [JSON.stringify(newTgtKho), target.id]);

  try {
    await target.send({
      embeds: [new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('⚗️ Nhận Được Đan Dược!')
        .setDescription(`🎁 **${msg.author.username}** (Luyện Đan Sư) tặng bạn:\n\n${danInfo.emoji} **${danInfo.ten}** ×${qty}\n\nDùng \`-dung_dan ${danId}\` để sử dụng!`)],
    });
  } catch {}

  return msg.reply({
    embeds: [new EmbedBuilder()
      .setTitle('⚗️ Tặng Đan Dược Thành Công!')
      .setColor(0xe67e22)
      .setDescription(
        `*Đan dược thơm ngát theo gió bay đến tay ${target.username}...*\n\n` +
        `🎁 Tặng **${target.username}**: ${danInfo.emoji} **${danInfo.ten}** ×${qty}\n` +
        `📦 Kho còn lại: **${newKho[danId] || 0}** viên`,
      )
      .setFooter({ text: 'Luyện Đan Sư | Tặng Đan | CD: 2h | Tối đa 5 viên/lần' })],
  });
});

