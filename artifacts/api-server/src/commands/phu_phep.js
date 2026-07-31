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
  fmt, fmtLT, calcSpend, getCG, pBar, fTime, cdRem, cdRemMin, cdTs, embedClr,
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


reg("ve_phu", ["vp", "vephu"], async (n, t) => {
    const e = n.author.id,
      h = (t[0] || "xem").toLowerCase(),
      i = await getPlayer(e);
    if (!i) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("phu_luc" !== i.nghe)
      return n.reply({
        embeds: [
          errE("Lệnh này chỉ dành cho **📜 Phù Lục Sư**!\nĐổi đường tu: `-nghe chon phu_luc`"),
        ],
      });
    if ("xem" === h) {
      const t = i.phu_luc || {};
      const e = new EmbedBuilder()
          .setTitle("📜 Phù Lục Sư — Kho Phù Lục")
          .setColor(10181046)
          .setDescription(
            "`-ve_phu tao <id>` — Vẽ | `-dung_phu <id>` — Dùng\n━━━━━━━━━━━━━━━━━━━━",
          );
      for (const n of PHU_LUC_DATA) {
        if (n.limited) continue;
        e.addFields({
          name: `${n.emoji} ${n.ten} | \`${n.id}\``,
          value: `${fmtLT(n.phi)} | Tầng ${n.yeu_cau_cap} | Kho: **${t[n.id] || 0}×**\n*${n.mo_ta}*`,
          inline: !1,
        });
      }
      const limitedPhu = PHU_LUC_DATA.filter((n) => n.limited);
      if (limitedPhu.length > 0) {
        e.addFields({
          name: "💎 Phù Lục Limited (Chỉ nhận qua code)",
          value: limitedPhu.map((n) => `${n.emoji} **${n.ten}** | \`${n.id}\` | Kho: **${t[n.id] || 0}×**\n*${n.mo_ta}*`).join("\n"),
          inline: !1,
        });
      }
      return (
        e.addFields({
          name: "📜 Đặc Kỹ Phù Lục Sư",
          value:
            `• \`-phu_bo_tro @người\` — 3 Thảo + 4,000${CE("tult", "💠")} → Tặng **Tu Vi tức thì** cho đồng đạo · CD 2h\n• 💥 **Phá Cảnh Phù** *(limited/code)* — Dùng \`-dung_phu pha_canh_phu\` để xoá Bình Cảnh tức thì`,
          inline: !1,
        }),
        n.reply({ embeds: [e] })
      );
    }
    if ("tao" === h) {
      const h = (t[1] || "").toLowerCase(),
        a = PHU_LUC_DATA.find((n) => n.id === h);
      if (!a) return n.reply({ embeds: [errE(`Không tìm thấy \`${h}\`.`)] });
      if (a.limited) return n.reply({ embeds: [errE(`**${a.ten}** chỉ nhận qua code!`)] });
      if (i.canh_gioi < a.yeu_cau_cap)
        return n.reply({ embeds: [errE(`Cần tầng **${a.yeu_cau_cap}**!`)] });
      if (!calcSpend(i, a.phi))
        return n.reply({ embeds: [errE(`Cần **${fmt(a.phi)} ${CE("tult", "💠")}**!`)] });
      const cdKey = `ve_phu_cd_${a.id}`;
      const buff = typeof i.buff_active === "object" && i.buff_active ? i.buff_active : {};
      const cdLeft = cdRem(buff[cdKey], a.ve_cd_h || 1);
      if (cdLeft) return n.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Bút thần nghỉ ngơi! **${a.ten}** — Hết CD ${cdTs(buff[cdKey], a.ve_cd_h || 1)}`)] });
      const o = i.phu_luc || {};
      o[a.id] = (o[a.id] || 0) + 1;
      buff[cdKey] = Date.now();
      { const _s = calcSpend(i, a.phi);
        await db("UPDATE players SET linh_thach=$1, linh_thach_trung=$2, linh_thach_cao=$3, phu_luc=$4, buff_active=$5 WHERE user_id=$6", [
          _s.newThuong, _s.newTrung, _s.newCao, JSON.stringify(o), JSON.stringify(buff), e,
        ]); }
      return n.reply({
        embeds: [okE(
          `✍️ Vẽ thành công **${a.ten}**!\n` +
          `-${fmt(a.phi)} ${CE("tult", "💠")} | Kho: **${o[a.id]}×** | ${CE("cd_timer","⏳")} CD: **${a.ve_cd_h}h**`,
        )],
      });
    }
    return n.reply({ embeds: [errE("`-ve_phu xem` | `-ve_phu tao <id>`")] });
});

reg("dung_phu", ["dp", "dungphu"], async (n, t) => {
    const e = n.author.id,
      h = (t[0] || "").toLowerCase();
    if (!h) return n.reply({ embeds: [errE("Cú pháp: `-dung_phu <id>`")] });
    const i = await getPlayer(e);
    if (!i) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    const a = PHU_LUC_DATA.find((n) => n.id === h);
    if (!a) return n.reply({ embeds: [errE(`Không tìm thấy phù \`${h}\`.`)] });
    if (i.nghe !== 'phu_luc' && !a.limited)
      return n.reply({ embeds: [errE("Lệnh này chỉ dành cho **📜 Phù Lục Sư**!\nĐổi đường tu: `-nghe chon phu_luc`")] });
    const o = i.phu_luc || {};
    if (!o[a.id] || o[a.id] < 1)
      return n.reply({ embeds: [errE(`Không có **${a.ten}** trong kho!`)] });
    ((o[a.id] -= 1),
      await db("UPDATE players SET phu_luc=$1 WHERE user_id=$2", [JSON.stringify(o), e]));
    if ("pha_canh_phu" === a.id) {
      if (!i.binh_canh)
        return n.reply({
          embeds: [warnE("💥 **Phá Cảnh Phù** — Ngươi không đang bị Bình Cảnh phong bế!\nPhù lục đã tiêu tốn — không thể hoàn lại.")],
        });
      await db("UPDATE players SET binh_canh=FALSE WHERE user_id=$1", [e]);
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("💥 Phá Cảnh Phù Kích Hoạt — Bình Cảnh Tiêu Tan!")
            .setColor(16766720)
            .setDescription(
              `*Phù văn cực phẩm bùng nổ, kinh mạch tắc nghẽn tan biến trong chớp mắt!*\n\n🧱 ~~Bình Cảnh~~ ✅ **Đã xoá bỏ!**\n\n${CE("tip_icon","💡")} Đường đột phá đã thông — dùng \`-dot_pha\` khi Cảm Ngộ ≥ 60%!`,
            )
            .setFooter({ text: "Phá Cảnh Phù · Limited · Nhận qua code" }),
        ],
      });
    }
    if ("ho_than_phu" === a.id) {
      const buff = { ...(i.buff_active || {}), ho_than_phu: 1 };
      await db("UPDATE players SET buff_active=$1 WHERE user_id=$2", [JSON.stringify(buff), e]);
      return n.reply({
        embeds: [new EmbedBuilder().setTitle("🛡️ Hộ Thân Phù Kích Hoạt!").setColor(3447003)
          .setDescription(`*Phù văn kết giới bao phủ toàn thân, hào quang bảo hộ sáng rực!*\n\n🛡️ **Giảm 25% sát thương** nhận vào trong trận PVP tiếp theo.\n\n${CE("tip_icon","💡")} Dùng \`-thach_dau\` để áp dụng ngay!`)
          .setFooter({ text: "Hiệu lực: 1 trận PVP" })],
      });
    }
    if ("sat_phong_phu" === a.id) {
      const buff = { ...(i.buff_active || {}), sat_phong_phu: 1 };
      await db("UPDATE players SET buff_active=$1 WHERE user_id=$2", [JSON.stringify(buff), e]);
      return n.reply({
        embeds: [new EmbedBuilder().setTitle("⚔️ Sát Phong Phù Kích Hoạt!").setColor(15158332)
          .setDescription(`*Phù văn sát khí cuồn cuộn, linh lực tràn ngập phi khí chiến đấu!*\n\n⚔️ **Công Lực +30%** trong trận PVP tiếp theo.\n\n${CE("tip_icon","💡")} Dùng \`-thach_dau\` để áp dụng ngay!`)
          .setFooter({ text: "Hiệu lực: 1 trận PVP" })],
      });
    }
    if ("linh_hoi_phu" === a.id) {
      const hpMax = Number(i.hp_max) || 100;
      await db("UPDATE players SET hp=$1 WHERE user_id=$2", [hpMax, e]);
      return n.reply({
        embeds: [new EmbedBuilder().setTitle("💚 Linh Hồi Phù Kích Hoạt!").setColor(3066993)
          .setDescription(`*Linh khí thuần khiết từ phù văn thấm vào thân thể, vết thương lành lại tức thì!*\n\n💜 HP: **${fmt(Number(i.hp))}** ➜ **${fmt(hpMax)}** *(tối đa)*`)
          .setFooter({ text: "Hồi phục hoàn toàn" })],
      });
    }
    if ("tu_toc_phu" === a.id) {
      const cur = i.cam_ngo || 0;
      const gain = Math.floor(Math.random() * 8) + 5; // random 5–12
      const neo = Math.min(100, cur + gain);
      await db("UPDATE players SET cam_ngo=$1 WHERE user_id=$2", [neo, e]);
      return n.reply({
        embeds: [new EmbedBuilder().setTitle(`${CE("tia_set","⚡")} Tu Tốc Phù Kích Hoạt!`).setColor(16766720)
          .setDescription(`*Phù văn khai thông huyệt đạo, linh khí vận hành thông suốt, cảm ngộ đại tăng!*\n\n💭 Cảm Ngộ: **${cur}%** ➜ **${neo}%** *(+${gain}%)*\n\n${neo >= 60 ? "✅ Cảm Ngộ đủ để đột phá! Dùng `-dot_pha`" : `${CE("tip_icon","💡")} Cần thêm **${60-neo}%** để đột phá.`}`)
          .setFooter({ text: "Tăng Cảm Ngộ · +5~12%" })],
      });
    }
    if ("khai_ngo_phu" === a.id) {
      const cur = i.cam_ngo || 0;
      const gainCN = Math.floor(Math.random() * 8) + 8;  // random 8–15
      const gainKV = Math.floor(Math.random() * 5) + 4;  // random 4–8
      const neo = Math.min(100, cur + gainCN);
      await db("UPDATE players SET cam_ngo=$1, khi_van=LEAST(100,COALESCE(khi_van,30)+$2) WHERE user_id=$3", [neo, gainKV, e]);
      return n.reply({
        embeds: [new EmbedBuilder().setTitle("🌟 Khai Ngộ Phù Kích Hoạt!").setColor(16766720)
          .setDescription(`*Thiên phù khai mở trí tuệ, linh quang chói lòa — nhất niệm thành đạo!*\n\n💭 Cảm Ngộ: **${cur}%** ➜ **${neo}%** *(+${gainCN}%)*\n${CE("tukv","🍀")} Khí Vận: **+${gainKV}**\n\n${neo >= 60 ? "✅ Cảm Ngộ đủ để đột phá! Dùng `-dot_pha`" : `${CE("tip_icon","💡")} Cần thêm **${60-neo}%** để đột phá.`}`)
          .setFooter({ text: "Khai Ngộ + Khí Vận · CN +8~15% · KV 4–8" })],
      });
    }
    if ("thien_dia_phu" === a.id) {
      const hpMax = Number(i.hp_max) || 100;
      const cur = i.cam_ngo || 0;
      const gainCN = Math.floor(Math.random() * 7) + 8;   // random 8–14
      const gainKV = Math.floor(Math.random() * 5) + 6;   // random 6–10
      const neo = Math.min(100, cur + gainCN);
      await db("UPDATE players SET hp=$1, cam_ngo=$2, khi_van=LEAST(100,COALESCE(khi_van,30)+$3) WHERE user_id=$4", [hpMax, neo, gainKV, e]);
      return n.reply({
        embeds: [new EmbedBuilder().setTitle("☯️ Thiên Địa Phù Kích Hoạt — Thiên Địa Linh Lực!").setColor(10181046)
          .setDescription(`*Phù cực phẩm thu hút thiên địa linh lực, khí trường bao trùm vũ trụ — toàn thân phục hồi, tâm linh thăng hoa!*\n\n💜 HP: **${fmt(Number(i.hp))}** ➜ **${fmt(hpMax)}** *(tối đa)*\n💭 Cảm Ngộ: **${cur}%** ➜ **${neo}%** *(+${gainCN}%)*\n${CE("tukv","🍀")} Khí Vận: **+${gainKV}**\n\n${neo >= 60 ? "✅ Cảm Ngộ đủ để đột phá! Dùng `-dot_pha`" : `${CE("tip_icon","💡")} Cần thêm **${60-neo}%** để đột phá.`}`)
          .setFooter({ text: "Phù Cực Phẩm · CN +8~14% · KV 6–10" })],
      });
    }
});

