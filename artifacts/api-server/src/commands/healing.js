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
  NGOC_GIAN_DATA, DAN_DUOC, DAN_PHAM, REN_LUYEN_CAP, calcDanTyLe, PHU_LUC_DATA,
  THIEN_KIEP_KQ, THIEN_KIEP_NGUONG, getThienKiepLoai,
  PHONG_THUY_VAN, DONG_PHU, TRUYEN_THUA_LIST,
  TONG_MON_CAP_BAC, TONG_MON, CO_DUYEN_EVENTS,
  BI_CANH_SESSIONS, BI_CANH_CD_H, BI_CANH_LUA_CHON,
  NHIEM_VU_LIST,
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
  // Note: DT_TEN, DT_HIEU, etc. are declared inline at line 8963 of source (below)
} = require('../utils');
const {
  COMBAT_SESSIONS, RECENTLY_ENDED, markRecentlyEnded, wasRecentlyEnded,
  BP_COMBAT, hpBar, hpHeart, makeCombatEmbed,
  makePVPInviteRow, makePVPInviteRowDisabled, makePVPCombatRow,
  resolveCombatTurn, endCombat, scheduleTurnTimeout, applyCombatStats,
} = require('../game/combat');
const ADMIN_ID = process.env.ADMIN_ID || '';
const AUTO_HEAL_MS = 864e5;

const DT_TEN = ["✅ Lành Mạnh", `${CE("dt_nhe","🟡")} Đạo Thương Nhẹ`, `${CE("dt_trung","🟠")} Đạo Thương Trung`, `${CE("dt_nang","🔴")} Đạo Thương Nặng`],
  DT_HIEU = [
    "Chiến lực bình thường.",
    "ATK -15% | Tu Vi nhận vào -30%",
    "ATK -30%, DEF -10% | Tu Vi nhận vào -55%",
    "ATK -50%, DEF -20% | Tu Vi nhận vào -70% | 🔒 Bị khóa mọi lệnh",
  ],
  PHI_TU_CHUA = [0, 8e3, 2e4, 45e3],
  PHI_DUOC_SU = [0, 5e3, 12e3, 28e3],
  CD_TU_H = 5,
  CD_DS_TU_H = 3,
  CD_DS_NGUOI = 45;
function describeRewards(n) {
  const t = [];
  if (
    (n.linh_thach && t.push(`${CE("tult", "💠")} ${fmt(n.linh_thach)} Linh Thạch`),
    n.exp && t.push(`${CE("tutv", "📈")} ${fmt(n.exp)} Tu Vi`),
    n.ve_doi_nghe && t.push(`${CE('ve_nghe','🎫')} Vé Đổi Nghề ×${n.ve_doi_nghe}`),
    n.ve_doi_huyet && t.push(`${CE('ve_huyet_mach','🩸')} Vé Đổi Huyết Mạch ×${n.ve_doi_huyet}`),
    n.ve_doi_huyet_vip && t.push(`${CE('tukv','💎')} Vé Huyết Mạch VIP ×${n.ve_doi_huyet_vip}`),
    n.ve_nang_cap_huyet && t.push(`🔱 Vé Nâng Cấp Huyết Mạch ×${n.ve_nang_cap_huyet}`),
    n.vu_khi)
  ) {
    const e = VU_KHI.find((t) => t.id === n.vu_khi);
    t.push(`${CE("tuatk", "⚔️")} ${e?.ten || n.vu_khi}`);
  }
  if (n.bao_boi) {
    const e = BAO_BOI.find((t) => t.id === n.bao_boi);
    t.push(`${CE('ft_linh_bao','🔮')} ${e?.ten || n.bao_boi}`);
  }
  if (n.bi_phap) {
    const e = BI_PHAP.find((t) => t.id === n.bi_phap);
    t.push(`✨ ${e?.ten || n.bi_phap}`);
  }
  if (n.dan_duoc) {
    const e = DAN_DUOC.find((t) => t.id === n.dan_duoc);
    t.push(`${e?.emoji || CE('ng_luyen_dan','⚗️')} ${e?.ten || n.dan_duoc}${e?.limited ? ` ${CE('tukv','💎')} *(Limited)*` : ""} ×1`);
  }
  if (n.linh_can) {
    const e = LINH_CAN[n.linh_can];
    t.push(`${e?.emoji || CE('ve_linh_can','🔮')} Linh Căn: **${e?.ten || n.linh_can}**`);
  }
  if (n.huyet_mach) {
    const e = HUYET_MACH[n.huyet_mach];
    t.push(`${CE(e?.ce_name || "hm_pham", e?.emoji || "🩸")} Huyết Mạch: **${e?.ten || n.huyet_mach}**`);
  }
  return t.join(" · ") || "*(trống)*";
}
async function applyGiftcodeRewards(n, t, e) {
  const h = [],
    i = Number(e.linh_thach || 0),
    a = Number(e.exp || 0);
  if (i > 0) {
    const lt = calcMaxLinhThach(n, i);
    if (lt > 0) {
      h.push(`${CE("tult", "💠")} +**${fmt(lt)}** Linh Thạch${lt < i ? ` *(túi đầy, chỉ nhận ${fmt(lt)})*` : ''}`);
      await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [lt, t]);
    } else {
      h.push(`${CE("tult", "💠")} ~~+${fmt(i)} Linh Thạch~~ *(túi quá nặng — không nhận được)*`);
    }
  }
  if (
    (a > 0 &&
      (await db("UPDATE players SET exp=exp+$1 WHERE user_id=$2", [a, t]),
      h.push(`${CE("tutv", "📈")} +**${fmt(a)}** Tu Vi`)),
    e.vu_khi)
  ) {
    const n = VU_KHI.find((n) => n.id === e.vu_khi);
    n &&
      (await db("UPDATE players SET vu_khi=$1 WHERE user_id=$2", [n.id, t]),
      h.push(`${CE("tuatk", "⚔️")} Vũ Khí: **${CE(n.ce_name, n.pham || '⚔️')} ${n.ten}**`));
  }
  if (e.bao_boi) {
    const i = BAO_BOI.find((n) => n.id === e.bao_boi);
    i && !(n.bao_boi || []).includes(i.id)
      ? canAddToBag(n, "bao_boi", 1, i.id)
        ? (await db("UPDATE players SET bao_boi=array_append(bao_boi,$1) WHERE user_id=$2", [
            i.id,
            t,
          ]),
          h.push(`${CE(i.ce_name, '🔮')} Bảo Bối: **${i.ten}**`))
        : await (async () => {
            const lt = calcMaxLinhThach(n, 2000);
            h.push(lt > 0
              ? `${CE('ft_linh_bao','🔮')} Bảo Bối **${i.ten}** *(túi quá tải — đổi thành ${fmt(lt)} ${CE("tult", "💠")})*`
              : `${CE('ft_linh_bao','🔮')} Bảo Bối **${i.ten}** *(túi quá tải + đầy linh thạch — bỏ qua)*`);
            if (lt > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [lt, t]);
          })()
      : i &&
        await (async () => {
          const lt = calcMaxLinhThach(n, 2000);
          h.push(lt > 0
            ? `${CE('ft_linh_bao','🔮')} Bảo Bối **${i.ten}** *(đã có, đổi thành ${fmt(lt)} ${CE("tult", "💠")})*`
            : `${CE('ft_linh_bao','🔮')} Bảo Bối **${i.ten}** *(đã có + túi đầy linh thạch — bỏ qua)*`);
          if (lt > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [lt, t]);
        })();
  }
  if (e.bi_phap) {
    const i = BI_PHAP.find((n) => n.id === e.bi_phap);
    i && !(n.bi_phap || []).includes(i.id)
      ? canAddToBag(n, "bi_phap", 1)
        ? (await db("UPDATE players SET bi_phap=array_append(bi_phap,$1) WHERE user_id=$2", [
            i.id,
            t,
          ]),
          h.push(`✨ Bí Pháp: **${i.ten}**`))
        : await (async () => {
            const lt = calcMaxLinhThach(n, 3000);
            h.push(lt > 0
              ? `✨ Bí Pháp **${i.ten}** *(túi quá tải — đổi thành ${fmt(lt)} ${CE("tult", "💠")})*`
              : `✨ Bí Pháp **${i.ten}** *(túi quá tải + đầy linh thạch — bỏ qua)*`);
            if (lt > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [lt, t]);
          })()
      : i &&
        await (async () => {
          const lt = calcMaxLinhThach(n, 3000);
          h.push(lt > 0
            ? `✨ Bí Pháp **${i.ten}** *(đã biết, đổi thành ${fmt(lt)} ${CE("tult", "💠")})*`
            : `✨ Bí Pháp **${i.ten}** *(đã biết + túi đầy linh thạch — bỏ qua)*`);
          if (lt > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [lt, t]);
        })();
  }
  if (e.dan_duoc) {
    const i = DAN_DUOC.find((n) => n.id === e.dan_duoc),
      a = Math.max(1, Number(e.dan_duoc_qty) || 1);
    if (i)
      if (canAddToBag(n, "dan_duoc", a, i.id)) {
        const e = { ...(n.dan_duoc || {}) };
        ((e[i.id] = (e[i.id] || 0) + a),
          await db("UPDATE players SET dan_duoc=$1 WHERE user_id=$2", [JSON.stringify(e), t]),
          h.push(`${CE('ng_luyen_dan','⚗️')} Đan Dược: **🟢 Trung Phẩm ${i.ten}** ×${a}`));
      } else h.push(`⚗️ Đan **${i.ten}** ×${a} *(túi quá tải — bỏ qua)*`);
  }
  if (e.bag_bonus_kg) {
    const n = Number(e.bag_bonus_kg);
    n > 0 &&
      (await db("UPDATE players SET bag_bonus_kg=COALESCE(bag_bonus_kg,0)+$1 WHERE user_id=$2", [
        n,
        t,
      ]),
      h.push(`🎒 **Tải trọng +${n}kg** (vĩnh viễn)`));
  }
  if (e.linh_can) {
    const n = LINH_CAN[e.linh_can] || LINH_CAN.moc;
    n &&
      (await db("UPDATE players SET linh_can=$1 WHERE user_id=$2", [e.linh_can, t]),
      h.push(`${n.emoji} Linh Căn đổi thành: **${n.ten}**`));
  }
  if (e.huyet_mach) {
    const n = HUYET_MACH[e.huyet_mach] || HUYET_MACH.pham;
    n &&
      (await db("UPDATE players SET huyet_mach=$1 WHERE user_id=$2", [e.huyet_mach, t]),
      h.push(`${CE(n.ce_name, n.emoji)} Huyết Mạch thức tỉnh: **${n.ten}**`));
  }
  if (e.ve_doi_nghe) {
    const n = Math.max(1, Number(e.ve_doi_nghe) || 1);
    (await db("UPDATE players SET ve_doi_nghe=ve_doi_nghe+$1 WHERE user_id=$2", [n, t]),
      h.push(`${CE('ve_nghe','🎫')} **Vé Đổi Nghề** ×${n} *(dùng \`-nghe doi <id>\` đổi đường tu miễn phí!)*`));
  }
  if (e.ve_doi_huyet) {
    const n = Math.max(1, Number(e.ve_doi_huyet) || 1);
    (await db("UPDATE players SET ve_doi_huyet=ve_doi_huyet+$1 WHERE user_id=$2", [n, t]),
      h.push(`${CE('ve_huyet_mach','🩸')} **Vé Đổi Huyết Mạch** ×${n} *(dùng \`-huyet_mach doi\` random huyết mạch mới!)*`));
  }
  if (e.ve_doi_huyet_vip) {
    const n = Math.max(1, Number(e.ve_doi_huyet_vip) || 1);
    (await db("UPDATE players SET ve_doi_huyet_vip=ve_doi_huyet_vip+$1 WHERE user_id=$2", [n, t]),
      h.push(
        `💎 **Vé Huyết Mạch VIP** ×${n} *(dùng \`-huyet_mach doi_vip\` thăng cấp huyết mạch +1 bậc!)*`,
      ));
  }
  if (e.ve_nang_cap_huyet) {
    const n = Math.max(1, Number(e.ve_nang_cap_huyet) || 1);
    (await db("UPDATE players SET ve_nang_cap_huyet=ve_nang_cap_huyet+$1 WHERE user_id=$2", [n, t]),
      h.push(`🔱 **Vé Nâng Cấp Huyết Mạch** ×${n} *(dùng \`-huyet_mach nang_cap\` để nâng lên Tu La hoặc Cổ Thần!)*`));
  }
  if (e.thien_phu_nghe) {
    const i = e.thien_phu_nghe,
      a = NGHE[i];
    a
      ? n.thien_phu_nghe
        ? h.push(
            `${CE('warn_icon','⚠️')} Ngươi đã có Thiên Phú Nghề rồi! (${NGHE[n.thien_phu_nghe]?.ten || n.thien_phu_nghe}) — không thể ghi đè.`,
          )
        : (await db("UPDATE players SET thien_phu_nghe=$1 WHERE user_id=$2", [i, t]),
          h.push(
            `✨ **Thiên Phú Nghề — ${a.thien_phu_ten || a.ten}** khai phóng!\n*${a.thien_phu_mo_ta || ""}*`,
          ))
      : h.push(`${CE('warn_icon','⚠️')} Thiên phú không hợp lệ: ${i}`);
  }
  if (e.ngoc_gian) {
    const i = e.ngoc_gian,
      a = NGOC_GIAN_DATA.find((n) => n.id === i);
    if (a) {
      if ((Array.isArray(n.than_thong) ? n.than_thong : []).includes(i))
        await (async () => {
          const lt = calcMaxLinhThach(n, 5000);
          h.push(lt > 0
            ? `${a.emoji} **${a.ten}** *(đã học rồi — đổi thành ${fmt(lt)} ${CE("tult", "💠")})*`
            : `${a.emoji} **${a.ten}** *(đã học rồi + túi đầy linh thạch — bỏ qua)*`);
          if (lt > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [lt, t]);
        })();
      else {
        const e =
          "object" == typeof n.ngoc_gian_tui && n.ngoc_gian_tui ? { ...n.ngoc_gian_tui } : {};
        e[i]
          ? await (async () => {
              const lt = calcMaxLinhThach(n, 5000);
              h.push(lt > 0
                ? `${a.emoji} **${a.ten}** *(đã có trong túi — đổi thành ${fmt(lt)} ${CE("tult", "💠")})*`
                : `${a.emoji} **${a.ten}** *(đã có trong túi + túi đầy linh thạch — bỏ qua)*`);
              if (lt > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [lt, t]);
            })()
          : ((e[i] = 1),
            await db("UPDATE players SET ngoc_gian_tui=$1 WHERE user_id=$2", [
              JSON.stringify(e),
              t,
            ]),
            h.push(
              `${a.emoji} **Ngọc Giản ${a.ten}** → vào **Túi Trữ Vật**!\nDùng \`-than_thong hoc ${i}\` để học ngay.`,
            ));
      }
    } else h.push(`${CE('warn_icon','⚠️')} Ngọc Giản không hợp lệ: ${i}`);
  }
  return (0 === h.length && h.push("*(Không có phần thưởng)*"), h);
}

reg("chua_thuong", ["ct", "chua", "chuathuong"], async (n) => {
  const t = n.author.id,
    e = n.mentions.users.first(),
    h = await getPlayer(t);
  if (!h) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
  if (!e || e.id === t) {
    const e = Math.min(3, Math.max(0, h.dao_thuong || 0));
    if (0 === e) {
      const t = "duoc_su" === h.nghe,
        e = t && "duoc_su" === h.thien_phu_nghe,
        i = t
          ? `\n\n💉 **Đặc Kỹ Dược Sư:**\n• Tự chữa đạo thương: **CD 5h** + phí **giảm 50%** (thường 10h)\n• Chữa người khác: \`-chua_thuong @người\` → thu phí · **CD 45 phút**\n• \`-luyen_thuoc\` — 5 Thảo → **HP đầy + +15 Cảm Ngộ** · CD 45ph\n• \`-kham_benh @người\` — 15,000${CE("tult", "💠")} + 2 Thảo → Xem chi tiết đạo thương người khác · CD 30ph\n` +
            (e ? "• ✨ **Diệu Thủ Thần Y** — Chữa thương **MIỄN PHÍ** + CD giảm 50%" : "")
          : "";
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🩺 Trạng Thái Thần Thể")
            .setColor(3066993)
            .setDescription(
              `✅ Thần thể ngươi **lành mạnh hoàn toàn**, không có đạo thương!\n\n${CE("tip_icon","💡")} Đạo thương xuất hiện khi:\n• Thua PVP với HP rất thấp\n• Thua Boss trọng thương\n• Bị Ám Vệ tấn công` +
                i,
            ),
        ],
      });
    }
    const i = "duoc_su" === h.nghe,
      a = i && "duoc_su" === h.thien_phu_nghe,
      o = i ? (a ? 1.5 : 3) : 5,
      c = a ? 0 : i ? Math.floor(0.5 * PHI_TU_CHUA[e]) : PHI_TU_CHUA[e],
      _ = 60 * o - (Date.now() - Number(h.chua_thuong_cd || 0)) / 6e4,
      u = Number(h.dao_thuong_at || 0),
      r = u > 0 ? Math.max(0, AUTO_HEAL_MS - (Date.now() - u)) : AUTO_HEAL_MS,
      healUnix = u > 0 ? Math.floor((u + AUTO_HEAL_MS) / 1000) : Math.floor((Date.now() + AUTO_HEAL_MS) / 1000),
      m = r > 0 ? `⏰ Tự giảm 1 cấp <t:${healUnix}:R>` : "⏰ Sắp tự giảm 1 cấp...";
    if (_ > 0) {
      const t = Math.floor(_ / 60),
        h = Math.ceil(_ % 60);
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🩺 Trạng Thái Thần Thể")
            .setColor(15105570)
            .setDescription(
              `**${DT_TEN[e]}**\n*${DT_HIEU[e]}*\n\n${CE("cd_timer","⏳")} Chữa tiếp sau: **${t > 0 ? `${t}h ` : ""}${h}ph**\n${m}\n\n${CE("tip_icon","💡")} Nhờ **💉 Dược Sư** chữa: **${fmt(PHI_DUOC_SU[e])} ${CE("tult", "💠")}** (không cần CD của bạn)`,
            ),
        ],
      });
    }
    if (c > 0 && Number(h.linh_thach) < c)
      return n.reply({
        embeds: [
          errE(
            `${CE("tult", "💠")} Không đủ Linh Thạch!\n\n**${DT_TEN[e]}** — Cần **${fmt(c)}** ${CE("tult", "💠")} để chữa\n*(${i ? "Dược Sư giảm 50% phí tự chữa" : "Nhờ Dược Sư chữa rẻ hơn: " + fmt(PHI_DUOC_SU[e]) + " " + CE("tult", "💠") + ""})*`,
          ),
        ],
      });
    const g = e - 1,
      d = g > 0 ? Date.now() : 0;
    await db(
      "UPDATE players SET dao_thuong=$1, dao_thuong_at=$2, linh_thach=GREATEST(0,linh_thach-$3), chua_thuong_cd=$4 WHERE user_id=$5",
      [g, d, c, Date.now(), t],
    );
    const p = g > 0 ? "⏰ Tự hết sau **24h** nếu không bị thương thêm" : "";
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🩺 Tự Điều Trị Đạo Thương")
          .setColor(3066993)
          .setDescription(
            `${DT_TEN[e]} → **${DT_TEN[g]}**\n\n` +
              (a
                ? "✨ **MIỄN PHÍ** *(Diệu Thủ Thần Y)*"
                : `💸 Tiêu **${fmt(c)}** ${CE("tult", "💠")} Linh Thạch` +
                  (i ? " *(Dược Sư -50%)*" : "")) +
              "\n" +
              (g > 0
                ? `${CE('warn_icon','⚠️')} Vẫn còn **${DT_TEN[g]}** — hãy chữa thêm!\n${CE("tip_icon","💡")} Nhờ **💉 Dược Sư** chữa nhanh & rẻ hơn.\n${p}`
                : "✅ Thần thể đã **hoàn toàn hồi phục**! Có thể tiếp tục tu luyện."),
          )
          .setFooter({ text: `CD tiếp: ${o}h${i?" (Dược Sư)":""} · Phí cấp tiếp: ${g>0?fmt(i?Math.floor(.5*PHI_TU_CHUA[g]):PHI_TU_CHUA[g])+CEu("tult","💠"):"✅ Lành"}` }),
      ],
    });
  }
  if ("duoc_su" !== h.nghe)
    return n.reply({
      embeds: [
        errE(
          "❌ Chỉ **💉 Dược Sư** mới có thể chữa đạo thương cho người khác!\n\nBản thân có thể tự chữa bằng `-chua_thuong` (không cần tag người)\nĐổi nghề: `-nghe chon duoc_su`",
        ),
      ],
    });
  if (e.bot) return n.reply({ embeds: [errE("Không thể chữa cho bot!")] });
  const i = cdRemMin(h.chua_thuong_cd, 45);
  if (i) return n.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Tay nghề cần hồi phục — hết CD ${cdTsMin(h.chua_thuong_cd, 45)}.`)] });
  const a = await getPlayer(e.id);
  if (!a) return n.reply({ embeds: [errE(`**${e.username}** chưa tu tiên!`)] });
  const o = Math.min(3, Math.max(0, a.dao_thuong || 0));
  if (0 === o)
    return n.reply({
      embeds: [okE(`💚 **${e.username}** thần thể lành mạnh, không cần chữa trị!`)],
    });
  const c = PHI_DUOC_SU[o];
  if (Number(a.linh_thach) < c)
    return n.reply({
      embeds: [
        errE(
          `💸 **${e.username}** không đủ Linh Thạch!\n\n${DT_TEN[o]} — Phí chữa: **${fmt(c)}** ${CE("tult", "💠")}\nHọ chỉ có **${fmt(Number(a.linh_thach))}** ${CE("tult", "💠")}`,
        ),
      ],
    });
  const newDT = o - 1,
    newDTAt = newDT > 0 ? Date.now() : 0;

  await db(
    "UPDATE players SET dao_thuong=$1, dao_thuong_at=$2, linh_thach=GREATEST(0,linh_thach-$3), chua_thuong_cd=$4 WHERE user_id=$5",
    [newDT, newDTAt, c, Date.now(), a.user_id],
  );

  // REDESIGN: Dược Sư nhận Cảm Ngộ khi chữa lành hoàn toàn (về 0 đạo thương)
  // Thường: +3% CN, Thiên Phú: +5% CN — khuyến khích phối hợp
  const isTP = h.thien_phu_nghe === "duoc_su";
  const dsLoot = calcMaxLinhThach(h, c);
  const dsCNBonus = newDT === 0 ? (isTP ? 5 : 3) : 0;
  const dsCurCN = Math.min(100, (h.cam_ngo || 0) + dsCNBonus);

  if (dsCNBonus > 0) {
    await db(
      "UPDATE players SET linh_thach=linh_thach+$1, chua_thuong_cd=$2, cam_ngo=$3 WHERE user_id=$4",
      [dsLoot, Date.now(), dsCurCN, t],
    );
  } else {
    await db("UPDATE players SET linh_thach=linh_thach+$1, chua_thuong_cd=$2 WHERE user_id=$3", [
      dsLoot, Date.now(), t,
    ]);
  }

  return n.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("💉 Dược Sư Chữa Trị Thành Công!")
        .setColor(0x1ABC9C)
        .setDescription(
          `💉 **${n.author.username}** → **${e.username}**: ${DT_TEN[o]} → **${DT_TEN[newDT]}**\n` +
          `💸 Phí: **${fmt(c)}** ${CE("tult","💠")} *(thu từ bệnh nhân)*\n` +
          (newDT > 0
            ? `${CE('warn_icon','⚠️')} **${e.username}** vẫn còn **${DT_TEN[newDT]}** — cần chữa thêm!`
            : `✅ **${e.username}** thần thể đã **hoàn toàn hồi phục**!\n` +
              `${CE("tip_icon","💡")} Dược Sư nhận thêm: **+${dsCNBonus}% Cảm Ngộ**` +
              (isTP ? " ✨ *(Thiên Phú)*" : "")),
        )
        .setFooter({ text: `Dược Sư CD: 45ph · Phí cấp tiếp: ${newDT>0?fmt(PHI_DUOC_SU[newDT])+CEu("tult","💠"):"✅ Bệnh nhân đã lành"}` }),
    ],
  });
});


