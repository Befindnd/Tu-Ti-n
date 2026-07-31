'use strict';
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { DAN_DUOC, DAN_PHAM } = require('../data');
const { pool } = require('../db/pool');
const { getPlayer } = require('../db/players');
const { logger } = require('../utils/logger');
const log = logger.child('tuichoHandler');

module.exports = function setupTuichoHandler(client) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('tuicho_modal_')) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const parts = interaction.customId.split('_');
    const giverId = parts[2];
    const pillKey = parts.slice(3).join('_');

    if (interaction.user.id !== giverId)
      return interaction.editReply({ content: '❌ Không phải tu viên của bạn!' });

    const qtyRaw = parseInt(interaction.fields.getTextInputValue('qty'), 10);
    const recipientId = (interaction.fields.getTextInputValue('recipient') || '').trim().replace(/\D/g, '');

    if (!qtyRaw || qtyRaw < 1 || qtyRaw > 10)
      return interaction.editReply({ content: '❌ Số lượng phải từ 1 đến 10!' });
    if (!recipientId)
      return interaction.editReply({ content: '❌ User ID không hợp lệ!' });
    if (recipientId === giverId)
      return interaction.editReply({ content: '❌ Không thể cho chính mình!' });

    const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const giver = await getPlayer(giverId);
    if (!giver) return interaction.editReply({ content: '❌ Không tìm thấy tu viên của bạn!' });

    const giverBuff = (typeof giver.buff_active === 'object' && giver.buff_active) ? { ...giver.buff_active } : {};
    const choCount = giverBuff.cho_dan_date === today ? giverBuff.cho_dan_count || 0 : 0;

    if (choCount + qtyRaw > 10)
      return interaction.editReply({ content: `❌ Hôm nay đã cho **${choCount}/10** đan, không thể cho thêm ${qtyRaw} viên!` });

    let baseId = pillKey;
    let pham = 'trung';
    for (const grade of ['cuc', 'thuong', 'trung', 'ha']) {
      if (pillKey.endsWith('_' + grade)) {
        baseId = pillKey.slice(0, -(grade.length + 1));
        pham = grade;
        break;
      }
    }

    const giverDuoc = { ...(giver.dan_duoc || {}) };
    const haveQty = giverDuoc[pillKey] || 0;
    if (haveQty < qtyRaw)
      return interaction.editReply({ content: `❌ Không đủ đan! Có ${haveQty} viên, muốn cho ${qtyRaw}` });

    const recipient = await getPlayer(recipientId).catch(() => null);
    if (!recipient) return interaction.editReply({ content: '❌ Không tìm thấy tu viên này!' });

    const recipBuff = (typeof recipient.buff_active === 'object' && recipient.buff_active) ? { ...recipient.buff_active } : {};
    const nhanCount = recipBuff.nhan_dan_date === today ? recipBuff.nhan_dan_count || 0 : 0;
    if (nhanCount + qtyRaw > 10)
      return interaction.editReply({ content: `❌ Tu viên này hôm nay đã nhận **${nhanCount}/10** đan, không nhận thêm được!` });

    const dan = DAN_DUOC.find((d) => d.id === baseId);
    const phamData = DAN_PHAM[pham] || DAN_PHAM.trung;

    giverDuoc[pillKey] -= qtyRaw;
    if (giverDuoc[pillKey] <= 0) delete giverDuoc[pillKey];
    giverBuff.cho_dan_count = choCount + qtyRaw;
    giverBuff.cho_dan_date = today;

    const recipDuoc = { ...(recipient.dan_duoc || {}) };
    recipDuoc[pillKey] = (recipDuoc[pillKey] || 0) + qtyRaw;
    recipBuff.nhan_dan_count = nhanCount + qtyRaw;
    recipBuff.nhan_dan_date = today;

    const pgClient = await pool.connect();
    try {
      await pgClient.query('BEGIN');
      await pgClient.query(
        'UPDATE players SET dan_duoc=$1, buff_active=$2 WHERE user_id=$3',
        [JSON.stringify(giverDuoc), JSON.stringify(giverBuff), giverId],
      );
      await pgClient.query(
        'UPDATE players SET dan_duoc=$1, buff_active=$2 WHERE user_id=$3',
        [JSON.stringify(recipDuoc), JSON.stringify(recipBuff), recipientId],
      );
      await pgClient.query('COMMIT');
    } catch (err) {
      await pgClient.query('ROLLBACK').catch(() => {});
      log.error('DB transaction lỗi:', err?.message || err);
      return interaction.editReply({ content: '❌ Lỗi hệ thống, vui lòng thử lại!' });
    } finally {
      pgClient.release();
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🎁 Cho Đan Thành Công!')
          .setColor(3447003)
          .setDescription(
            `Đã gửi **${qtyRaw} viên** ${phamData.ten} ${dan?.ten || baseId} cho <@${recipientId}>!\n\nHôm nay bạn đã cho: **${choCount + qtyRaw}/10 đan**\nNgười nhận hôm nay: **${nhanCount + qtyRaw}/10 đan**`,
          )
          .setFooter({ text: 'Giới hạn 10 đan/người/ngày' }),
      ],
    });
  });
};
