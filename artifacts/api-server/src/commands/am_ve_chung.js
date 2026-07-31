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
  CONG_PHAP, BI_PHAP, NGHE, VU_KHI, BAO_BOI, LINH_THAO, KHOANG_VAT,
  NGOC_GIAN_DATA, DAN_DUOC, DAN_PHAM, DAN_PHAM_ORDER, REN_LUYEN_CAP, calcDanTyLe, PHU_LUC_DATA,
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
  BAG_WEIGHTS, getDanKg, getBagCapacity, calcBagWeight, canAddToBag, calcMaxLinhThach,
  DONATE_DATA, findDonateGoi, buildDonateEmbed, buildDonateButtons, buildDonateCatSelect,
  fmt, getCG, pBar, fTime, cdRem, cdRemMin, cdTs, cdTsMin, embedClr,
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
const { LINH_THU_LOOT_ITEMS } = require('../data/linh_thu_data');
const ADMIN_ID = process.env.ADMIN_ID || '';

// ── Ám Vệ ─────────────────────────────────────────────────────────────────


reg("trinh_sat", ["ts_am", "trinhsat"], async (n) => {
    const t = n.author.id,
      e = n.mentions.users.first();
    if (!e || e.id === t || e.bot)
      return n.reply({ embeds: [errE("Cú pháp: `-trinh_sat @người_chơi`")] });
    const h = await getPlayer(t);
    if (!h) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("an_sat" !== h.nghe)
      return n.reply({
        embeds: [errE(`Lệnh này chỉ dành cho **${CE("ft_am_sat","🗡️")} Ám Vệ**!\nĐổi: \`-nghe chon an_sat\``)],
      });
    const i = cdRemMin(h.trinh_sat_cd, 30);
    if (i) return n.reply({ embeds: [warnE(`Đang ẩn mình theo dõi! Hết CD ${cdTsMin(h.trinh_sat_cd, 30)}.`)] });
    const a = await getPlayer(e.id);
    if (!a) return n.reply({ embeds: [errE(`**${e.username}** chưa tu tiên!`)] });
    await db("UPDATE players SET trinh_sat_cd=$1 WHERE user_id=$2", [Date.now(), t]);
    const o = tinhCS(a),
      c = getCG(a.canh_gioi),
      _ = LINH_CAN[a.linh_can] || LINH_CAN.kim,
      u = HUYET_MACH[a.huyet_mach] || HUYET_MACH.pham,
      r = NGHE[a.nghe],
      s = VU_KHI.find((n) => n.id === a.vu_khi),
      l =
        (a.bi_phap || [])
          .map((n) => {
            const t = BI_PHAP.find((t) => t.id === n);
            return t ? t.ten : n;
          })
          .join(", ") || "Không có",
      m = (a.bao_boi || []).length;
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${CE("ft_am_sat","🗡️")} Trinh Sát — **${e.username}**`)
          .setColor(2899536)
          .setThumbnail(e.displayAvatarURL())
          .setDescription("*Bóng tối thu thập tin tức về địch thủ...*")
          .addFields(
            {
              name: `${CE("tuatk","⚔️")} Chiến Lực`,
              value: `${CE("tuatk", "⚔️")} Công: **${fmt(o.atk)}**  ·  ${CE("tudef", "🛡️")} Thủ: **${fmt(o.def)}**\n${CE("tuhp", "💜")} Linh Lực: **${fmt(a.hp)}/${fmt(o.hp_max)}**`,
              inline: !1,
            },
            {
              name: `${CE("tucn","🌟")} Căn Cốt`,
              value: `${CG_EMOJI(a.canh_gioi)} **${c.ten}**\n${_.emoji} ${_.ten}  ·  ${CE(u.ce_name, u.emoji)} ${u.ten}\n${r?.emoji || "？"} ${r?.ten || "Chưa chọn đường tu"}`,
              inline: !1,
            },
            {
              name: `${CE('ng_phu_luc_su','📜')} Bí Pháp & Trang Bị`,
              value: `${CE('ng_phu_luc_su','📜')} Bí Pháp: *${l}*\n🔮 Linh Bảo: **${m}** món\n${CE("tuatk", "⚔️")} Phi Khí: ${s ? `${CE(s.ce_name, s.pham || '⚔️')} ${s.ten}` : "Chưa có"}`,
              inline: !1,
            },
          )
          .setFooter({ text: "Trinh Sát | Ám Vệ Độc Quyền | CD: 30ph" }),
      ],
    });
});

reg("an_ngu", ["anngu", "angu"], async (n) => {
    const t = n.author.id,
      e = await getPlayer(t, n.author.username);
    if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("an_sat" !== e.nghe)
      return n.reply({
        embeds: [errE(`Lệnh này chỉ dành cho **${CE("ft_am_sat","🗡️")} Ám Vệ**!\nĐổi: \`-nghe chon an_sat\``)],
      });
    const h = 3e3;
    if (Number(e.an_ngu_until || 0) > Date.now()) {
      const t = Math.ceil((Number(e.an_ngu_until) - Date.now()) / 6e4);
      return n.reply({
        embeds: [
          okE(
            `🌫️ Đang trong trạng thái **An Ngu**!\n⏱️ Còn hiệu lực: **${fTime(Math.ceil((Number(e.an_ngu_until) - Date.now()) / 1000))}**\n\n*Không kẻ nào có thể tìm thấy ngươi...*`,
          ),
        ],
      });
    }
    const i = cdRem(e.an_ngu_cd, 6);
    if (i)
      return n.reply({
        embeds: [warnE(`${CE("cd_timer","⏳")} Cần hồi phục sau khi ẩn mình!\nHết CD ${cdTs(e.an_ngu_cd, 6)}.`)],
      });
    if (Number(e.linh_thach) < h)
      return n.reply({
        embeds: [
          errE(
            `Cần **${fmt(h)} ${CE("tult", "💠")}** để ẩn mình!\nHiện có: **${fmt(Number(e.linh_thach))} ${CE("tult", "💠")}**`,
          ),
        ],
      });
    const a = Date.now() + 216e5;
    return (
      await db(
        "UPDATE players SET an_ngu_until=$1, an_ngu_cd=$2, linh_thach=GREATEST(0,linh_thach-$3) WHERE user_id=$4",
        [a, Date.now(), h, t],
      ),
      n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🌫️ An Ngu — Hòa Mình Vào Bóng Tối!")
            .setColor(2899536)
            .setDescription(
              `🌫️ **Miễn nhiễm Ám Sát** trong **6 giờ** tới!\n⏱️ Hiệu lực đến: <t:${Math.floor(a / 1e3)}:R>\n${CE("tult", "💠")} Tiêu **-${fmt(h)} Linh Thạch**`,
            )
            .setFooter({ text: "Ám Vệ Độc Quyền | CD: 6h" }),
        ],
      })
    );
});

