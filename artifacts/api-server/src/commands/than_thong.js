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
  CG_EMOJI, getNgoTinh, getKhiVanBonus, getNhanQua, getTT,
} = require('../data');
const {
  getDailyMissionState,
  BAG_WEIGHTS, getDanKg, getBagCapacity, calcBagWeight, canAddToBag, calcMaxLinhThach,
  DONATE_DATA, findDonateGoi, buildDonateEmbed, buildDonateButtons, buildDonateCatSelect,
  fmt, getCG, pBar, fTime, cdRem, cdRemMin, embedClr,
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

const DT_TEN = ["✅ Lành Mạnh", "🟡 Đạo Thương Nhẹ", "🟠 Đạo Thương Trung", "🔴 Đạo Thương Nặng"],
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
  if (n.phu_luc) {
    const e = PHU_LUC_DATA.find((p) => p.id === n.phu_luc);
    const qty = Math.max(1, Number(n.phu_luc_qty) || 1);
    t.push(`${e?.emoji || CE('cp_thap_huyen','📜')} ${e?.ten || n.phu_luc}${e?.limited ? ` ${CE('tukv','💎')}` : ""} ×${qty}`);
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
      h.push(`${CE("tuatk", "⚔️")} Vũ Khí: **${n.pham} ${n.ten}**`));
  }
  if (e.bao_boi) {
    const i = BAO_BOI.find((n) => n.id === e.bao_boi);
    i && !(n.bao_boi || []).includes(i.id)
      ? canAddToBag(n, "bao_boi", 1, i.id)
        ? (await db("UPDATE players SET bao_boi=array_append(bao_boi,$1) WHERE user_id=$2", [
            i.id,
            t,
          ]),
          h.push(`${CE('ft_linh_bao','🔮')} Bảo Bối: **${i.pham} ${i.ten}**`))
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
          h.push(`⚗️ Đan Dược: **🟢 Trung Phẩm ${i.ten}** ×${a}`));
      } else h.push(`⚗️ Đan **${i.ten}** ×${a} *(túi quá tải — bỏ qua)*`);
  }
  if (e.phu_luc) {
    const i = PHU_LUC_DATA.find((n) => n.id === e.phu_luc),
      a = Math.max(1, Number(e.phu_luc_qty) || 1);
    if (i) {
      const e = { ...(n.phu_luc || {}) };
      (e[i.id] = (e[i.id] || 0) + a);
      await db("UPDATE players SET phu_luc=$1 WHERE user_id=$2", [JSON.stringify(e), t]);
      h.push(`📜 Phù Lục: **${i.emoji} ${i.ten}**${i.limited ? ` ${CE('tukv','💎')} *(Limited)*` : ""} ×${a}`);
    }
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
        `${CE('tukv','💎')} **Vé Huyết Mạch VIP** ×${n} *(dùng \`-huyet_mach doi_vip\` thăng cấp huyết mạch +1 bậc!)*`,
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


  reg("than_thong", ["tt_ngoc", "thanththong", "ngoc_gian"], async (n, t) => {
    const e = n.author.id,
      h = await getPlayer(e, n.author.username);
    if (!h) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    const i = (t[0] || "xem").toLowerCase();
    if ("xem" === i) {
      const NM = { atk: "ATK", def: "DEF", hp: "HP", crit: "Bạo Kích", dodge: "Né tránh", dmg_reduce: "Giảm ST nhận", exp: "Tu Vi", drop: "Drop Bonus", hp_flat: "HP tĩnh", regen_pct: "Hồi Phục/lượt", cd_reduce: "Giảm CD" };
      const buildTTEmbed = (player, footerText) => {
        const tt = Array.isArray(player.than_thong) ? player.than_thong : [];
        const tui = "object" == typeof player.ngoc_gian_tui && player.ngoc_gian_tui ? player.ngoc_gian_tui : {};
        let learnedList = [];
        if (tt.length === 0) learnedList.push("*Chưa học thần thông nào.*");
        else for (const id of tt) {
          const d = NGOC_GIAN_DATA.find((x) => x.id === id);
          if (!d) continue;
          const eff = Object.entries(d.effects).map(([k, v]) => { const lbl = NM[k] || k; return k === "hp_flat" ? `+${v} ${lbl}` : `+${Math.round(100 * v)}% ${lbl}`; }).join(", ");
          learnedList.push(`${d.emoji} **${d.ten}** — ${eff}`);
        }
        let tuiList = [];
        for (const [id] of Object.entries(tui)) {
          const d = NGOC_GIAN_DATA.find((x) => x.id === id);
          if (!d) continue;
          const status = (player.canh_gioi || 0) >= d.yeu_cau_cap ? "✅ Đủ cảnh giới" : `${CE('warn_icon','⚠️')} Cần ≥ cảnh giới ${d.yeu_cau_cap}`;
          tuiList.push(`${d.emoji} **${d.ten}** \`${d.id}\` — ${status}\n  *${d.mo_ta}*`);
        }
        return new EmbedBuilder()
          .setTitle("✨ Thần Thông — Ngọc Giản")
          .setColor(11032055)
          .setDescription(
            `*Thần thông huyền diệu — chỉ có từ Donate, học 1 lần vĩnh viễn.*\n\n${CE("tia_set","⚡")} **Thần Thông Đã Học (${tt.length}/8):**\n${learnedList.join("\n")}\n\n` +
            (tuiList.length > 0
              ? `📦 **Ngọc Giản Trong Túi (chờ học):**\n${tuiList.join("\n\n")}\n\n*Dùng \`-than_thong hoc <id>\` để học*`
              : "📦 **Túi Ngọc Giản:** *Trống — mua từ `-donate` (chọn ✨ Thần Thông)*")
          )
          .setFooter({ text: footerText || "Ngọc Giản: donate → túi → -than_thong hoc <id> → học vĩnh viễn" });
      };
      const buildTTComps = (player) => {
        const tt = Array.isArray(player.than_thong) ? player.than_thong : [];
        if (tt.length === 0) return [];
        return [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("tt_delete_select")
              .setPlaceholder("🗑️ Xóa thần thông... (chọn thần thông muốn xóa)")
              .addOptions(
                tt.map((id) => {
                  const d = NGOC_GIAN_DATA.find((x) => x.id === id);
                  return { label: `Xóa: ${d ? d.ten : id}`, value: id, description: d ? d.mo_ta.slice(0, 50) : id, emoji: "🗑️" };
                })
              )
          ),
        ];
      };
      const ttMsg = await n.reply({ embeds: [buildTTEmbed(h)], components: buildTTComps(h) });
      const ttColl = ttMsg.createMessageComponentCollector({ filter: (x) => x.user.id === e, time: 9e4 });
      ttColl.on("collect", async (x) => {
        if ("tt_delete_select" !== x.customId) return;
        await x.deferUpdate();
        const ttId = x.values[0];
        const ttInfo = NGOC_GIAN_DATA.find((d) => d.id === ttId);
        const fresh = await getPlayer(e);
        const curr = Array.isArray(fresh.than_thong) ? [...fresh.than_thong] : [];
        if (!curr.includes(ttId)) {
          return void (await ttMsg.edit({ embeds: [buildTTEmbed(fresh, `${CE('warn_icon','⚠️')} Không tìm thấy thần thông này!`)], components: buildTTComps(fresh) }));
        }
        const newList = curr.filter((id) => id !== ttId);
        await db("UPDATE players SET than_thong=$1 WHERE user_id=$2", [newList, e]);
        const updated = await getPlayer(e);
        return void (await ttMsg.edit({ embeds: [buildTTEmbed(updated, `🗑️ Đã xóa **${ttInfo?.ten || ttId}**! Slot thần thông đã được giải phóng.`)], components: buildTTComps(updated) }));
      });
      ttColl.on("end", () => { ttMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }
    if ("hoc" === i) {
      const i = (t[1] || "").toLowerCase().trim();
      if (!i)
        return n.reply({
          embeds: [errE("Cú pháp: `-than_thong hoc <id>`\nXem túi: `-than_thong xem`")],
        });
      const a = NGOC_GIAN_DATA.find((n) => n.id === i);
      if (!a)
        return n.reply({
          embeds: [errE(`Không tìm thấy Ngọc Giản \`${i}\`!\nXem túi: \`-than_thong xem\``)],
        });
      const o = Array.isArray(h.than_thong) ? [...h.than_thong] : [];
      if (o.includes(i))
        return n.reply({ embeds: [warnE(`${a.emoji} Ngươi đã học **${a.ten}** rồi!`)] });
      const c = "object" == typeof h.ngoc_gian_tui && h.ngoc_gian_tui ? { ...h.ngoc_gian_tui } : {};
      if (!c[i])
        return n.reply({
          embeds: [
            errE(
              `${a.emoji} Túi không có **${a.ten}**!\nMua từ \`-donate\` → danh mục ✨ Thần Thông.`,
            ),
          ],
        });
      if ((h.canh_gioi || 0) < a.yeu_cau_cap)
        return n.reply({
          embeds: [
            errE(
              `${a.emoji} **${a.ten}** yêu cầu **cảnh giới ${a.yeu_cau_cap}**!\nCảnh giới hiện tại: ${h.canh_gioi || 0}`,
            ),
          ],
        });
      (delete c[i],
        o.push(i),
        await db("UPDATE players SET than_thong=$1, ngoc_gian_tui=$2 WHERE user_id=$3", [
          o,
          JSON.stringify(c),
          e,
        ]));
      // Cộng bag_bonus_kg nếu thần thông có property này
      if (a.bag_bonus_kg) {
        const bonusKg = Number(a.bag_bonus_kg);
        if (bonusKg > 0) {
          await db("UPDATE players SET bag_bonus_kg=COALESCE(bag_bonus_kg,0)+$1 WHERE user_id=$2", [bonusKg, e]);
        }
      }
      const nameMap = { atk: "ATK", def: "Thủ Lực", hp: "HP", crit: "Bạo Kích", dodge: "Né tránh", dmg_reduce: "Giảm ST nhận", exp: "Tu Vi", drop: "Drop Bonus", hp_flat: "HP tĩnh", regen_pct: "Hồi Phục/lượt", cd_reduce: "Giảm CD" };
      const _ = Object.entries(a.effects)
        .map(([n, t]) => {
          const label = nameMap[n] || n;
          if (n === "hp_flat") return `**+${t} ${label}**`;
          const sign = t >= 0 ? "+" : "";
          return `**${sign}${Math.round(100 * t)}% ${label}**`;
        })
        .join(", ");
      const bagLine = a.bag_bonus_kg ? `\n🎒 **Tải trọng +${a.bag_bonus_kg}kg** (vĩnh viễn)` : "";
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${a.emoji} Thần Thông Khai Ngộ!`)
            .setColor(11032055)
            .setDescription(
              `*Ngọc Giản tan thành linh quang, đạo lý thần thông thấm vào huyết mạch...*\n\n${a.emoji} **${a.ten}** học thành công!\n\n${CE("tutv", "📈")} Hiệu ứng vĩnh viễn: ${_}${bagLine}\n\n*Tổng thần thông: ${o.length}/8 — dùng \`-than_thong xem\` xem tất cả.*`,
            )
            .setFooter({ text: "Thần Thông | Donate Exclusive | Vĩnh Viễn" }),
        ],
      });
    }
    return n.reply({ embeds: [errE("Cú pháp: `-than_thong xem` | `-than_thong hoc <id>`")] });
});

