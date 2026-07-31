'use strict';
const { LINH_THU_CRAFT, LINH_THU_LOOT_ITEMS } = require('../data/linh_thu_data');
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer, awardBiPhap, awardLinhThao } = require('../db/players');
const { CE, getCEUrl, getCardAttachment } = require('../systems/emoji');
const {
  DAI_CANH_GIOI, CANH_GIOI, NGO_TINH_PHAM, getDaiCanhGioiIndex, getDCGDiff,
  LINH_CAN, LINH_CAN_MO_TA, HUYET_MACH, CO_THU,
  CONG_PHAP, BI_PHAP, NGHE, VU_KHI, BAO_BOI, LINH_THAO,
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
  fmt, fmtLT, calcSpend, calcMultiSpend, MIXED_SPEND_THRESHOLD, getCG, pBar, fTime, cdRem, cdRemMin, embedClr,
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
const ADMIN_ID = process.env.ADMIN_ID || '';


const DIA_DANH_HAI_THAO = [
  "khe núi Vạn Linh sâu thẳm",
  "vách đá Thái Âm chơi vơi",
  "đầm lầy Linh Mộc huyền ảo",
  "đỉnh Thiên Phong mây phủ",
  "hang động Bích Lâm rêu phong cổ kính",
  "bờ suối Linh Tuyền nước trong vắt",
  "rừng Huyền Mộc ngàn năm tuổi",
];
async function xuLyBiCanhKetQua(n, t, e) {
  tinhCS(n);
  const h = 100 * Math.random();
  let i = 0,
    a = e.ket_qua[e.ket_qua.length - 1];
  for (const n of e.ket_qua)
    if (((i += n.rate), h < i)) {
      a = n;
      break;
    }
  let o = (a.mo_ta || "").replace(/Linh Thạch/g, CE("tult", "💠") + " Linh Thạch");
  const c = getKhiVanBonus(n.khi_van || 30);
  if ("linh_thach" === a.loai) {
    const e = getTT(n, "drop"),
      h = Math.floor(a.gia_tri * (1 + c.bi_canh_bonus + e)),
      lt = calcMaxLinhThach(n, h);
    if (lt > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [lt, t]);
    o = a.mo_ta.replace(fmt(a.gia_tri), lt > 0 ? fmt(lt) : `0 *(túi đầy)*`);
  } else if ("mat_hp" === a.loai) {
    const e = Math.floor(Number(n.linh_thach) * a.gia_tri * 0.06);
    (await db("UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1) WHERE user_id=$2", [e, t]),
      (o = a.mo_ta.replace("Linh Lực", "Linh Thạch") + ` *(−**${fmt(e)}** ${CE("tult", "💠")})*`));
  } else if ("mat_linh_thach" === a.loai) {
    const e = Math.floor(Number(n.linh_thach) * a.gia_tri);
    await db("UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1) WHERE user_id=$2", [e, t]);
  } else if ("heal" === a.loai) {
    const ltHeal = Math.floor(1500 * a.gia_tri),
      ltH = calcMaxLinhThach(n, ltHeal);
    if (ltH > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [ltH, t]);
    o = a.mo_ta.replace("Linh Lực", "Linh Thạch") + ` (+**${fmt(ltH)}** ${CE("tult", "💠")}${ltH < ltHeal ? " *(túi đầy)*" : ""})`;
  } else if ("heal_linh_thach" === a.loai) {
    const ltHT = calcMaxLinhThach(n, a.gia_tri);
    if (ltHT > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [ltHT, t]);
  }
  else if ("exp" === a.loai) {
    const e = Math.floor(calcEXP_active(n) * a.gia_tri),
      h = CANH_GIOI[n.canh_gioi + 1],
      i = Math.floor(10 * Math.random()) + 5,
      c = Math.min(100, (n.cam_ngo || 0) + i);
    (h
      ? await db("UPDATE players SET exp=LEAST(exp+$1,$2), cam_ngo=$3 WHERE user_id=$4", [
          e,
          h.exp_can,
          c,
          t,
        ])
      : await db("UPDATE players SET exp=exp+$1, cam_ngo=$2 WHERE user_id=$3", [e, c, t]),
      (o = `${CE("tutv", "📈")} +**${fmt(e)}** Tu Vi | Cảm Ngộ +**${i}%** (${c}%)`));
  } else if ("bi_phap_random" === a.loai) o = await awardBiPhap(n, t);
  else if ("linh_thao_random" === a.loai) {
    const e = await awardLinhThao(n, t, a.gia_tri);
    o = e
      ? `${CE("lt_linh_chi","🌿")} Hái được **${e.ten} ×${e.gia_tri}**!`
      : "${CE('warn_icon','⚠️')} **Túi quá nặng** — linh thảo rơi xuống đất! Dùng `-tui` để kiểm tra.";
  }
  return { kq: a, resultStr: o };
}


  reg("dong_phu", ["dongphu"], async (n, t) => {
    const e = n.author.id,
      h = (t[0] || "xem").toLowerCase();
    if ("xem" === h) {
      const t = new EmbedBuilder()
        .setTitle(`${CE("dp_linh_son","🏔️")} Động Phủ Tu Luyện`)
        .setColor(9323693)
        .setDescription(
          "`-dong_phu thue <id>` để thuê | `-dong_phu roi` để rời\n━━━━━━━━━━━━━━━━━━━━",
        );
      for (const n of DONG_PHU)
        t.addFields({
          name: `${n.emoji} ${n.ten} | \`${n.id}\``,
          value: `Tầng **${n.yeu_cau_cap}** | ${fmtLT(n.gia_thue)}\n${CE("tutv", "📈")}+${Math.round(100 * n.exp_bonus)}% ${CE("tuatk", "⚔️")}+${Math.round(100 * n.atk_bonus)}% ${CE("tudef", "🛡️")}+${Math.round(100 * n.def_bonus)}%\n*${n.mo_ta}*`,
          inline: !1,
        });
      return n.reply({ embeds: [t] });
    }
    const i = await getPlayer(e);
    if (!i) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("thue" === h) {
      const h = DONG_PHU.find((n) => n.id === (t[1] || "").toLowerCase());
      return h
        ? i.canh_gioi < h.yeu_cau_cap
          ? n.reply({ embeds: [errE(`Cần tầng **${h.yeu_cau_cap}** để vào **${h.ten}**!`)] })
          : !(h.gia_thue >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(i, h.gia_thue) : calcSpend(i, h.gia_thue))
            ? n.reply({
                embeds: [
                  errE(`Cần **${fmt(h.gia_thue)} ${CE("tult", "💠")}** để thuê **${h.ten}**!`),
                ],
              })
            : (await (async () => { const _s = h.gia_thue >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(i, h.gia_thue) : calcSpend(i, h.gia_thue); await db("UPDATE players SET dong_phu=$1, linh_thach=$2, linh_thach_trung=$3, linh_thach_cao=$4 WHERE user_id=$5", [h.id, _s.newThuong, _s.newTrung, _s.newCao, e]); })(),
              n.reply({
                embeds: [
                  new EmbedBuilder()
                    .setTitle(`${h.emoji} Thuê ${h.ten} Thành Công!`)
                    .setColor(9323693)
                    .setDescription(
                      `${CE("tutv", "📈")}+${Math.round(100 * h.exp_bonus)}% Tu Vi | ${CE("tuatk", "⚔️")}+${Math.round(100 * h.atk_bonus)}% Công Lực | ${CE("tudef", "🛡️")}+${Math.round(100 * h.def_bonus)}% Thủ Lực\n\n-**${fmt(h.gia_thue)} ${CE("tult", "💠")}**`,
                    ),
                ],
              }))
        : n.reply({ embeds: [errE("Dùng `-dong_phu xem` để xem danh sách.")] });
    }
    if ("roi" === h) {
      if (!i.dong_phu) return n.reply({ embeds: [errE("Ngươi chưa thuê động phủ nào!")] });
      const t = DONG_PHU.find((n) => n.id === i.dong_phu);
      return (
        await db("UPDATE players SET dong_phu=NULL WHERE user_id=$1", [e]),
        n.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(9807270)
              .setDescription(`✅ Đã rời **${t?.ten || i.dong_phu}**.`),
          ],
        })
      );
    }
    return n.reply({ embeds: [errE("`-dong_phu [xem | thue <id> | roi]`")] });
  });

