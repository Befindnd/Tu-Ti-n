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
      } else h.push(`${CE('ng_luyen_dan','⚗️')} Đan **${i.ten}** ×${a} *(túi quá tải — bỏ qua)*`);
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


  // ── REDESIGN: Khám Bệnh ────────────────────────────────────────────────────
  // Cũ: 15,000 LT + 2 Thảo · CD 30ph → chỉ xem thông tin (quá đắt cho info)
  // Mới: 3,000 LT + 1 Thảo · CD 20ph → xem thông tin + tặng mục tiêu +5% Cảm Ngộ
  // Thiên Phú: tặng target +10% Cảm Ngộ (tăng gấp đôi hiệu quả)
  reg("kham_benh", ["kb_y", "khambenh"], async (n) => {
    const t = n.author.id,
      e = n.mentions.users.first();
    if (!e || e.bot) return n.reply({ embeds: [errE("Cú pháp: `-kham_benh @người_chơi`")] });
    const h = await getPlayer(t, n.author.username);
    if (!h) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("duoc_su" !== h.nghe)
      return n.reply({
        embeds: [errE("Lệnh này chỉ dành cho **💉 Dược Sư**!\nĐổi: `-nghe chon duoc_su`")],
      });

    const KB_PHI  = 3000; // từ 15,000
    const KB_THAO = 1;    // từ 2

    const buffActive = "object" == typeof h.buff_active && h.buff_active ? h.buff_active : {};
    const cdLeft = cdRemMin(buffActive.kham_benh_cd, 20); // CD 20ph (từ 30ph)
    if (cdLeft)
      return n.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Cần dưỡng sức!\nHết CD ${cdTsMin(buffActive.kham_benh_cd, 20)}.`)] });

    if (Number(h.linh_thach) < KB_PHI)
      return n.reply({ embeds: [errE(`Cần **${fmt(KB_PHI)} ${CE("tult","💠")}** để khám bệnh!\nHiện có: **${fmt(Number(h.linh_thach))}**`)] });

    const thaoMap = h.linh_thao || {},
      thaoTong = Object.values(thaoMap).reduce((s, v) => s + Number(v || 0), 0);
    if (thaoTong < KB_THAO)
      return n.reply({ embeds: [errE(`Cần **${KB_THAO} Linh Thảo** để khám bệnh!\nHiện có: **${thaoTong}**.`)] });

    // Deduct 1 Linh Thảo
    let remain = KB_THAO;
    const thaoMoi = { ...thaoMap };
    for (const k of Object.keys(thaoMoi)) {
      if (remain <= 0) break;
      const take = Math.min(remain, Number(thaoMoi[k] || 0));
      thaoMoi[k] = (Number(thaoMoi[k]) || 0) - take;
      remain -= take;
      if (thaoMoi[k] <= 0) delete thaoMoi[k];
    }

    const target = await getPlayer(e.id);
    if (!target) return n.reply({ embeds: [errE(`**${e.username}** chưa tu tiên!`)] });

    const isTP = h.thien_phu_nghe === "duoc_su";
    const cnBonus = isTP ? 10 : 5; // Thiên Phú tặng +10% CN, thường +5%
    const newTargetCN = Math.min(100, (target.cam_ngo || 0) + cnBonus);

    const buffMoi = { ...buffActive, kham_benh_cd: Date.now() };
    await db(
      "UPDATE players SET buff_active=$1, linh_thach=GREATEST(0,linh_thach-$2), linh_thao=$3 WHERE user_id=$4",
      [JSON.stringify(buffMoi), KB_PHI, JSON.stringify(thaoMoi), t],
    );
    // Tặng Cảm Ngộ cho mục tiêu
    await db("UPDATE players SET cam_ngo=$1 WHERE user_id=$2", [newTargetCN, target.user_id]);

    const dtLv  = Math.min(3, Math.max(0, target.dao_thuong || 0)),
      cs      = tinhCS(target),
      dtAt    = Number(target.dao_thuong_at || 0),
      autoMs  = dtLv > 0 && dtAt > 0 ? Math.max(0, AUTO_HEAL_MS - (Date.now() - dtAt)) : 0,
      autoH   = Math.floor(autoMs / 36e5),
      autoM   = Math.ceil((autoMs % 36e5) / 6e4),
      hpPct   = cs.hp_max > 0 ? Math.round((Number(target.hp) / cs.hp_max) * 100) : 100;

    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`💉 Khám Bệnh — ${e.username}`)
          .setColor(dtLv === 0 ? 0x27AE60 : dtLv === 1 ? 0xF1C40F : dtLv === 2 ? 0xE67E22 : 0xE74C3C)
          .setThumbnail(e.displayAvatarURL())
          .setDescription(
            `*Dược Sư vận công quán sát, chẩn đoán thần thể **${e.username}**...*\n\n` +
            `**${DT_TEN[dtLv]}**` +
            (dtLv > 0 ? `\n*${DT_HIEU[dtLv]}*` : "") +
            `\n\n${CE("tip_icon","💡")} **Cảm Ngộ tặng:** ${target.cam_ngo||0}% → **${newTargetCN}%** *(+${cnBonus}%)* ` +
            (isTP ? "✨ **Thiên Phú**" : ""),
          )
          .addFields(
            { name: `${CE("tuhp","💜")} Linh Lực`, value: `**${fmt(Number(target.hp))} / ${fmt(cs.hp_max)}** *(${hpPct}%)*`, inline: true },
            { name: `${CE('tuatk','⚔️')} Chiến Lực`, value: `Công: **${fmt(cs.atk)}** · Thủ: **${fmt(cs.def)}**`, inline: true },
            dtLv > 0
              ? { name: "⏰ Tự Hồi Phục", value: autoMs > 0 ? `Giảm 1 cấp sau **${autoH > 0 ? `${autoH}h ` : ""}${autoM}ph**` : "Sắp tự giảm...", inline: false }
              : { name: "🌿 Tình Trạng", value: "Thần thể **hoàn toàn lành mạnh!**", inline: false },
            dtLv > 0
              ? { name: "💊 Phí Chữa Trị (tham khảo)", value: `Dược Sư: **${fmt(PHI_DUOC_SU[dtLv])}** ${CE("tult","💠")} · Tự chữa: **${fmt(PHI_TU_CHUA[dtLv])}** ${CE("tult","💠")}`, inline: false }
              : { name: `${CE("tip_icon","💡")} Gợi Ý`, value: "Không cần chữa trị!", inline: false },
          )
          .addFields({ name: "💸 Chi Phí Khám", value: `${CE("tult","💠")} **-${fmt(KB_PHI)}** · 🌿 **-${KB_THAO} Linh Thảo**`, inline: false })
          .setFooter({ text: `Dược Sư Đặc Kỹ · Khám Bệnh · CD: 20ph · Tặng +${cnBonus}% Cảm Ngộ cho bệnh nhân` }),
      ],
    });
  });

