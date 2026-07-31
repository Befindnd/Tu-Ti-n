'use strict';
const { CE, CEu } = require('../systems/emoji');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer } = require('../db/players');
const { LINH_THU_LOOT_ITEMS, LINH_THU_CRAFT } = require('../data/linh_thu_data');
const { BAO_BOI } = require('../data/cong_phap');
const {
  fmt, embedClr, SEP, errE, okE,
  reg, calcMaxLinhThach,
} = require('../utils');
const { findDonateGoi } = require('../utils/donate');
const { applyGiftcodeRewards } = require('./donate');

const ITEM_TIERS = {
  da_linh_thu: 'thuong', long_linh_thu: 'thuong', rang_vuot: 'thuong',
  xuong_linh_thu: 'hiem', tinh_thach_nho: 'hiem',
  nanh_linh_thu: 'su_thi', tinh_thach_trung: 'su_thi',
  xuong_huyen_linh: 'huyen_thoai', vay_linh_long: 'huyen_thoai',
  tinh_thach_than: 'than_thu', tim_than_thu: 'than_thu', linh_hon_than_thu: 'than_thu',
};

const TIER_LABEL = {
  than_thu:    '⭐ Thần Thú',
  huyen_thoai: '🔴 Huyền Thoại',
  su_thi:      '🟣 Sử Thi',
  hiem:        '🔵 Hiếm',
  thuong:      '⚪ Phổ Thông',
};
const TIER_ORDER = ['than_thu', 'huyen_thoai', 'su_thi', 'hiem', 'thuong'];

// ── Command: -vat_pham [-vp] ──────────────────────────────────────────────────
reg('vat_pham', ['vatpham', 'vat-pham'], async (msg) => {
  const args  = msg.content.trim().split(/\s+/).slice(1);
  const sub   = args[0]?.toLowerCase();

  // ── -vat_pham che_tao [id] ──────────────────────────────────────────────
  if (sub === 'che_tao' || sub === 'craft' || sub === 'chetao') {
    const player = await getPlayer(msg.author.id);
    if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });

    const craftId = args[1]?.toLowerCase();

    // Không có id → redirect sang -tb tab chế tạo
    if (!craftId) {
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle('🔨 Chế Tạo Bảo Bối — Dùng -tb')
            .setDescription(
              `Xem công thức và chế tạo trực tiếp trong lệnh **\`-trang_bi\`** (hoặc \`-tb\`)!\n\n` +
              `📋 Mở **\`-tb\`** → Tab **🔮 Linh Bảo** → Tab **🔨 Chế Tạo**\n` +
              `> Hiện đủ/thiếu nguyên liệu realtime, chế tạo ngay bằng menu.\n\n` +
              `${CE('tip_icon','💡')} Hoặc dùng thẳng: \`-vat_pham che_tao <id>\` nếu biết ID.`,
            )
            .setFooter({ text: 'Nguyên liệu từ -san · Xem túi loot: -vat_pham' }),
        ],
      });
    }

    // Có id → thực hiện chế tạo
    const recipe = LINH_THU_CRAFT.find((r) => r.bao_boi_id === craftId);
    if (!recipe) {
      return msg.reply({ embeds: [errE(`Không tìm thấy công thức \`${craftId}\`!\nDùng \`-vat_pham che_tao\` để xem danh sách.`)] });
    }

    const bb = BAO_BOI.find((b) => b.id === craftId);
    if (!bb) return msg.reply({ embeds: [errE('Dữ liệu Bảo Bối không tồn tại!')] });

    // Kiểm tra cảnh giới
    if (player.canh_gioi < recipe.yeu_cau_cap) {
      return msg.reply({ embeds: [errE(`Cần tầng **${recipe.yeu_cau_cap}** để chế tạo **${bb.ten}**!\nHiện tại tầng **${player.canh_gioi}**.`)] });
    }

    // Kiểm tra linh thạch
    if (Number(player.linh_thach || 0) < recipe.phi) {
      return msg.reply({ embeds: [errE(`Cần **${fmt(recipe.phi)} ${CE('tult','💠')}** Linh Thạch!\nHiện có: **${fmt(player.linh_thach)} ${CE('tult','💠')}**`)] });
    }

    // Túi bag — danh sách theo thứ tự từ yếu → mạnh (không stack, chỉ lấy cái xịn nhất)
    const BAG_TIER = ['van_bao_tui', 'tui_da_thu'];
    const ownedBB = Array.isArray(player.bao_boi) ? player.bao_boi : (player.bao_boi ? [player.bao_boi] : []);

    // Kiểm tra đã có chưa (hoặc đã có túi xịn hơn)
    if (BAG_TIER.includes(craftId)) {
      const craftTier = BAG_TIER.indexOf(craftId);
      const ownedTier = BAG_TIER.reduce((best, id, idx) => ownedBB.includes(id) ? Math.max(best, idx) : best, -1);
      if (ownedBB.includes(craftId)) {
        return msg.reply({ embeds: [errE(`Bạn đã sở hữu **${bb.ten}** rồi!`)] });
      }
      if (ownedTier > craftTier) {
        const betterBB = BAO_BOI.find(b => b.id === BAG_TIER[ownedTier]);
        return msg.reply({ embeds: [errE(`Bạn đã có túi xịn hơn: **${betterBB?.ten || BAG_TIER[ownedTier]}**!\nKhông cần thay thế.`)] });
      }
    } else if (ownedBB.includes(craftId)) {
      return msg.reply({ embeds: [errE(`Bạn đã sở hữu **${bb.ten}** rồi!`)] });
    }

    // Kiểm tra nguyên liệu
    const vp = { ...(player.vat_pham || {}) };
    for (const [id, qty] of Object.entries(recipe.vat_lieu)) {
      const have = Number(vp[id] || 0);
      if (have < qty) {
        const info = LINH_THU_LOOT_ITEMS[id];
        return msg.reply({ embeds: [errE(`Thiếu **${info?.emoji || ''}${info?.ten || id}**! Cần ${qty}, có ${have}.\n${CE('tip_icon','💡')} Đi \`-san_linh_thu\` để thu thập nguyên liệu.`)] });
      }
    }

    // Trừ nguyên liệu
    for (const [id, qty] of Object.entries(recipe.vat_lieu)) {
      vp[id] = (Number(vp[id] || 0)) - qty;
      if (vp[id] <= 0) delete vp[id];
    }

    // Nếu đang craft túi tốt hơn → xóa túi cũ trước, rồi thêm túi mới
    const isBagUpgrade = BAG_TIER.includes(craftId) && BAG_TIER.slice(0, BAG_TIER.indexOf(craftId)).some(id => ownedBB.includes(id));
    const oldBagId = isBagUpgrade ? BAG_TIER.slice(0, BAG_TIER.indexOf(craftId)).find(id => ownedBB.includes(id)) : null;

    if (oldBagId) {
      await db(
        `UPDATE players
         SET linh_thach = linh_thach - $1,
             vat_pham   = $2::jsonb,
             bao_boi    = array_append(array_remove(COALESCE(bao_boi, '{}'), $3::text), $4::text)
         WHERE user_id = $5`,
        [recipe.phi, JSON.stringify(vp), oldBagId, craftId, msg.author.id],
      );
    } else {
      // bao_boi là TEXT[] — dùng array_append để thêm
      await db(
        `UPDATE players
         SET linh_thach = linh_thach - $1,
             vat_pham   = $2::jsonb,
             bao_boi    = array_append(COALESCE(bao_boi, '{}'), $3::text)
         WHERE user_id = $4`,
        [recipe.phi, JSON.stringify(vp), craftId, msg.author.id],
      );
    }

    const matDesc = Object.entries(recipe.vat_lieu)
      .map(([id, qty]) => `${LINH_THU_LOOT_ITEMS[id]?.emoji || ''}${LINH_THU_LOOT_ITEMS[id]?.ten || id} ×${qty}`)
      .join(' · ');

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle('🔨 Chế Tạo Thành Công!')
      .setDescription(
        `${bb.pham} **${bb.ten}** đã được chế tạo!\n\n` +
        (bb.atk > 0 ? `⚔️ Công Lực: **+${fmt(bb.atk)}**\n` : '') +
        (bb.def > 0 ? `🛡️ Thủ Lực: **+${fmt(bb.def)}**\n` : '') +
        (bb.hieu_ung ? `✦ *${bb.hieu_ung}*\n` : '') +
        `\n📦 Đã dùng: ${matDesc}\n${CE('tult','💠')} -${fmt(recipe.phi)} Linh Thạch`,
      )
      .setFooter({ text: 'Trang bị tại -bag hoặc -profile' })
      .setTimestamp();
    return msg.reply({ embeds: [embed] });
  }

  // ── -vat_pham mo [id] [số] — mở hộp phần thưởng ───────────────────────
  if (sub === 'mo' || sub === 'open' || sub === 'mở') {
    const itemId = args[1]?.toLowerCase() || 'hop_linh_thach';
    const qty    = Math.max(1, Math.min(100, parseInt(args[2]) || 1));

    // ── Hộp Donate (donbox_<goi_id>) ─────────────────────────────────────────
    if (itemId.startsWith('donbox_')) {
      const goiId = itemId.slice(7);
      const found = findDonateGoi(goiId);
      if (!found) return msg.reply({ embeds: [errE(`Không tìm thấy thông tin gói donate: \`${goiId}\``)] });
      const player = await getPlayer(msg.author.id);
      if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
      const vp2 = { ...(player.vat_pham || {}) };
      const owned = Number(vp2[itemId] || 0);
      if (owned <= 0) return msg.reply({ embeds: [errE(`Không có **📦 Hộp ${found.goi.ten}** trong túi!`)] });
      // Chỉ mở 1 hộp mỗi lần (vật phẩm trong hộp không stack được — vũ khí, bí pháp, v.v.)
      vp2[itemId] = owned - 1;
      if (vp2[itemId] <= 0) delete vp2[itemId];
      await db('UPDATE players SET vat_pham=$1::jsonb WHERE user_id=$2', [JSON.stringify(vp2), msg.author.id]);
      const freshPlayer = await getPlayer(msg.author.id);
      const results = await applyGiftcodeRewards(freshPlayer, msg.author.id, found.goi.rewards || {});
      const embed2 = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`📦 Mở Hộp: ${found.goi.emoji} ${found.goi.ten}`)
        .setDescription(
          `*Hộp bí bảo bừng sáng, linh khí tràn ra...*\n\n**Phần thưởng nhận được:**\n` +
          results.map(r => `▸ ${r}`).join('\n') +
          `\n\n💼 Còn lại trong túi: **${vp2[itemId] || 0} hộp**`
        )
        .setTimestamp();
      return msg.reply({ embeds: [embed2] });
    }

    const itemInfo = LINH_THU_LOOT_ITEMS[itemId];
    if (!itemInfo || !itemInfo.openable) {
      return msg.reply({
        embeds: [errE(
          `**\`${itemId}\`** không phải hộp có thể mở!\n\n` +
          `${CE('tip_icon','💡')} Hộp hiện có: \`hop_linh_thach\``,
        )],
      });
    }

    const player = await getPlayer(msg.author.id);
    if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });

    const vp     = { ...(player.vat_pham || {}) };
    const owned  = Number(vp[itemId] || 0);

    if (owned <= 0) {
      return msg.reply({
        embeds: [errE(`Không có **${itemInfo.emoji} ${itemInfo.ten}** trong túi!`)],
      });
    }

    const actualQty = Math.min(qty, owned);

    // Mở hộp: mỗi hộp cho 500–2500 linh thạch ngẫu nhiên
    let totalReward = 0;
    const rolls = [];
    for (let i = 0; i < actualQty; i++) {
      const reward = Math.floor(Math.random() * 2001) + 500; // 500–2500
      totalReward += reward;
      rolls.push(reward);
    }

    // Trừ hộp, cộng linh thạch — truyền kg hộp được giải phóng để tính đúng sức chứa
    vp[itemId] = owned - actualQty;
    if (vp[itemId] <= 0) delete vp[itemId];

    const boxFreedKg = (itemInfo.kg || 0) * actualQty;
    const actualReward = calcMaxLinhThach(player, totalReward, boxFreedKg);

    await db(
      `UPDATE players SET vat_pham=$1::jsonb, linh_thach=linh_thach+$2 WHERE user_id=$3`,
      [JSON.stringify(vp), actualReward, msg.author.id],
    );

    const rollDesc = actualQty <= 5
      ? rolls.map((r, i) => `> Hộp ${i + 1}: **+${fmt(r)} ${CE('tult','💠')}**`).join('\n')
      : `> *${actualQty} hộp đã mở*`;

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle(`${itemInfo.emoji} Mở Hộp Linh Thạch`)
      .setDescription(
        `*Ánh linh quang tản ra từ hộp bí ẩn, linh thạch tuôn chảy...*\n\n` +
        rollDesc +
        `\n${SEP}\n` +
        `✨ Tổng nhận: **+${fmt(actualReward)} ${CE('tult','💠')} Linh Thạch**` +
        (actualReward < totalReward ? `\n${CE('warn_icon','⚠️')} *(Đã đạt giới hạn tích trữ — bỏ lỡ ${fmt(totalReward - actualReward)} ${CE("tult","💠")})*` : '') +
        `\n💼 Còn lại trong túi: **${vp[itemId] || 0} hộp**`,
      )
      .setFooter({ text: `Mỗi hộp cho 500–2,500 ${CEu("tult","💠")} ngẫu nhiên` });

    return msg.reply({ embeds: [embed] });
  }

  // ── -vat_pham dung [id] — không còn hỗ trợ dùng trực tiếp ─────────────
  if (sub === 'dung' || sub === 'use' || sub === 'dùng') {
    return msg.reply({
      embeds: [errE(
        `Vật phẩm Linh Thú đã là **nguyên liệu chế tạo** — không dùng trực tiếp!\n\n${CE('tip_icon','💡')} Dùng \`-vat_pham che_tao\` để xem công thức Bảo Bối.\n📦 Để mở hộp: \`-vat_pham mo hop_linh_thach\``,
      )],
    });
  }

  // ── -vat_pham [xem túi] ──────────────────────────────────────────────────
  const player = await getPlayer(msg.author.id);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });

  const vp = typeof player.vat_pham === 'object' && player.vat_pham ? player.vat_pham : {};

  const hasItems = Object.entries(vp).some(([id, v]) => Number(v) > 0 && !id.startsWith('donbox_'));

  // Nhóm theo tier
  const byTier = {};
  for (const [id, count] of Object.entries(vp)) {
    if (Number(count) <= 0) continue;
    const tier = ITEM_TIERS[id] || 'thuong';
    if (!byTier[tier]) byTier[tier] = [];
    const info = LINH_THU_LOOT_ITEMS[id];
    if (!info) continue;
    byTier[tier].push({ id, count: Number(count), info });
  }

  let desc = '';

  if (!hasItems) {
    desc += '*Túi trống — đi `-san_linh_thu` để nhận nguyên liệu!*\n\n';
  } else {
    for (const tier of TIER_ORDER) {
      if (!byTier[tier]) continue;
      desc += `**${TIER_LABEL[tier]}**\n`;
      for (const { id, count, info } of byTier[tier]) {
        desc += `> ${info.emoji} **${info.ten}** ×${count}\n`;
        desc += `> *${info.mo_ta}*\n`;
      }
      desc += '\n';
    }
  }

  // Show donate boxes if any
  const donBoxEntries = Object.entries(vp).filter(([id, c]) => id.startsWith('donbox_') && Number(c) > 0);
  if (donBoxEntries.length > 0) {
    desc += `\n**📦 Hộp Donate (chờ mở):**\n`;
    for (const [id, count] of donBoxEntries) {
      const goiId = id.slice(7);
      const found = findDonateGoi(goiId);
      const label = found ? `${found.goi.emoji} ${found.goi.ten}` : goiId;
      desc += `> 📦 **${label}** ×${Number(count)} — ` + `\`-vat_pham mo ${id}\`\n`;
    }
  }
  desc += `${SEP}\n🔨 \`-vat_pham che_tao\` — Xem & chế tạo Bảo Bối từ nguyên liệu`;

  const embed = new EmbedBuilder()
    .setColor(embedClr(player.canh_gioi || 0))
    .setTitle('🎒 Túi Vật Phẩm Linh Thú')
    .setAuthor({ name: msg.author.username, iconURL: msg.author.displayAvatarURL() })
    .setDescription(desc)
    .setFooter({ text: 'Nguyên liệu dùng để chế tạo Bảo Bối & Rèn Luyện +9/+10' })
    .setTimestamp();

  return msg.reply({ embeds: [embed] });
});
