'use strict';
const { LINH_THU_CRAFT, LINH_THU_LOOT_ITEMS } = require('../data/linh_thu_data');
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer, awardBiPhap, awardLinhThao } = require('../db/players');
const { CE, CEu, getCEUrl, getCardAttachment } = require('../systems/emoji');

/** Truncate a string to maxLen chars, appending '…' if cut. */
const trunc = (s, maxLen = 100) => {
  if (typeof s !== 'string') s = String(s ?? '');
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
};

function safeEmoji(ceStr, fallback = '❓') {
  try {
    if (typeof ceStr !== 'string' || !ceStr) return fallback;
    const m = ceStr.match(/^<a?:(\w+):(\d+)>$/);
    if (m) return { name: m[1], id: m[2] };
    if ([...ceStr].length <= 2) return ceStr;
    return fallback;
  } catch (_) {
    return fallback;
  }
}
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
  CG_EMOJI, GET_RANK_KEY, getNgoTinh, getKhiVanBonus, getNhanQua, getTT,
} = require('../data');
const {
  getDailyMissionState,
  BAG_WEIGHTS, getDanKg, getBagCapacity, calcBagWeight, canAddToBag, calcMaxLinhThach,
  DONATE_DATA, findDonateGoi, buildDonateEmbed, buildDonateButtons, buildDonateCatSelect,
  fmt, fmtLT, fmtLTShort, calcSpend, calcMultiSpend, MIXED_SPEND_THRESHOLD, getCG, pBar, fTime, cdRem, cdRemMin, embedClr,
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

// 2 túi ngoại lệ: được phép tiêu cả Linh Thạch Trung/Cao dù giá < 100k
const BAG_MIXED_SPEND_IDS = ['huyen_khong_linh_nang', 'thien_dia_dai_nang'];

// Quy đổi Linh Thạch (tab 💠 Linh Thạch trong -tb)
const LT_RATE_TRUNG = 5000; // 5.000 Thường = 1 Trung
const LT_RATE_CAO   = 10;   // 10 Trung     = 1 Cao


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


  reg("trangbi", ["tb", "trang_bi"], async (n) => {
    const userId = n.author.id;
    let player = await getPlayer(userId);
    if (!player) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });

    let tab = 'trang_bi';
    let footer = '';
    let pendingWeaponId = null;

    const buildEmbed = (p, currentTab) => {
      const embed = new EmbedBuilder().setColor(15965202);
      if (currentTab === 'trang_bi') {
        const cs = tinhCS(p);
        const vk = VU_KHI.find(w => w.id === (p.vu_khi || 'kiem_go')) || VU_KHI[0];
        const cp = CONG_PHAP.find(c => c.id === p.cong_phap);
        const bbs = (p.bao_boi || []).map(id => BAO_BOI.find(b => b.id === id)).filter(Boolean);
        const bps = (p.bi_phap || []).map(id => BI_PHAP.find(b => b.id === id)).filter(Boolean);
        const cap = Number(p.vu_khi_cap || 0);
        embed
          .setTitle(`${CE('tuatk','⚔️')} Trang Bị — ${n.author.username}`)
          .setDescription(
            `${SEP2}\n${CE('tuatk','⚔️')} Công: **${fmt(cs.atk)}** · ${CE('tudef','🛡️')} Thủ: **${fmt(cs.def)}** · ${CE('tuhp','❤️')} HP: **${fmt(cs.hp_max)}**\n${SEP}\n` +
            `${CE(vk.ce_name,'⚔️')} **Phi Khí:** ${vk.ten}${cap > 0 ? ` **(+${cap})**` : ''} — +${fmt(vk.atk)} ATK${vk.hieu_ung ? `\n  ✦ *${vk.hieu_ung}*` : ''}\n\n` +
            `${CE('ft_cong_phap','📖')} **Công Pháp:** ${cp ? `${cp.ten}  +${Math.round(100*cp.exp_bonus)}%Tu · +${Math.round(100*cp.atk_bonus)}%Công · +${Math.round(100*cp.def_bonus)}%Thủ` : '*Chưa có — dùng `-bp` tab Công Pháp*'}\n\n` +
            `${CE('ft_linh_bao','🔮')} **Linh Bảo (${bbs.length}/8):**\n${bbs.length ? bbs.map(b => `  ${CE(b.ce_name,'')} **${b.ten}**${b.hieu_ung ? ` — *${b.hieu_ung}*` : ''}`).join('\n') : `  *Chưa có — chọn tab ${CE('ft_linh_bao','🔮')} Linh Bảo*`}\n\n` +
            `${CE('ft_bi_phap','✨')} **Bí Pháp (${bps.length}/8):**\n${bps.length ? bps.map(b => `${CE('bp_' + b.id, '📜')} ${b.ten}`).join(' · ') : '  *Chưa có — dùng `-bp`*'}`
          )
          .setFooter({ text: `Tầng ${p.canh_gioi} · ${CEu("tult","💠")} ${fmt(p.linh_thach||0)}${Number(p.linh_thach_trung||0)>0?` · ${CEu("tult_trung","🔮")} ${fmt(p.linh_thach_trung)} Trung`:''}${Number(p.linh_thach_cao||0)>0?` · ${CEu("tult_cao","💚")} ${fmt(p.linh_thach_cao)} Cao`:''}${footer ? ' · ' + footer : ''}`, iconURL: getCEUrl(GET_RANK_KEY(p.canh_gioi)) || undefined });
      } else if (currentTab === 'phi_khi') {
        const myVK = p.vu_khi || 'kiem_go';
        const cap = Number(p.vu_khi_cap || 0);
        const lines = VU_KHI.filter(w => !w.donate_only).map(w => {
          const owned = w.id === myVK;
          const locked = p.canh_gioi < w.cap;
          const badge = owned ? ` 🟡${cap > 0 ? `(+${cap})` : ''}` : locked ? ` ${CE('lock_icon','🔒')}T${w.cap}` : '';
          return `${CE(w.ce_name, w.pham.split(' ')[0])} **${w.ten}**${badge} — T${w.cap} · ${w.gia === 0 ? 'Miễn phí' : fmtLT(w.gia)} · ATK+${fmt(w.atk)}${w.hieu_ung ? ` · *${w.hieu_ung}*` : ''}`;
        });
        embed
          .setTitle('⚔️ Phi Khí Các — Pháp Khí Phi Kiếm')
          .setDescription(lines.join('\n') + `\n${SEP}\n🟡 Đang dùng · ${CE('lock_icon','🔒')} Chưa đủ cảnh giới\n${CE('tip_icon','💡')} Tôi luyện +1→+10 qua \`-ren_luyen\``)
          .setFooter({ text: `${CEu("tult","💠")} ${fmt(p.linh_thach||0)}${Number(p.linh_thach_trung||0)>0?` · ${CEu("tult_trung","🔮")} ${fmt(p.linh_thach_trung)} Trung`:''}${Number(p.linh_thach_cao||0)>0?` · ${CEu("tult_cao","💚")} ${fmt(p.linh_thach_cao)} Cao`:''}${footer ? ' · ' + footer : cap > 0 ? ` · ${CE('warn_icon','⚠️')} Phi khí +${cap} — đổi sẽ mất tôi luyện` : ''}` });
      } else if (currentTab === 'linh_bao') {
        const myBB = p.bao_boi || [];
        const buyable = BAO_BOI.filter(b => !b.donate_only && !b.craft_only);
        const lines = buyable.map(b => {
          const owned = myBB.includes(b.id);
          const locked = p.canh_gioi < b.cap;
          const stats = [b.atk ? `ATK+${fmt(b.atk)}` : '', b.def ? `DEF+${fmt(b.def)}` : ''].filter(Boolean).join(' ');
          return `${CE(b.ce_name, b.pham.split(' ')[0])} **${b.ten}**${owned ? ' ✅' : locked ? ` ${CE('lock_icon','🔒')}T${b.cap}` : ''} — T${b.cap} · ${fmtLT(b.gia, BAG_MIXED_SPEND_IDS.includes(b.id))}${stats ? ' · ' + stats : ''}${b.hieu_ung ? ` · *${b.hieu_ung}*` : ''}`;
        });
        embed
          .setTitle('🔮 Linh Bảo — 🛒 Mua Bằng Linh Thạch')
          .setDescription(lines.join('\n') + `\n${SEP}\n✅ Đã có · ${CE('lock_icon','🔒')} Chưa đủ cảnh giới · Tối đa 8 Linh Bảo\n${CE('warn_icon','⚠️')} Tháo Linh Bảo = **xóa vĩnh viễn**\n${CE('tip_icon','💡')} Tab **🔨 Chế Tạo** để xem Bảo Bối từ loot Săn Linh Thú`)
          .setFooter({ text: `${CEu("tult","💠")} ${fmt(p.linh_thach||0)}${Number(p.linh_thach_trung||0)>0?` · ${CEu("tult_trung","🔮")} ${fmt(p.linh_thach_trung)} Trung`:''}${Number(p.linh_thach_cao||0)>0?` · ${CEu("tult_cao","💚")} ${fmt(p.linh_thach_cao)} Cao`:''}${footer ? ' · ' + footer : ''}` });
      } else if (currentTab === 'linh_thach') {
        const lt  = Number(p.linh_thach || 0);
        const ltt = Number(p.linh_thach_trung || 0);
        const ltc = Number(p.linh_thach_cao || 0);
        const veLc = Number(p.ve_doi_linh_can || 0);
        const veHm = Number(p.ve_doi_huyet || 0);
        const capacity = getBagCapacity(p.canh_gioi || 0, p.bao_boi || [], p.bag_bonus_kg || 0, p.tui_nang_cap || 0);
        const weight   = calcBagWeight(p);
        embed
          .setTitle(`${CE('tult','💠')} Linh Thạch — Quy Đổi`)
          .setDescription(
            `${CE('tult','💠')} **Linh Thạch Thường:** ${fmt(lt)}\n` +
            `${CE('tult_trung','🔮')} **Linh Thạch Trung:**  ${fmt(ltt)}\n` +
            `${CE('tult_cao','💚')} **Linh Thạch Cao:**    ${fmt(ltc)}\n${SEP}\n` +
            `**Tỷ lệ quy đổi:**\n` +
            `> **${LT_RATE_TRUNG.toLocaleString()}** Thường = 1 Trung\n` +
            `> **${LT_RATE_CAO}** Trung = 1 Cao *(= ${(LT_RATE_TRUNG*LT_RATE_CAO).toLocaleString()} Thường)*\n${SEP}\n` +
            `${CE('tip_icon','💡')} Bấm nút bên dưới để **quy đổi tối đa** có thể:\n` +
            `> ${CE('tult','💠')}→${CE('tult_trung','🔮')} **Đổi Trung** · ${CE('tult_trung','🔮')}→${CE('tult_cao','💚')} **Đổi Cao** *(luôn an toàn — không tốn thêm cân nặng túi)*\n` +
            `> ${CE('tult_trung','🔮')}→${CE('tult','💠')} **Hạ Trung** · ${CE('tult_cao','💚')}→${CE('tult_trung','🔮')} **Hạ Cao** *(bị giới hạn theo túi trống vì làm tăng cân nặng)*\n${SEP}\n` +
            `**Đổi Vé dư lấy Linh Thạch Thường** *(tối đa theo túi)*:\n` +
            `> ${CE('ve_linh_can','🔮')} **Vé Đổi Linh Căn:** ${veLc} vé — **300 Thường/vé**\n` +
            `> ${CE('ve_huyet_mach','🩸')} **Vé Đổi Huyết Mạch:** ${veHm} vé — **250 Thường/vé**`
          )
          .setFooter({ text: footer || `Tầng ${p.canh_gioi} · Túi: ${fmt(weight)}/${fmt(capacity)}kg`, iconURL: getCEUrl(GET_RANK_KEY(p.canh_gioi)) || undefined });
      } else {
        // linh_bao_craft
        const myBB = p.bao_boi || [];
        const vp = (typeof p.vat_pham === 'object' && p.vat_pham) ? p.vat_pham : {};
        const lines = LINH_THU_CRAFT.map(r => {
          const bb = BAO_BOI.find(b => b.id === r.bao_boi_id);
          if (!bb) return null;
          const owned   = myBB.includes(r.bao_boi_id);
          const locked  = p.canh_gioi < r.yeu_cau_cap;
          const hasLt   = !!(r.phi >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(p, r.phi) : calcSpend(p, r.phi));
          const mats = Object.entries(r.vat_lieu).map(([id, qty]) => {
            const item = LINH_THU_LOOT_ITEMS[id];
            const have = Number(vp[id] || 0);
            return `${have >= qty ? '✅' : '❌'}${item?.emoji || '🧪'}${item?.ten || id} ×${qty}(${have})`;
          }).join(' · ');
          const stats = [bb.atk ? `ATK+${fmt(bb.atk)}` : '', bb.def ? `DEF+${fmt(bb.def)}` : ''].filter(Boolean).join(' ');
          const canCraft = !owned && !locked && hasLt && Object.entries(r.vat_lieu).every(([id, qty]) => Number(vp[id] || 0) >= qty);
          const badge = owned ? ' ✅ Đã có' : canCraft ? ' 🔨 Đủ điều kiện!' : locked ? ` ${CE('lock_icon','🔒')}T${r.yeu_cau_cap}` : '';
          return `${CE(bb.ce_name, bb.pham.split(' ')[0])} **${bb.ten}**${badge}\n> T${r.yeu_cau_cap} · ${fmtLT(r.phi)} · ${mats}\n> ${stats ? stats + ' · ' : ''}*${bb.hieu_ung || ''}*`;
        }).filter(Boolean);
        embed
          .setTitle('🔮 Linh Bảo — 🔨 Chế Tạo từ Loot Săn Linh Thú')
          .setDescription(lines.join('\n\n') + `\n${SEP}\n✅/❌ = đủ/thiếu nguyên liệu (có/cần) · ${CE('lock_icon','🔒')} Chưa đủ cảnh giới\n${CE('tip_icon','💡')} Chọn menu bên dưới để chế tạo · Loot từ \`-san\``)
          .setFooter({ text: footer || `Tầng ${p.canh_gioi} · ${CEu("tult","💠")} ${fmt(p.linh_thach || 0)}${Number(p.linh_thach_trung||0)>0?` · ${CEu("tult_trung","🔮")} ${fmt(p.linh_thach_trung)} Trung`:''}${Number(p.linh_thach_cao||0)>0?` · ${CEu("tult_cao","💚")} ${fmt(p.linh_thach_cao)} Cao`:''}`, iconURL: getCEUrl(GET_RANK_KEY(p.canh_gioi)) || undefined });
      }
      return embed;
    };

    const buildRows = (p, currentTab, wpnConfirmId = null) => {
      const rows = [];
      const inLinhBao = currentTab === 'linh_bao' || currentTab === 'linh_bao_craft';
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tb_view_trang_bi').setLabel('Trang Bị').setEmoji(safeEmoji(CE('ft_trang_bi','⚔️'))).setStyle(currentTab === 'trang_bi' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tb_view_phi_khi').setLabel('Phi Khí').setEmoji(safeEmoji(CE('tuatk','⚔️'))).setStyle(currentTab === 'phi_khi' ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tb_view_linh_bao').setLabel('Linh Bảo').setEmoji(safeEmoji(CE('ft_linh_bao','🔮'))).setStyle(inLinhBao ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tb_view_linh_thach').setLabel('Linh Thạch').setEmoji(safeEmoji(CE('tult','💠'))).setStyle(currentTab === 'linh_thach' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tb_reload').setLabel('↺').setStyle(ButtonStyle.Secondary),
      ));
      if (currentTab === 'linh_thach') {
        rows.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('tb_lt_trung').setLabel('Đổi Trung').setEmoji(safeEmoji(CE('tult_trung','🔮'))).setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tb_lt_cao').setLabel('Đổi Cao').setEmoji(safeEmoji(CE('tult_cao','💚'))).setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tb_lt_ha_trung').setLabel('Hạ Trung').setEmoji(safeEmoji(CE('tult','💠'))).setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tb_lt_ha_cao').setLabel('Hạ Cao').setEmoji(safeEmoji(CE('tult_trung','🔮'))).setStyle(ButtonStyle.Secondary),
        ));
        rows.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('tb_doi_ve_lc').setLabel('Đổi Vé Linh Căn').setEmoji(safeEmoji(CE('ve_linh_can','🔮'))).setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tb_doi_ve_hm').setLabel('Đổi Vé Huyết Mạch').setEmoji(safeEmoji(CE('ve_huyet_mach','🩸'))).setStyle(ButtonStyle.Secondary),
        ));
      }
      if (currentTab === 'phi_khi') {
        const myVK = p.vu_khi || 'kiem_go';
        const available = VU_KHI.filter(w => !w.donate_only && w.id !== myVK);
        if (available.length > 0)
          rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('tb_buy_vu_khi')
              .setPlaceholder('⚔️ Chọn Phi Khí để mua...')
              .addOptions(available.slice(0, 25).map(w => {
                const ceStr = CE(w.ce_name, '⚔️');
                return {
                  label: trunc(`${w.ten} (T${w.cap})`),
                  value: trunc(w.id),
                  description: trunc(`${w.gia === 0 ? 'Miễn phí' : fmtLTShort(w.gia)} · ATK+${fmt(w.atk)}`),
                  emoji: safeEmoji(ceStr),
                };
              }))
          ));
        if (wpnConfirmId)
          rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tb_confirm_vk_${wpnConfirmId}`).setLabel('✅ Xác Nhận Đổi (mất tôi luyện)').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('tb_cancel_vk').setLabel('❌ Huỷ').setStyle(ButtonStyle.Secondary),
          ));
      } else if (inLinhBao) {
        // Sub-tab buttons: Mua / Chế Tạo
        rows.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('tb_subtab_buy').setLabel('🛒 Mua').setStyle(currentTab === 'linh_bao' ? ButtonStyle.Success : ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tb_view_linh_bao_craft').setLabel('🔨 Chế Tạo').setStyle(currentTab === 'linh_bao_craft' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        ));
        if (currentTab === 'linh_bao') {
          const myBB = p.bao_boi || [];
          // Chỉ hiện Linh Bảo mua được (không bao gồm craft_only và donate_only)
          const available = BAO_BOI.filter(b => !b.donate_only && !b.craft_only && !myBB.includes(b.id));
          if (available.length > 0)
            rows.push(new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('tb_buy_bao_boi')
                .setPlaceholder('🔮 Chọn Linh Bảo để mua...')
                .addOptions(available.slice(0, 25).map(b => {
                  const ceStr = CE(b.ce_name, '🔮');
                  return {
                    label: trunc(`${b.ten} (T${b.cap})`),
                    value: trunc(b.id),
                    description: trunc(`${fmtLTShort(b.gia, BAG_MIXED_SPEND_IDS.includes(b.id))}${b.def ? ` DEF+${fmt(b.def)}` : ''}${b.atk ? ` ATK+${fmt(b.atk)}` : ''}`),
                    emoji: safeEmoji(ceStr),
                  };
                }))
            ));
          if (myBB.length > 0)
            rows.push(new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('tb_thao_bao_boi')
                .setPlaceholder('🗑️ Tháo Linh Bảo (xóa vĩnh viễn)...')
                .addOptions(myBB.slice(0, 25).map(id => {
                  const b = BAO_BOI.find(x => x.id === id);
                  const ceStr = b ? CE(b.ce_name, '🗑️') : '🗑️';
                  return {
                    label: trunc(b ? b.ten : id),
                    value: trunc(id),
                    description: trunc(b?.hieu_ung || `Tháo ${id}`),
                    emoji: safeEmoji(ceStr),
                  };
                }))
            ));
        }
        if (currentTab === 'linh_bao_craft') {
          const myBB2 = p.bao_boi || [];
          const vp2 = (typeof p.vat_pham === 'object' && p.vat_pham) ? p.vat_pham : {};
          const notOwned = LINH_THU_CRAFT.filter(r => !myBB2.includes(r.bao_boi_id));
          if (notOwned.length > 0)
            rows.push(new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('tb_craft_bao_boi')
                .setPlaceholder('🔨 Chọn Bảo Bối để chế tạo...')
                .addOptions(notOwned.slice(0, 25).map(r => {
                  const bb = BAO_BOI.find(b => b.id === r.bao_boi_id);
                  const locked   = p.canh_gioi < r.yeu_cau_cap;
                  const hasLt    = !!(r.phi >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(p, r.phi) : calcSpend(p, r.phi));
                  const hasMats  = Object.entries(r.vat_lieu).every(([id, qty]) => Number(vp2[id] || 0) >= qty);
                  const canCraft = !locked && hasLt && hasMats;
                  const ceStr = bb ? CE(bb.ce_name, '🔮') : '🔮';
                  return {
                    label: trunc(`${bb?.ten || r.bao_boi_id} (T${r.yeu_cau_cap})`),
                    value: trunc(r.bao_boi_id),
                    description: trunc(`${canCraft ? '✅ Đủ điều kiện' : locked ? `${CEu('lock_icon','🔒')} Thiếu cảnh giới` : '❌ Thiếu nguyên liệu'} · ${fmtLTShort(r.phi)}`),
                    emoji: safeEmoji(ceStr),
                  };
                }))
            ));
        }
      }
      return rows;
    };

    const msg = await n.reply({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) });
    const coll = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 120_000 });

    coll.on('collect', async (i) => {
     try {
      const cid = i.customId;
      if (['tb_view_trang_bi','tb_view_phi_khi','tb_view_linh_bao','tb_view_linh_bao_craft','tb_view_linh_thach','tb_subtab_buy','tb_reload'].includes(cid)) {
        await i.deferUpdate();
        player = await getPlayer(userId);
        if (cid === 'tb_view_phi_khi') tab = 'phi_khi';
        else if (cid === 'tb_view_linh_bao' || cid === 'tb_subtab_buy') tab = 'linh_bao';
        else if (cid === 'tb_view_linh_bao_craft') tab = 'linh_bao_craft';
        else if (cid === 'tb_view_linh_thach') tab = 'linh_thach';
        else if (cid === 'tb_reload') { /* giữ nguyên tab hiện tại */ }
        else tab = 'trang_bi';
        footer = ''; pendingWeaponId = null;
        return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) });
      }
      if (cid === 'tb_lt_trung') {
        await i.deferUpdate();
        player = await getPlayer(userId);
        const lt = Number(player.linh_thach || 0);
        const qty = Math.floor(lt / LT_RATE_TRUNG);
        if (qty <= 0) {
          footer = `❌ Cần ít nhất ${fmt(LT_RATE_TRUNG)} ${CEu('tult','💠')} Thường để đổi 1 Trung! Hiện có: ${fmt(lt)}`;
        } else {
          const cost = qty * LT_RATE_TRUNG;
          const r = await db('UPDATE players SET linh_thach=linh_thach-$1, linh_thach_trung=linh_thach_trung+$2 WHERE user_id=$3 AND linh_thach>=$1 RETURNING linh_thach', [cost, qty, userId]);
          if (!r.rows.length) footer = `❌ Linh Thạch đã thay đổi — thử lại!`;
          else { player = await getPlayer(userId); footer = `✅ Đã đổi ${fmt(cost)} ${CEu('tult','💠')} Thường → ${fmt(qty)} ${CEu('tult_trung','🔮')} Trung`; }
        }
        return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) });
      }
      if (cid === 'tb_lt_cao') {
        await i.deferUpdate();
        player = await getPlayer(userId);
        const ltt = Number(player.linh_thach_trung || 0);
        const qty = Math.floor(ltt / LT_RATE_CAO);
        if (qty <= 0) {
          footer = `❌ Cần ít nhất ${LT_RATE_CAO} ${CEu('tult_trung','🔮')} Trung để đổi 1 Cao! Hiện có: ${fmt(ltt)}`;
        } else {
          const cost = qty * LT_RATE_CAO;
          const r = await db('UPDATE players SET linh_thach_trung=linh_thach_trung-$1, linh_thach_cao=linh_thach_cao+$2 WHERE user_id=$3 AND linh_thach_trung>=$1 RETURNING linh_thach_trung', [cost, qty, userId]);
          if (!r.rows.length) footer = `❌ Linh Thạch Trung đã thay đổi — thử lại!`;
          else { player = await getPlayer(userId); footer = `✅ Đã đổi ${fmt(cost)} ${CEu('tult_trung','🔮')} Trung → ${fmt(qty)} ${CEu('tult_cao','💚')} Cao`; }
        }
        return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) });
      }
      if (cid === 'tb_lt_ha_trung') {
        await i.deferUpdate();
        player = await getPlayer(userId);
        const ltt = Number(player.linh_thach_trung || 0);
        if (ltt <= 0) {
          footer = `❌ Không có ${CEu('tult_trung','🔮')} Linh Thạch Trung nào!`;
        } else {
          const capacity = getBagCapacity(player.canh_gioi || 0, player.bao_boi || [], player.bag_bonus_kg || 0, player.tui_nang_cap || 0);
          const currentWeight = calcBagWeight(player);
          const freeKg = Math.max(0, capacity - currentWeight);
          const maxByWeight = Math.floor(freeKg / 4); // (5.000 Thường = 5kg) - (1 Trung = 1kg)
          if (maxByWeight <= 0) {
            footer = `❌ Túi đã đầy (${fmt(currentWeight)}/${fmt(capacity)}kg)! Không thể hạ Trung → Thường vì sẽ tăng thêm cân nặng túi.`;
          } else {
            const qty = Math.min(ltt, maxByWeight);
            const reward = qty * LT_RATE_TRUNG;
            const r = await db('UPDATE players SET linh_thach_trung=linh_thach_trung-$1, linh_thach=linh_thach+$2 WHERE user_id=$3 AND linh_thach_trung>=$1 RETURNING linh_thach_trung', [qty, reward, userId]);
            if (!r.rows.length) footer = `❌ Linh Thạch Trung đã thay đổi — thử lại!`;
            else {
              player = await getPlayer(userId);
              footer = `✅ Đã hạ ${fmt(qty)} ${CEu('tult_trung','🔮')} Trung → ${fmt(reward)} ${CEu('tult','💠')} Thường` + (qty < ltt ? ` *(giới hạn túi)*` : '');
            }
          }
        }
        return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) });
      }
      if (cid === 'tb_lt_ha_cao') {
        await i.deferUpdate();
        player = await getPlayer(userId);
        const ltc = Number(player.linh_thach_cao || 0);
        if (ltc <= 0) {
          footer = `❌ Không có ${CEu('tult_cao','💚')} Linh Thạch Cao nào!`;
        } else {
          const capacity = getBagCapacity(player.canh_gioi || 0, player.bao_boi || [], player.bag_bonus_kg || 0, player.tui_nang_cap || 0);
          const currentWeight = calcBagWeight(player);
          const freeKg = Math.max(0, capacity - currentWeight);
          const maxByWeight = Math.floor(freeKg / 5); // (10 Trung = 10kg) - (1 Cao = 5kg)
          if (maxByWeight <= 0) {
            footer = `❌ Túi đã đầy (${fmt(currentWeight)}/${fmt(capacity)}kg)! Không thể hạ Cao → Trung vì sẽ tăng thêm cân nặng túi.`;
          } else {
            const qty = Math.min(ltc, maxByWeight);
            const reward = qty * LT_RATE_CAO;
            const r = await db('UPDATE players SET linh_thach_cao=linh_thach_cao-$1, linh_thach_trung=linh_thach_trung+$2 WHERE user_id=$3 AND linh_thach_cao>=$1 RETURNING linh_thach_cao', [qty, reward, userId]);
            if (!r.rows.length) footer = `❌ Linh Thạch Cao đã thay đổi — thử lại!`;
            else {
              player = await getPlayer(userId);
              footer = `✅ Đã hạ ${fmt(qty)} ${CEu('tult_cao','💚')} Cao → ${fmt(reward)} ${CEu('tult_trung','🔮')} Trung` + (qty < ltc ? ` *(giới hạn túi)*` : '');
            }
          }
        }
        return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) });
      }
      if (cid === 'tb_buy_vu_khi') {
        await i.deferUpdate();
        const wId = i.values[0];
        player = await getPlayer(userId);
        const w = VU_KHI.find(x => x.id === wId);
        if (!w) return;
        if (w.donate_only) { footer = `❌ ${w.ten} là vật phẩm Donate!`; }
        else if (player.canh_gioi < w.cap) { footer = `❌ Cần tầng ${w.cap}!`; }
        else if (!(w.gia >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(player, w.gia) : calcSpend(player, w.gia))) { footer = `❌ Thiếu Linh Thạch! Cần ${fmt(w.gia)} ${CEu("tult","💠")} · Có ${CEu("tult","💠")}${fmt(player.linh_thach)}${Number(player.linh_thach_trung||0)>0?` 🔮${fmt(player.linh_thach_trung)}Trung`:''}${Number(player.linh_thach_cao||0)>0?` 💚${fmt(player.linh_thach_cao)}Cao`:''}`; }
        else {
          const cur = VU_KHI.find(x => x.id === player.vu_khi);
          if (cur && w.cap < cur.cap) { footer = `❌ Không thể mua phi khí cấp thấp hơn hiện tại!`; }
          else if (Number(player.vu_khi_cap || 0) > 0) {
            footer = `${CE('warn_icon','⚠️')} Phi khí đang +${player.vu_khi_cap} — đổi sẽ mất hết! Xác nhận bên dưới.`;
            pendingWeaponId = wId;
          } else {
            { const _s = w.gia >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(player, w.gia) : calcSpend(player, w.gia);
              await db('UPDATE players SET vu_khi=$1,linh_thach=$2,linh_thach_trung=$3,linh_thach_cao=$4,vu_khi_cap=0 WHERE user_id=$5', [wId, _s.newThuong, _s.newTrung, _s.newCao, userId]); }
            player = await getPlayer(userId);
            footer = `✅ Lĩnh hội ${w.pham} ${w.ten}! -${fmt(w.gia)} ${CEu("tult","💠")}`;
            pendingWeaponId = null;
          }
        }
        return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab, pendingWeaponId) });
      }
      if (cid.startsWith('tb_confirm_vk_')) {
        await i.deferUpdate();
        const wId = cid.replace('tb_confirm_vk_', '');
        player = await getPlayer(userId);
        const w = VU_KHI.find(x => x.id === wId);
        if (!w) return;
        if (!(w.gia >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(player, w.gia) : calcSpend(player, w.gia))) { footer = `❌ Không đủ Linh Thạch!`; }
        else {
          const _s = w.gia >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(player, w.gia) : calcSpend(player, w.gia);
          await db('UPDATE players SET vu_khi=$1,linh_thach=$2,linh_thach_trung=$3,linh_thach_cao=$4,vu_khi_cap=0 WHERE user_id=$5', [wId, _s.newThuong, _s.newTrung, _s.newCao, userId]);
          player = await getPlayer(userId);
          footer = `✅ Đổi sang ${w.pham} ${w.ten}! Tôi luyện reset về 0.`;
        }
        pendingWeaponId = null;
        return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) });
      }
      if (cid === 'tb_cancel_vk') {
        await i.deferUpdate();
        pendingWeaponId = null; footer = '';
        return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) });
      }
      if (cid === 'tb_buy_bao_boi') {
        await i.deferUpdate();
        const bId = i.values[0];
        player = await getPlayer(userId);
        const b = BAO_BOI.find(x => x.id === bId);
        if (!b) return;
        // Túi cần trả cả 3 loại nếu giá >= 100k HOẶC là túi forceMixed
        const bbUseMulti = BAG_MIXED_SPEND_IDS.includes(bId) || b.gia >= MIXED_SPEND_THRESHOLD;
        const bbSpend = (p, cost) => bbUseMulti ? calcMultiSpend(p, cost) : calcSpend(p, cost);
        if (b.donate_only) { footer = `❌ ${b.ten} là vật phẩm Donate!`; }
        else if (player.canh_gioi < b.cap) { footer = `❌ Cần tầng ${b.cap}!`; }
        else if ((player.bao_boi || []).includes(bId)) { footer = `${CE('warn_icon','⚠️')} Đã có ${b.ten} rồi!`; }
        else if ((player.bao_boi || []).length >= 8) { footer = `❌ Tối đa 8 Linh Bảo!`; }
        else if (!canAddToBag(player, 'bao_boi', 1, bId)) { footer = `❌ Túi quá nặng! ${b.ten} nặng ${b.kg}kg`; }
        else if (!bbSpend(player, b.gia)) { footer = `❌ Thiếu Linh Thạch! Cần ${fmt(b.gia)} ${CEu("tult","💠")} · Có ${CEu("tult","💠")}${fmt(player.linh_thach)}${Number(player.linh_thach_trung||0)>0?` 🔮${fmt(player.linh_thach_trung)}Trung`:''}${Number(player.linh_thach_cao||0)>0?` 💚${fmt(player.linh_thach_cao)}Cao`:''}`; }
        else {
          // Thứ tự túi yếu → mạnh: van_bao_tui(10kg) → tui_da_thu(18kg) → huyen_khong_linh_nang(25kg) → thien_dia_dai_nang(30kg)
          const BT = ['van_bao_tui', 'tui_da_thu', 'huyen_khong_linh_nang', 'thien_dia_dai_nang'];
          const ownedBT = (player.bao_boi || []);
          const oldTierBags = BT.includes(bId)
            ? BT.slice(0, BT.indexOf(bId)).filter(id => ownedBT.includes(id))
            : [];
          // Xóa tất cả túi yếu hơn trước khi thêm túi mới
          for (const oldBag of oldTierBags) {
            await db('UPDATE players SET bao_boi=array_remove(bao_boi,$1) WHERE user_id=$2', [oldBag, userId]);
          }
          const _sb = bbSpend(player, b.gia);
          const r = await db(
            'UPDATE players SET bao_boi=array_append(COALESCE(bao_boi,\'{}\'::text[]),$1),linh_thach=$2,linh_thach_trung=$3,linh_thach_cao=$4 WHERE user_id=$5 RETURNING linh_thach',
            [bId, _sb.newThuong, _sb.newTrung, _sb.newCao, userId],
          );
          if (!r.rows.length) { footer = `❌ Linh Thạch không đủ!`; return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) }); }
          player = await getPlayer(userId);
          const removedNames = oldTierBags.map(id => BAO_BOI.find(b2 => b2.id === id)?.ten || id).join(', ');
          footer = `✅ Lĩnh hội ${b.pham} ${b.ten}! -${fmt(b.gia)} ${CEu("tult","💠")}${removedNames ? ` · Đã xóa: ${removedNames}` : ''}`;
        }
        return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) });
      }
      if (cid === 'tb_thao_bao_boi') {
        await i.deferUpdate();
        const bId = i.values[0];
        player = await getPlayer(userId);
        const b = BAO_BOI.find(x => x.id === bId);
        if (!(player.bao_boi || []).includes(bId)) { footer = `❌ Không có ${b?.ten || bId} trong trang bị!`; }
        else {
          await db('UPDATE players SET bao_boi=array_remove(bao_boi,$1) WHERE user_id=$2', [bId, userId]);
          player = await getPlayer(userId);
          footer = `✅ Đã tháo ${b?.pham || ''} ${b?.ten || bId}. *(Bảo bội đã bị xóa)*`;
        }
        return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) });
      }
      if (cid === 'tb_doi_ve_lc') {
        await i.deferUpdate();
        player = await getPlayer(userId);
        const RATE = 300;
        const ve = Number(player.ve_doi_linh_can || 0);
        if (ve <= 0) {
          footer = `❌ Không có Vé Đổi Linh Căn nào! Nhận qua giftcode hoặc donate.`;
        } else {
          const maxFitLT = calcMaxLinhThach(player, ve * RATE);
          const veDung = Math.min(ve, Math.floor(maxFitLT / RATE));
          if (veDung <= 0) {
            footer = `❌ Túi quá tải! Cần ít nhất 0.3 kg trống để đổi 1 vé (= ${RATE} Linh Thạch).`;
          } else {
            const lt = veDung * RATE;
            const r = await db(
              'UPDATE players SET ve_doi_linh_can=ve_doi_linh_can-$1, linh_thach=linh_thach+$2 WHERE user_id=$3 AND ve_doi_linh_can>=$1 RETURNING ve_doi_linh_can',
              [veDung, lt, userId],
            );
            if (!r.rowCount) {
              footer = `❌ Vé đã thay đổi — thử lại!`;
            } else {
              player = await getPlayer(userId);
              footer = `✅ Đổi ${veDung} Vé Linh Căn → +${fmt(lt)} ${CEu('tult','💠')} Thường` + (veDung < ve ? ` *(giới hạn túi)*` : '');
            }
          }
        }
        return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) });
      }
      if (cid === 'tb_doi_ve_hm') {
        await i.deferUpdate();
        player = await getPlayer(userId);
        const RATE = 250;
        const ve = Number(player.ve_doi_huyet || 0);
        if (ve <= 0) {
          footer = `❌ Không có Vé Đổi Huyết Mạch nào! Mua tại \`-donate\` → Đặc Biệt.`;
        } else {
          const maxFitLT = calcMaxLinhThach(player, ve * RATE);
          const veDung = Math.min(ve, Math.floor(maxFitLT / RATE));
          if (veDung <= 0) {
            footer = `❌ Túi quá tải! Cần ít nhất 0.25 kg trống để đổi 1 vé (= ${RATE} Linh Thạch).`;
          } else {
            const lt = veDung * RATE;
            const r = await db(
              'UPDATE players SET ve_doi_huyet=ve_doi_huyet-$1, linh_thach=linh_thach+$2 WHERE user_id=$3 AND ve_doi_huyet>=$1 RETURNING ve_doi_huyet',
              [veDung, lt, userId],
            );
            if (!r.rowCount) {
              footer = `❌ Vé đã thay đổi — thử lại!`;
            } else {
              player = await getPlayer(userId);
              footer = `✅ Đổi ${veDung} Vé Huyết Mạch → +${fmt(lt)} ${CEu('tult','💠')} Thường` + (veDung < ve ? ` *(giới hạn túi)*` : '');
            }
          }
        }
        return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) });
      }
      if (cid === 'tb_craft_bao_boi') {
        await i.deferUpdate();
        const craftId = i.values[0];
        player = await getPlayer(userId);
        const recipe = LINH_THU_CRAFT.find(r => r.bao_boi_id === craftId);
        const bb = recipe && BAO_BOI.find(b => b.id === craftId);
        // Túi bag — theo thứ tự từ yếu → mạnh (không stack)
        // van_bao_tui(10kg) → tui_da_thu(18kg) → huyen_khong_linh_nang(25kg) → thien_dia_dai_nang(30kg)
        const BAG_TIER = ['van_bao_tui', 'tui_da_thu', 'huyen_khong_linh_nang', 'thien_dia_dai_nang'];
        const ownedBB = player.bao_boi || [];
        if (!recipe || !bb) {
          footer = '❌ Công thức không tồn tại!';
        } else if (ownedBB.includes(craftId)) {
          footer = `${CE('warn_icon','⚠️')} Đã sở hữu ${bb.ten} rồi!`;
        } else if (BAG_TIER.includes(craftId) && BAG_TIER.indexOf(craftId) < BAG_TIER.reduce((best, id, idx) => ownedBB.includes(id) ? Math.max(best, idx) : best, -1)) {
          const betterBB = BAO_BOI.find(b => b.id === BAG_TIER[BAG_TIER.reduce((best, id, idx) => ownedBB.includes(id) ? Math.max(best, idx) : best, -1)]);
          footer = `${CE('warn_icon','⚠️')} Đã có túi xịn hơn: ${betterBB?.ten || ''}! Không cần thay.`;
        } else if (player.canh_gioi < recipe.yeu_cau_cap) {
          footer = `❌ Cần tầng ${recipe.yeu_cau_cap} để chế tạo!`;
        } else if (!(recipe.phi >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(player, recipe.phi) : calcSpend(player, recipe.phi))) {
          footer = `❌ Thiếu Linh Thạch! Cần ${fmt(recipe.phi)} ${CEu("tult","💠")} · Có ${CEu("tult","💠")}${fmt(player.linh_thach)}${Number(player.linh_thach_trung||0)>0?` 🔮${fmt(player.linh_thach_trung)}Trung`:''}${Number(player.linh_thach_cao||0)>0?` 💚${fmt(player.linh_thach_cao)}Cao`:''}`;
        } else {
          const vp = { ...(player.vat_pham || {}) };
          let missing = null;
          for (const [id, qty] of Object.entries(recipe.vat_lieu)) {
            if (Number(vp[id] || 0) < qty) {
              const info = LINH_THU_LOOT_ITEMS[id];
              missing = `❌ Thiếu ${info?.emoji || ''}${info?.ten || id}! Cần ${qty} · Có ${vp[id] || 0}`;
              break;
            }
          }
          if (missing) {
            footer = missing;
          } else {
            for (const [id, qty] of Object.entries(recipe.vat_lieu)) {
              vp[id] = (Number(vp[id] || 0)) - qty;
              if (vp[id] <= 0) delete vp[id];
            }
            // Nếu đang nâng cấp túi → xóa tất cả túi yếu hơn rồi thêm túi mới
            const oldBagIds = BAG_TIER.includes(craftId)
              ? BAG_TIER.slice(0, BAG_TIER.indexOf(craftId)).filter(id => ownedBB.includes(id))
              : [];
            const _sc = recipe.phi >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(player, recipe.phi) : calcSpend(player, recipe.phi);
            // Xóa các túi cũ yếu hơn
            for (const oldBagId of oldBagIds) {
              await db('UPDATE players SET bao_boi=array_remove(bao_boi,$1) WHERE user_id=$2', [oldBagId, userId]);
            }
            const r = await db(
              `UPDATE players SET linh_thach=$1, linh_thach_trung=$2, linh_thach_cao=$3, vat_pham=$4::jsonb, bao_boi=array_append(COALESCE(bao_boi,'{}'),$5::text) WHERE user_id=$6 RETURNING linh_thach`,
              [_sc.newThuong, _sc.newTrung, _sc.newCao, JSON.stringify(vp), craftId, userId],
            );
            if (!r.rows.length) { footer = `❌ Linh Thạch không đủ (đã thay đổi)!`; return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) }); }
            if (oldBagIds.length > 0) {
              const removedNames = oldBagIds.map(id => BAO_BOI.find(b2 => b2.id === id)?.ten || id).join(', ');
              footer = `✅ Nâng cấp túi → ${bb.pham} ${bb.ten}! -${fmt(recipe.phi)} ${CEu("tult","💠")} · Đã xóa: ${removedNames}`;
            } else {
              footer = `✅ Chế tạo thành công ${bb.pham} ${bb.ten}! -${fmt(recipe.phi)} ${CEu("tult","💠")}`;
            }
            player = await getPlayer(userId);
          }
        }
        return msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) });
      }
     } catch (e) {
       console.error('[trang_bi] collector error:', e?.message || e);
       if (e?.stack) console.error(e.stack);
       if (Array.isArray(e?.errors)) {
         e.errors.forEach((sub, idx) => console.error(`[trang_bi] sub-error[${idx}]:`, sub?.message || sub, sub?.stack || ''));
       }
       try {
         player = await getPlayer(userId);
         footer = `${CE('warn_icon','⚠️')} Có lỗi xảy ra, đã tải lại — thử lại nhé!`;
         await msg.edit({ embeds: [buildEmbed(player, tab)], components: buildRows(player, tab) });
       } catch (_) {}
     }
    });

    coll.on('end', () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  });

