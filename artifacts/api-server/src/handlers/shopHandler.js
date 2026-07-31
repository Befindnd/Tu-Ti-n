'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} = require('discord.js');
const { CE, CEu } = require('../systems/emoji');
const {
  DAN_DUOC, DAN_PHAM, DAN_PHAM_ORDER, REN_LUYEN_CAP, calcDanTyLe,
  LINH_THAO, KHOANG_VAT,
  VU_KHI,
} = require('../data');
const { db } = require('../db/pool');
const { getPlayer } = require('../db/players');
const { fmt, errE, okE, canAddToBag, calcSpend, calcMultiSpend, MIXED_SPEND_THRESHOLD } = require('../utils');
const { handleTowerButton } = require('../commands/tower');
const { HD_GROUPS } = require('../commands/system');
const { logger } = require('../utils/logger');
const log = logger.child('shopHandler');

module.exports = function setupShopHandler(client) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    const id = interaction.customId;
    const userId = interaction.user.id;

    if (id.startsWith('tower_')) return handleTowerButton(interaction);

    if (id === 'hd_menu' && interaction.isStringSelectMenu()) {
      const key   = interaction.values[0];
      const group = HD_GROUPS[key];
      if (!group)
        return interaction.reply({ flags: MessageFlags.Ephemeral, content: '❌ Mục không hợp lệ!' }).catch(() => {});

      const embed = new EmbedBuilder()
        .setTitle(`${group.emoji}  ${group.ten}`)
        .setColor(group.color ?? 0x5865F2)
        .setDescription(group.lenh)
        .addFields({ name: `${CE('tip_icon','💡')} Lưu ý`, value: group.chu, inline: false })
        .setFooter({ text: '-hd để mở lại menu  •  Chỉ mình bạn thấy' });

      return interaction.reply({ flags: MessageFlags.Ephemeral, embeds: [embed] }).catch(() => {});
    }

    if (!interaction.isButton()) return;

    if (id.startsWith('ld_lam_')) {
      const danId = id.replace('ld_lam_', '');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const player = await getPlayer(userId, interaction.user.username);
        if (!player) return interaction.editReply({ content: '❌ Dùng `-bat_dau` trước!' });

        const dan = DAN_DUOC.find(d => d.id === danId);
        if (!dan) return interaction.editReply({ content: '❌ Không tìm thấy đan!' });
        if (player.canh_gioi < dan.yeu_cau_cap) return interaction.editReply({ embeds: [errE(`Cần tầng **${dan.yeu_cau_cap}**!`)] });
        const _sDanCheck = calcSpend(player, dan.phi);
        if (!_sDanCheck) return interaction.editReply({ embeds: [errE(`Cần **${fmt(dan.phi)} ${CE('tult', '💠')}**! Có **${fmt(player.linh_thach)} ${CE('tult', '💠')}**`)] });

        const thao = { ...(player.linh_thao || {}) };
        for (const [tId, need] of Object.entries(dan.cong_thuc)) {
          if ((thao[tId] || 0) < need) {
            const t = LINH_THAO.find(l => l.id === tId);
            return interaction.editReply({ embeds: [errE(`Thiếu **${t?.ten || tId}**! Cần ${need}, có ${thao[tId] || 0}`)] });
          }
        }
        for (const [tId, need] of Object.entries(dan.cong_thuc)) thao[tId] = (thao[tId] || 0) - need;

        const isAlchemist = player.nghe === 'luyen_dan';
        const rate = calcDanTyLe(player.canh_gioi, dan.yeu_cau_cap, isAlchemist);
        let phamKey = 'ha';
        if (Math.random() < rate) {
          let acc = 0, roll = Math.random() * 100;
          for (const p of DAN_PHAM_ORDER) {
            acc += DAN_PHAM[p].rate;
            if (roll < acc) { phamKey = p; break; }
          }
        }

        const phamData = DAN_PHAM[phamKey];
        if (!canAddToBag(player, 'dan_duoc', 1, phamKey))
          return interaction.editReply({ embeds: [errE('🎒 Túi quá nặng! Dùng `-tui` và `-vut`.')] });

        const duoc = { ...(player.dan_duoc || {}) };
        const duocKey = phamKey === 'trung' ? dan.id : `${dan.id}_${phamKey}`;
        duoc[duocKey] = (duoc[duocKey] || 0) + 1;

        let bonus = '';
        if (isAlchemist && Math.random() < 0.25) { duoc[duocKey] += 1; bonus = '\n⚗️ Đặc Kỹ: luyện thêm 1 đan!'; }

        await db('UPDATE players SET linh_thao=$1,dan_duoc=$2,linh_thach=$3,linh_thach_trung=$4,linh_thach_cao=$5 WHERE user_id=$6',
          [JSON.stringify(thao), JSON.stringify(duoc), _sDanCheck.newThuong, _sDanCheck.newTrung, _sDanCheck.newCao, userId]);

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${phamData.emoji} Luyện Thành — ${phamData.ten} ${dan.ten}`)
              .setColor(phamData.color)
              .setDescription(`${phamData.emoji} **${phamData.ten} ${dan.ten}** đã ra lò!${bonus}\nDùng: \`-dung_dan ${dan.id}\``)
              .setFooter({ text: `-${fmt(dan.phi)} ${CEu("tult","💠")} | Tỉ lệ: ${Math.round(100 * rate)}%` }),
          ],
        });
      } catch (e) {
        log.error('ld_lam error:', e.message);
        return interaction.editReply({ content: '❌ Lỗi luyện đan! Thử lại sau.' }).catch(() => {});
      }
    }

    if (id === 'ld_back_xem') {
      await interaction.deferUpdate();
      const player = await getPlayer(userId, interaction.user.username);
      if (!player) return;

      const duoc = player.dan_duoc || {};
      const thao = player.linh_thao || {};
      const nonLimited = DAN_DUOC.filter(d => !d.limited);

      const lines = nonLimited.map(d => {
        const recipe = Object.entries(d.cong_thuc)
          .map(([tId, qty]) => { const t = LINH_THAO.find(l => l.id === tId); return `${t?.emoji || ''}${t?.ten || tId}×${qty}(${thao[tId] || 0})`; })
          .join(' ');
        const stock = DAN_PHAM_ORDER.map(p => {
          const key = p === 'trung' ? d.id : `${d.id}_${p}`;
          const qty = duoc[key] || 0;
          return qty > 0 ? `${DAN_PHAM[p].emoji}${qty}` : null;
        }).filter(Boolean).join('') || '0';
        const lock = player.canh_gioi < d.yeu_cau_cap ? ` ${CE('lock_icon','🔒')}T${d.yeu_cau_cap}` : '';
        return `${d.emoji} **${d.ten}**${lock} — ${fmt(d.phi)}${CE('tult', '💠')} | 🌿 ${recipe} | Kho: ${stock}`;
      });

      const limited = DAN_DUOC.filter(d => d.limited && (duoc[d.id] || 0) > 0)
        .map(d => `${d.emoji} **${d.ten}** ×${duoc[d.id]} *(đặc biệt · \`-dung_dan ${d.id}\`)*`);

      const btns = nonLimited.map(d => {
        const locked = player.canh_gioi < d.yeu_cau_cap;
        const canMake = !locked
          && Object.entries(d.cong_thuc).every(([tId, qty]) => (thao[tId] || 0) >= qty)
          && Number(player.linh_thach || 0) >= d.phi;
        return new ButtonBuilder()
          .setCustomId(`ld_lam_${d.id}`)
          .setLabel(d.ten.slice(0, 20))
          .setStyle(canMake ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(locked);
      });
      const refreshBtn = new ButtonBuilder().setCustomId('ld_back_xem').setLabel('🔄 Làm Mới').setStyle(ButtonStyle.Secondary);
      const allBtns = [...btns.slice(0, 24), refreshBtn];
      const rows = [];
      for (let i = 0; i < Math.ceil(allBtns.length / 5); i++)
        rows.push(new ActionRowBuilder().addComponents(allBtns.slice(i * 5, i * 5 + 5)));

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚗️ Luyện Đan — Công Thức & Kho')
            .setColor(15105570)
            .setDescription(lines.join('\n') + (limited.length ? '\n\n💎 **Đặc Biệt:**\n' + limited.join('\n') : ''))
            .setFooter({ text: '🟢 Nút xanh = đủ nguyên liệu · Xám = thiếu/khóa | -dung_dan <id> để uống đan' }),
        ],
        components: rows,
      });
    }

    if (id === 'rl_nang_cap') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const player = await getPlayer(userId, interaction.user.username);
        if (!player) return interaction.editReply({ content: '❌ Dùng `-bat_dau` trước!' });
        if (player.nghe !== 'luyen_khi')
          return interaction.editReply({ embeds: [errE('Lệnh chỉ dành cho **🔱 Phi Khí Sư**!')] });

        const curCap = player.vu_khi_cap || 0;
        const next = REN_LUYEN_CAP.find(c => c.cap === curCap + 1);
        if (!next) return interaction.editReply({ embeds: [okE('✨ Phi khí đã đạt Cấp Tối Đa (+8)!')] });
        if (player.canh_gioi < (next.yeu_cau_cap || 0))
          return interaction.editReply({ embeds: [errE(`Cần tầng **${next.yeu_cau_cap}**!`)] });
        const _sRen = next.phi >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(player, next.phi) : calcSpend(player, next.phi);
        if (!_sRen)
          return interaction.editReply({ embeds: [errE(`Cần **${fmt(next.phi)} ${CE('tult', '💠')}**! Có **${fmt(player.linh_thach)} ${CE('tult', '💠')}**`)] });

        const mats = { ...(player.khoang_vat || {}) };
        for (const [mId, need] of Object.entries(next.vat_lieu)) {
          if ((mats[mId] || 0) < need) {
            const mat = KHOANG_VAT.find(k => k.id === mId);
            return interaction.editReply({ embeds: [errE(`Thiếu **${mat?.emoji || '🪨'}${mat?.ten || mId}**! Cần ${need}, có ${mats[mId] || 0}.\nDùng \`-khai_quang\` để khai mỏ.`)] });
          }
        }
        for (const [mId, need] of Object.entries(next.vat_lieu)) mats[mId] = (mats[mId] || 0) - need;

        await db('UPDATE players SET linh_thach=$1,linh_thach_trung=$2,linh_thach_cao=$3,khoang_vat=$4,vu_khi_cap=$5 WHERE user_id=$6',
          [_sRen.newThuong, _sRen.newTrung, _sRen.newCao, JSON.stringify(mats), next.cap, userId]);

        const weapon = VU_KHI.find(w => w.id === player.vu_khi);
        return interaction.editReply({
          embeds: [
            okE(`🔱 **${weapon?.pham || ''} ${weapon?.ten || 'Phi Khí'}** tôi luyện lên **Cấp +${next.cap}**!\n✨ ${next.mo_ta}\n${CE('tuatk', '⚔️')} ATK +${Math.round(100 * next.atk_bonus)}%\n-${fmt(next.phi)} ${CE('tult', '💠')}`),
          ],
        });
      } catch (e) {
        log.error('rl_nang_cap error:', e.message);
        return interaction.editReply({ content: '❌ Lỗi rèn phi khí! Thử lại sau.' }).catch(() => {});
      }
    }

  });
};
