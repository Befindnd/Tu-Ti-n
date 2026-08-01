'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { db } = require('../db/pool');
const { getDanhVongBonus } = require('../utils/danh_vong');
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
  tinhCS,
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


const {
  SU_KIEN_TU,
  calcTuLuyenResult,
  calcDotPhaSuccess,
  buildVuotKiepTable,
  rollVuotKiepResult,
} = require('../game/cultivation_engine');

const TU_LUYEN_CD_H = 1;
const { checkNgheDotPha } = require('./cultivation');


reg("tu_luyen", ["tl", "tu", "tuluyen"], async (msg, args) => {
  const e = msg.author.id,
    h = await getPlayer(e);
  if (!h)
    return msg.reply({
      embeds: [
        errE("Ngươi chưa bước vào con đường tu tiên!\nDùng `-bat_dau` để khai mở thiên tư."),
      ],
    });
  const i = (args[0] || "").toLowerCase(),
    a = Math.max(3e3, 1000 * h.canh_gioi);  // REDESIGN: skip cost reduced (was 5000 min / 1500/level)
  if ("sk" === i) {
    const cdElapsedH = (Date.now() - Number(h.tu_luyen_cd || 0)) / 36e5;
    if (cdElapsedH < TU_LUYEN_CD_H) {
      // CD còn hiệu lực — thử trả phí để bỏ qua
      if (Number(h.linh_thach) < a)
        return msg.reply({
          embeds: [
            errE(
              `Cần **${fmt(a)} ${CE("tult", "💠")}** để bỏ qua CD tu luyện!\nHiện có: **${fmt(Number(h.linh_thach))} ${CE("tult", "💠")}**`,
            ),
          ],
        });
      (await db("UPDATE players SET tu_luyen_cd=0, linh_thach=linh_thach-$1 WHERE user_id=$2", [
        a,
        e,
      ]),
        (h.tu_luyen_cd = 0),
        (h.linh_thach = String(Number(h.linh_thach) - a)));
    }
    // CD đã hết → bỏ qua lệnh sk, tiếp tục thực thi tu luyện bình thường
  }
  const o = CANH_GIOI[h.canh_gioi + 1];
  if (o && THIEN_KIEP_NGUONG.has(o.cap) && Number(h.exp) >= o.exp_can)
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(16737792)
          .setTitle("🌩 Thiên Kiếp Tầng " + o.cap + " Đang Chờ!")
          .setDescription(`${CE("tia_set","⚡")} Dùng **\`-vuot_kiep\`** để vượt qua!\n${CE('warn_icon','⚠️')} Cần Đạo Tâm ≥ 30 *(Ma Tu miễn)*`),
      ],
    });
  const c = (Date.now() - Number(h.tu_luyen_cd || 0)) / 36e5;
  const effectiveTuLuyenCD = TU_LUYEN_CD_H * (1 - getTT(h, 'cd_reduce'));
  if (c < effectiveTuLuyenCD) {
    const expiryUnix = Math.floor((Number(h.tu_luyen_cd || 0) + effectiveTuLuyenCD * 3_600_000) / 1000);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setDescription(
            `${CE("cd_timer","⏳")} CD hết <t:${expiryUnix}:R> (lúc <t:${expiryUnix}:t>) · Skip: \`-tu_luyen sk\` (${fmt(a)} ${CE("tult","💠")})`,
          ),
      ],
    });
  }
  // ── Delegate pure math to cultivation_engine ──────────────────────────
  const calc = calcTuLuyenResult(h);
  const u   = calc.event;
  const buffCheck = "object" == typeof h.buff_active && h.buff_active ? h.buff_active : {};
  const linhHoaActive = (buffCheck.linh_hoa_until || 0) > Date.now();
  const linhHoaMult = linhHoaActive ? 1.25 : 1.0;
  const dvBonus     = getDanhVongBonus(h.danh_vong);
  const dvExpMult   = 1 + dvBonus.exp; // e.g. 1.10 khi DV >= 1000, 0.95 khi Ác Danh
  const g   = Math.floor(calc.expGain * linhHoaMult * dvExpMult);
  const $   = calc.newExp - calc.expGain + g;
  const k   = calc.newCamNgo;
  const C   = h.cam_ngo || 0;
  const N   = calc.newTamMa;
  const p   = calc.tamMaDelta;
  const l   = calc.ngoTinhBonus;
  const s   = getNgoTinh(h.ngo_tinh || 50);
  const b   = CANH_GIOI[h.canh_gioi + 1]?.exp_can ?? null;
  const D   = !h.la_ma_tu && N < 0;

  let y = '';
  if (calc.isMaxExp) {
    y = calc.isThienKiep
      ? `\n\n🌩 **Tu Vi Chạm Ngưỡng Thiên Kiếp Tầng ${CANH_GIOI[h.canh_gioi + 1].cap}!**\n*Thiên địa biến sắc, kiếp lôi tụ tập...*\n${CE("tia_set","⚡")} Dùng **\`-vuot_kiep\`** để vượt kiếp!`
      : `\n\n✦ **Tu Vi Đã Đầy!** Tu Vi đang dừng ở ngưỡng.\n${CE("tip_icon","💡")} Dùng **\`-dot_pha\`** khi Cảm Ngộ ≥ 60% để đột phá cảnh giới!`;
  }

  const { hp_max: L } = tinhCS({ ...h });
  const P = Math.min(L, Math.max(1, Number(h.hp)));
  const S = "object" == typeof h.buff_active && h.buff_active ? h.buff_active : {};
  let A = "", v = 0;
  if ((S.dam_doc || 0) > 0) {
    Math.random() < 0.50 &&
      ((v = Math.floor(0.1 * Number(h.linh_thach))),
      await db("UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1) WHERE user_id=$2", [v, e]),
      (A = `\n\n☠️ **Đầu Độc Kích Hoạt!** Tu luyện khuếch tán linh lực — mất **-${fmt(v)} ${CE("tult", "💠")}** *(Ám Vệ đặt bẫy! Dùng \`-giai_doc\` để giải)*`));
    const nBuff = { ...S, dam_doc: 0 };
    await db("UPDATE players SET buff_active=$1 WHERE user_id=$2", [JSON.stringify(nBuff), e]).catch(() => {});
  }
  await db(
    "UPDATE players SET exp=$1, tu_luyen_cd=$2, hp_max=$3, hp=$4, tam_ma=$5, la_ma_tu=$6, cam_ngo=$7 WHERE user_id=$8",
    [$, Date.now(), L, P, N, h.la_ma_tu || D, k, e],
  );
  const w = getCG(h.canh_gioi),
    M = b ? Math.min(100, Math.floor(($ / b) * 100)) : 100,
    H = (h.dao_thuong || 0) > 0
      ? `\n\n${["", CE("dt_nhe","🟡"), CE("dt_trung","🟠"), CE("dt_nang","🔴")][h.dao_thuong]} **Đạo Thương Cấp ${h.dao_thuong}** đang ảnh hưởng tu vi! *(${DT_HIEU[h.dao_thuong]})*\n${CE("tip_icon","💡")} Dùng \`-chua_thuong\` để chữa trị.`
      : "";
  let B = y + H + A;
  linhHoaActive && (B += `\n🔥 **Linh Hóa Đang Hiệu Ứng!** +25% EXP tu luyện *(Phi Khí Sư đặc kỹ)*`);
  l > 0 && (B += `\n${CE('tip_icon','💡')} *Ngộ Tính ${s.ten}: Tu Vi +${Math.round(100 * l)}%*`);
  D && (B += `\n\n${CE("tam_ac","👿")} **ĐẠO TÂM TRƯỢT VỀ 0 — NGỘ VÀO MA ĐẠO!**`);
  0 !== p && (B += `\n\n${p > 0 ? CE("tam_nhan","😇") : CE("tam_ma","😈")} Đạo Tâm: **${h.tam_ma}** → **${N}**`);

  const I = "toan_tam" === u.id ? 16755200 : u.id.includes("ma") ? 9109504 : embedClr(h.canh_gioi);
  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`${u.emoji} Tu Luyện — ${u.ten}`)
        .setColor(I)
        .setThumbnail(msg.author.displayAvatarURL())
        .setDescription(B || `*${u.mo_ta}*`)
        .addFields(
          {
            name: `${CE("tia_set","⚡")} Tu Vi Thu Được`,
            value: `**+${fmt(g)}**${1 !== u.bonus ? `  *(×${u.bonus})*` : ""}`,
            inline: !0,
          },
          {
            name: `${CE("tip_icon","💡")} Cảm Ngộ`,
            value: `${pBar(k)} **${k}%**  *(+${k - C})*`,
            inline: !0,
          },
          {
            name: `${CE("cd_timer","⏳")} CD Hồi Phục`,
            value: `**${TU_LUYEN_CD_H}h** · Skip ${fmt(a)} ${CE("tult", "💠")}`,
            inline: !0,
          },
          {
            name: `${CG_EMOJI(h.canh_gioi)} Tiến Độ — ${w.ten}`,
            value: `${pBar(M)} **${M}%**\n*${fmt($)} / ${b ? fmt(b) : "✨ ĐẠT ĐỈNH"}*`,
            inline: !1,
          },
        )
        .setFooter({
          text: `Công Pháp: ${CONG_PHAP.find((n) => n.id === h.cong_phap)?.ten || "Thập Huyền"} · Ngộ Tính: ${h.ngo_tinh || 50}/100`,
        }),
    ],
  });
});


