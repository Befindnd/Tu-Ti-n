'use strict';
const { EmbedBuilder } = require('discord.js');
const { getPlayer } = require('../db/players');
const { db } = require('../db/pool');
const { GIA_TOC, GIA_TOC_MAU, GIA_TOC_DO_QUY_EMOJI, getGiaToc, randomGiaToc } = require('../data');
const { BI_PHAP, BP_GIA } = require('../data');
const { errE, SEP2, reg, fmt } = require('../utils');
const { CE } = require('../systems/emoji');

reg('gia_toc', ['giatoc', 'gt'], async (msg, args) => {
  const subCmd = (args[0] || '').toLowerCase();

  // ── Lệnh học bí pháp gia tộc ─────────────────────────────────────────
  if (subCmd === 'hoc' || subCmd === 'hoc_bi_phap' || subCmd === 'bp') {
    const player = await getPlayer(msg.author.id);
    if (!player)
      return msg.reply({ embeds: [errE('Dùng `-bat_dau` để khai mở thiên tư trước!')] });

    if (!player.gia_toc)
      return msg.reply({ embeds: [errE('Bạn chưa có gia tộc! Dùng `-gia_toc` để nhận gia tộc ngẫu nhiên trước.')] });

    const gt = getGiaToc(player.gia_toc);
    if (!gt)
      return msg.reply({ embeds: [errE('Không tìm thấy dữ liệu gia tộc của bạn.')] });

    const bpId = gt.bi_phap_id;
    const bp = BI_PHAP.find(x => x.id === bpId);
    if (!bp)
      return msg.reply({ embeds: [errE('Bí pháp gia tộc chưa được khai mở. Báo cáo admin!')] });

    // Kiểm tra đã học chưa
    if ((player.bi_phap || []).includes(bpId)) {
      const mau = GIA_TOC_MAU[gt.do_quy] || 0x8B8B8B;
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(mau)
            .setTitle(`${gt.emoji} ${gt.ten} — Bí Pháp Gia Tộc`)
            .setDescription(
              `✅ Bạn đã học **${bp.ten}** rồi!\n\n` +
              `*${bp.mo_ta}*\n\n` +
              `Dùng \`-bi_phap\` để xem chi tiết bí pháp đã học.`
            ),
        ],
      });
    }

    // Kiểm tra cảnh giới
    if ((player.canh_gioi || 0) < (gt.bi_phap_yc || 0)) {
      const mau = GIA_TOC_MAU[gt.do_quy] || 0x8B8B8B;
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(mau)
            .setTitle(`${gt.emoji} ${gt.ten} — Bí Pháp Gia Tộc`)
            .setDescription(
              `${CE('warn_icon','⚠️')} **${bp.ten}** đòi hỏi cảnh giới tối thiểu **${gt.bi_phap_yc}** để giác ngộ!\n\n` +
              `*Huyết mạch gia tộc chưa đủ mạnh để khai mở bí pháp cổ truyền này...*\n\n` +
              `Cảnh giới hiện tại: **${player.canh_gioi || 0}** / Yêu cầu: **${gt.bi_phap_yc}**`
            ),
        ],
      });
    }

    // Học bí pháp — miễn phí (đây là quyền lợi huyết thống)
    await db('UPDATE players SET bi_phap=array_append(bi_phap,$1) WHERE user_id=$2', [bpId, msg.author.id]);

    const mau = GIA_TOC_MAU[gt.do_quy] || 0x8B8B8B;
    const doQuyEmoji = GIA_TOC_DO_QUY_EMOJI[gt.do_quy] || '⬜';

    let chiTietStr = '';
    if (bp.loai === 'tan_cong') chiTietStr = `${CE("tuatk","⚔️")} Tấn công — Sát thương **${Math.round((bp.sat_thuong_pct || 0) * 100)}%** Công Lực`;
    else if (bp.loai === 'phong_thu') chiTietStr = `${CE("tudef","🛡️")} Phòng thủ — Giảm **${Math.round((bp.giam_dame_pct || 0) * 100)}%** sát thương nhận vào`;
    else if (bp.loai === 'hoi_phuc') chiTietStr = `${CE("tuhp","💜")} Hồi phục — Hồi **${Math.round((bp.heal_pct || 0) * 100)}%** Linh Lực tối đa`;

    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(mau)
          .setTitle(`${CE('ft_huyet_mach','🩸')} Huyết Mạch Giác Tỉnh! ${doQuyEmoji} ${gt.emoji} ${gt.ten}`)
          .setThumbnail(msg.author.displayAvatarURL())
          .setDescription(
            `*Huyết thống ${gt.ten} trong người **${msg.author.username}** rung chuyển, bí pháp cổ truyền dâng trào...*\n\n` +
            `${doQuyEmoji} **${gt.do_quy_ten}** — ${gt.emoji} **${gt.ten}**\n\n` +
            `${SEP2}\n\n` +
            `${CE('ft_bi_phap','📜')} **Bí Pháp Gia Tộc Khai Ngộ:**\n` +
            `${CE(gt.ce_name, gt.emoji)} **${bp.ten}** *(Độc quyền ${gt.ten})*\n` +
            `*${bp.mo_ta}*\n` +
            `${chiTietStr}\n` +
            `${CE("cd_timer","🌀")} Hồi chiêu: **${bp.hoi_chieu}** lượt\n\n` +
            `*Bí pháp huyết thống — không thể truyền dạy, không thể đánh mất.*`
          )
          .setFooter({ text: 'Dùng -bi_phap để xem bí pháp đã học · -gia_toc hoc để xem lại' }),
      ],
    });
  }

  // ── Xem thông tin gia tộc (mặc định) ──────────────────────────────────
  const target = msg.mentions.users.first() || msg.author;
  const player = await getPlayer(target.id);

  if (!player)
    return msg.reply({
      embeds: [errE(`**${target.username}** chưa bước vào con đường tu tiên!\nDùng \`-bat_dau\` để khai mở thiên tư.`)],
    });

  let gt = player.gia_toc ? getGiaToc(player.gia_toc) : null;

  // Tự động gán gia tộc cho người chơi cũ chưa có
  if (!gt) {
    if (target.id !== msg.author.id) {
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x8B8B8B)
            .setTitle('🏚️ Chưa Có Gia Tộc')
            .setDescription(`**${target.username}** chưa được gán gia tộc.\n*Yêu cầu họ dùng \`-gia_toc\` để nhận gia tộc ngẫu nhiên.*`),
        ],
      });
    }

    gt = randomGiaToc();
    await db('UPDATE players SET gia_toc=$1 WHERE user_id=$2', [gt.id, target.id]);

    const doQuyEmoji = GIA_TOC_DO_QUY_EMOJI[gt.do_quy] || '⬜';
    const mau = GIA_TOC_MAU[gt.do_quy] || 0x8B8B8B;

    const bonusLines = [];
    if (gt.atk_bonus > 0)    bonusLines.push(`${CE("tuatk","⚔️")} ATK: **+${Math.round(gt.atk_bonus * 100)}%**`);
    if (gt.def_bonus > 0)    bonusLines.push(`${CE("tudef","🛡️")} DEF: **+${Math.round(gt.def_bonus * 100)}%**`);
    if (gt.hp_bonus > 0)     bonusLines.push(`${CE("tuhp","💜")} HP Tối Đa: **+${Math.round(gt.hp_bonus * 100)}%**`);
    if (gt.crit_bonus > 0)   bonusLines.push(`${CE("ft_dot_pha","💥")} Bạo Kích: **+${Math.round(gt.crit_bonus * 100)}%**`);
    if (gt.tu_vi_bonus > 0)  bonusLines.push(`${CE("tutv","📿")} Tu Vi nhận được: **+${Math.round(gt.tu_vi_bonus * 100)}%**`);

    const bpInfo = gt.bi_phap_id
      ? `\n\n${SEP2}\n\n${CE('ft_huyet_mach','🩸')} **Bí Pháp Gia Tộc:** ${gt.bi_phap_ten}\n*Dùng \`-gia_toc hoc\` để học bí pháp huyết thống (cần cảnh giới ${gt.bi_phap_yc})*`
      : '';

    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(mau)
          .setTitle(`${CE('ft_khai_quang','✨')} Huyết Thống Khai Ngộ! ${doQuyEmoji} ${CE(gt.ce_name, gt.emoji)} ${gt.ten}`)
          .setThumbnail(target.displayAvatarURL())
          .setDescription(
            `*Thiên địa soi xét, huyết mạch trong người **${target.username}** đã hiển lộ...*\n\n` +
            `${doQuyEmoji} **${gt.do_quy_ten}** — ${CE(gt.ce_name, gt.emoji)} **${gt.ten}**\n\n` +
            `*${gt.mo_ta}*\n\n${SEP2}\n\n` +
            `${CE('ft_gia_toc','✨')} **Huyết Thống Bonus:**\n${bonusLines.length > 0 ? bonusLines.join('\n') : '_Không có bonus đặc biệt_'}` +
            bpInfo
          )
          .setFooter({ text: `Gia tộc đã được gán vĩnh viễn · Dùng -gia_toc để xem lại` }),
      ],
    });
  }

  const doQuyEmoji = GIA_TOC_DO_QUY_EMOJI[gt.do_quy] || '⬜';
  const mau = GIA_TOC_MAU[gt.do_quy] || 0x8B8B8B;

  const bonusLines = [];
  if (gt.atk_bonus > 0)    bonusLines.push(`${CE("tuatk","⚔️")} ATK: **+${Math.round(gt.atk_bonus * 100)}%**`);
  if (gt.def_bonus > 0)    bonusLines.push(`${CE("tudef","🛡️")} DEF: **+${Math.round(gt.def_bonus * 100)}%**`);
  if (gt.hp_bonus > 0)     bonusLines.push(`${CE("tuhp","💜")} HP Tối Đa: **+${Math.round(gt.hp_bonus * 100)}%**`);
  if (gt.crit_bonus > 0)   bonusLines.push(`${CE("ft_dot_pha","💥")} Bạo Kích: **+${Math.round(gt.crit_bonus * 100)}%**`);
  if (gt.tu_vi_bonus > 0)  bonusLines.push(`${CE("tutv","📿")} Tu Vi nhận được: **+${Math.round(gt.tu_vi_bonus * 100)}%**`);

  // Kiểm tra trạng thái bí pháp gia tộc
  const bpId = gt.bi_phap_id;
  const daHocBp = (player.bi_phap || []).includes(bpId);
  let bpStatusLine = '';
  if (bpId) {
    if (daHocBp) {
      bpStatusLine = `\n\n${SEP2}\n\n${CE('ft_huyet_mach','🩸')} **Bí Pháp Gia Tộc:** ${gt.bi_phap_ten} ✅ *[Đã học]*`;
    } else if ((player.canh_gioi || 0) >= (gt.bi_phap_yc || 0)) {
      bpStatusLine = `\n\n${SEP2}\n\n${CE('ft_huyet_mach','🩸')} **Bí Pháp Gia Tộc:** ${gt.bi_phap_ten}\n*${CE('ft_khai_quang','✨')} Có thể học ngay! Dùng \`-gia_toc hoc\` để khai mở (miễn phí)*`;
    } else {
      bpStatusLine = `\n\n${SEP2}\n\n${CE('ft_huyet_mach','🩸')} **Bí Pháp Gia Tộc:** ${gt.bi_phap_ten}\n*${CE('lock_icon','🔒')} Yêu cầu cảnh giới ${gt.bi_phap_yc} (hiện tại: ${player.canh_gioi || 0})*`;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(mau)
    .setTitle(`${doQuyEmoji} ${CE(gt.ce_name, gt.emoji)} ${gt.ten} — ${gt.do_quy_ten}`)
    .setThumbnail(target.displayAvatarURL())
    .setDescription(
      `*${gt.mo_ta}*\n\n${SEP2}\n\n` +
      `${CE('ft_gia_toc','✨')} **Huyết Thống Bonus:**\n${bonusLines.length > 0 ? bonusLines.join('\n') : '_Không có bonus đặc biệt_'}` +
      bpStatusLine
    )
    .setFooter({ text: `Gia tộc của ${target.username} · Dùng -gia_toc @người để xem gia tộc của người khác` });

  return msg.reply({ embeds: [embed] });
});

reg('xem_gia_toc', ['xgt', 'ds_gia_toc'], async (msg) => {
  const doQuyOrder = ['huyen_thoai', 'su_thi', 'quy', 'thuong', 'pham'];

  const grouped = {};
  for (const dq of doQuyOrder) grouped[dq] = [];
  for (const gt of GIA_TOC) {
    if (grouped[gt.do_quy]) grouped[gt.do_quy].push(gt);
  }

  const lines = [];
  for (const dq of doQuyOrder) {
    const list = grouped[dq];
    if (!list.length) continue;
    const emoji = GIA_TOC_DO_QUY_EMOJI[dq];
    const tenCap = list[0].do_quy_ten;
    const doQuyLabel = `${emoji} **${tenCap}**`;
    lines.push(doQuyLabel);
    for (const gt of list) {
      const xacSuat = ((gt.weight / GIA_TOC.reduce((s, g) => s + g.weight, 0)) * 100).toFixed(1);
      const bpTen = gt.bi_phap_ten ? ` · ${CE('ft_huyet_mach','🩸')} *${gt.bi_phap_ten}*` : '';
      lines.push(`${CE(gt.ce_name, gt.emoji)} ${gt.ten} — ${gt.bonus} *(${xacSuat}%)*${bpTen}`);
    }
    lines.push('');
  }

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('📜 Danh Sách Gia Tộc Tu Tiên')
    .setDescription(
      `*Gia tộc được ban ngẫu nhiên khi dùng \`-bat_dau\` hoặc \`-gia_toc\`.*\n*Số % là xác suất nhận được khi khai mở thiên tư.*\n*${CE('ft_huyet_mach','🩸')} = Bí pháp gia tộc độc quyền — dùng \`-gia_toc hoc\` để học.*\n\n${SEP2}\n\n` +
      lines.join('\n')
    )
    .setFooter({ text: 'Có tất cả ' + GIA_TOC.length + ' gia tộc · Dùng -gia_toc để xem gia tộc của bạn' });

  return msg.reply({ embeds: [embed] });
});
