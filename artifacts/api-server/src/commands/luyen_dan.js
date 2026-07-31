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


  reg("luyen_dan", ["ld", "luyendan"], async (n, t) => {
    const e = n.author.id,
      h = (t[0] || "xem").toLowerCase(),
      i = await getPlayer(e);
    if (!i) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if (i.nghe !== 'luyen_dan')
      return n.reply({ embeds: [errE(`Lệnh này chỉ dành cho **⚗️ Luyện Đan Sư**!\nDùng \`-nghe chon luyen_dan\` để chọn nghề.`)] });
    if ("xem" === h) {
      const t = i.dan_duoc || {},
        e = i.linh_thao || {},
        h = DAN_DUOC.filter((n) => !n.limited),
        a = h.map((n) => {
          const h = Object.entries(n.cong_thuc)
              .map(([n, t]) => {
                const h = LINH_THAO.find((t) => t.id === n);
                return `${h?.emoji || ""}${h?.ten || n}×${t}(${e[n] || 0})`;
              })
              .join(" "),
            a =
              DAN_PHAM_ORDER.map((e) => {
                const h = "trung" === e ? n.id : `${n.id}_${e}`,
                  i = t[h] || 0;
                return i > 0 ? `${DAN_PHAM[e].emoji}${i}` : null;
              })
                .filter(Boolean)
                .join("") || "0",
            o = i.canh_gioi < n.yeu_cau_cap ? ` ${CE('lock_icon','🔒')}T${n.yeu_cau_cap}` : "";
          return `${n.emoji} **${n.ten}**${o} — ${fmtLT(n.phi)} | 🌿 ${h} | Kho: ${a}`;
        }),
        o = DAN_DUOC.filter((n) => n.limited && (t[n.id] || 0) > 0).map(
          (n) => `${n.emoji} **${n.ten}** ×${t[n.id]} *(đặc biệt · \`-dung_dan ${n.id}\`)*`,
        ),
        c = h.map((n) => {
          const t = i.canh_gioi < n.yeu_cau_cap,
            h =
              !t &&
              Object.entries(n.cong_thuc).every(([n, t]) => (e[n] || 0) >= t) &&
              Number(i.linh_thach || 0) >= n.phi;
          return new ButtonBuilder()
            .setCustomId(`ld_lam_${n.id}`)
            .setLabel(n.ten.slice(0, 20))
            .setStyle(h ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(t);
        }),
        _ = new ButtonBuilder()
          .setCustomId("ld_back_xem")
          .setLabel("🔄 Làm Mới")
          .setStyle(ButtonStyle.Secondary),
        u = [...c.slice(0, 24), _],
        r = [];
      for (let n = 0; n < Math.ceil(u.length / 5); n++)
        r.push(new ActionRowBuilder().addComponents(u.slice(5 * n, 5 * n + 5)));
      const s = "luyen_dan" === i.nghe,
        l = "luyen_dan" === i.thien_phu_nghe,
        m = s
          ? "\n\n⚗️ **Đặc Kỹ Luyện Đan Sư:**\n• 25% cơ hội luyện thêm **1 đan thứ 2** miễn phí\n• `-kiem_linh_thao` — Hái linh thảo · **CD 30ph**\n" +
            (l ? "• ✨ **Đan Vương Thiên Phú** — 50% cơ hội ép **Cực Phẩm** khi luyện đan" : "")
          : "",
        g = new EmbedBuilder()
          .setTitle(`${CE('ng_luyen_dan','⚗️')} Luyện Đan — Công Thức & Kho`)
          .setColor(15105570)
          .setDescription(
            a.join("\n") + (o.length ? `\n\n${CE('tukv','💎')} **Đặc Biệt:**\n` + o.join("\n") : "") + m,
          )
          .setFooter({
            text: `${CEu("tult","💠")} ${fmt(i.linh_thach||0)}${Number(i.linh_thach_trung||0)>0?` · ${CEu("tult_trung","🔮")} ${fmt(i.linh_thach_trung)} Trung`:''}${Number(i.linh_thach_cao||0)>0?` · ${CEu("tult_cao","💚")} ${fmt(i.linh_thach_cao)} Cao`:''} | 🟢 Đủ nguyên liệu · Xám = thiếu/khóa`,
          });
      return n.reply({ embeds: [g], components: r });
    }
    if ("lam" === h) {
      const h = (t[1] || "").toLowerCase(),
        a = DAN_DUOC.find((n) => n.id === h);
      if (!a)
        return n.reply({
          embeds: [errE(`Không tìm thấy \`${h}\`.\nDùng \`-luyen_dan xem\` xem công thức.`)],
        });
      if (i.canh_gioi < a.yeu_cau_cap)
        return n.reply({ embeds: [errE(`Cần tầng **${a.yeu_cau_cap}** để luyện **${a.ten}**!`)] });
      if (!calcSpend(i, a.phi))
        return n.reply({
          embeds: [
            errE(
              `Cần **${fmt(a.phi)} ${CE("tult","💠")}** để luyện đan!\nHiện có: **${CE("tult","💠")}${fmt(i.linh_thach)}**${Number(i.linh_thach_trung||0)>0?` · **${CE("tult_trung","🔮")}${fmt(i.linh_thach_trung)} Trung**`:''}${Number(i.linh_thach_cao||0)>0?` · **${CE("tult_cao","💚")}${fmt(i.linh_thach_cao)} Cao**`:''}`,
            ),
          ],
        });
      const o = { ...(i.linh_thao || {}) };
      for (const [t, e] of Object.entries(a.cong_thuc))
        if ((o[t] || 0) < e) {
          const h = LINH_THAO.find((n) => n.id === t);
          return n.reply({
            embeds: [errE(`Thiếu **${h?.ten || t}**! Cần ${e}, có ${o[t] || 0}.`)],
          });
        }
      for (const [n, t] of Object.entries(a.cong_thuc)) o[n] = (o[n] || 0) - t;
      const c = "luyen_dan" === i.nghe,
        _ = calcDanTyLe(i.canh_gioi, a.yeu_cau_cap, c);
      let u = "ha";
      if (Math.random() < _)
        if (c && "luyen_dan" === i.thien_phu_nghe && Math.random() < 0.5) u = "cuc";
        else {
          let n = 0;
          const t = 100 * Math.random();
          for (const e of DAN_PHAM_ORDER)
            if (((n += DAN_PHAM[e].rate), t < n)) {
              u = e;
              break;
            }
        }
      const r = DAN_PHAM[u];
      if (!canAddToBag(i, "dan_duoc", 1, u)) {
        const t = getBagCapacity(
            i.canh_gioi || 0,
            i.bao_boi || [],
            i.bag_bonus_kg || 0,
            i.tui_nang_cap || 0,
          ),
          e = calcBagWeight(i);
        return n.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${CE('warn_icon','⚠️')} Túi Trữ Vật Quá Nặng!`)
              .setColor(15158332)
              .setDescription(
                `🎒 Đã dùng: **${e}/${t} kg**\n✅ **Nguyên liệu & Linh Thạch không bị mất** — hãy dùng bớt đồ rồi thử lại.\nDùng \`-tui\` để xem túi đồ.`,
              ),
          ],
        });
      }
      const s = { ...(i.dan_duoc || {}) },
        l = "trung" === u ? a.id : `${a.id}_${u}`;
      s[l] = (s[l] || 0) + 1;
      let m = "";
      return (
        "luyen_dan" === i.nghe &&
          Math.random() < 0.25 &&
          ((s[l] += 1),
          (m = "\n\n⚗️ **Đặc Kỹ Luyện Đan Sư** — Tay nghề cao, luyện thêm được **1 đan thứ 2**!")),
        await (async () => { const _s = calcSpend(i, a.phi); await db("UPDATE players SET linh_thao=$1, dan_duoc=$2, linh_thach=$3, linh_thach_trung=$4, linh_thach_cao=$5 WHERE user_id=$6", [JSON.stringify(o), JSON.stringify(s), _s.newThuong, _s.newTrung, _s.newCao, e]); })(),
        n.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${r.emoji} Luyện Đan Thành Công — ${r.ten} ${a.ten}`)
              .setColor(r.color)
              .setDescription(
                `${r.emoji} **${r.ten} ${a.ten}**\n*${a.mo_ta}*${m}\n\nDùng: \`-dung_dan ${a.id}\``,
              )
              .setFooter({
                text: `-${fmt(a.phi)} ${CEu("tult","💠")} | Tỉ lệ thành công: ${Math.round(100 * _)}%`,
              }),
          ],
        })
      );
    }
    return n.reply({
      embeds: [errE("`-luyen_dan xem` — Xem công thức\n`-luyen_dan lam <id>` — Luyện đan")],
    });
  });

