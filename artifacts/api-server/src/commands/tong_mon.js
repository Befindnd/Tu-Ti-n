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
  fmt, fmtLT, calcSpend, getCG, pBar, fTime, cdRem, cdRemMin, embedClr,
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





reg("tong_mon", ["tm", "mon_phai", "tongmon"], async (msg, args) => {
    const e = msg.author.id,
      h = (args[0] || "xem").toLowerCase();
    if ("xem" === h || "list" === h) {
      const t = new EmbedBuilder()
        .setTitle("🏯 Tứ Đại Tông Môn — Chọn Môn Phái")
        .setColor(15105570)
        .setDescription(
          `${SEP2}\n${CE("tip_icon","💡")} \`-tong_mon gia_nhap <id>\` · \`-tong_mon roi\` · \`-tong_mon cap\` xem cấp bậc`,
        );
      for (const [n, e] of Object.entries(TONG_MON)) {
        const h = CONG_PHAP.find((n) => n.id === e.cong_phap_doc_quyen);
        t.addFields({
          name: `${e.emoji} ${e.ten} | \`${n}\``,
          value: `Tầng **${e.yeu_cau_cap}** | ${fmtLT(e.phi)}\n*${e.mo_ta}*\n${CE("nt_tien","✨")} ${e.mo_ta_bonus}\n📖 **${h?.ten || e.cong_phap_doc_quyen}**`,
          inline: !1,
        });
      }
      return msg.reply({ embeds: [t] });
    }
    if ("cap" === h || "cap_bac" === h) {
      const t = new EmbedBuilder()
        .setTitle("🏯 Cấp Bậc Trong Tông Môn")
        .setColor(16766720)
        .setDescription(
          `*Con đường trong tông môn — từ Ngoại Môn đến Tông Chủ, phải cạnh tranh thật!*\n\n${SEP}\n\`-tong_mon len_cap\` để thăng cấp\n${SEP}`,
        );
      for (const n of TONG_MON_CAP_BAC)
        t.addFields({
          name: `${n.emoji} ${n.ten}`,
          value: `Yêu cầu: Tầng **${n.yeu_cau_canh}** + **${fmt(n.yeu_cau_dong)} ${CE("tult", "💠")}** cống nạp\n${CE("nt_tien","✨")} Bonus x${n.bonus_mult}\n*${n.mo_ta}*`,
          inline: !1,
        });
      return msg.reply({ embeds: [t] });
    }
    const i = await getPlayer(e);
    if (!i) return msg.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });
    if ("gia_nhap" === h) {
      const h = (args[1] || "").toLowerCase();
      if (!TONG_MON[h])
        return msg.reply({
          embeds: [errE(`Không có tông môn \`${h}\`.\nDùng \`-tong_mon xem\` để xem.`)],
        });
      if (i.tong_mon)
        return msg.reply({
          embeds: [
            warnE(
              `Đang ở **${TONG_MON[i.tong_mon]?.ten || i.tong_mon}** rồi!\nDùng \`-tong_mon roi\` trước.`,
            ),
          ],
        });
      const a = TONG_MON[h];
      if (i.canh_gioi < a.yeu_cau_cap)
        return msg.reply({
          embeds: [errE(`Cần tầng **${a.yeu_cau_cap}** để gia nhập **${a.ten}**!`)],
        });
      if (!calcSpend(i, a.phi))
        return msg.reply({
          embeds: [
            errE(
              `Cần **${fmt(a.phi)} ${CE("tult", "💠")}** để gia nhập!\nHiện có: **${fmt(i.linh_thach)} ${CE("tult", "💠")}**`,
            ),
          ],
        });
      const o = CONG_PHAP.find((n) => n.id === a.cong_phap_doc_quyen);
      const _stm = calcSpend(i, a.phi);
      return (
        await db(
          "UPDATE players SET tong_mon=$1, linh_thach=$2, linh_thach_trung=$3, linh_thach_cao=$4, cong_phap=$5, tong_mon_cap='ngoai_mon' WHERE user_id=$6",
          [h, _stm.newThuong, _stm.newTrung, _stm.newCao, a.cong_phap_doc_quyen, e],
        ),
        msg.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${a.emoji} Gia Nhập ${a.ten}!`)
              .setColor(16766720)
              .setDescription(
                `✅ **${msg.author.username}** gia nhập **${a.ten}**!\n⚪ Cấp bậc: **Ngoại Môn Đệ Tử**\n${CE("nt_tien","✨")} ${a.mo_ta_bonus}\n📖 ${o?.ten||a.cong_phap_doc_quyen}\n-${fmt(a.phi)} ${CE("tult","💠")}`,
              ),
          ],
        })
      );
    }
    if ("len_cap" === h) {
      if (!i.tong_mon) return msg.reply({ embeds: [errE("Chưa gia nhập tông môn nào!")] });
      const t =
          TONG_MON_CAP_BAC.find((n) => n.id === (i.tong_mon_cap || "ngoai_mon")) ||
          TONG_MON_CAP_BAC[0],
        h = TONG_MON_CAP_BAC.indexOf(t);
      if (h >= TONG_MON_CAP_BAC.length - 1)
        return msg.reply({
          embeds: [okE("👑 Ngươi đã là **Tông Chủ** — đỉnh cao quyền lực tông môn!")],
        });
      const a = TONG_MON_CAP_BAC[h + 1];
      if (i.canh_gioi < a.yeu_cau_canh)
        return msg.reply({
          embeds: [
            errE(
              `Cần tầng **${a.yeu_cau_canh}** để thăng lên **${a.ten}**!\nCảnh giới hiện tại: **${getCG(i.canh_gioi).ten}**`,
            ),
          ],
        });
      if (!calcSpend(i, a.yeu_cau_dong))
        return msg.reply({
          embeds: [
            errE(
              `Cần cống nạp **${fmt(a.yeu_cau_dong)} ${CE("tult", "💠")}** để thăng lên **${a.ten}**!\nHiện có: **${fmt(i.linh_thach)} ${CE("tult", "💠")}**`,
            ),
          ],
        });
      { const _s = calcSpend(i, a.yeu_cau_dong);
        await db("UPDATE players SET tong_mon_cap=$1, linh_thach=$2, linh_thach_trung=$3, linh_thach_cao=$4 WHERE user_id=$5", [
          a.id, _s.newThuong, _s.newTrung, _s.newCao, e,
        ]); }
      const o = TONG_MON[i.tong_mon];
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${a.emoji} Thăng Cấp Tông Môn — ${a.ten}!`)
            .setColor(16766720)
            .setDescription(
              `*${o?.emoji || "🏯"} ${o?.ten || i.tong_mon} công nhận tài năng và cống hiến của ngươi...*\n\n${t.emoji} **${t.ten}** → ${a.emoji} **${a.ten}**\n\n${CE("nt_tien","✨")} **Bonus Mới:** Tất cả chỉ số chiến đấu × **${a.bonus_mult}**\n*${a.mo_ta}*\n\n-**${fmt(a.yeu_cau_dong)} ${CE("tult", "💠")}** (cống nạp tông môn)`,
            ),
        ],
      });
    }
    if ("roi" === h) {
      if (!i.tong_mon) return msg.reply({ embeds: [warnE("Chưa gia nhập tông môn nào!")] });
      const t = TONG_MON[i.tong_mon];
      return (
        await db("UPDATE players SET tong_mon=NULL, tong_mon_cap='ngoai_mon' WHERE user_id=$1", [
          e,
        ]),
        msg.reply({
          embeds: [
            okE(
              `Đã rời **${t?.ten || i.tong_mon}**.\n*Công pháp độc quyền vẫn giữ nguyên. Cấp bậc reset về Ngoại Môn nếu gia nhập lại.*`,
            ),
          ],
        })
      );
    }
    if ("thong_tin" === h || "info" === h) {
      if (!i.tong_mon)
        return msg.reply({
          embeds: [warnE("Chưa gia nhập tông môn nào!\nDùng `-tong_mon xem` để xem danh sách.")],
        });
      const t = TONG_MON[i.tong_mon],
        e = CONG_PHAP.find((n) => n.id === t.cong_phap_doc_quyen),
        h =
          TONG_MON_CAP_BAC.find((n) => n.id === (i.tong_mon_cap || "ngoai_mon")) ||
          TONG_MON_CAP_BAC[0],
        a = TONG_MON_CAP_BAC.indexOf(h),
        o = a < TONG_MON_CAP_BAC.length - 1 ? TONG_MON_CAP_BAC[a + 1] : null;
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${t.emoji} ${t.ten}`)
            .setColor(15105570)
            .setDescription(
              `${h.emoji} **${h.ten}** · ×${h.bonus_mult} mọi chỉ số\n📖 ${e?.ten}\n\n` +
                (o ? `**Thăng ${o.emoji} ${o.ten}:** T${o.yeu_cau_canh} + ${fmt(o.yeu_cau_dong)} ${CE("tult","💠")} → `+"`-tong_mon len_cap`" : "👑 Đã đạt cấp tối đa!"),
            ),
        ],
      });
    }
    return msg.reply({
      embeds: [errE("`-tong_mon [xem | gia_nhap <id> | roi | thong_tin | cap | len_cap]`")],
    });
  });

