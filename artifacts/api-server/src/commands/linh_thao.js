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
  fmt, getCG, pBar, fTime, cdRem, cdRemMin, cdTsMin, embedClr,
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
      ? `🌿 Hái được **${e.ten} ×${e.gia_tri}**!`
      : "${CE('warn_icon','⚠️')} **Túi quá nặng** — linh thảo rơi xuống đất! Dùng `-tui` để kiểm tra.";
  }
  return { kq: a, resultStr: o };
}

reg("kiem_linh_thao", ["klt", "kiemlinhthao"], async (n) => {
  const t = n.author.id,
    e = await getPlayer(t);
  if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
  if (e.nghe !== 'luyen_dan' && e.nghe !== 'duoc_su')
    return n.reply({ embeds: [errE(`Lệnh này chỉ dành cho **⚗️ Luyện Đan Sư** và **💉 Dược Sư**!\nDùng \`-nghe chon luyen_dan\` hoặc \`-nghe chon duoc_su\` để chọn nghề.`)] });
  const h = cdRemMin(e.kiem_thao_cd, 30);
  if (h)
    return n.reply({
      embeds: [warnE(`Cần nghỉ ngơi sau khi hái thảo!\nHết CD ${cdTsMin(e.kiem_thao_cd, 30)}.`)],
    });
  const i = LINH_THAO.filter((n) => e.canh_gioi >= n.yeu_cau_cap && !n.special);
  i.length || i.push(LINH_THAO[0]);
  const a = i.map((n) => Math.pow(Math.max(1, e.canh_gioi - n.yeu_cau_cap + 1), 2)),
    o = a.reduce((n, t) => n + t, 0);
  let c = Math.random() * o,
    _ = i[i.length - 1];
  for (let n = 0; n < i.length; n++)
    if (((c -= a[n]), c <= 0)) {
      _ = i[n];
      break;
    }
  const u = Math.floor(3 * Math.random()) + 1;
  if (!canAddToBag(e, "linh_thao", u, _.id)) {
    const h = getBagCapacity(
        e.canh_gioi || 0,
        e.bao_boi || [],
        e.bag_bonus_kg || 0,
        e.tui_nang_cap || 0,
      ),
      i = calcBagWeight(e);
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${CE('warn_icon','⚠️')} Túi Trữ Vật Quá Nặng!`)
          .setColor(15158332)
          .setDescription(
            `🎒 Đã dùng: **${i}/${h} kg**\nDùng \`-tui\` để xem và quản lý túi đồ.`,
          )
          .setFooter({ text: "Đột phá cảnh giới để mở rộng sức chứa túi" }),
      ],
    });
  }
  const r = { ...(e.linh_thao || {}) };
  ((r[_.id] = (r[_.id] || 0) + u),
    await db("UPDATE players SET linh_thao=$1, kiem_thao_cd=$2 WHERE user_id=$3", [
      JSON.stringify(r),
      Date.now(),
      t,
    ]));
  const s = DIA_DANH_HAI_THAO[Math.floor(Math.random() * DIA_DANH_HAI_THAO.length)],
    l = calcBagWeight({ ...e, linh_thao: r }),
    m = getBagCapacity(e.canh_gioi || 0, e.bao_boi || [], e.bag_bonus_kg || 0, e.tui_nang_cap || 0);
  return n.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`🌿 Hái Linh Thảo — ${_.emoji} ${_.ten}`)
        .setColor(3066993)
        .setDescription(
          `${_.emoji} +**${u}x ${_.ten}**!\nKho: **${r[_.id]}x**`,
        )
        .setFooter({ text: `CD: 30ph | Túi: ${l}/${m}kg` }),
    ],
  });
});

