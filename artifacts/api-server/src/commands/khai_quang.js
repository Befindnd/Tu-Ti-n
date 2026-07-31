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
  DAO_TU,
  NHIEM_VU_LIST,
  CP_GIA, BP_GIA,
  CG_EMOJI, getNgoTinh, getKhiVanBonus, getNhanQua, getTT,
} = require('../data');
const {
  getDailyMissionState,
  BAG_WEIGHTS, getDanKg, getBagCapacity, calcBagWeight, canAddToBag, calcMaxLinhThach,
  DONATE_DATA, findDonateGoi, buildDonateEmbed, buildDonateButtons, buildDonateCatSelect,
  fmt, getCG, pBar, fTime, cdRem, cdRemMin, cdTs, embedClr,
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
// ── Tỉ lệ kết quả Bí Cảnh thay đổi theo Đạo Tu ─────────────────────────
// Giá trị > 1 = outcome đó xảy ra nhiều hơn (có thể tốt HOẶC xấu)
// Giá trị < 1 = outcome đó xảy ra ít hơn
// ── Bí Cảnh: mỗi Đạo Tu có đúng 2 LỢI và 2 HẠI ──────────────────────────
// LỢI = tăng outcome tốt (>1) HOẶC giảm outcome xấu (<1 trên mat_linh_thach)
// HẠI = tăng outcome xấu (>1 trên mat_linh_thach) HOẶC giảm outcome tốt (<1)
const DAO_TU_BC_MOD = {
  kiem_tu: {
    linh_thach: 1.5, bi_phap_random: 1.4,       // LỢI: chiến lợi phẩm & bí pháp nhiều
    mat_linh_thach: 1.5, exp: 0.6,               // HẠI: liều lĩnh mất tài nguyên, học chậm
  },
  the_tu: {
    heal: 1.8, mat_linh_thach: 0.45,             // LỢI: hồi phục cực tốt, hiếm khi mất linh thạch
    exp: 0.55, bi_phap_random: 0.5,              // HẠI: ngộ tính cùn, không hiểu bí pháp
  },
  phap_tu: {
    exp: 1.5, bi_phap_random: 1.8,               // LỢI: học giỏi, thông thạo bí pháp
    mat_linh_thach: 1.4, linh_thach: 0.6,        // HẠI: thể chất yếu hay mất tiền, ít chiến lợi phẩm
  },
  ma_tu: {
    linh_thach: 1.6, bi_phap_random: 1.3,        // LỢI: may mắn tà đạo, tìm được bí pháp lạ
    mat_linh_thach: 1.7, exp: 0.65,              // HẠI: rủi ro cao mất linh thạch, tu vi hỗn loạn
  },
  yeu_tu: {
    linh_thao_random: 1.9, heal: 1.6,            // LỢI: bản năng thiên nhiên, hồi phục tốt
    mat_linh_thach: 1.3, exp: 0.7,               // HẠI: bị người kỳ thị mất linh thạch, học kinh điển chậm
  },
  dan_tu: {
    linh_thao_random: 2.3, heal: 1.6,            // LỢI: bậc thầy linh thảo, chữa lành vô địch
    mat_linh_thach: 1.6, linh_thach: 0.55,       // HẠI: yếu đuối hay bị cướp, ít chiến lợi phẩm
  },
  khi_tu: {
    linh_thach: 1.6, bi_phap_random: 1.3,        // LỢI: tìm khí cụ & bảo vật tốt
    linh_thao_random: 0.4, exp: 0.7,             // HẠI: bỏ qua thiên nhiên, chỉ tập trung rèn đúc
  },
  tran_tu: {
    mat_linh_thach: 0.3, bi_phap_random: 1.5,    // LỢI: kháng mất linh thạch hoàn hảo, nghiên cứu trận pháp
    exp: 0.5, linh_thach: 0.6,                   // HẠI: thụ động ít tu vi, ít tìm được chiến lợi phẩm
  },
};

async function xuLyBiCanhKetQua(n, t, e) {
  tinhCS(n);
  // Áp tỉ lệ Đạo Tu vào danh sách kết quả trước khi roll
  const dtMod = (n.dao_tu && DAO_TU_BC_MOD[n.dao_tu]) ? DAO_TU_BC_MOD[n.dao_tu] : {};
  const adjKQ = e.ket_qua.map(kq => ({ ...kq, rate: kq.rate * (dtMod[kq.loai] || 1) }));
  const totalRate = adjKQ.reduce((s, k) => s + k.rate, 0);
  const h = totalRate * Math.random();
  let i = 0,
    a = adjKQ[adjKQ.length - 1];
  for (const kq of adjKQ)
    if (((i += kq.rate), h < i)) {
      a = kq;
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


reg("khai_quang", ["khaiquang", "kq_mine", "dao_mo"], async (n) => {
    const t = n.author.id,
      e = await getPlayer(t);
    if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("luyen_khi" !== e.nghe)
      return n.reply({
        embeds: [errE("Lệnh này chỉ dành cho **🔱 Phi Khí Sư**!\nĐổi: `-nghe chon luyen_khi`")],
      });
    const h = cdRem(e.khai_quang_cd, 1);
    if (h)
      return n.reply({
        embeds: [warnE(`⛏️ Mỏ khoáng chưa hồi phục!\nHết CD ${cdTs(e.khai_quang_cd, 1)}.`)],
      });
    const cg = e.canh_gioi || 0;
    let pool;
    if (cg <= 7)
      pool = [
        { id: 'sat_tinh', w: 60 }, { id: 'huyen_thiet', w: 30 }, { id: 'tinh_cang', w: 10 },
      ];
    else if (cg <= 17)
      pool = [
        { id: 'sat_tinh', w: 40 }, { id: 'huyen_thiet', w: 35 },
        { id: 'tinh_cang', w: 20 }, { id: 'thien_tiet', w: 5 },
      ];
    else if (cg <= 25)
      pool = [
        { id: 'huyen_thiet', w: 20 }, { id: 'tinh_cang', w: 40 },
        { id: 'thien_tiet', w: 35 }, { id: 'vong_tinh_thach', w: 5 },
      ];
    else
      pool = [
        { id: 'tinh_cang', w: 20 }, { id: 'thien_tiet', w: 45 }, { id: 'vong_tinh_thach', w: 35 },
      ];
    const total = pool.reduce((s, x) => s + x.w, 0);
    const count = 2 + Math.floor(Math.random() * 3);
    const gained = {};
    for (let i = 0; i < count; i++) {
      let r = Math.random() * total, picked = pool[pool.length - 1].id;
      for (const p of pool) { r -= p.w; if (r <= 0) { picked = p.id; break; } }
      gained[picked] = (gained[picked] || 0) + 1;
    }
    const kv = { ...(e.khoang_vat || {}) };
    for (const [id, qty] of Object.entries(gained)) kv[id] = (kv[id] || 0) + qty;
    await db("UPDATE players SET khoang_vat=$1, khai_quang_cd=$2 WHERE user_id=$3",
      [JSON.stringify(kv), Date.now(), t]);
    const lines = Object.entries(gained).map(([id, qty]) => {
      const kv_data = KHOANG_VAT.find(k => k.id === id);
      return `${kv_data?.emoji || '🪨'} **${kv_data?.ten || id}** ×${qty}`;
    });
    const kv_summary = KHOANG_VAT.map(k => {
      const qty = kv[k.id] || 0;
      return qty > 0 ? `${k.emoji} ${k.ten}: **${qty}**` : null;
    }).filter(Boolean).join(' · ') || 'Kho trống';
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("⛏️ Khai Mỏ — Phi Khí Sư Thu Hoạch!")
          .setColor(9868950)
          .setDescription(
            `*Linh lực dẫn đường, phi khí cắt qua đá cứng — khoáng vật hiện ra!*\n\n⚒️ **Thu được:**\n${lines.join('\n')}\n\n📦 **Kho khoáng vật:** ${kv_summary}`,
          )
          .setFooter({ text: `Phi Khí Sư Đặc Kỹ | CD: 1h | Dùng -ren_luyen xem để tôi luyện` }),
      ],
    });
  });

