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
    (n.linh_thach && t.push(`${CE("tult", "💠")} ${fmt(n.linh_thach)} LT Thường`),
    n.linh_thach_trung && t.push(`${CE("tult_trung","🔮")} ${fmt(n.linh_thach_trung)} LT Trung`),
    n.linh_thach_cao   && t.push(`${CE("tult_cao","💚")} ${fmt(n.linh_thach_cao)} LT Cao`),
    n.exp && t.push(`${CE("tutv", "📈")} ${fmt(n.exp)} Tu Vi`),
    n.ve_doi_nghe && t.push(`${CE('ve_nghe','🎫')} Vé Đổi Nghề ×${n.ve_doi_nghe}`),
    n.ve_doi_huyet && t.push(`${CE('ve_huyet_mach','🩸')} Vé Đổi Huyết Mạch ×${n.ve_doi_huyet}`),
    n.ve_doi_huyet_vip && t.push(`${CE("tukv","💎")} Vé Huyết Mạch VIP ×${n.ve_doi_huyet_vip}`),
    n.ve_nang_cap_huyet && t.push(`${CE("vk_linh_thuong","🔱")} Vé Nâng Cấp Huyết Mạch ×${n.ve_nang_cap_huyet}`),
    n.ve_linh_can && t.push(
      n.ve_linh_can_tier === 'cao_cap'
        ? `${CE("tukv","💎")} Vé Thức Tỉnh LC Cao Cấp ×${n.ve_linh_can}`
        : n.ve_linh_can_tier === 'nguyen_linh'
          ? `${CE("vk_linh_thuong","🔱")} Vé Nguyên Linh Căn ×${n.ve_linh_can}`
          : `🎟️ Vé Thức Tỉnh LC Cơ Bản ×${n.ve_linh_can}`
    ),
    n.huyet_mach_thach && t.push(`${CE('lt_huyet_mach_thach','💎')} Huyết Mạch Thạch ×${n.huyet_mach_thach}`),
    n.vu_khi)
  ) {
    const e = VU_KHI.find((t) => t.id === n.vu_khi);
    t.push(`${CE("tuatk", "⚔️")} ${e?.ten || n.vu_khi}`);
  }
  if (n.bao_boi) {
    const e = BAO_BOI.find((t) => t.id === n.bao_boi);
    t.push(`${CE("tult_trung","🔮")} ${e?.ten || n.bao_boi}`);
  }
  if (n.bi_phap) {
    const e = BI_PHAP.find((t) => t.id === n.bi_phap);
    t.push(`${CE("nt_tien","✨")} ${e?.ten || n.bi_phap}`);
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
  if (n.vat_pham) {
    const qty = Math.max(1, Number(n.vat_pham_qty) || 1);
    const info = LINH_THU_LOOT_ITEMS[n.vat_pham];
    t.push(`${info?.emoji || "📦"} **${info?.ten || n.vat_pham}** ×${qty} ${CE('lock_icon','🔒')} *(Độc Quyền)*`);
  }
  return t.join(" · ") || "*(trống)*";
}
// ─────────────────────────────────────────────────────────────────────────────
// Đồ donate KHÔNG tính kg túi — bypass hoàn toàn mọi kiểm tra tải trọng.
// (Giftcode thường vẫn dùng applyGiftcodeRewards trong social.js có check kg)
// ─────────────────────────────────────────────────────────────────────────────
async function applyGiftcodeRewards(n, t, e) {
  const h = [],
    i = Number(e.linh_thach || 0),
    a = Number(e.exp || 0);

  // ── Linh Thạch Thường: cộng thẳng, không check kg ───────────────────────
  if (i > 0) {
    await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [i, t]);
    h.push(`${CE("tult", "💠")} +**${fmt(i)}** Linh Thạch Thường`);
  }

  // ── Linh Thạch Trung ──────────────────────────────────────────────────────
  const ltTrung = Number(e.linh_thach_trung || 0);
  if (ltTrung > 0) {
    await db("UPDATE players SET linh_thach_trung=linh_thach_trung+$1 WHERE user_id=$2", [ltTrung, t]);
    h.push(`${CE("tult_trung","🔮")} +**${ltTrung}** Linh Thạch Trung`);
  }

  // ── Linh Thạch Cao ────────────────────────────────────────────────────────
  const ltCao = Number(e.linh_thach_cao || 0);
  if (ltCao > 0) {
    await db("UPDATE players SET linh_thach_cao=linh_thach_cao+$1 WHERE user_id=$2", [ltCao, t]);
    h.push(`${CE("tult_cao","💚")} +**${ltCao}** Linh Thạch Cao`);
  }

  // ── Tu Vi ──────────────────────────────────────────────────────────────────
  if (a > 0) {
    await db("UPDATE players SET exp=exp+$1 WHERE user_id=$2", [a, t]);
    h.push(`${CE("tutv", "📈")} +**${fmt(a)}** Tu Vi`);
  }

  // ── Vũ Khí ────────────────────────────────────────────────────────────────
  if (e.vu_khi) {
    const vk = VU_KHI.find((v) => v.id === e.vu_khi);
    if (vk) {
      const currentVK = n.vu_khi ? VU_KHI.find((v) => v.id === n.vu_khi) : null;
      const currentAtk = currentVK ? (currentVK.atk || 0) : 0;
      if (vk.atk > currentAtk) {
        await db("UPDATE players SET vu_khi=$1 WHERE user_id=$2", [vk.id, t]);
        h.push(`${CE("tuatk", "⚔️")} Vũ Khí: **${CE(vk.ce_name, vk.pham || '⚔️')} ${vk.ten}** *(ATK ${vk.atk})*`);
      } else {
        const comp = 5000;
        await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [comp, t]);
        h.push(`${CE("tuatk", "⚔️")} Vũ Khí **${vk.ten}** yếu hơn vũ khí hiện tại — đổi thành **${fmt(comp)} ${CE("tult","💠")}**`);
      }
    }
  }

  // ── Bảo Bối: check đã có hoặc đã có túi xịn hơn trong cùng tier ──────────
  if (e.bao_boi) {
    const BAG_TIER = ['van_bao_tui', 'tui_da_thu'];
    const bb = BAO_BOI.find((v) => v.id === e.bao_boi);
    if (bb) {
      const currentBaoBoi = n.bao_boi || [];
      const alreadyHas = currentBaoBoi.includes(bb.id);
      const bbTierIdx = BAG_TIER.indexOf(bb.id);
      // Có túi cùng tier xịn hơn hoặc bằng → không add, đổi linh thạch
      const hasBetterOrEqual = bbTierIdx >= 0 && BAG_TIER.some((id, idx) => idx >= bbTierIdx && currentBaoBoi.includes(id));
      if (alreadyHas || hasBetterOrEqual) {
        await db("UPDATE players SET linh_thach=linh_thach+2000 WHERE user_id=$1", [t]);
        h.push(`${CE("tult_trung","🔮")} Bảo Bối **${bb.ten}** *(đã có túi xịn hơn — đổi thành 2.000 ${CE("tult", "💠")})*`);
      } else {
        await db("UPDATE players SET bao_boi=array_append(bao_boi,$1) WHERE user_id=$2", [bb.id, t]);
        h.push(`${CE(bb.ce_name, '🔮')} Bảo Bối: **${bb.ten}**`);
      }
    }
  }

  // ── Bí Pháp: không check kg, chỉ check đã biết chưa ──────────────────────
  if (e.bi_phap) {
    const bp = BI_PHAP.find((v) => v.id === e.bi_phap);
    if (bp) {
      if (!(n.bi_phap || []).includes(bp.id)) {
        await db("UPDATE players SET bi_phap=array_append(bi_phap,$1) WHERE user_id=$2", [bp.id, t]);
        h.push(`${CE("nt_tien","✨")} Bí Pháp: **${bp.ten}**`);
      } else {
        await db("UPDATE players SET linh_thach=linh_thach+3000 WHERE user_id=$1", [t]);
        h.push(`${CE("nt_tien","✨")} Bí Pháp **${bp.ten}** *(đã biết — đổi thành 3.000 ${CE("tult", "💠")})*`);
      }
    }
  }

  // ── Đan Dược: cộng thẳng, không check kg ─────────────────────────────────
  if (e.dan_duoc) {
    const dd = DAN_DUOC.find((v) => v.id === e.dan_duoc);
    const qty = Math.max(1, Number(e.dan_duoc_qty) || 1);
    if (dd) {
      const bag = { ...(n.dan_duoc || {}) };
      bag[dd.id] = (bag[dd.id] || 0) + qty;
      // ── Đan dược phụ (dan_duoc_extra) — dành cho gói lần đầu có 2 loại đan ─
      if (e.dan_duoc_extra && e.dan_duoc_extra.id) {
        const ddEx = DAN_DUOC.find((v) => v.id === e.dan_duoc_extra.id);
        const qtyEx = Math.max(1, Number(e.dan_duoc_extra.qty) || 1);
        if (ddEx) {
          bag[ddEx.id] = (bag[ddEx.id] || 0) + qtyEx;
          h.push(`${CE("ng_luyen_dan","⚗️")} Đan Dược: **${ddEx.ten}** ×${qtyEx}`);
        }
      }
      await db("UPDATE players SET dan_duoc=$1 WHERE user_id=$2", [JSON.stringify(bag), t]);
      h.push(`${CE("ng_luyen_dan","⚗️")} Đan Dược: **${dd.ten}** ×${qty}`);
    }
  }

  // ── Phù Lục: cộng thẳng (đã không check kg từ trước) ─────────────────────
  if (e.phu_luc) {
    const pl = PHU_LUC_DATA.find((v) => v.id === e.phu_luc);
    const qty = Math.max(1, Number(e.phu_luc_qty) || 1);
    if (pl) {
      const bag = { ...(n.phu_luc || {}) };
      bag[pl.id] = (bag[pl.id] || 0) + qty;
      await db("UPDATE players SET phu_luc=$1 WHERE user_id=$2", [JSON.stringify(bag), t]);
      h.push(`📜 Phù Lục: **${pl.emoji} ${pl.ten}**${pl.limited ? " 💎 *(Limited)*" : ""} ×${qty}`);
    }
  }

  // ── Tải trọng túi ─────────────────────────────────────────────────────────
  if (e.bag_bonus_kg) {
    const kg = Number(e.bag_bonus_kg);
    if (kg > 0) {
      await db("UPDATE players SET bag_bonus_kg=COALESCE(bag_bonus_kg,0)+$1 WHERE user_id=$2", [kg, t]);
      h.push(`🎒 **Tải trọng +${kg}kg** (vĩnh viễn)`);
    }
  }

  // ── Vé Linh Căn (donate ticket — ngẫu nhiên khi dùng) ────────────────────
  if (e.ve_linh_can) {
    const qty  = Math.max(1, Number(e.ve_linh_can) || 1);
    const tier = e.ve_linh_can_tier || 'co_ban';
    if (tier === 'cao_cap') {
      await db(
        "UPDATE players SET ve_doi_linh_can_cao_cap=COALESCE(ve_doi_linh_can_cao_cap,0)+$1 WHERE user_id=$2",
        [qty, t],
      );
      h.push(`${CE("tukv","💎")} **Vé Thức Tỉnh LC Cao Cấp** ×${qty} *(dùng \`-linh_can doi\` → random Lôi/Hỗn Độn/Thiên/Vô Cực!)*`);
    } else if (tier === 'nguyen_linh') {
      await db(
        "UPDATE players SET ve_doi_linh_can_nguyen=COALESCE(ve_doi_linh_can_nguyen,0)+$1 WHERE user_id=$2",
        [qty, t],
      );
      h.push(`${CE("vk_linh_thuong","🔱")} **Vé Thức Tỉnh Nguyên Linh Căn** ×${qty} *(huyền thoại — liên hệ Admin để kích hoạt!)*`);
    } else {
      // co_ban — cột ve_doi_linh_can có sẵn
      await db(
        "UPDATE players SET ve_doi_linh_can=COALESCE(ve_doi_linh_can,0)+$1 WHERE user_id=$2",
        [qty, t],
      );
      h.push(`🎟️ **Vé Thức Tỉnh LC Cơ Bản** ×${qty} *(dùng \`-linh_can doi\` → random 8 linh căn!)*`);
    }
  }

  // ── Linh Căn trực tiếp (Admin grant) ──────────────────────────────────────
  if (e.linh_can) {
    const lc = LINH_CAN[e.linh_can] || LINH_CAN.moc;
    if (lc) {
      await db("UPDATE players SET linh_can=$1 WHERE user_id=$2", [e.linh_can, t]);
      h.push(`${lc.emoji} Linh Căn đổi thành: **${lc.ten}**`);
    }
  }

  // ── Huyết Mạch Thạch ──────────────────────────────────────────────────────
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
    h.push(`🔴 **Huyết Mạch Thạch** ×${qty} *(dùng \`-huyet_mach nang_cap\` để cường hóa huyết mạch!)*`);
  }

  // ── Huyết Mạch ────────────────────────────────────────────────────────────
  if (e.huyet_mach) {
    const hm = HUYET_MACH[e.huyet_mach] || HUYET_MACH.pham;
    if (hm) {
      await db("UPDATE players SET huyet_mach=$1 WHERE user_id=$2", [e.huyet_mach, t]);
      h.push(`${CE(hm.ce_name, hm.emoji)} Huyết Mạch thức tỉnh: **${hm.ten}**`);
    }
  }

  // ── Vé Đổi Nghề ───────────────────────────────────────────────────────────
  if (e.ve_doi_nghe) {
    const qty = Math.max(1, Number(e.ve_doi_nghe) || 1);
    await db("UPDATE players SET ve_doi_nghe=ve_doi_nghe+$1 WHERE user_id=$2", [qty, t]);
    h.push(`${CE('ve_nghe','🎫')} **Vé Đổi Nghề** ×${qty} *(dùng \`-nghe doi <id>\` đổi đường tu miễn phí!)*`);
  }

  // ── Vé Đổi Huyết Mạch ────────────────────────────────────────────────────
  if (e.ve_doi_huyet) {
    const qty = Math.max(1, Number(e.ve_doi_huyet) || 1);
    await db("UPDATE players SET ve_doi_huyet=ve_doi_huyet+$1 WHERE user_id=$2", [qty, t]);
    h.push(`${CE('ve_huyet_mach','🩸')} **Vé Đổi Huyết Mạch** ×${qty} *(dùng \`-huyet_mach doi\` random huyết mạch mới!)*`);
  }

  // ── Vé Huyết Mạch VIP ─────────────────────────────────────────────────────
  if (e.ve_doi_huyet_vip) {
    const qty = Math.max(1, Number(e.ve_doi_huyet_vip) || 1);
    await db("UPDATE players SET ve_doi_huyet_vip=ve_doi_huyet_vip+$1 WHERE user_id=$2", [qty, t]);
    h.push(`${CE("tukv","💎")} **Vé Huyết Mạch VIP** ×${qty} *(dùng \`-huyet_mach doi_vip\` thăng cấp huyết mạch +1 bậc!)*`);
  }

  // ── Vé Nâng Cấp Huyết Mạch ───────────────────────────────────────────────
  if (e.ve_nang_cap_huyet) {
    const qty = Math.max(1, Number(e.ve_nang_cap_huyet) || 1);
    await db("UPDATE players SET ve_nang_cap_huyet=ve_nang_cap_huyet+$1 WHERE user_id=$2", [qty, t]);
    h.push(`${CE("vk_linh_thuong","🔱")} **Vé Nâng Cấp Huyết Mạch** ×${qty} *(dùng \`-huyet_mach nang_cap\` để nâng lên Tu La hoặc Cổ Thần!)*`);
  }

  // ── Thiên Phú Nghề ────────────────────────────────────────────────────────
  if (e.thien_phu_nghe) {
    const nghId = e.thien_phu_nghe;
    const ngh = NGHE[nghId];
    if (ngh) {
      if (n.thien_phu_nghe) {
        h.push(`${CE('warn_icon','⚠️')} Ngươi đã có Thiên Phú Nghề rồi! (${NGHE[n.thien_phu_nghe]?.ten || n.thien_phu_nghe}) — không thể ghi đè.`);
      } else {
        await db("UPDATE players SET thien_phu_nghe=$1 WHERE user_id=$2", [nghId, t]);
        h.push(`${CE("nt_tien","✨")} **Thiên Phú Nghề — ${ngh.thien_phu_ten || ngh.ten}** khai phóng!\n*${ngh.thien_phu_mo_ta || ""}*`);
      }
    } else {
      h.push(`${CE('warn_icon','⚠️')} Thiên phú không hợp lệ: ${nghId}`);
    }
  }

  // ── Ngọc Giản: không check kg, chỉ check đã học / đã có chưa ─────────────
  if (e.ngoc_gian) {
    const ngId = e.ngoc_gian;
    const ng = NGOC_GIAN_DATA.find((v) => v.id === ngId);
    if (ng) {
      if ((Array.isArray(n.than_thong) ? n.than_thong : []).includes(ngId)) {
        await db("UPDATE players SET linh_thach=linh_thach+5000 WHERE user_id=$1", [t]);
        h.push(`${ng.emoji} **${ng.ten}** *(đã học rồi — đổi thành 5.000 ${CE("tult", "💠")})*`);
      } else {
        const tui = (typeof n.ngoc_gian_tui === 'object' && n.ngoc_gian_tui) ? { ...n.ngoc_gian_tui } : {};
        if (tui[ngId]) {
          await db("UPDATE players SET linh_thach=linh_thach+5000 WHERE user_id=$1", [t]);
          h.push(`${ng.emoji} **${ng.ten}** *(đã có trong túi — đổi thành 5.000 ${CE("tult", "💠")})*`);
        } else {
          tui[ngId] = 1;
          await db("UPDATE players SET ngoc_gian_tui=$1 WHERE user_id=$2", [JSON.stringify(tui), t]);
          h.push(`${ng.emoji} **Ngọc Giản ${ng.ten}** → vào **Túi Trữ Vật**!\nDùng \`-than_thong hoc ${ngId}\` để học ngay.`);
        }
      }
    } else {
      h.push(`${CE('warn_icon','⚠️')} Ngọc Giản không hợp lệ: ${ngId}`);
    }
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

reg("donate", ["nap", "ung_ho", "shop_vip"], async (n) => {
    const t = "linh_thach",
      h = buildDonateCatSelect(t),
      i = buildDonateEmbed(t),
      a = buildDonateButtons(t, 0);
    return n.reply({ embeds: [i], components: [h, ...a] });
  });

reg("thu_hoi_tui", ["thuhoi_tui", "revoke_tui"], async (n, t) => {
  if (!ADMIN_ID || n.author.id !== ADMIN_ID)
    return n.reply({ embeds: [errE("Không có quyền truy cập!")] });

  // ── Thu hồi TẤT CẢ ────────────────────────────────────────────────────
  const arg0 = (t[0] || '').toLowerCase();
  if (arg0 === 'all' || arg0 === 'tat_ca' || arg0 === 'tatca') {
    const countRes = await db(
      "SELECT COUNT(*) AS cnt FROM players WHERE bao_boi @> ARRAY[$1]::text[]",
      ['tui_da_thu'],
    );
    const soNguoi = parseInt(countRes.rows?.[0]?.cnt || '0', 10);

    if (soNguoi === 0)
      return n.reply({ embeds: [warnE("Không có người chơi nào đang có Túi Da Thú.")] });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`thuhoi_all_confirm_${n.author.id}`)
        .setLabel(`✅ Xác nhận thu hồi ${soNguoi} người`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`thuhoi_all_cancel_${n.author.id}`)
        .setLabel("❌ Hủy")
        .setStyle(ButtonStyle.Secondary),
    );

    const msg = await n.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xE67E22)
          .setTitle(`${CE('warn_icon','⚠️')} Xác Nhận Thu Hồi Hàng Loạt`)
          .setDescription(
            `Sắp thu hồi **Túi Da Thú** khỏi **${soNguoi} người chơi** đang sở hữu.\n\n` +
            `${CE('warn_icon','⚠️')} Hành động này **không thể hoàn tác!**`,
          )
          .setFooter({ text: `Admin: ${n.author.username}` }),
      ],
      components: [row],
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ time: 30000 });
    collector.on('collect', async inter => {
      if (inter.user.id !== n.author.id) return inter.reply({ content: 'Không phải lệnh của bạn!', ephemeral: true });
      collector.stop();
      if (inter.customId === `thuhoi_all_cancel_${n.author.id}`) {
        return inter.update({ embeds: [warnE('Đã hủy thu hồi.')], components: [] });
      }
      // Thực hiện thu hồi tất cả
      const result = await db(
        "UPDATE players SET bao_boi=array_remove(bao_boi,$1) WHERE bao_boi @> ARRAY[$1]::text[] RETURNING user_id",
        ['tui_da_thu'],
      );
      const affected = result.rows?.length || 0;
      return inter.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle("✅ Thu Hồi Hàng Loạt Thành Công")
            .setDescription(
              `Đã xóa **🌿 Túi Da Thú** khỏi bao bối của **${affected} người chơi**.`,
            )
            .setFooter({ text: `Admin: ${n.author.username}` }),
        ],
        components: [],
      });
    });
    collector.on('end', (_, reason) => {
      if (reason === 'time') msg.edit({ components: [] }).catch(() => {});
    });
    return;
  }

  // ── Thu hồi từng người ────────────────────────────────────────────────
  const mention = n.mentions.users.first();
  let target = mention;

  if (!target) {
    if (t[0] && /^\d{15,20}$/.test(t[0])) {
      try { target = await n.client.users.fetch(t[0]); }
      catch { return n.reply({ embeds: [errE("Không tìm thấy người dùng với ID này!")] }); }
    } else {
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xE67E22)
            .setTitle("📦 Thu Hồi Túi Da Thú — Admin")
            .setDescription(
              "**Cú pháp:**\n" +
              "▸ `-thu_hoi_tui @người_chơi` hoặc `-thu_hoi_tui <userID>` — Thu hồi 1 người\n" +
              "▸ `-thu_hoi_tui all` — Thu hồi **tất cả** người chơi đang có túi\n\n" +
              "Xóa **Túi Da Thú** khỏi bao bối (dùng thu hồi khi lấy qua bug).\n\n" +
              `${CE('warn_icon','⚠️')} Hành động này **không hoàn tác** được.`,
            ),
        ],
      });
    }
  }

  const player = await getPlayer(target.id);
  if (!player) return n.reply({ embeds: [errE(`${target.username} chưa bắt đầu tu tiên!`)] });

  const bb = player.bao_boi || [];
  if (!bb.includes('tui_da_thu'))
    return n.reply({ embeds: [warnE(`${target.username} không có Túi Da Thú trong bao bối.`)] });

  await db("UPDATE players SET bao_boi=array_remove(bao_boi,$1) WHERE user_id=$2", ['tui_da_thu', target.id]);

  return n.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("✅ Thu Hồi Thành Công")
        .setDescription(`Đã xóa **🌿 Túi Da Thú** khỏi bao bối của <@${target.id}>.`)
        .setFooter({ text: `Admin: ${n.author.username} · ID: ${target.id}` }),
    ],
  });
});

reg("cap_nang_all", ["capnang_all", "grant_nang_all"], async (n) => {
  if (!ADMIN_ID || n.author.id !== ADMIN_ID)
    return n.reply({ embeds: [errE("Không có quyền truy cập!")] });

  // Đếm số người chưa có van_bao_tui
  const countRes = await db(
    "SELECT COUNT(*) AS cnt FROM players WHERE NOT (bao_boi @> ARRAY[$1]::text[])",
    ['van_bao_tui'],
  );
  const soNguoi = parseInt(countRes.rows?.[0]?.cnt || '0', 10);

  if (soNguoi === 0)
    return n.reply({ embeds: [warnE("Tất cả người chơi đều đã có **Càn Khôn Hư Không Nang** rồi!")] });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`capnang_confirm_${n.author.id}`)
      .setLabel(`✅ Xác nhận cấp cho ${soNguoi} người`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`capnang_cancel_${n.author.id}`)
      .setLabel("❌ Hủy")
      .setStyle(ButtonStyle.Secondary),
  );

  const msg = await n.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle("🎒 Xác Nhận Cấp Càn Khôn Hư Không Nang")
        .setDescription(
          `Sắp cấp **🔮 Càn Khôn Hư Không Nang** cho **${soNguoi} người chơi** chưa có túi này.\n\n` +
          `*(Người đã có sẵn sẽ không bị cấp lại)*`,
        )
        .setFooter({ text: `Admin: ${n.author.username}` }),
    ],
    components: [row],
    fetchReply: true,
  });

  const collector = msg.createMessageComponentCollector({ time: 30000 });
  collector.on('collect', async inter => {
    if (inter.user.id !== n.author.id) return inter.reply({ content: 'Không phải lệnh của bạn!', ephemeral: true });
    collector.stop();

    if (inter.customId === `capnang_cancel_${n.author.id}`) {
      return inter.update({ embeds: [warnE('Đã hủy cấp túi.')], components: [] });
    }

    // Cấp van_bao_tui cho tất cả người chưa có
    const result = await db(
      "UPDATE players SET bao_boi=array_append(bao_boi,$1) WHERE NOT (bao_boi @> ARRAY[$1]::text[]) RETURNING user_id",
      ['van_bao_tui'],
    );
    const affected = result.rows?.length || 0;

    return inter.update({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle("✅ Cấp Túi Thành Công")
          .setDescription(
            `Đã cấp **🔮 Càn Khôn Hư Không Nang** cho **${affected} người chơi**.`,
          )
          .setFooter({ text: `Admin: ${n.author.username}` }),
      ],
      components: [],
    });
  });
  collector.on('end', (_, reason) => {
    if (reason === 'time') msg.edit({ components: [] }).catch(() => {});
  });
});

module.exports = { applyGiftcodeRewards };

