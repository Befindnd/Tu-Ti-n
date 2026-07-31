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
  BAG_WEIGHTS, getDanKg, getBagCapacity, calcBagWeight, canAddToBag, calcMaxLinhThach, calcMaxLinhThachTrung,
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
const { LINH_THU_LOOT_ITEMS } = require('../data/linh_thu_data');
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
    n.linh_thach_trung && t.push(`${CE("tult_trung", "🔮")} ${fmt(n.linh_thach_trung)} Linh Thạch Trung`),
    n.exp && t.push(`${CE("tutv", "📈")} ${fmt(n.exp)} Tu Vi`),
    n.ve_doi_nghe && t.push(`${CE('ve_nghe','🎫')} Vé Đổi Nghề ×${n.ve_doi_nghe}`),
    n.ve_doi_linh_can && t.push(`${CE('ve_linh_can','🔮')} Vé Đổi Linh Căn ×${n.ve_doi_linh_can}`),
    n.ve_doi_huyet && t.push(`${CE('ve_huyet_mach','🩸')} Vé Đổi Huyết Mạch ×${n.ve_doi_huyet}`),
    n.ve_doi_huyet_vip && t.push(`💎 Vé Huyết Mạch VIP ×${n.ve_doi_huyet_vip}`),
    n.ve_nang_cap_huyet && t.push(`🔱 Vé Nâng Cấp Huyết Mạch ×${n.ve_nang_cap_huyet}`),
    n.vu_khi)
  ) {
    const e = VU_KHI.find((t) => t.id === n.vu_khi);
    t.push(`${CE("tuatk", "⚔️")} ${e?.ten || n.vu_khi}`);
  }
  if (n.bao_boi) {
    const e = BAO_BOI.find((t) => t.id === n.bao_boi);
    t.push(`🔮 ${e?.ten || n.bao_boi}`);
  }
  if (n.bi_phap) {
    const e = BI_PHAP.find((t) => t.id === n.bi_phap);
    t.push(`✨ ${e?.ten || n.bi_phap}`);
  }
  if (n.dan_duoc) {
    const e = DAN_DUOC.find((t) => t.id === n.dan_duoc);
    t.push(`${e?.emoji || "⚗️"} ${e?.ten || n.dan_duoc}${e?.limited ? " 💎 *(Limited)*" : ""} ×${n.dan_duoc_qty || 1}`);
  }
  if (n.linh_can) {
    const e = LINH_CAN[n.linh_can];
    t.push(`${e?.emoji || "🔮"} Linh Căn: **${e?.ten || n.linh_can}**`);
  }
  if (n.huyet_mach) {
    const e = HUYET_MACH[n.huyet_mach];
    t.push(`${CE(e?.ce_name || "hm_pham", e?.emoji || "🩸")} Huyết Mạch: **${e?.ten || n.huyet_mach}**`);
  }
  if (n.phu_luc) {
    const e = PHU_LUC_DATA.find((p) => p.id === n.phu_luc);
    const qty = Math.max(1, Number(n.phu_luc_qty) || 1);
    t.push(`${e?.emoji || "📜"} ${e?.ten || n.phu_luc}${e?.limited ? " 💎" : ""} ×${qty}`);
  }
  if (n.ngoc_gian) {
    const e = NGOC_GIAN_DATA.find((x) => x.id === n.ngoc_gian);
    t.push(`${e?.emoji || "✨"} Ngọc Giản **${e?.ten || n.ngoc_gian}**${e?.giftcode_only ? " 🌸 *(Giftcode Độc Quyền)*" : ""}`);
  }
  if (n.vat_pham) {
    const e = LINH_THU_LOOT_ITEMS[n.vat_pham];
    const qty = Math.max(1, Number(n.vat_pham_qty) || 1);
    t.push(`${e?.emoji || "📦"} **${e?.ten || n.vat_pham}** ×${qty}`);
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
  if (Number(e.linh_thach_trung) > 0) {
    const want = Math.floor(Number(e.linh_thach_trung));
    const qty = calcMaxLinhThachTrung(n, want);
    if (qty > 0) {
      await db("UPDATE players SET linh_thach_trung=COALESCE(linh_thach_trung,0)+$1 WHERE user_id=$2", [qty, t]);
      h.push(`${CE("tult_trung", "🔮")} +**${fmt(qty)}** Linh Thạch Trung${qty < want ? ` *(túi đầy, chỉ nhận ${qty}/${want})*` : ""}`);
    } else {
      h.push(`${CE("tult_trung", "🔮")} ~~+${fmt(want)} Linh Thạch Trung~~ *(túi quá nặng — không nhận được)*`);
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
              ? `🔮 Bảo Bối **${i.ten}** *(túi quá tải — đổi thành ${fmt(lt)} ${CE("tult", "💠")})*`
              : `🔮 Bảo Bối **${i.ten}** *(túi quá tải + đầy linh thạch — bỏ qua)*`);
            if (lt > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [lt, t]);
          })()
      : i &&
        await (async () => {
          const lt = calcMaxLinhThach(n, 2000);
          h.push(lt > 0
            ? `🔮 Bảo Bối **${i.ten}** *(đã có, đổi thành ${fmt(lt)} ${CE("tult", "💠")})*`
            : `🔮 Bảo Bối **${i.ten}** *(đã có + túi đầy linh thạch — bỏ qua)*`);
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
      h.push(`📜 Phù Lục: **${i.emoji} ${i.ten}**${i.limited ? " 💎 *(Limited)*" : ""} ×${a}`);
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
  if (e.ve_doi_linh_can) {
    const n = Math.max(1, Number(e.ve_doi_linh_can) || 1);
    (await db("UPDATE players SET ve_doi_linh_can=COALESCE(ve_doi_linh_can,0)+$1 WHERE user_id=$2", [n, t]),
      h.push(`${CE('ve_linh_can','🔮')} **Vé Đổi Linh Căn** ×${n} *(dùng \`-linh_can doi\` để đổi ngẫu nhiên!)*`));
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
  if (e.vat_pham) {
    const itemId = e.vat_pham;
    const itemDef = LINH_THU_LOOT_ITEMS[itemId];
    const qty = Math.max(1, Number(e.vat_pham_qty) || 1);
    if (itemDef) {
      const vp = { ...(n.vat_pham || {}) };
      vp[itemId] = (vp[itemId] || 0) + qty;
      await db("UPDATE players SET vat_pham=$1 WHERE user_id=$2", [JSON.stringify(vp), t]);
      h.push(`${itemDef.emoji || "📦"} **${itemDef.ten}** ×${qty} → vào Túi Trữ Vật!\nDùng \`-vat_pham mo ${itemId}\` để mở.`);
    } else {
      h.push(`${CE('warn_icon','⚠️')} Vật phẩm không hợp lệ: ${itemId}`);
    }
  }
  return (0 === h.length && h.push("*(Không có phần thưởng)*"), h);
}


  reg("admin", ["adm"], async (n, t) => {
    const e = n.author.id;
    if (!ADMIN_ID || e !== ADMIN_ID) return n.reply({ embeds: [errE("Không có quyền truy cập!")] });
    const h = (t[0] || "").toLowerCase();
    if ("nap" === h) {
      const e = n.mentions.users.first(),
        h = parseInt(t[2]) || 0;
      if (!e || h <= 0)
        return n.reply({ embeds: [errE("Cú pháp: `-admin nap @user <số_linh_thạch>`")] });
      return (await getPlayer(e.id))
        ? (await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [h, e.id]),
          n.reply({
            embeds: [okE(`✅ Đã nạp **${fmt(h)} ${CE("tult", "💠")}** cho **${e.username}**!`)],
          }))
        : n.reply({ embeds: [errE(`**${e.username}** chưa có tài khoản!`)] });
    }
    if ("nap_kg" === h) {
      const e = n.mentions.users.first(),
        kg = parseInt(t[2]) || 0;
      if (!e || kg === 0)
        return n.reply({ embeds: [errE("Cú pháp: `-admin nap_kg @user <số_kg>`\nVí dụ: `-admin nap_kg @NhanVat 30`")] });
      const pl = await getPlayer(e.id);
      if (!pl) return n.reply({ embeds: [errE(`**${e.username}** chưa có tài khoản!`)] });
      await db("UPDATE players SET bag_bonus_kg=COALESCE(bag_bonus_kg,0)+$1 WHERE user_id=$2", [kg, e.id]);
      const newKg = (pl.bag_bonus_kg || 0) + kg;
      return n.reply({
        embeds: [okE(`✅ Đã ${kg > 0 ? "thêm" : "trừ"} **${Math.abs(kg)}kg** tải trọng túi cho **${e.username}**!\n🎒 Bonus túi hiện tại: **+${newKg}kg**`)],
      });
    }
    if ("set_exp" === h) {
      const e = n.mentions.users.first(),
        h = parseInt(t[2]) || 0;
      if (!e || h < 0) return n.reply({ embeds: [errE("Cú pháp: `-admin set_exp @user <exp>`")] });
      return (await getPlayer(e.id))
        ? (await db("UPDATE players SET exp=$1 WHERE user_id=$2", [h, e.id]),
          n.reply({ embeds: [okE(`✅ Set exp **${fmt(h)}** cho **${e.username}**!`)] }))
        : n.reply({ embeds: [errE(`**${e.username}** chưa có tài khoản!`)] });
    }
    if ("set_cap" === h) {
      const e = n.mentions.users.first(),
        h = parseInt(t[2]);
      if (!e || isNaN(h) || h < 0 || h >= CANH_GIOI.length)
        return n.reply({
          embeds: [errE(`Cú pháp: \`-admin set_cap @user <0-${CANH_GIOI.length - 1}>\``)],
        });
      const i = await getPlayer(e.id);
      if (!i) return n.reply({ embeds: [errE(`**${e.username}** chưa có tài khoản!`)] });
      const a = tinhCS({ ...i, canh_gioi: h });
      return (
        await db("UPDATE players SET canh_gioi=$1, hp_max=$2, hp=$3 WHERE user_id=$4", [
          h,
          a.hp_max,
          a.hp_max,
          e.id,
        ]),
        n.reply({
          embeds: [okE(`✅ Set cảnh giới tầng **${h}** (${getCG(h).ten}) cho **${e.username}**!`)],
        })
      );
    }
    if ("reset" === h) {
      const t = n.mentions.users.first();
      return t
        ? (await db("DELETE FROM players WHERE user_id=$1", [t.id]),
          n.reply({ embeds: [okE(`✅ Đã xóa tài khoản **${t.username}**!`)] }))
        : n.reply({ embeds: [errE("Cú pháp: `-admin reset @user`")] });
    }
    if ("reset_all" === h) {
      if (t[1] !== "XACNHAN")
        return n.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setTitle(`${CE('warn_icon','⚠️')} XÁC NHẬN XÓA TOÀN BỘ DỮ LIỆU`)
              .setDescription(
                "Lệnh này sẽ **XÓA TOÀN BỘ** tài khoản tất cả người chơi!\n\n" +
                "Để xác nhận, gõ:\n`-admin reset_all XACNHAN`"
              ),
          ],
        });
      const { rowCount } = await db("DELETE FROM players");
      return n.reply({
        embeds: [okE(`✅ Đã xóa **${rowCount}** tài khoản! Server đã reset hoàn toàn.`)],
      });
    }
    if ("ban" === h) {
      const e = n.mentions.users.first(),
        h = parseInt(t[2]) || 24;
      if (!e) return n.reply({ embeds: [errE("Cú pháp: `-admin ban @user [giờ]`")] });
      const i = Date.now() + 36e5 * h;
      return (
        await db("UPDATE players SET ban_until=$1 WHERE user_id=$2", [i, e.id]),
        n.reply({ embeds: [okE(`🔨 Đã ban **${e.username}** trong **${h} giờ**!`)] })
      );
    }
    if ("unban" === h) {
      const t = n.mentions.users.first();
      return t
        ? (await db("UPDATE players SET ban_until=0 WHERE user_id=$1", [t.id]),
          n.reply({ embeds: [okE(`✅ Đã unban **${t.username}**!`)] }))
        : n.reply({ embeds: [errE("Cú pháp: `-admin unban @user`")] });
    }
    if ("info" === h) {
      const t = n.mentions.users.first();
      if (!t) return n.reply({ embeds: [errE("Cú pháp: `-admin info @user`")] });
      const e = await getPlayer(t.id);
      if (!e) return n.reply({ embeds: [errE(`**${t.username}** chưa có tài khoản!`)] });
      const h =
        Number(e.ban_until || 0) > Date.now()
          ? `Còn ${Math.ceil((Number(e.ban_until) - Date.now()) / 36e5)}h`
          : "Không";
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`👤 Admin Info — ${t.username}`)
            .setColor(2899536)
            .addFields(
              { name: "ID", value: e.user_id, inline: !0 },
              {
                name: "Cảnh Giới",
                value: `${getCG(e.canh_gioi).ten} (${e.canh_gioi})`,
                inline: !0,
              },
              { name: "Linh Thạch", value: fmt(e.linh_thach), inline: !0 },
              { name: "Tu Vi", value: fmt(e.exp), inline: !0 },
              { name: "Ban", value: h, inline: !0 },
              { name: "Nghề", value: e.nghe || "Chưa chọn", inline: !0 },
            ),
        ],
      });
    }
    if ("broadcast" === h) {
      const e = t.slice(1).join(" ");
      return e
        ? (n.channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle("📢 Thông Báo Từ Admin")
                .setColor(16737792)
                .setDescription(e),
            ],
          }),
          n.reply({ embeds: [okE("✅ Đã gửi thông báo!")] }))
        : n.reply({ embeds: [errE("Cú pháp: `-admin broadcast <tin nhắn>`")] });
    }
    if ("tao_code" === h) {
      const e = (t[1] || "").toUpperCase().trim();
      if (!e)
        return n.reply({
          embeds: [
            errE(
              "Cú pháp: `-admin tao_code <CODE> [lt:số] [ltt:số] [exp:số] [kg:số] [ve:số] [vh:số] [vhv:số] [vk:id] [bb:id] [bp:id] [dd:id] [ddqty:số] [lc:id] [hm:id] [phu:id] [pqty:số] [ng:id] [vp:id] [vpqty:số] [max:số] [ngay:số] [cg:số] [uid:userID]`\nVí dụ: `-admin tao_code GIFT2026 lt:1500 ve:1 vh:1 max:100 ngay:3`\nVí dụ Hộp Linh Thạch: `-admin tao_code BUOITOIVV vp:hop_linh_thach vpqty:3 max:100 ngay:1`\nVí dụ tải trọng: `-admin tao_code TUIKHUNG kg:30 max:50 ngay:7`\nVí dụ đan dược: `-admin tao_code PHACANHX3 dd:pha_canh_dan ddqty:3 vh:10 max:100`\nTặng riêng: `-admin tao_code HOISUANRIENG ng:hoi_xuan uid:123456789 cg:10`\n`vp:id` — Vật Phẩm 📦 (vd: hop_linh_thach) | `vpqty:số` — Số lượng hộp | `kg:số` — +Tải Trọng Túi 🎒 (kg vĩnh viễn)\n`ve:số` — Vé Đổi Nghề 🎫 | `vh:số` — Vé Đổi Huyết 🩸 | `vhv:số` — Vé Huyết VIP 💎 | `vnch:số` — Vé Nâng Cấp Huyết 🔱 | `vlc:số` — Vé Đổi Linh Căn 🔮 | `ngay:số` — Hết hạn sau N ngày\n`dd:id` — Đan Dược ⚗️ | `ddqty:số` — Số lượng đan dược | `phu:id` — Phù Lục 📜 | `pqty:số` — Số lượng phù | `ng:id` — Ngọc Giản Thần Thông ✨\n`cg:số` — Yêu cầu cảnh giới tầng tối thiểu | `uid:userID` — Tặng riêng cho 1 người (Discord ID)\nLinh Căn IDs: kim moc thuy hoa tho hon_don am duong thunder phong\nHuyết Mạch IDs: pham linh than thanh tien\nPhù IDs: ho_than_phu sat_phong_phu linh_hoi_phu tu_toc_phu khai_ngo_phu thien_dia_phu pha_canh_phu\nThần Thông IDs: ngung_khi_thuat linh_giac the_phach_cuong_hoa khinh_cong linh_khi_ho_the kim_chung_trao thiet_bo_sam thien_phuc_chi_thuat tu_luyen_chi_thuat hoi_xuan",
            ),
          ],
        });
      const h = {};
      for (let n = 2; n < t.length; n++) {
        const [e, i] = t[n].split(":");
        e && i && (h[e.toLowerCase()] = i);
      }
      const i = parseInt(h.lt) || 0,
        a = parseInt(h.exp) || 0,
        o = h.uid ? 1 : (parseInt(h.max) || 1),
        c = parseInt(h.ngay) || 0,
        _ = c > 0 ? new Date(Date.now() + 864e5 * c) : null,
        u = parseInt(h.ve) || 0,
        cgYeuCau = parseInt(h.cg) || 0,
        targetUserId = h.uid ? h.uid.replace(/[^0-9]/g, '') : null,
        r = {};
      (i > 0 && (r.linh_thach = i), a > 0 && (r.exp = a), u > 0 && (r.ve_doi_nghe = u));
      const ltt = parseInt(h.ltt) || 0;
      ltt > 0 && (r.linh_thach_trung = ltt);
      const s = parseInt(h.vh) || 0;
      s > 0 && (r.ve_doi_huyet = s);
      const l = parseInt(h.vhv) || 0;
      l > 0 && (r.ve_doi_huyet_vip = l);
      const vnch = parseInt(h.vnch) || 0;
      vnch > 0 && (r.ve_nang_cap_huyet = vnch);
      const vlc = parseInt(h.vlc) || 0;
      vlc > 0 && (r.ve_doi_linh_can = vlc);
      if (h.vk) {
        if (!VU_KHI.find((n) => n.id === h.vk))
          return n.reply({ embeds: [errE(`Không tìm thấy vũ khí \`${h.vk}\`!`)] });
        r.vu_khi = h.vk;
      }
      if (h.bb) {
        if (!BAO_BOI.find((n) => n.id === h.bb))
          return n.reply({ embeds: [errE(`Không tìm thấy bảo bối \`${h.bb}\`!`)] });
        r.bao_boi = h.bb;
      }
      if (h.bp) {
        if (!BI_PHAP.find((n) => n.id === h.bp))
          return n.reply({ embeds: [errE(`Không tìm thấy bí pháp \`${h.bp}\`!`)] });
        r.bi_phap = h.bp;
      }
      if (h.dd) {
        if (!DAN_DUOC.find((n) => n.id === h.dd))
          return n.reply({ embeds: [errE(`Không tìm thấy đan dược \`${h.dd}\`!`)] });
        r.dan_duoc = h.dd;
        const ddqty = parseInt(h.ddqty) || 1;
        if (ddqty > 1) r.dan_duoc_qty = ddqty;
      }
      if (h.lc) {
        if (!LINH_CAN[h.lc])
          return n.reply({
            embeds: [
              errE(
                `Không tìm thấy Linh Căn \`${h.lc}\`!\nIDs hợp lệ: kim moc thuy hoa tho hon_don am duong thunder phong`,
              ),
            ],
          });
        if (h.lc === 'vo_cuc')
          return n.reply({
            embeds: [errE('♾️ **Vô Cực Căn Nguyên** chỉ tặng qua gói Donate — không thể tạo qua giftcode thường.')],
          });
        r.linh_can = h.lc;
      }
      if (h.hm) {
        if (!HUYET_MACH[h.hm])
          return n.reply({
            embeds: [
              errE(`Không tìm thấy Huyết Mạch \`${h.hm}\`!\nIDs hợp lệ: pham linh than thanh tien`),
            ],
          });
        r.huyet_mach = h.hm;
      }
      if (h.phu) {
        if (!PHU_LUC_DATA.find((p) => p.id === h.phu))
          return n.reply({
            embeds: [errE(`Không tìm thấy Phù \`${h.phu}\`!\nIDs hợp lệ: ho_than_phu sat_phong_phu linh_hoi_phu tu_toc_phu khai_ngo_phu thien_dia_phu pha_canh_phu`)],
          });
        r.phu_luc = h.phu;
        const pqty = parseInt(h.pqty) || 1;
        if (pqty > 1) r.phu_luc_qty = pqty;
      }
      if (h.ng) {
        if (!NGOC_GIAN_DATA.find((x) => x.id === h.ng))
          return n.reply({
            embeds: [errE(`Không tìm thấy Ngọc Giản Thần Thông \`${h.ng}\`!\nIDs hợp lệ: ${NGOC_GIAN_DATA.map(x=>x.id).join(', ')}`)],
          });
        r.ngoc_gian = h.ng;
      }
      const kgBonus = parseInt(h.kg) || 0;
      if (kgBonus > 0) r.bag_bonus_kg = kgBonus;
      if (h.vp) {
        if (!LINH_THU_LOOT_ITEMS[h.vp])
          return n.reply({ embeds: [errE(`Không tìm thấy vật phẩm \`${h.vp}\`!\nVí dụ: \`vp:hop_linh_thach\``)] });
        r.vat_pham = h.vp;
        const vpqty = Math.max(1, parseInt(h.vpqty) || 1);
        if (vpqty > 1) r.vat_pham_qty = vpqty;
      }
      if (0 === Object.keys(r).length)
        return n.reply({
          embeds: [errE("Phải có ít nhất 1 phần thưởng! (lt, ltt, exp, kg, ve, vh, vhv, vnch, vlc, vk, bb, bp, dd, lc, hm, phu, ng, vp)")],
        });
      await db(
        "INSERT INTO giftcodes(code, rewards, max_uses, expires_at, min_canh_gioi, target_user_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(code) DO UPDATE SET rewards=$2, max_uses=$3, used_by='{}', min_canh_gioi=$5, expires_at=$4, target_user_id=$6",
        [e, JSON.stringify(r), o, _, cgYeuCau, targetUserId],
      );
      const m = describeRewards(r),
        g = _ ? `\n⏰ Hết hạn: **${c} ngày** (${_.toLocaleDateString("vi-VN")})` : "",
        cgStr = cgYeuCau > 0 ? `\n🏔️ Yêu cầu cảnh giới tầng **${cgYeuCau}** trở lên` : "",
        uidStr = targetUserId ? `\n👤 Tặng riêng: <@${targetUserId}> (chỉ họ dùng được)` : "";
      return n.reply({
        embeds: [okE(`✅ Tạo code **${e}**!\n${m}\n📊 Giới hạn: **${o}** lượt dùng.${g}${cgStr}${uidStr}`)],
      });
    }
    if ("xoa_code" === h) {
      const e = (t[1] || "").toUpperCase().trim();
      if (!e) return n.reply({ embeds: [errE("Cú pháp: `-admin xoa_code <CODE>`")] });
      return 0 === (await db("DELETE FROM giftcodes WHERE code=$1", [e])).rowCount
        ? n.reply({ embeds: [warnE(`Code **${e}** không tồn tại.`)] })
        : n.reply({ embeds: [okE(`🗑️ Đã xóa code **${e}**!`)] });
    }
    if ("thu_hoi_code" === h) {
      const codeArg = (t[1] || "").toUpperCase().trim();
      const targetUser = n.mentions.users.first();
      if (!codeArg || !targetUser)
        return n.reply({
          embeds: [errE("Cú pháp: `-admin thu_hoi_code <CODE> @user`\nXoá lượt dùng của 1 người khỏi code (để họ không thể dùng lại, hoặc mở slot cho người khác).")],
        });
      const codeRow = await db("SELECT code, used_by, max_uses FROM giftcodes WHERE code=$1", [codeArg]);
      if (!codeRow.rows.length)
        return n.reply({ embeds: [warnE(`Code **${codeArg}** không tồn tại.`)] });
      const usedBy = codeRow.rows[0].used_by || [];
      if (!usedBy.includes(targetUser.id))
        return n.reply({ embeds: [warnE(`**${targetUser.username}** chưa dùng code **${codeArg}**.`)] });
      await db(
        "UPDATE giftcodes SET used_by=array_remove(used_by,$1) WHERE code=$2",
        [targetUser.id, codeArg],
      );
      return n.reply({
        embeds: [okE(`✅ Đã thu hồi lượt dùng code **${codeArg}** của **${targetUser.username}**!\n*(Họ có thể dùng lại code này, hoặc slot đã được giải phóng cho người khác.)*`)],
      });
    }
    if ("ds_code" === h) {
      const t = await db(
        "SELECT code, rewards, max_uses, COALESCE(array_length(used_by,1),0) AS used, expires_at, min_canh_gioi, target_user_id FROM giftcodes ORDER BY created_at DESC LIMIT 20",
      );
      if (!t.rows.length) return n.reply({ embeds: [warnE("Chưa có code nào.")] });
      const e = t.rows.map((n) => {
        const expired = n.expires_at && new Date(n.expires_at) < new Date();
        const expStr = n.expires_at
          ? ` | ⏰ ${expired ? "~~hết hạn~~" : new Date(n.expires_at).toLocaleDateString("vi-VN")}`
          : "";
        const cgStr = (n.min_canh_gioi || 0) > 0 ? ` | 🏔️ cg≥${n.min_canh_gioi}` : "";
        const uidStr = n.target_user_id ? ` | 👤 <@${n.target_user_id}>` : "";
        return `${expired ? "~~" : ""}**${n.code}**${expired ? "~~" : ""} — ${describeRewards(n.rewards || {})} | ${n.used || 0}/${n.max_uses} lượt${expStr}${cgStr}${uidStr}`;
      });
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("📋 Danh Sách Code")
            .setColor(2899536)
            .setDescription(e.join("\n")),
        ],
      });
    }
    if ("donate" === h) {
      const e = n.mentions.users.first(),
        h = t[2];
      if (!e || !h)
        return n.reply({
          embeds: [
            errE(
              "Cú pháp: `-admin donate @user <package_id>`\nVí dụ: `-admin donate @nguoi lt_25k`\nXem danh sách IDs trong `-donate`.",
            ),
          ],
        });
      const i = await getPlayer(e.id);
      if (!i) return n.reply({ embeds: [errE(`**${e.username}** chưa có tài khoản!`)] });
      const a = findDonateGoi(h);
      if (!a)
        return n.reply({
          embeds: [
            errE(`Không tìm thấy package ID \`${h}\`!\nXem danh sách IDs trong \`-donate\`.`),
          ],
        });
      const { cat: o, goi: c } = a;
      if (o.lan_dau) {
        if ((i.lan_dau_mua || []).includes(h))
          return n.reply({
            embeds: [
              warnE(`**${e.username}** đã nhận gói **${c.ten}** rồi! (gói lần đầu, chỉ 1 lần)`),
            ],
          });
      }
      const _ = c.rewards || {},
        u = await applyGiftcodeRewards(i, e.id, _);
      o.lan_dau &&
        (await db("UPDATE players SET lan_dau_mua=array_append(lan_dau_mua,$1) WHERE user_id=$2", [
          h,
          e.id,
        ]),
        u.push(`✅ Đánh dấu gói Lần Đầu **${c.ten}** đã dùng`));
      // Ghi lịch sử nạp
      const logEntry = JSON.stringify({
        pkg_id: h,
        ten: c.ten,
        gia: c.gia,
        thoi_gian: new Date().toISOString(),
        admin: n.author.username,
      });
      await db(
        "UPDATE players SET nap_log = nap_log || $1::jsonb WHERE user_id = $2",
        [`[${logEntry}]`, e.id]
      ).catch(() => {});
      const r = new EmbedBuilder()
        .setTitle("✅ Đã Kích Hoạt Gói Donate")
        .setColor(3066993)
        .setDescription(
          `**Người nhận:** ${e.username} (${e.id})\n**Gói:** ${c.emoji} ${c.ten} — ${c.gia}\n\n**Phần thưởng đã trao:**\n${u.join("\n")}`,
        )
        .setFooter({ text: `Admin: ${n.author.username}` });
      return n.reply({ embeds: [r] });
    }
    if ("lich_nap" === h) {
      const t = n.mentions.users.first();
      if (!t) return n.reply({ embeds: [errE("Cú pháp: `-admin lich_nap @user`")] });
      const e = await getPlayer(t.id);
      if (!e) return n.reply({ embeds: [errE(`**${t.username}** chưa có tài khoản!`)] });
      const logs = e.nap_log || [];
      if (!logs.length)
        return n.reply({
          embeds: [new EmbedBuilder()
            .setTitle(`💳 Lịch Sử Nạp — ${t.username}`)
            .setColor(0x2C2F33)
            .setDescription("_Chưa có lần nạp nào được ghi nhận._")],
        });
      const lines = logs.map((entry, i) => {
        const d = new Date(entry.thoi_gian);
        const dateStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
        return `**${i+1}.** ${CE('tult','💠')} ${entry.ten} — \`${entry.gia}\` · 📅 ${dateStr} · 👤 ${entry.admin}`;
      });
      // Tổng số lần nạp và danh sách giá
      const tongNap = logs.length;
      return n.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`💳 Lịch Sử Nạp — ${t.username}`)
          .setColor(0xF1C40F)
          .setDescription(lines.slice(-20).join("\n"))
          .setFooter({ text: `Tổng: ${tongNap} lần nạp${tongNap > 20 ? ` (hiển thị 20 gần nhất)` : ""}` })],
      });
    }
    if ("lan_dau_info" === h) {
      const t = n.mentions.users.first();
      if (!t) return n.reply({ embeds: [errE("Cú pháp: `-admin lan_dau_info @user`")] });
      const e = await getPlayer(t.id);
      if (!e) return n.reply({ embeds: [errE(`**${t.username}** chưa có tài khoản!`)] });
      const h = e.lan_dau_mua || [],
        i = e.bag_bonus_kg || 0,
        a = h.length
          ? h
              .map((n) => {
                const t = findDonateGoi(n);
                return t ? `• ${t.goi.emoji} ${t.goi.ten}` : `• ${n}`;
              })
              .join("\n")
          : "_Chưa mua gói lần đầu nào._";
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`📋 Donate Info — ${t.username}`)
            .setColor(2899536)
            .addFields(
              { name: "🎁 Gói Lần Đầu Đã Mua", value: a, inline: !1 },
              { name: "🎒 Bonus Tải Trọng Túi", value: `+${i} kg`, inline: !0 },
            ),
        ],
      });
    }
    if ("thu_hoi_thach" === h) {
      const rows = await db(
        `UPDATE players SET linh_thao = linh_thao - 'huyet_mach_thach' WHERE linh_thao ? 'huyet_mach_thach' RETURNING user_id`,
      );
      const count = rows.rowCount || rows.length || 0;
      return n.reply({
        embeds: [okE(`✅ Đã thu hồi **Huyết Mạch Thạch** từ **${count}** người chơi!`)],
      });
    }
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("⚙️ Admin Commands")
          .setColor(2899536)
          .setDescription(
            "`-admin nap @user <số>` — Nạp Linh Thạch\n`-admin nap_kg @user <kg>` — Thêm/trừ tải trọng túi (VD: 30 hoặc -10)\n`-admin set_exp @user <exp>` — Set Tu Vi\n`-admin set_cap @user <tầng>` — Set Cảnh Giới\n`-admin reset @user` — Xóa 1 tài khoản\n`-admin reset_all XACNHAN` — ${CE('warn_icon','⚠️')} Xóa **toàn bộ** tài khoản\n`-admin ban @user [giờ]` — Ban người chơi\n`-admin unban @user` — Gỡ ban\n`-admin info @user` — Xem thông tin\n`-admin broadcast <tin>` — Thông báo\n`-admin donate @user <pkg_id>` — Kích hoạt gói donate\n`-admin lich_nap @user` — 💳 Xem lịch sử nạp của người chơi\n`-admin lan_dau_info @user` — Xem gói lần đầu đã mua\n`-admin tao_code <CODE> [lt:số] [exp:số] [kg:số] [ve:số] [vk:id] [bb:id] [bp:id] [dd:id] [lc:id] [hm:id] [max:số]` — Tạo giftcode (`kg` = +tải trọng túi vĩnh viễn)\n`-admin xoa_code <CODE>` — Xóa giftcode\n`-admin thu_hoi_code <CODE> @user` — Thu hồi lượt dùng code của 1 người\n`-admin ds_code` — Danh sách giftcode\n`-admin thu_hoi_thach` — Thu hồi Huyết Mạch Thạch từ tất cả player",
          ),
      ],
    });
});

module.exports = { applyGiftcodeRewards, describeRewards };
