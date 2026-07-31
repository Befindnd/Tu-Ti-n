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
      ? `${CE("lt_linh_chi","🌿")} Hái được **${e.ten} ×${e.gia_tri}**!`
      : "${CE('warn_icon','⚠️')} **Túi quá nặng** — linh thảo rơi xuống đất! Dùng `-tui` để kiểm tra.";
  }
  return { kq: a, resultStr: o };
}


  reg("am_sat", ["am", "amsat"], async (n) => {
    const t = n.author.id,
      e = n.mentions.users.first();
    if (!e || e.id === t || e.bot)
      return n.reply({ embeds: [errE("Cú pháp: `-am_sat @người_chơi`")] });
    const h = await getPlayer(t);
    if (!h) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("an_sat" !== h.nghe)
      return n.reply({
        embeds: [errE(`Lệnh này chỉ dành cho **${CE("ft_am_sat","🗡️")} Ám Vệ**!\nĐổi: \`-nghe chon an_sat\``)],
      });
    const i = cdRemMin(h.am_sat_cd, 45);
    if (i)
      return n.reply({ embeds: [warnE(`${CE("ft_am_sat","🗡️")} Đang ẩn náu chờ thời cơ!\nHết CD ${cdTsMin(h.am_sat_cd, 45)}.`)] });
    const a = await getPlayer(e.id);
    if (!a) return n.reply({ embeds: [errE(`**${e.username}** chưa tu tiên!`)] });
    if (Number(a.an_ngu_until || 0) > Date.now()) {
      const t = Math.ceil((Number(a.an_ngu_until) - Date.now()) / 6e4);
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🌫️ Ám Sát Thất Bại — Mục Tiêu Đang Ẩn Mình!")
            .setColor(9109504)
            .setDescription(
              `🌫️ **${e.username}** đang kích hoạt **An Ngu** — miễn nhiễm ám sát!\n${CE("cd_timer","⏳")} Còn hiệu lực: **${fTime(Math.ceil((Number(a.an_ngu_until) - Date.now()) / 1000))}**\n*(CD ám sát đã bị tiêu tốn)*`,
            )
            .setFooter({ text: "An Ngu — Ám Vệ Đặc Kỹ" }),
        ],
      });
    }
    const o = 0.1 + (h.canh_gioi / 39) * 0.3,
      c = h.canh_gioi - a.canh_gioi,
      _ = 0.03 * c,
      u = Math.min(0.65, Math.max(0.05, o + _));
    if (
      (await db("UPDATE players SET am_sat_cd=$1 WHERE user_id=$2", [Date.now(), t]),
      Math.random() < u)
    ) {
      const i = Math.floor(0.03 * Number(a.linh_thach)),
        r = "an_sat" === h.nghe && "an_sat" === h.thien_phu_nghe ? Math.floor(1.2 * i) : i;
      if (r < 10)
        return n.reply({
          embeds: [okE(`Ám sát thành công, nhưng **${e.username}** không có gì đáng cướp!`)],
        });
      const ltAmSat = calcMaxLinhThach(h, r);
      if (ltAmSat > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [ltAmSat, t]);
      const s = Math.min(3, Math.max(0, a.dao_thuong || 0));
      let l = s,
        m = !1;
      (s < 3 && Math.random() < 0.25 && ((l = Math.min(3, s + 1)), (m = !0)),
        await db(
          "UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1), dao_thuong=$2, dao_thuong_at=CASE WHEN $2>0 THEN $3::BIGINT ELSE 0::BIGINT END WHERE user_id=$4",
          [r, l, Date.now(), e.id],
        ),
        await db(
          "UPDATE players SET nhan_qua=GREATEST(-100,nhan_qua-10), ma_khi=ma_khi+10 WHERE user_id=$1",
          [t],
        ));
      try {
        const t = await n.client.users.fetch(e.id),
          h = m
            ? `${CE("ft_am_sat","🗡️")} **Cảnh Báo!** Có kẻ ẩn danh vừa ám sát và đoạt mất **${fmt(r)} Linh Thạch** của ngươi!\n${CE('warn_icon','⚠️')} Ngươi bị **${DT_TEN[l]}** — dùng \`-chua_thuong\` để chữa trị!`
            : `${CE("ft_am_sat","🗡️")} **Cảnh Báo!** Có kẻ ẩn danh vừa ám sát và đoạt mất **${fmt(r)} Linh Thạch** của ngươi!`;
        await t.send(h).catch(() => {});
      } catch {}
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE("ft_am_sat","🗡️")} Ám Sát Thành Công!`)
            .setColor(2899536)
            .setDescription(
              `${CE("tult", "💠")} Đoạt được **${fmt(r)} Linh Thạch**!\n😈 Nghiệp Lực +10 | Ma Khí +20\n` +
                (m ? `${CE("nq_nghiep","🩸")} Nạn nhân bị **${DT_TEN[l]}** sau đòn ám sát!\n` : "") +
                "\n*Nạn nhân nhận được cảnh báo ẩn danh...*",
            )
            .setFooter({
              text: `Tỉ lệ: ${Math.round(100 * u)}% (Base ${Math.round(100 * o)}% + Chênh lệch ${c > 0 ? "+" : ""}${Math.round(100 * _)}%) | CD: 45ph`,
            }),
        ],
      });
    }
    const r = Math.floor(0.06 * Number(h.linh_thach)),
      s = Math.min(0.7, Math.max(0.2, 0.35 + 0.05 * (a.canh_gioi - h.canh_gioi))),
      l = Math.min(3, Math.max(0, h.dao_thuong || 0));
    let m = l,
      g = !1;
    (l < 3 && Math.random() < s && ((m = Math.min(3, l + 1)), (g = !0)),
      await db(
        "UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1), nhan_qua=GREATEST(-100,nhan_qua-5), ma_khi=ma_khi+4, dao_thuong=$2, dao_thuong_at=CASE WHEN $2>0 THEN $3::BIGINT ELSE 0::BIGINT END WHERE user_id=$4",
        [r, m, Date.now(), t],
      ));
    try {
      const t = await n.client.users.fetch(e.id);
      await t
        .send(
          `${CE("tudef","🛡️")} **Cảnh Báo!** Có kẻ ẩn danh vừa cố ám sát ngươi nhưng **thất bại**! Thần thức của ngươi đã phản đòn kẻ đó.`,
        )
        .catch(() => {});
    } catch {}
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${CE("ft_am_sat","🗡️")} Ám Sát Thất Bại!`)
          .setColor(15158332)
          .setDescription(
            `*Thần thức của **${e.username}** kháng cự — phản đòn xé toạc thần thức kẻ xâm phạm!*\n\n💸 Đánh rơi **${fmt(r)}** Linh Thạch khi tháo chạy *(6%)*\n${CE("tam_ma","😈")} Nghiệp Lực +5 | Ma Khí +8\n` +
              (g
                ? `🩸 Phản đòn gây **${DT_TEN[m]}**! *(${DT_HIEU[m]})*\n${CE("tip_icon","💡")} Dùng \`-chua_thuong\` để chữa trị!`
                : `${CE("tudef", "🛡️")} May mắn né được phản đòn — thần thể vô sự.`) +
              "\n\n*Nạn nhân nhận được cảnh báo ẩn danh...*",
          )
          .addFields(
            {
              name: "📊 Tỉ Lệ Ám Sát",
              value: `**${Math.round(100 * u)}%** *(Base ${Math.round(100 * o)}% ${c >= 0 ? "+" : ""} ${Math.round(100 * _)}% chênh lệch)*`,
              inline: !0,
            },
            {
              name: `${CE("tudef", "🛡️")} Xác Suất Phản Đòn`,
              value: `**${Math.round(100 * s)}%**`,
              inline: !0,
            },
          )
          .setFooter({ text: "CD: 45ph | Luyện lên cảnh giới cao hơn để tăng tỉ lệ thành công" }),
      ],
    });
  });

