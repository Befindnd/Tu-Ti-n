'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer, awardBiPhap, awardLinhThao } = require('../db/players');
const { CE, CEu } = require('../systems/emoji');
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


  reg("ban_dan", ["band", "bandan"], async (n) => {
    const t = n.author.id,
      e = await getPlayer(t, n.author.username);
    if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("luyen_dan" !== e.nghe)
      return n.reply({
        embeds: [
          errE(
            `Lệnh này chỉ dành cho **${CE("ng_luyen_dan","⚗️")} Luyện Đan Sư**!\nChỉ Luyện Đan Sư mới có kênh tiêu thụ thương nhân.`,
          ),
        ],
      });
    const h = "object" == typeof e.buff_active && e.buff_active ? e.buff_active : {},
      i = cdRem(h.ban_dan_cd, 1);
    if (i)
      return n.reply({
        embeds: [
          warnE(
            `${CE("cd_timer","⏳")} Thương nhân chưa mở cổng giao dịch!\nHết CD ${cdTs(h.ban_dan_cd, 1)}.\n*(Mỗi lần bán CD: 1h)*`,
          ),
        ],
      });
    const a = e.dan_duoc || {},
      o = [],
      c = [];
    for (const n of DAN_DUOC.filter((n) => !n.limited)) {
      const t = [];
      for (const e of DAN_PHAM_ORDER) {
        const h = "trung" === e ? n.id : `${n.id}_${e}`,
          i = Number(a[h] || 0);
        if (i <= 0) continue;
        const c = DAN_PHAM[e],
          _ = Math.floor(2 * n.phi * c.he_so);
        (o.push(
          new StringSelectMenuOptionBuilder()
            .setValue(`${n.id}|${e}`)
            .setLabel(`${c.ten} ${n.ten} ×${i}`)
            .setDescription(
              `${fmt(_)} ${CE("tult", "💠")}/viên · Tổng tối đa: ${fmt(_ * i)} ${CE("tult", "💠")}`,
            ),
        ),
          t.push(`${c.emoji} ${c.ten} ×${i}`));
      }
      t.length && c.push(`${n.emoji} **${n.ten}**: ${t.join("  ")}`);
    }
    if (0 === o.length)
      return n.reply({ embeds: [warnE("Kho đan trống — dùng `-luyen_dan` để luyện đan trước!")] });
    const _ = new EmbedBuilder()
        .setTitle(`${CE("ng_luyen_dan","⚗️")} Bán Đan Dược — Kho Của Bạn`)
        .setColor(15105570)
        .setDescription(c.join("\n") + "\n\n*Chọn loại đan và phẩm cấp muốn bán từ menu bên dưới:*")
        .setFooter({
          text: "Giá: 200% phí luyện × hệ số phẩm | Đan Limited KHÔNG bán được | CD: 6h",
        }),
      u = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`bandansel_${t}`)
          .setPlaceholder(`${CEu("ng_luyen_dan","⚗️")} Chọn đan và phẩm cấp muốn bán...`)
          .addOptions(o.slice(0, 25)),
      ),
      r = await n.reply({ embeds: [_], components: [u] });
    let s = null,
      l = null;
    const m = r.createMessageComponentCollector({ filter: (n) => n.user.id === t, time: 6e4 });
    (m.on("collect", async (n) => {
      if ((await n.deferUpdate(), n.customId === `bandansel_${t}`)) {
        const [e, h] = n.values[0].split("|");
        ((s = DAN_DUOC.find((n) => n.id === e)), (l = h));
        const i = (await getPlayer(t)).dan_duoc || {},
          a = Number(i["trung" === h ? e : `${e}_${h}`] || 0);
        if (a <= 0)
          return (
            await r.edit({ embeds: [errE("Đan đã hết trong kho!")], components: [] }),
            void m.stop()
          );
        const o = DAN_PHAM[h],
          c = Math.floor(2 * s.phi * o.he_so),
          _ = [
            ...[1, 5, 10, 20]
              .filter((n) => n < a)
              .map((n) =>
                new ButtonBuilder()
                  .setCustomId(`bandanqty_${t}_${n}`)
                  .setLabel(`×${n}  (${fmt(c * n)} ${CEu("tult","💠")})`)
                  .setStyle(ButtonStyle.Primary),
              ),
            new ButtonBuilder()
              .setCustomId(`bandanqty_${t}_all`)
              .setLabel(`Tất cả ×${a}  (${fmt(c * a)} ${CEu("tult","💠")})`)
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`bandanhuy_${t}`)
              .setLabel("❌ Hủy")
              .setStyle(ButtonStyle.Secondary),
          ],
          u = [];
        for (let n = 0; n < Math.ceil(_.length / 5); n++)
          u.push(new ActionRowBuilder().addComponents(_.slice(5 * n, 5 * n + 5)));
        return void (await r.edit({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${CE("ng_luyen_dan","⚗️")} Chọn Số Lượng Bán`)
              .setColor(o.color)
              .setDescription(
                `${s.emoji} ${o.emoji} **${o.ten} ${s.ten}**\nTrong kho: **×${a}** | Đơn giá: **${fmt(c)} ${CE("tult", "💠")}/viên**\n\nChọn số lượng muốn bán:`,
              )
              .setFooter({ text: "Menu tự đóng sau 60s | CD 6h bắt đầu sau khi bán" }),
          ],
          components: u,
        }));
      }
      if (n.customId.startsWith(`bandanqty_${t}_`)) {
        if (!s || !l) return;
        const e = n.customId.slice(`bandanqty_${t}_`.length),
          h = await getPlayer(t),
          i = "object" == typeof h.buff_active && h.buff_active ? h.buff_active : {},
          a = (Date.now() - Number(i.ban_dan_cd || 0)) / 36e5;
        if (a < 1) {
          const expiryUnix = Math.floor((Number(i.ban_dan_cd || 0) + 3_600_000) / 1000);
          return (
            await r.edit({
              embeds: [warnE(`${CE("cd_timer","⏳")} CD chưa hết! Hết CD <t:${expiryUnix}:R> (lúc <t:${expiryUnix}:t>)`)],
              components: [],
            }),
            void m.stop()
          );
        }
        const o = { ...(h.dan_duoc || {}) },
          c = "trung" === l ? s.id : `${s.id}_${l}`,
          _ = Number(o[c] || 0),
          u = "all" === e ? _ : Math.min(parseInt(e) || 1, _);
        if (u <= 0)
          return (
            await r.edit({ embeds: [errE("Không còn đan trong kho!")], components: [] }),
            void m.stop()
          );
        ((o[c] = _ - u), o[c] <= 0 && delete o[c]);
        const g = DAN_PHAM[l],
          d = Math.floor(2 * s.phi * g.he_so) * u,
          ltBan = calcMaxLinhThach(h, d),
          p = { ...i, ban_dan_cd: Date.now() };
        return (
          await db(
            "UPDATE players SET dan_duoc=$1, linh_thach=linh_thach+$2, buff_active=$3 WHERE user_id=$4",
            [JSON.stringify(o), ltBan, JSON.stringify(p), t],
          ),
          await r.edit({
            embeds: [
              new EmbedBuilder()
                .setTitle(`${CE("ng_luyen_dan","⚗️")} Bán Đan Thành Công!`)
                .setColor(15105570)
                .setDescription(
                  `*Thương nhân kiểm tra phẩm cấp, trả giá công bằng...*\n\n${s.emoji} ${g.emoji} **${g.ten} ${s.ten}** ×${u}\n${CE("tult", "💠")} Thu: **+${fmt(d)} Linh Thạch**\n\n*(Phí luyện × 200% × hệ số phẩm)*\n${CE("cd_timer","⏳")} *Cooldown tiếp theo: 6h*`,
                )
                .setFooter({ text: "Luyện Đan Sư Đặc Kỹ | CD: 6h | Đan Limited không bán được" }),
            ],
            components: [],
          }),
          void m.stop()
        );
      }
      n.customId === `bandanhuy_${t}` &&
        (await r.edit({ embeds: [warnE("Đã hủy giao dịch.")], components: [] }), m.stop());
    }),
      m.on("end", (n, t) => {
        "time" === t && r.edit({ components: [] }).catch(() => {});
      }));
  });

