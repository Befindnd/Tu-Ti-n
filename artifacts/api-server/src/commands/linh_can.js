'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer, awardBiPhap, awardLinhThao } = require('../db/players');
const { CE } = require('../systems/emoji');
const {
  DAI_CANH_GIOI, CANH_GIOI, NGO_TINH_PHAM, getDaiCanhGioiIndex, getDCGDiff,
  LINH_CAN, LINH_CAN_MO_TA, HUYET_MACH, CO_THU,
  CONG_PHAP, BI_PHAP, NGHE, VU_KHI, BAO_BOI, LINH_THAO,
  NGOC_GIAN_DATA, DAN_DUOC, DAN_PHAM, REN_LUYEN_CAP, calcDanTyLe, PHU_LUC_DATA,
  THIEN_KIEP_KQ, THIEN_KIEP_NGUONG, getThienKiepLoai,
  PHONG_THUY_VAN, DONG_PHU, TRUYEN_THUA_LIST,
  TONG_MON_CAP_BAC, TONG_MON, CO_DUYEN_EVENTS,
  BI_CANH_SESSIONS, BI_CANH_CD_H, BI_CANH_LUA_CHON,
  NHIEM_VU_LIST,
  CP_GIA, BP_GIA,
  CG_EMOJI, getNgoTinh, getKhiVanBonus, getNhanQua, getTT,
} = require('../data');
const {
  getDailyMissionState,
  BAG_WEIGHTS, getDanKg, getBagCapacity, calcBagWeight, canAddToBag,
  DONATE_DATA, findDonateGoi, buildDonateEmbed, buildDonateButtons, buildDonateCatSelect,
  fmt, getCG, pBar, fTime, cdRem, cdRemMin, embedClr,
  randomLC, randomHM, getTamMa,
  SEP, SEP2, SEP3, errE, warnE, okE,
  CHIEU_THUC, getChieu,
  tinhCS, calcEXP_active,
  COMMANDS, reg, RATE_LIMIT, checkRateLimit,
  DT_TEN, DT_HIEU, PHI_TU_CHUA, PHI_DUOC_SU, CD_TU_H, CD_DS_TU_H, CD_DS_NGUOI,
} = require('../utils');
const {
  COMBAT_SESSIONS, RECENTLY_ENDED, markRecentlyEnded, wasRecentlyEnded,
  BP_COMBAT, hpBar, hpHeart, makeCombatEmbed,
  makePVPInviteRow, makePVPInviteRowDisabled, makePVPCombatRow,
  resolveCombatTurn, endCombat, scheduleTurnTimeout, applyCombatStats,
} = require('../game/combat');
const { checkNgheDotPha } = require('./cultivation');
const ADMIN_ID = process.env.ADMIN_ID || '';




reg('linh_can', ['linhcan', 'linh_can_doi'], async (msg, args) => {
  const userId = msg.author.id;
  const sub = (args[0] || 'xem').toLowerCase();
  const player = await getPlayer(userId);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });

  const lc = LINH_CAN[player.linh_can] || LINH_CAN.moc;

  if (sub !== 'doi') {
    const lcKeys = Object.keys(LINH_CAN);
    const tiLeStr = lcKeys.map(k => {
      const d = LINH_CAN[k];
      return `${d.emoji} **${d.ten}** — ATK +${Math.round(d.bonus_atk*100)}% · DEF +${Math.round(d.bonus_def*100)}% · EXP +${Math.round(d.bonus_exp*100)}%`;
    }).join('\n');
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${CE('ve_linh_can','🔮')} Linh Căn — Thiên Mệnh Tu Tiên`)
          .setColor(0x9b59b6)
          .addFields(
            { name: `${lc.emoji} Linh Căn Hiện Tại`, value: `**${lc.ten}**\n*${LINH_CAN_MO_TA[player.linh_can]}*\n\n${CE('tuatk','⚔️')} ATK +${Math.round(lc.bonus_atk*100)}% · ${CE('tudef','🛡️')} DEF +${Math.round(lc.bonus_def*100)}% · ${CE('tutv','📈')} EXP +${Math.round(lc.bonus_exp*100)}%`, inline: false },
            { name: `${CE('ve_linh_can','🔮')} Vé Đổi Linh Căn`, value: `Bạn có **${player.ve_doi_linh_can || 0} vé**\nDùng \`-linh_can doi\` để đổi ngẫu nhiên (xác suất đều nhau)\n💠 Đổi vé dư lấy **300 Linh Thạch/vé** → dùng \`-tb\` tab Linh Thạch`, inline: false },
            { name: '📋 Tất Cả Linh Căn', value: tiLeStr, inline: false },
          ),
      ],
    });
  }

  if (Number(player.ve_doi_linh_can || 0) < 1)
    return msg.reply({
      embeds: [errE(`Không có **Vé Đổi Linh Căn** ${CE('ve_linh_can','🔮')}!\nNhận qua giftcode sự kiện hoặc donate đặc biệt.`)],
    });

  // Phân tầng hiếm cho vé đổi (cao hơn bat_dau vì tốn công/tiền)
  // Huyền Thoại: Thiên 5% | Cực Hiếm: Hỗn Độn 8%
  // Hiếm: Âm · Dương · Lôi · Phong 8% mỗi = 32% | Thường: Kim · Mộc · Thủy · Hỏa · Thổ 11% mỗi = 55%
  const roll = Math.random() * 100;
  let newKey;
  if (roll < 5)  newKey = 'thien';
  else if (roll < 13) newKey = 'hon_don';
  else if (roll < 21) newKey = 'am';
  else if (roll < 29) newKey = 'duong';
  else if (roll < 37) newKey = 'thunder';
  else if (roll < 45) newKey = 'phong';
  else if (roll < 56) newKey = 'kim';
  else if (roll < 67) newKey = 'moc';
  else if (roll < 78) newKey = 'thuy';
  else if (roll < 89) newKey = 'hoa';
  else newKey = 'tho';
  const newLc = LINH_CAN[newKey];

  await db(
    'UPDATE players SET linh_can=$1, ve_doi_linh_can=GREATEST(0,ve_doi_linh_can-1) WHERE user_id=$2',
    [newKey, userId],
  );

  const same = newKey === player.linh_can;
  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`${CE('ve_linh_can','🔮')} Vé Đổi Linh Căn — Kết Quả!`)
        .setColor(same ? 0x888888 : 0x9b59b6)
        .setDescription(
          '*Thiên cơ vận chuyển, linh căn thiên mệnh được định đoạt...*\n\n' +
          (same
            ? `${newLc.emoji} **${newLc.ten}** — Linh căn **không đổi** (thiên mệnh đã định!)`
            : `${lc.emoji} **${lc.ten}** ➜ ${newLc.emoji} **${newLc.ten}**`) +
          `\n\n⚔️ ATK +${Math.round(newLc.bonus_atk*100)}% · 🛡️ DEF +${Math.round(newLc.bonus_def*100)}% · 📈 EXP +${Math.round(newLc.bonus_exp*100)}%` +
          `\n*${LINH_CAN_MO_TA[newKey]}*` +
          `\n\n${CE('ve_linh_can','🔮')} Tiêu **1 Vé Đổi Linh Căn**\n*Còn lại: **${Math.max(0, Number(player.ve_doi_linh_can || 0) - 1)} vé***`,
        )
        .setFooter({ text: 'Thường 11%×5 · Hiếm 8%×4 · Hỗn Độn 8% · 🌟Thiên 5% · ♾️Vô Cực chỉ từ Donate' }),
    ],
  });
});

