'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer, awardBiPhap, awardLinhThao } = require('../db/players');
const { LINH_THU_LOOT_ITEMS } = require('../data/linh_thu_data');
const { CE } = require('../systems/emoji');
const antiraid = require('../core/antiraid');
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
    n.ve_doi_huyet_vip && t.push(`${CE('tukv','💎')} Vé Huyết Mạch VIP ×${n.ve_doi_huyet_vip}`),
    n.ve_nang_cap_huyet && t.push(`🔱 Vé Nâng Cấp Huyết Mạch ×${n.ve_nang_cap_huyet}`),
    n.huyet_mach_thach && t.push(`${CE('lt_huyet_mach_thach','💎')} Huyết Mạch Thạch ×${n.huyet_mach_thach}`),
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
    t.push(`${e?.emoji || CE('ng_luyen_dan','⚗️')} ${e?.ten || n.dan_duoc}${e?.limited ? ` ${CE('tukv','💎')} *(Limited)*` : ""} ×${n.dan_duoc_qty || 1}`);
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
  if (n.ngoc_gian) {
    const e = NGOC_GIAN_DATA.find((x) => x.id === n.ngoc_gian);
    t.push(`${e?.emoji || "✨"} Ngọc Giản **${e?.ten || n.ngoc_gian}**${e?.giftcode_only ? " 🌸 *(Giftcode Độc Quyền)*" : ""}`);
  }
  if (n.vat_pham) {
    const qty = Math.max(1, Number(n.vat_pham_qty) || 1);
    const info = LINH_THU_LOOT_ITEMS[n.vat_pham];
    t.push(`${info?.emoji || "📦"} **${info?.ten || n.vat_pham}** ×${qty} ${CE('lock_icon','🔒')} *(Độc Quyền)*`);
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
  if (e.huyet_mach_thach) {
    const qty = Math.max(1, Number(e.huyet_mach_thach) || 1);
    await db(
      `UPDATE players SET linh_thao = jsonb_set(
         COALESCE(linh_thao,'{}'),
         '{huyet_mach_thach}',
         to_jsonb(COALESCE((linh_thao->>'huyet_mach_thach')::int,0) + $1)
       ) WHERE user_id=$2`,
      [qty, t],
    );
    h.push(`💎 **Huyết Mạch Thạch** ×${qty} *(dùng \`-kham_pha\` → Thức Tỉnh Huyết Mạch để dùng)*`);
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
  // ── Vật Phẩm Độc Quyền (giftcode/donate) ────────────────────────────────
  if (e.vat_pham) {
    const itemId = e.vat_pham;
    const qty    = Math.max(1, Number(e.vat_pham_qty) || 1);
    const info   = LINH_THU_LOOT_ITEMS[itemId];
    if (info) {
      await db(
        `UPDATE players SET vat_pham = jsonb_set(
           COALESCE(vat_pham,'{}'),
           $1::text[],
           to_jsonb(COALESCE((vat_pham->>$2)::int,0) + $3)
         ) WHERE user_id=$4`,
        [`{${itemId}}`, itemId, qty, t],
      );
      h.push(`${info.emoji} **${info.ten}** ×${qty} ${CE('lock_icon','🔒')} *(Độc Quyền — dùng \`-vat_pham mo ${itemId}\`)*`);
    }
  }
  return (0 === h.length && h.push("*(Không có phần thưởng)*"), h);
}


reg("giftcode", ["code", "nhap_code", "gc"], async (n, t) => {
    const e = n.author.id,
      h = (t[0] || "").toUpperCase().trim();
    if (h) {
      const t = await getPlayer(e, n.author.username);
      if (!t) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });
      const i = await db("SELECT * FROM giftcodes WHERE code=$1", [h]);
      if (!i.rows.length)
        return n.reply({ embeds: [errE("❌ Mã code không tồn tại hoặc đã hết hạn!")] });
      const a = i.rows[0];
      if (a.expires_at && new Date(a.expires_at) < new Date())
        return n.reply({ embeds: [errE("⏰ Mã code này đã hết hạn!")] });
      if ((a.used_by || []).includes(e))
        return n.reply({ embeds: [warnE("Ngươi đã sử dụng code **" + h + "** rồi!")] });
      if ((a.used_by || []).length >= a.max_uses)
        return n.reply({ embeds: [errE("Code **" + h + "** đã được sử dụng hết lượt!")] });
      if (a.target_user_id && a.target_user_id !== e)
        return n.reply({ embeds: [errE("❌ Code này được tạo riêng cho người khác!")] });
      const acctCheck = antiraid.checkAccountAge(n.author);
      if (acctCheck.suspicious)
        return n.reply({ embeds: [errE(`❌ Tài khoản Discord quá mới (${acctCheck.ageDays.toFixed(1)} ngày) — cần đủ **${antiraid.DEFAULT_MIN_ACCOUNT_AGE_DAYS} ngày** tuổi mới được nhập giftcode (chống farm code bằng acc rác).`)] });
      if ((a.min_canh_gioi || 0) > 0 && t.canh_gioi < a.min_canh_gioi)
        return n.reply({ embeds: [errE(`❌ Code **${h}** yêu cầu cảnh giới **${getCG(a.min_canh_gioi).ten}** trở lên!`)] });
      const claimRes = await db(
        `UPDATE giftcodes SET used_by=array_append(used_by,$1) WHERE code=$2 AND NOT (COALESCE(used_by,'{}') @> ARRAY[$1]::text[]) AND COALESCE(array_length(used_by,1),0)<max_uses`,
        [e, h]
      );
      if (claimRes.rowCount === 0)
        return n.reply({ embeds: [errE("Code **" + h + "** vừa hết lượt hoặc ngươi đã dùng rồi!")] });
      const o = a.rewards || {},
        c = await applyGiftcodeRewards(t, e, o);
      const _ = Math.max(0, a.max_uses - (a.used_by || []).length - 1);
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(3066993)
            .setDescription(
              `🎁 Code **${h}** kích hoạt!\n\n${c.join("\n")}\n*(Còn ${_} lượt sử dụng)*`,
            )
            .setFooter({ text: n.author.username }),
        ],
      });
    }
    const i = (await getPlayer(e, n.author.username))
        ? "Nhập mã để nhận Linh Thạch, Linh Thạch phẩm cấp, Tiên Ngọc và vật phẩm Tu Đạo.\n\n• **Nhập Giftcode**: mở form nhập mã.\n• **Danh Sách**: xem các code còn hoạt động với bạn."
        : "Nhập mã để nhận Linh Thạch, Linh Thạch phẩm cấp, Tiên Ngọc và vật phẩm Tu Đạo.\nBạn phải hoàn tất tạo nhân vật Tu Đạo trước khi nhận code.\n\n• **Nhập Giftcode**: mở form nhập mã.\n• **Danh Sách**: xem các code còn hoạt động với bạn.",
      a = new EmbedBuilder().setTitle("🎁 Giftcode Tu Đạo").setColor(5793266).setDescription(i),
      o = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("gc_nhap")
          .setLabel("Nhập Giftcode")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🎁"),
        new ButtonBuilder()
          .setCustomId("gc_danhsach")
          .setLabel("Danh Sách")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("📋"),
      );
    return n.reply({ embeds: [a], components: [o] });
  });

  reg("tao_giftcode", ["tgc"], async (n, t) => {
    if (!ADMIN_ID || n.author.id !== ADMIN_ID)
      return n.reply({ embeds: [errE("Không có quyền truy cập!")] });

    // Usage: -tao_giftcode @user [params]  OR  -tao_giftcode userID [params]
    const mention = n.mentions.users.first();
    let targetUser = mention;
    let paramStart = 0;

    if (!targetUser) {
      // Try first arg as a user ID
      if (t[0] && /^\d{15,20}$/.test(t[0])) {
        try { targetUser = await n.client.users.fetch(t[0]); paramStart = 1; }
        catch { return n.reply({ embeds: [errE("Không tìm thấy người dùng với ID này!")] }); }
      } else {
        return n.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("🎁 Tạo Giftcode Riêng Cho Một Người")
              .setColor(9109504)
              .setDescription(
                "**Cú pháp:** `-tao_giftcode @người_chơi [tham số...]`\n\n" +
                "**Tham số phần thưởng:**\n" +
                `\`lt:số\` — Linh Thạch ${CE('tult','💠')} | \`ltt:số\` — Linh Thạch Trung 🔮 | \`exp:số\` — Tu Vi 📈\n` +
                "`ve:số` — Vé Đổi Nghề 🎫 | `vh:số` — Vé Đổi Huyết 🩸\n" +
                "`vhv:số` — Vé Huyết VIP 💎 | `vnch:số` — Vé Nâng Cấp Huyết 🔱\n" +
                "`vlc:số` — Vé Đổi Linh Căn 🔮 | `hmt:số` — Huyết Mạch Thạch 💎\n" +
                "`vk:id` — Vũ Khí ⚔️\n" +
                "`bb:id` — Bảo Bối 🔮 | `bp:id` — Bí Pháp 📜\n" +
                "`dd:id` — Đan Dược 💊 | `lc:id` — Linh Căn 🌿\n" +
                "`hm:id` — Huyết Mạch 🩸 | `phu:id` — Phù Lục 📜\n" +
                "`ng:id` — Ngọc Giản Thần Thông ✨\n" +
                "`ngay:số` — Hết hạn sau N ngày | `cg:số` — Yêu cầu cảnh giới\n" +
                "`ten:TENCODE` — Tự đặt tên code (mặc định tự tạo ngẫu nhiên)\n\n" +
                "**Ví dụ:** `-tao_giftcode @NhanVat lt:5000 exp:1000 ngay:7`\n" +
                "**Ví dụ tặng thần thông:** `-tao_giftcode @NhanVat ng:hoi_xuan lt:1000 ten:QUATANGTHANHTICH`\n\n" +
                `${CE('warn_icon','⚠️')} Code được tạo sẽ chỉ dùng được bởi người đó, và chỉ 1 lần.`
              ),
          ],
        });
      }
    } else {
      paramStart = 0; // mentions are not in t[]
    }

    // Parse params (skip the first arg if it was a raw user ID)
    const params = {};
    for (let i = paramStart; i < t.length; i++) {
      if (n.mentions.users.first() && i === 0 && t[0].startsWith("<@")) continue;
      const [k, v] = (t[i] || "").split(":");
      if (k && v) params[k.toLowerCase()] = v;
    }

    const rewards = {};
    if (parseInt(params.lt) > 0)  rewards.linh_thach = parseInt(params.lt);
    if (parseInt(params.ltt) > 0) rewards.linh_thach_trung = parseInt(params.ltt);
    if (parseInt(params.exp) > 0) rewards.exp = parseInt(params.exp);
    if (parseInt(params.ve) > 0)  rewards.ve_doi_nghe = parseInt(params.ve);
    if (parseInt(params.vh) > 0)  rewards.ve_doi_huyet = parseInt(params.vh);
    if (parseInt(params.vhv) > 0) rewards.ve_doi_huyet_vip = parseInt(params.vhv);
    if (parseInt(params.vnch) > 0) rewards.ve_nang_cap_huyet = parseInt(params.vnch);
    if (parseInt(params.vlc) > 0) rewards.ve_doi_linh_can = parseInt(params.vlc);
    if (parseInt(params.hmt) > 0) rewards.huyet_mach_thach = parseInt(params.hmt);

    if (params.vk) {
      if (!VU_KHI.find(x => x.id === params.vk))
        return n.reply({ embeds: [errE(`Không tìm thấy vũ khí \`${params.vk}\`!`)] });
      rewards.vu_khi = params.vk;
    }
    if (params.bb) {
      if (!BAO_BOI.find(x => x.id === params.bb))
        return n.reply({ embeds: [errE(`Không tìm thấy bảo bối \`${params.bb}\`!`)] });
      rewards.bao_boi = params.bb;
    }
    if (params.bp) {
      if (!BI_PHAP.find(x => x.id === params.bp))
        return n.reply({ embeds: [errE(`Không tìm thấy bí pháp \`${params.bp}\`!`)] });
      rewards.bi_phap = params.bp;
    }
    if (params.dd) {
      if (!DAN_DUOC.find(x => x.id === params.dd))
        return n.reply({ embeds: [errE(`Không tìm thấy đan dược \`${params.dd}\`!`)] });
      rewards.dan_duoc = params.dd;
    }
    if (params.lc) {
      if (!LINH_CAN[params.lc])
        return n.reply({ embeds: [errE(`Không tìm thấy Linh Căn \`${params.lc}\`!`)] });
      rewards.linh_can = params.lc;
    }
    if (params.hm) {
      if (!HUYET_MACH[params.hm])
        return n.reply({ embeds: [errE(`Không tìm thấy Huyết Mạch \`${params.hm}\`!`)] });
      rewards.huyet_mach = params.hm;
    }
    if (params.phu) {
      if (!PHU_LUC_DATA.find(p => p.id === params.phu))
        return n.reply({ embeds: [errE(`Không tìm thấy Phù \`${params.phu}\`!`)] });
      rewards.phu_luc = params.phu;
      const pqty = parseInt(params.pqty) || 1;
      if (pqty > 1) rewards.phu_luc_qty = pqty;
    }
    if (params.ng) {
      if (!NGOC_GIAN_DATA.find(x => x.id === params.ng))
        return n.reply({ embeds: [errE(`Không tìm thấy Ngọc Giản Thần Thông \`${params.ng}\`!\nIDs hợp lệ: ${NGOC_GIAN_DATA.map(x=>x.id).join(', ')}`)] });
      rewards.ngoc_gian = params.ng;
    }
    if (params.vp) {
      if (!LINH_THU_LOOT_ITEMS[params.vp])
        return n.reply({ embeds: [errE(`Không tìm thấy vật phẩm \`${params.vp}\`!\nVí dụ: \`vp:hop_linh_thach\``)] });
      rewards.vat_pham = params.vp;
      const vpqty = Math.max(1, parseInt(params.vpqty) || 1);
      if (vpqty > 1) rewards.vat_pham_qty = vpqty;
    }

    if (Object.keys(rewards).length === 0)
      return n.reply({ embeds: [errE("Phải có ít nhất 1 phần thưởng!")] });

    const ngay = parseInt(params.ngay) || 0;
    const expiresAt = ngay > 0 ? new Date(Date.now() + 864e5 * ngay) : null;
    const cgYeuCau = parseInt(params.cg) || 0;

    // Tên code: tự đặt qua ten:TENCODE hoặc tự tạo ngẫu nhiên
    let code;
    if (params.ten) {
      code = params.ten.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '');
      if (!code) return n.reply({ embeds: [errE("Tên code không hợp lệ! Chỉ dùng chữ cái, số, gạch dưới.")] });
      const existing = await db("SELECT code FROM giftcodes WHERE code=$1", [code]);
      if (existing.rows.length) return n.reply({ embeds: [errE(`Code **${code}** đã tồn tại rồi! Chọn tên khác.`)] });
    } else {
      const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
      code = `RIENG_${targetUser.id.slice(-5)}_${suffix}`;
    }

    await db(
      "INSERT INTO giftcodes(code, rewards, max_uses, expires_at, min_canh_gioi, target_user_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(code) DO UPDATE SET rewards=$2, max_uses=1, used_by='{}', expires_at=$4, min_canh_gioi=$5, target_user_id=$6",
      [code, JSON.stringify(rewards), 1, expiresAt, cgYeuCau, targetUser.id],
    );

    const rewardLines = describeRewards(rewards);
    const expireStr = expiresAt ? `\n⏰ Hết hạn: **${ngay} ngày** (${expiresAt.toLocaleDateString("vi-VN")})` : "";
    const cgStr = cgYeuCau > 0 ? `\n🏔️ Yêu cầu cảnh giới tầng **${cgYeuCau}** trở lên` : "";

    const embed = new EmbedBuilder()
      .setTitle("🎁 Tạo Giftcode Riêng Thành Công!")
      .setColor(3066993)
      .setDescription(
        `👤 Dành riêng cho: **${targetUser.username}** (<@${targetUser.id}>)\n` +
        `🔑 Code: ||\`${code}\`||\n` +
        rewardLines +
        `\n📊 Giới hạn: 1 lượt (chỉ họ dùng được)${expireStr}${cgStr}`
      )
      .setFooter({ text: `Tạo bởi ${n.author.username}` });

    await n.reply({ embeds: [embed] });

    // Try DM the target user with the code
    try {
      await targetUser.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🎁 Bạn Nhận Được Giftcode!")
            .setColor(15965202)
            .setDescription(
              `Ngươi nhận được giftcode riêng từ **${n.author.username}**!\n` +
              `🔑 Code: \`${code}\`\n` +
              rewardLines +
              `\n\nDùng \`-giftcode ${code}\` hoặc nút **Nhận Giftcode** để đổi.`
            ),
        ],
      });
      await n.channel.send({ content: `📬 Đã DM code cho **${targetUser.username}**!` }).catch(() => {});
    } catch {
      // DM failed (user has DMs closed), code is visible in the admin's channel
    }
  });

// ── -tao_code: Tạo giftcode công khai (nhiều người dùng) ─────────────────────
// Cú pháp: -tao_code ten:EVENTSUKIEN max:100 vp:hop_linh_thach vpqty:3 lt:1000 ngay:7
// Alias: -tc
reg("tao_code", ["tc"], async (n, t) => {
  if (!ADMIN_ID || n.author.id !== ADMIN_ID)
    return n.reply({ embeds: [errE("Không có quyền truy cập!")] });

  if (!t.length) {
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📢 Tạo Giftcode Công Khai (Nhiều Người Dùng)")
          .setColor(0xf39c12)
          .setDescription(
            "**Cú pháp:** `-tao_code ten:TÊNCODE max:số [tham số phần thưởng...]`\n\n" +
            "**Bắt buộc:**\n" +
            "`ten:TÊNCODE` — Tên code (chữ cái, số, gạch dưới)\n" +
            "`max:số` — Số lượt dùng tối đa (mặc định: 100)\n\n" +
            "**Phần thưởng:**\n" +
            "`vp:hop_linh_thach` `vpqty:số` — 📦 Hộp Linh Thạch\n" +
            "`vp:ve_gacha` `vpqty:số` — 🎰 Vé Gacha (quay thưởng -gacha)\n" +
            `\`lt:số\` — Linh Thạch ${CE('tult','💠')} | \`ltt:số\` — Linh Thạch Trung 🔮 | \`exp:số\` — Tu Vi 📈\n` +
            "`ve:số` — Vé Đổi Nghề 🎫 | `vh:số` — Vé Đổi Huyết 🩸\n" +
            "`vhv:số` — Vé Huyết VIP 💎 | `vnch:số` — Vé Nâng Cấp Huyết 🔱\n" +
            "`vlc:số` — Vé Đổi Linh Căn 🔮 | `hmt:số` — Huyết Mạch Thạch 💎\n" +
            "`bb:id` — Bảo Bối 🔮 | `bp:id` — Bí Pháp 📜\n" +
            "`dd:id` — Đan Dược 💊 | `phu:id` `pqty:số` — Phù Lục 📜\n" +
            "`ng:id` — Ngọc Giản ✨ | `vk:id` — Vũ Khí ⚔️\n" +
            "`ngay:số` — Hết hạn sau N ngày | `cg:số` — Yêu cầu cảnh giới tối thiểu\n\n" +
            "**Ví dụ Hộp Linh Thạch:**\n" +
            "`-tao_code ten:SUKIENHE max:200 vp:hop_linh_thach vpqty:3 lt:500 ngay:3`\n\n" +
            "**Ví dụ Vé Gacha:**\n" +
            "`-tao_code ten:GACHA2026 max:100 vp:ve_gacha vpqty:3 ngay:3`\n\n" +
            "**Ví dụ thêm thông thường:**\n" +
            "`-tao_code ten:KHAIMO2025 max:999 lt:10000 exp:5000 ngay:30`\n\n" +
            "📋 Xem danh sách code đang hoạt động: `-ds_code`\n" +
            "🗑️ Xóa code: `-xoa_code TENCODE`"
          ),
      ],
    });
  }

  const params = {};
  for (const arg of t) {
    const [k, v] = (arg || "").split(":");
    if (k && v !== undefined) params[k.toLowerCase()] = v;
  }

  // ── Validate tên code ──
  let code;
  if (params.ten) {
    code = params.ten.toUpperCase().trim().replace(/[^A-Z0-9_]/g, "");
    if (!code)
      return n.reply({ embeds: [errE("Tên code không hợp lệ! Chỉ dùng chữ cái, số, gạch dưới.")] });
    const existing = await db("SELECT code FROM giftcodes WHERE code=$1", [code]);
    if (existing.rows.length)
      return n.reply({ embeds: [errE(`Code **${code}** đã tồn tại! Chọn tên khác hoặc dùng \`-xoa_code ${code}\` trước.`)] });
  } else {
    return n.reply({ embeds: [errE("Phải có `ten:TÊNCODE`! Ví dụ: `-tao_code ten:SUKIENHE max:100 vp:hop_linh_thach`")] });
  }

  const maxUses = Math.max(1, parseInt(params.max) || 100);

  // ── Build rewards ──
  const rewards = {};
  if (parseInt(params.lt) > 0)  rewards.linh_thach = parseInt(params.lt);
  if (parseInt(params.ltt) > 0) rewards.linh_thach_trung = parseInt(params.ltt);
  if (parseInt(params.exp) > 0) rewards.exp = parseInt(params.exp);
  if (parseInt(params.ve) > 0)  rewards.ve_doi_nghe = parseInt(params.ve);
  if (parseInt(params.vh) > 0)  rewards.ve_doi_huyet = parseInt(params.vh);
  if (parseInt(params.vhv) > 0) rewards.ve_doi_huyet_vip = parseInt(params.vhv);
  if (parseInt(params.vnch) > 0) rewards.ve_nang_cap_huyet = parseInt(params.vnch);
  if (parseInt(params.vlc) > 0) rewards.ve_doi_linh_can = parseInt(params.vlc);
  if (parseInt(params.hmt) > 0) rewards.huyet_mach_thach = parseInt(params.hmt);

  if (params.vk) {
    if (!VU_KHI.find(x => x.id === params.vk))
      return n.reply({ embeds: [errE(`Không tìm thấy vũ khí \`${params.vk}\`!`)] });
    rewards.vu_khi = params.vk;
  }
  if (params.bb) {
    if (!BAO_BOI.find(x => x.id === params.bb))
      return n.reply({ embeds: [errE(`Không tìm thấy bảo bối \`${params.bb}\`!`)] });
    rewards.bao_boi = params.bb;
  }
  if (params.bp) {
    if (!BI_PHAP.find(x => x.id === params.bp))
      return n.reply({ embeds: [errE(`Không tìm thấy bí pháp \`${params.bp}\`!`)] });
    rewards.bi_phap = params.bp;
  }
  if (params.dd) {
    if (!DAN_DUOC.find(x => x.id === params.dd))
      return n.reply({ embeds: [errE(`Không tìm thấy đan dược \`${params.dd}\`!`)] });
    rewards.dan_duoc = params.dd;
    const ddqty = parseInt(params.ddqty) || 1;
    if (ddqty > 1) rewards.dan_duoc_qty = ddqty;
  }
  if (params.lc) {
    if (!LINH_CAN[params.lc])
      return n.reply({ embeds: [errE(`Không tìm thấy Linh Căn \`${params.lc}\`!`)] });
    rewards.linh_can = params.lc;
  }
  if (params.hm) {
    if (!HUYET_MACH[params.hm])
      return n.reply({ embeds: [errE(`Không tìm thấy Huyết Mạch \`${params.hm}\`!`)] });
    rewards.huyet_mach = params.hm;
  }
  if (params.phu) {
    if (!PHU_LUC_DATA.find(p => p.id === params.phu))
      return n.reply({ embeds: [errE(`Không tìm thấy Phù Lục \`${params.phu}\`!`)] });
    rewards.phu_luc = params.phu;
    const pqty = parseInt(params.pqty) || 1;
    if (pqty > 1) rewards.phu_luc_qty = pqty;
  }
  if (params.ng) {
    if (!NGOC_GIAN_DATA.find(x => x.id === params.ng))
      return n.reply({ embeds: [errE(`Không tìm thấy Ngọc Giản \`${params.ng}\`!\nIDs hợp lệ: ${NGOC_GIAN_DATA.map(x => x.id).join(", ")}`)] });
    rewards.ngoc_gian = params.ng;
  }
  if (params.vp) {
    if (!LINH_THU_LOOT_ITEMS[params.vp])
      return n.reply({ embeds: [errE(`Không tìm thấy vật phẩm \`${params.vp}\`!\nVật phẩm hộp: \`hop_linh_thach\``)] });
    rewards.vat_pham = params.vp;
    const vpqty = Math.max(1, parseInt(params.vpqty) || 1);
    if (vpqty > 1) rewards.vat_pham_qty = vpqty;
  }

  if (Object.keys(rewards).length === 0)
    return n.reply({ embeds: [errE("Phải có ít nhất 1 phần thưởng! Ví dụ: `vp:hop_linh_thach vpqty:3`")] });

  const ngay = parseInt(params.ngay) || 0;
  const expiresAt = ngay > 0 ? new Date(Date.now() + 864e5 * ngay) : null;
  const cgYeuCau = parseInt(params.cg) || 0;

  await db(
    "INSERT INTO giftcodes(code, rewards, max_uses, expires_at, min_canh_gioi) VALUES($1,$2,$3,$4,$5)",
    [code, JSON.stringify(rewards), maxUses, expiresAt, cgYeuCau],
  );

  const rewardLines = describeRewards(rewards);
  const expireStr = expiresAt ? `\n⏰ Hết hạn: **${ngay} ngày** (${expiresAt.toLocaleDateString("vi-VN")})` : "\n⏰ Không có hạn";
  const cgStr = cgYeuCau > 0 ? `\n🏔️ Yêu cầu cảnh giới tầng **${cgYeuCau}** trở lên` : "";

  return n.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("📢 Tạo Giftcode Công Khai Thành Công!")
        .setColor(0x2ecc71)
        .setDescription(
          `🔑 Code: \`${code}\`\n` +
          `📊 Giới hạn: **${maxUses} lượt** (mỗi người 1 lần)${expireStr}${cgStr}\n\n` +
          `**Phần thưởng:**\n${rewardLines}\n\n` +
          `✅ Người chơi dùng: \`-giftcode ${code}\``
        )
        .setFooter({ text: `Tạo bởi ${n.author.username} · -ds_code để xem danh sách` }),
    ],
  });
});

// ── -xoa_code: Xóa / vô hiệu hóa một giftcode ────────────────────────────────
reg("xoa_code", ["xc", "del_code", "delcode"], async (n, t) => {
  if (!ADMIN_ID || n.author.id !== ADMIN_ID)
    return n.reply({ embeds: [errE("Không có quyền truy cập!")] });

  const code = (t[0] || "").toUpperCase().trim();
  if (!code)
    return n.reply({ embeds: [errE("Cú pháp: `-xoa_code TÊNCODE`")] });

  const res = await db("DELETE FROM giftcodes WHERE code=$1 RETURNING code, max_uses, used_by", [code]);
  if (!res.rows.length)
    return n.reply({ embeds: [errE(`Không tìm thấy code **${code}**!`)] });

  const row = res.rows[0];
  const usedCount = (row.used_by || []).length;
  return n.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xe74c3c)
        .setDescription(`🗑️ Đã xóa code **${code}**\n*(Đã có ${usedCount}/${row.max_uses} lượt sử dụng trước khi xóa)*`),
    ],
  });
});

// ── -xoa_all_code: Xóa toàn bộ giftcode ──────────────────────────────────────
reg("xoa_all_code", ["xac", "del_all_code", "delallcode"], async (n, t) => {
  if (!ADMIN_ID || n.author.id !== ADMIN_ID)
    return n.reply({ embeds: [errE("Không có quyền truy cập!")] });

  // Đếm số code hiện tại
  const count = await db("SELECT COUNT(*) FROM giftcodes", []);
  const total = parseInt(count.rows[0].count, 10);

  if (total === 0)
    return n.reply({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription("📭 Không có giftcode nào để xóa.")] });

  const confirm = (t[0] || "").toLowerCase();

  // Yêu cầu xác nhận
  if (confirm !== "confirm") {
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe67e22)
          .setTitle(`${CE('warn_icon','⚠️')} Xác nhận xóa toàn bộ giftcode`)
          .setDescription(
            `Tìm thấy **${total} giftcode** đang tồn tại.\n\n` +
            `Để xác nhận xóa hết, gõ:\n\`\`\`-xoa_all_code confirm\`\`\`\n` +
            `⛔ Hành động này **không thể hoàn tác**!`
          ),
      ],
    });
  }

  // Xoá tất cả
  const res = await db("DELETE FROM giftcodes RETURNING code", []);
  const deleted = res.rows.length;

  return n.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("🗑️ Đã xóa toàn bộ giftcode")
        .setDescription(`✅ Xóa thành công **${deleted} giftcode**.\nDatabase giftcode đã được dọn sạch.`),
    ],
  });
});

// ── -ds_code: Danh sách giftcode công khai đang hoạt động ─────────────────────
reg("ds_code", ["dscode", "list_code", "listcode"], async (n) => {
  if (!ADMIN_ID || n.author.id !== ADMIN_ID)
    return n.reply({ embeds: [errE("Không có quyền truy cập!")] });

  const res = await db(
    `SELECT code, rewards, max_uses, used_by, expires_at, min_canh_gioi, target_user_id
     FROM giftcodes
     WHERE (expires_at IS NULL OR expires_at > NOW())
       AND COALESCE(array_length(used_by,1),0) < max_uses
     ORDER BY code ASC LIMIT 30`,
    [],
  );

  if (!res.rows.length)
    return n.reply({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription("📭 Hiện không có giftcode nào đang hoạt động.")] });

  const lines = res.rows.map(row => {
    const used = (row.used_by || []).length;
    const rem = row.max_uses - used;
    const expStr = row.expires_at ? ` · ⏰ ${new Date(row.expires_at).toLocaleDateString("vi-VN")}` : "";
    const targStr = row.target_user_id ? ` · 👤 <@${row.target_user_id}>` : "";
    const cgStr = row.min_canh_gioi > 0 ? ` · 🏔️ Tầng ${row.min_canh_gioi}+` : "";
    const rwdStr = describeRewards(row.rewards || {});
    return `\`${row.code}\` — ${used}/${row.max_uses} lượt (còn **${rem}**)${expStr}${targStr}${cgStr}\n↳ ${rwdStr}`;
  });

  const pages = [];
  let cur = "";
  for (const line of lines) {
    if ((cur + line).length > 3800) { pages.push(cur); cur = ""; }
    cur += line + "\n\n";
  }
  if (cur) pages.push(cur);

  for (let i = 0; i < pages.length; i++) {
    await n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`📋 Giftcode Đang Hoạt Động${pages.length > 1 ? ` (${i + 1}/${pages.length})` : ""}`)
          .setColor(0x3498db)
          .setDescription(pages[i].trim())
          .setFooter({ text: `${res.rows.length} code · -xoa_code TÊNCODE để xóa` }),
      ],
    });
  }
});

