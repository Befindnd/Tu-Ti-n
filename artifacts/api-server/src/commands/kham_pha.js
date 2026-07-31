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

const NOI_TAI_AN_INFO = {
  tu_la: {
    ten: 'Bạo Sát Chi Bản',
    mo_ta: 'Thiên kiếp không khuất phục, Tu La bước từ máu lửa mà đến.',
    get hieu_ung() { return `${CE('tuatk','⚔️')} Bạo kích **+15%** vĩnh viễn`; },
    dieu_kien: '🩸 Tham gia **30 trận PvP thắng**',
    get emoji() { return CE('hm_tu_la','🔥'); },
    ce: 'hm_tu_la',
  },
  co_than: {
    ten: 'Cổ Thần Bất Diệt',
    mo_ta: 'Thần minh cổ đại, thiên địa nan địch — không có ngũ hành nào có thể khắc chế ngươi.',
    get hieu_ung() { return `${CE('tudef','🛡️')} Miễn khắc chế ngũ hành + DEF **+20%** vĩnh viễn · Miễn bạo kích`; },
    dieu_kien: `${CE("tia_set","⚡")} Vượt qua **Thiên Kiếp Nguyên Anh** (cảnh giới 18)`,
    get emoji() { return CE('hm_co_than','✨'); },
    ce: 'hm_co_than',
  },
  thien_long: {
    ten: 'Thiên Long Uy Linh',
    mo_ta: 'Long mạch tối thượng, thiên địa kính ngưỡng — uy lực của ngươi chấn động cả càn khôn.',
    hieu_ung: '👑 ATK **+45%**, DEF **+40%**, EXP **+25%** · Miễn mọi khắc chế ngũ hành · Bạo kích **+20%** · Hồi **10% HP**/lượt',
    get dieu_kien() { return `${CE('ft_thap','🏯')} Chinh phục **tầng 30 Tháp Thí Luyện** (tầng cuối)`; },
    get emoji() { return CE('hm_thien_long','🐲'); },
    ce: 'hm_thien_long',
  },
  hon_don_the: {
    ten: 'Hỗn Độn Khai Thiên',
    mo_ta: 'Trước khi trời đất phân chia, chỉ có hỗn độn — ngươi là hiện thân của thủy tổ vạn vật.',
    hieu_ung: '🌌 ATK **+60%**, DEF **+50%**, EXP **+30%** · Miễn mọi khắc chế · Không thể bị crit · Bạo kích **+30%** · Hồi **15% HP**/lượt',
    get dieu_kien() { return `${CE('tuatk','⚔️')} Thắng **100 trận PvP**`; },
    get emoji() { return CE('hm_hon_don','🌀'); },
    ce: 'hm_hon_don',
  },
};

reg('kham_pha_noi_tai', ['kham_pha', 'noi_tai_an'], async (n) => {
  const userId = n.author.id;
  const player = await getPlayer(userId);
  if (!player) return n.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });

  const hm = HUYET_MACH[player.huyet_mach];
  const info = NOI_TAI_AN_INFO[player.huyet_mach];
  const subCmd = (n.content.split(/\s+/)[1] || '').toLowerCase();

  // Huyết mạch không có nội tại ẩn
  if (!info) {
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🔍 Khám Phá Nội Tại Ẩn')
          .setColor(0x888888)
          .setDescription(
            `${CE(hm?.ce_name, hm?.emoji || '🩶')} **${hm?.ten || 'Phàm Huyết'}** không có nội tại ẩn.\n\n` +
            `*Chỉ Tu La Huyết và Cổ Thần Huyết mới ẩn chứa bí tịch cổ xưa.*`
          ),
      ],
    });
  }

  // Nội tại đã mở
  if (player.noi_tai_an_unlocked) {
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${info.emoji} Nội Tại Ẩn — Đã Khai Mở`)
          .setColor(0x00CC88)
          .setDescription(
            `${CE(info.ce, info.emoji)} **${hm?.ten}**\n\n` +
            `✅ **${info.ten}**\n*${info.mo_ta}*\n\n` +
            `${info.hieu_ung}`
          )
          .setFooter({ text: 'Nội tại ẩn của ngươi đã hoàn toàn thức tỉnh!' }),
      ],
    });
  }

  // Dùng Huyết Mạch Thạch để mở sớm
  if (subCmd === 'dung') {
    const thach = Number((player.linh_thao || {}).huyet_mach_thach || 0);
    if (thach < 1) {
      return n.reply({
        embeds: [
          warnE(`Ngươi không có **Huyết Mạch Thạch**!\n\n${CE('lt_huyet_mach_thach','💎')} Vật phẩm đặc biệt này có thể nhận từ sự kiện hoặc phần thưởng đặc biệt.`),
        ],
      });
    }
    const newThao = { ...(player.linh_thao || {}), huyet_mach_thach: thach - 1 };
    if (newThao.huyet_mach_thach === 0) delete newThao.huyet_mach_thach;
    await db(
      'UPDATE players SET noi_tai_an_unlocked=TRUE, linh_thao=$1 WHERE user_id=$2',
      [JSON.stringify(newThao), userId],
    );
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${info.emoji} NỘI TẠI ẨN — THỨC TỈNH!`)
          .setColor(info.ce === 'hm_tu_la' ? 0xFF4500 : 0xC0C0FF)
          .setDescription(
            `*Huyết Mạch Thạch tan vỡ, tinh hoa cổ đại truyền vào huyết mạch...*\n\n` +
            `${CE(info.ce, info.emoji)} **${hm?.ten}** · Nội Tại Ẩn Hiển Lộ:\n\n` +
            `> **${info.ten}**\n` +
            `> *${info.mo_ta}*\n` +
            `> ${info.hieu_ung}`
          )
          .setFooter({ text: `Tiêu 1 Huyết Mạch Thạch · Còn lại: ${thach - 1}` }),
      ],
    });
  }

  // Hiển thị trạng thái + điều kiện
  const pvpWins = player.pvp_wins || 0;
  const tienDoLine = player.huyet_mach === 'tu_la'
    ? `🩸 Trận thắng PvP: **${pvpWins}/30** ${pvpWins >= 30 ? '✅' : `(còn ${30 - pvpWins} trận)`}`
    : `${CE("tia_set","⚡")} Cảnh giới: **${getCG(player.canh_gioi).ten}** ${player.canh_gioi >= 18 ? '✅' : `(cần Nguyên Anh Sơ Kỳ)`}`;
  const thachCount = Number((player.linh_thao || {}).huyet_mach_thach || 0);

  return n.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`${info.emoji} Nội Tại Ẩn — Chưa Khai Mở`)
        .setColor(0x888888)
        .setDescription(
          `${CE(info.ce, info.emoji)} **${hm?.ten}** ẩn chứa một bí tịch chưa được đánh thức...\n\n` +
          `**Điều kiện tự động mở:**\n${info.dieu_kien}\n${tienDoLine}\n\n` +
          `**Hoặc dùng vật phẩm:**\n${CE('lt_huyet_mach_thach','💎')} Huyết Mạch Thạch: **${thachCount}** viên\n` +
          (thachCount > 0 ? `*Dùng \`-kham_pha_noi_tai dung\` để khai mở ngay!*` : `*Huyết Mạch Thạch có thể nhận từ sự kiện đặc biệt.*`)
        )
        .setFooter({ text: 'Khi điều kiện đủ, nội tại sẽ tự thức tỉnh trong trận chiến!' }),
    ],
  });
});

