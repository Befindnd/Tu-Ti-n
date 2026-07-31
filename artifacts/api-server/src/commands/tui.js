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
  DT_TEN, DT_HIEU, PHI_TU_CHUA, PHI_DUOC_SU, CD_TU_H, CD_DS_TU_H, CD_DS_NGUOI,
} = require('../utils');
const {
  COMBAT_SESSIONS, RECENTLY_ENDED, markRecentlyEnded, wasRecentlyEnded,
  BP_COMBAT, hpBar, hpHeart, makeCombatEmbed,
  makePVPInviteRow, makePVPInviteRowDisabled, makePVPCombatRow,
  resolveCombatTurn, endCombat, scheduleTurnTimeout, applyCombatStats,
} = require('../game/combat');
const ADMIN_ID = process.env.ADMIN_ID || '';
const AUTO_HEAL_MS = 864e5;

  reg("tui", ["bag", "kho_do", "inventory"], async (n) => {
    const t = n.author.id,
      e = await getPlayer(t);
    if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });
    // Auto-xóa túi yếu hơn nếu đang có túi tốt hơn trong cùng tier
    // Thứ tự yếu → mạnh: van_bao_tui(10kg) → tui_da_thu(18kg) → huyen_khong_linh_nang(25kg) → thien_dia_dai_nang(30kg)
    {
      const BAG_TIER = ['van_bao_tui', 'tui_da_thu', 'huyen_khong_linh_nang', 'thien_dia_dai_nang'];
      const currentBB = Array.isArray(e.bao_boi) ? e.bao_boi : [];
      let bestIdx = -1;
      for (let i = 0; i < BAG_TIER.length; i++)
        if (currentBB.includes(BAG_TIER[i])) bestIdx = i;
      if (bestIdx > 0) {
        const weaker = BAG_TIER.slice(0, bestIdx).filter(id => currentBB.includes(id));
        for (const id of weaker) {
          await db("UPDATE players SET bao_boi=array_remove(bao_boi,$1) WHERE user_id=$2", [id, t]);
          e.bao_boi = e.bao_boi.filter(b => b !== id);
        }
      }
    }
    const h = e.bao_boi || [],
      i = getBagCapacity(e.canh_gioi || 0, h, e.bag_bonus_kg || 0, e.tui_nang_cap || 0),
      a = calcBagWeight(e),
      o = Math.min(100, Math.floor((a / i) * 100)),
      c = a > i,
      _ = e.linh_thao || {},
      u = e.dan_duoc || {},
      r = e.bi_phap || [],
      s = h,
      l = e.phu_luc || {},
      m = Object.entries(_)
        .filter(([, n]) => Number(n) > 0)
        .map(([n, t]) => {
          const e = LINH_THAO.find((t) => t.id === n),
            h = e?.kg || 0.3,
            i = (Number(t) * h).toFixed(1);
          return `${e?.emoji || "🌿"} **${e?.ten || n}** ×${t} — *${h}kg/cây · ${i}kg*`;
        }),
      g = {};
    for (const [n, t] of Object.entries(u)) {
      if (!t) continue;
      let e = n,
        h = "trung";
      for (const t of ["cuc", "thuong", "trung", "ha"])
        if (n.endsWith("_" + t)) {
          ((e = n.slice(0, -(t.length + 1))), (h = t));
          break;
        }
      const i = DAN_DUOC.find((n) => n.id === e);
      if (!i) continue;
      const a = DAN_PHAM[h] || DAN_PHAM.trung,
        o = a.kg,
        c = (Number(t) * o).toFixed(1);
      g[n] = `${i.emoji} ${a.emoji} **${i.ten}** [${a.ten}] ×${t} — *${o}kg/viên · ${c}kg*`;
    }
    const d = Object.values(g),
      p = r
        .map((n) => {
          const t = BI_PHAP.find((t) => t.id === n);
          return t ? `${CE('bp_' + t.id, '📜')} **${t.ten}** — *${BAG_WEIGHTS.bi_phap}kg*` : null;
        })
        .filter(Boolean),
      T = s
        .map((n) => {
          const t = BAO_BOI.find((t) => t.id === n);
          return t
            ? `${CE(t.ce_name, '🔮')} **${t.ten}** — *${t.kg}kg*${t.hieu_ung ? ` · ${t.hieu_ung}` : ""}`
            : null;
        })
        .filter(Boolean),
      b = Object.entries(l)
        .filter(([, n]) => Number(n) > 0)
        .map(([n, t]) => {
          const e = PHU_LUC_DATA.find((t) => t.id === n),
            h = e?.kg || 0.1,
            i = (Number(t) * h).toFixed(1);
          return e ? `${e.emoji} **${e.ten}** ×${t} — *${h}kg/tờ · ${i}kg*` : null;
        })
        .filter(Boolean),
      vp = Object.entries(e.vat_pham || {})
        .filter(([, n]) => Number(n) > 0)
        .map(([n, t]) => {
          const item = LINH_THU_LOOT_ITEMS[n];
          if (!item) return null;
          const h = item.kg || 0.5,
            i = (Number(t) * h).toFixed(1);
          return `${item.emoji} **${item.ten}** ×${t} — *${h}kg/cái · ${i}kg*`;
        })
        .filter(Boolean),
      $ = c ? 15158332 : o >= 80 ? 15965202 : 3066993,
      y = c
        ? "🔴 **QUÁ TẢI — Không thể nhận đồ mới!**"
        : o >= 80
          ? "🟡 Sắp đầy, hãy dùng bớt đồ!"
          : "🟢 Còn chỗ trống.",
      E = Math.floor(Number(e.linh_thach || 0) / 1e3),
      ltTrungStr = Number(e.linh_thach_trung||0)>0 ? ` · ${CE("tult_trung","🔮")} **${fmt(e.linh_thach_trung||0)}** Trung` : '',
      ltCaoStr   = Number(e.linh_thach_cao||0)>0   ? ` · ${CE("tult_cao","💚")} **${fmt(e.linh_thach_cao||0)}** Cao` : '',
      f = new EmbedBuilder()
        .setTitle(`🎒 Túi Trữ Vật — ${n.author.username}`)
        .setColor($)
        .setDescription(
          `${pBar(o)} **${a}/${i} kg** ${y}\n${CE("tult","💠")} **${fmt(e.linh_thach||0)}**${ltTrungStr}${ltCaoStr} *(Linh Thạch — ${E}kg)* · \`-vut <loại> <id> [số]\` vứt đồ`,
        );
    if (
      (m.length &&
        f.addFields({
          name: "🌿 Linh Thảo (kg theo từng loại)",
          value: m.join("\n").slice(0, 1e3),
          inline: !1,
        }),
      d.length &&
        f.addFields({
          name: `${CE('ng_luyen_dan','⚗️')} Đan Dược (kg theo phẩm cấp)`,
          value: d.join("\n").slice(0, 1e3),
          inline: !1,
        }),
      p.length &&
        f.addFields({
          name: `${CE('cp_thap_huyen','📜')} Bí Pháp (${BAG_WEIGHTS.bi_phap}kg/cuộn)`,
          value: p.join("\n").slice(0, 1e3),
          inline: !1,
        }),
      T.length &&
        f.addFields({
          name: `${CE('ft_linh_bao','🔮')} Linh Bảo (kg theo phẩm cấp)`,
          value: T.join("\n").slice(0, 1e3),
          inline: !1,
        }),
      b.length &&
        f.addFields({
          name: "📄 Phù Lục (kg theo từng loại)",
          value: b.join("\n").slice(0, 1e3),
          inline: !1,
        }),
      vp.length &&
        f.addFields({
          name: "🎒 Vật Phẩm Săn Được (kg theo loại)",
          value: vp.join("\n").slice(0, 1e3),
          inline: !1,
        }),
      e.vu_khi && "kiem_go" !== e.vu_khi)
    ) {
      const n = VU_KHI.find((n) => n.id === e.vu_khi);
      f.addFields({
        name: `${CE('tuatk','⚔️')} Phi Khí — Trang Bị`,
        value: `${n ? CE(n.ce_name, n.pham || '⚔️') : CE('tuatk','⚔️')} **${n?.ten || e.vu_khi}** — *${n?.kg || 0}kg*`,
        inline: !1,
      });
    }
    m.length ||
      d.length ||
      p.length ||
      T.length ||
      b.length ||
      vp.length ||
      (e.vu_khi && "kiem_go" !== e.vu_khi) ||
      f.addFields({ name: "📦 Túi Trống", value: "*Chưa có vật phẩm nào trong túi.*", inline: !1 });
    const BAG_TIER_INFO = [
      { id: 'tui_da_thu',  kg: 18, ten: 'Túi Da Thú' },
      { id: 'van_bao_tui', kg: 10, ten: 'Càn Khôn Linh Nang' },
    ];
    const activeBag = BAG_TIER_INFO.find(b => s.includes(b.id));
    const k = Number(e.bag_bonus_kg || 0),
      N = Number(e.tui_nang_cap || 0);
    let D = `Túi ${i}kg`;
    (activeBag && (D += ` (+${activeBag.kg}kg ${activeBag.ten})`),
      k > 0 && (D += ` (+${k}kg Donate)`),
      N > 0 && (D += ` (+${2 * N}kg Nâng Cấp ×${N})`),
      f.setFooter({ text: `${D} — Tầng ${e.canh_gioi}` }));
    const L = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`tuivut_${t}`)
          .setLabel("🗑️ Vứt Đồ")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`tuiung_${t}`)
          .setLabel("💊 Sử Dụng")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`tuicho_${t}`)
          .setLabel("🎁 Cho Đan")
          .setStyle(ButtonStyle.Primary),
      ),
      P = await n.reply({ embeds: [f], components: [L] });
    let S = null,
      A = null,
      pendingVutItems = null;
    const v = P.createMessageComponentCollector({ filter: (n) => n.user.id === t, time: 9e4 });
    (v.on("collect", async (n) => {
      if (n.customId === `tuichosel_${t}`) {
        const pillKey = n.values[0];
        let baseId = pillKey,
          pham = "trung";
        for (const p of ["cuc", "thuong", "trung", "ha"])
          if (pillKey.endsWith("_" + p)) {
            baseId = pillKey.slice(0, -(p.length + 1));
            pham = p;
            break;
          }
        const dan = DAN_DUOC.find((d) => d.id === baseId);
        const phamData = DAN_PHAM[pham] || DAN_PHAM.trung;
        const modal = new ModalBuilder()
          .setCustomId(`tuicho_modal_${t}_${pillKey}`)
          .setTitle("🎁 Cho Đan — " + phamData.ten + " " + (dan?.ten || baseId));
        const qInp = new TextInputBuilder()
          .setCustomId("qty")
          .setLabel("Số lượng cho (1-10)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Nhập số 1-10")
          .setRequired(!0)
          .setMaxLength(2);
        const rInp = new TextInputBuilder()
          .setCustomId("recipient")
          .setLabel("User ID ngườị nhận")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Nhập dãy số User ID")
          .setRequired(!0)
          .setMaxLength(20);
        modal.addComponents(
          new ActionRowBuilder().addComponents(qInp),
          new ActionRowBuilder().addComponents(rInp),
        );
        return void (await n.showModal(modal));
      }
      if ((await n.deferUpdate(), n.customId === `tuivut_${t}`)) {
        const n = await getPlayer(t),
          e = [];
        for (const [t, h] of Object.entries(n.linh_thao || {})) {
          if (!h) continue;
          const n = LINH_THAO.find((n) => n.id === t);
          e.push(
            new StringSelectMenuOptionBuilder()
              .setValue(`lt|${t}`)
              .setLabel(`${n?.ten || t} ×${h}`)
              .setDescription(`Linh Thảo · ${(Number(h) * (n?.kg || 0.3)).toFixed(1)}kg`),
          );
        }
        for (const [t, h] of Object.entries(n.dan_duoc || {})) {
          if (!h) continue;
          let n = t,
            i = "trung";
          for (const e of ["cuc", "thuong", "trung", "ha"])
            if (t.endsWith("_" + e)) {
              ((n = t.slice(0, -(e.length + 1))), (i = e));
              break;
            }
          const a = DAN_DUOC.find((t) => t.id === n),
            o = DAN_PHAM[i] || DAN_PHAM.trung;
          e.push(
            new StringSelectMenuOptionBuilder()
              .setValue(`dd|${t}`)
              .setLabel(`${o.ten} ${a?.ten || n} ×${h}`)
              .setDescription(`Đan Dược · ${(Number(h) * o.kg).toFixed(1)}kg`),
          );
        }
        for (const [t, h] of Object.entries(n.phu_luc || {})) {
          if (!h) continue;
          const n = PHU_LUC_DATA.find((n) => n.id === t);
          e.push(
            new StringSelectMenuOptionBuilder()
              .setValue(`pl|${t}`)
              .setLabel(`${n?.ten || t} ×${h}`)
              .setDescription(`Phù Lục · ${(Number(h) * (n?.kg || 0.1)).toFixed(1)}kg`),
          );
        }
        for (const t of n.bao_boi || []) {
          const n = BAO_BOI.find((n) => n.id === t);
          e.push(
            new StringSelectMenuOptionBuilder()
              .setValue(`bb|${t}`)
              .setLabel(n?.ten || t)
              .setDescription(`Linh Bảo · ${n?.kg || 0}kg`),
          );
        }
        for (const t of n.bi_phap || []) {
          const n = BI_PHAP.find((n) => n.id === t);
          e.push(
            new StringSelectMenuOptionBuilder()
              .setValue(`bp|${t}`)
              .setLabel(n?.ten || t)
              .setDescription(`Bí Pháp · ${BAG_WEIGHTS.bi_phap}kg`),
          );
        }
        for (const [t, h] of Object.entries(n.vat_pham || {})) {
          if (!h) continue;
          const item = LINH_THU_LOOT_ITEMS[t];
          if (!item) continue;
          const kg = (Number(h) * (item.kg || 0.5)).toFixed(1);
          e.push(
            new StringSelectMenuOptionBuilder()
              .setValue(`vp|${t}`)
              .setLabel(`${item.ten} ×${h}`)
              .setDescription(`Vật phẩm săn · ${kg}kg`),
          );
        }
        return 0 === e.length
          ? (await P.edit({ embeds: [warnE("Túi trống, không có gì để vứt!")], components: [] }),
            void v.stop())
          : void (await P.edit({
              embeds: [
                new EmbedBuilder()
                  .setTitle("🗑️ Vứt Đồ — Chọn Vật Phẩm")
                  .setColor(15158332)
                  .setDescription(
                    `Chọn vật phẩm muốn vứt bỏ từ menu bên dưới:\n${CE('warn_icon','⚠️')} *Đồ đã vứt không thể lấy lại!*`,
                  )
                  .setFooter({ text: "Menu tự đóng sau 90s" }),
              ],
              components: [
                new ActionRowBuilder().addComponents(
                  new StringSelectMenuBuilder()
                    .setCustomId(`tuisel_${t}`)
                    .setPlaceholder("🗑️ Chọn vật phẩm muốn vứt (có thể chọn nhiều)...")
                    .setMinValues(1)
                    .setMaxValues(Math.min(25, e.length))
                    .addOptions(e.slice(0, 25)),
                ),
              ],
            }));
      }
      if (n.customId === `tuiung_${t}`) {
        const pl = await getPlayer(t);
        const opts = [];
        for (const [id, qty] of Object.entries(pl.dan_duoc || {})) {
          if (!qty) continue;
          let baseId = id,
            pham = "trung";
          for (const p of ["cuc", "thuong", "trung", "ha"])
            if (id.endsWith("_" + p)) {
              baseId = id.slice(0, -(p.length + 1));
              pham = p;
              break;
            }
          const dan = DAN_DUOC.find((d) => d.id === baseId);
          const phamData = DAN_PHAM[pham] || DAN_PHAM.trung;
          const tuVi = dan?.limited ? 0 : Math.floor((dan?.tu_vi || 0) * phamData.he_so);
          const desc = dan?.limited ? "Đột phá 1 cảnh giới" : "+" + fmt(tuVi) + " Tu Vi";
          opts.push(
            new StringSelectMenuOptionBuilder()
              .setValue("use|" + id)
              .setLabel(phamData.ten + " " + (dan?.ten || baseId) + " ×" + qty)
              .setDescription(desc),
          );
        }
        if (!opts.length)
          return void (await P.edit({
            embeds: [warnE("Không có đan dược trong túi!")],
            components: [L],
          }));
        return void (await P.edit({
          embeds: [
            new EmbedBuilder()
              .setTitle("💊 Sử Dụng Đan Dược")
              .setColor(3066993)
              .setDescription("Chọn đan dược muốn uống:")
              .setFooter({ text: "Menu tự động sau 90s" }),
          ],
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`tuiungsel_${t}`)
                .setPlaceholder("💊 Chọn đan...")
                .addOptions(opts.slice(0, 25)),
            ),
          ],
        }));
      }
      if (n.customId === `tuiungsel_${t}`) {
        const selId = n.values[0].slice(4);
        let baseId = selId,
          pham = "trung";
        for (const p of ["cuc", "thuong", "trung", "ha"])
          if (selId.endsWith("_" + p)) {
            baseId = selId.slice(0, -(p.length + 1));
            pham = p;
            break;
          }
        const pl = await getPlayer(t);
        const dan = DAN_DUOC.find((d) => d.id === baseId);
        if (!dan)
          return void (await P.edit({
            embeds: [errE("Không tìm thấy đan dược!")],
            components: [L],
          }));
        if (dan.limited && "pha_canh_dan" === dan.id) {
          const ddPC = { ...(pl.dan_duoc || {}) };
          const qty = ddPC.pha_canh_dan || 0;
          if (qty <= 0)
            return void (await P.edit({
              embeds: [errE("Không còn Phá Cảnh Đan!")],
              components: [L],
            }));
          if (pl.canh_gioi >= CANH_GIOI.length - 1)
            return void (await P.edit({
              embeds: [warnE("Đã đạt cảnh giới tối cao!")],
              components: [L],
            }));
          const newCg = pl.canh_gioi + 1;
          const cgData = CANH_GIOI[newCg];
          ddPC.pha_canh_dan = qty - 1;
          if (ddPC.pha_canh_dan <= 0) delete ddPC.pha_canh_dan;
          await db(
            "UPDATE players SET dan_duoc=$1,canh_gioi=$2,exp=$3,hp=hp_max WHERE user_id=$4",
            [JSON.stringify(ddPC), newCg, cgData.exp_can, t],
          );
          return void (await P.edit({
            embeds: [
              new EmbedBuilder()
                .setTitle(dan.emoji + " Phá Cảnh Đan — Đột Phá!")
                .setColor(10181046)
                .setDescription(
                  CG_EMOJI(pl.canh_gioi) +
                    " **" +
                    CANH_GIOI[pl.canh_gioi].ten +
                    "** ➜ " +
                    CG_EMOJI(newCg) +
                    " **" +
                    cgData.ten +
                    "**\n" +
                    CE("tuhp", "HP") +
                    " Linh Lực hồi đầy!\n\n" + CE('tukv','💎') + " Còn " +
                    (ddPC.pha_canh_dan || 0) +
                    " Phá Cảnh Đan",
                ),
            ],
            components: [L],
          }));
        }
        if (dan.limited && "hoi_xuan_dan" === dan.id) {
          const ddHX = { ...(pl.dan_duoc || {}) };
          const qty = ddHX.hoi_xuan_dan || 0;
          if (qty <= 0)
            return void (await P.edit({
              embeds: [errE("Không còn Hồi Xuân Đan!")],
              components: [L],
            }));
          const curDT = Math.min(3, Math.max(0, pl.dao_thuong || 0));
          if (curDT <= 0)
            return void (await P.edit({
              embeds: [warnE("🌸 Thần thể ngươi hoàn toàn lành mạnh — không có đạo thương nào cần chữa!")],
              components: [L],
            }));
          const newDT = curDT - 1;
          ddHX.hoi_xuan_dan = qty - 1;
          if (ddHX.hoi_xuan_dan <= 0) delete ddHX.hoi_xuan_dan;
          await db(
            "UPDATE players SET dan_duoc=$1, dao_thuong=$2, dao_thuong_at=CASE WHEN $2>0 THEN dao_thuong_at ELSE 0::BIGINT END WHERE user_id=$3",
            [JSON.stringify(ddHX), newDT, t],
          );
          const dtE = ["", CE("dt_nhe","🟡"), CE("dt_trung","🟠"), CE("dt_nang","🔴")];
          return void (await P.edit({
            embeds: [
              new EmbedBuilder()
                .setTitle(dan.emoji + " Hồi Xuân Đan — Chữa Đạo Thương!")
                .setColor(3066993)
                .setDescription(
                  "*Tiên đan tan vào kinh mạch, khí xuân lan tỏa chữa lành vết thương...*\n\n" +
                    dtE[curDT] + " Đạo Thương Cấp " + curDT +
                    " ➜ " +
                    (newDT > 0 ? dtE[newDT] + " **Cấp " + newDT + "**" : "✅ **Hoàn toàn khỏi!**") +
                    "\n\n" + CE('tukv','💎') + " Còn " + (ddHX.hoi_xuan_dan || 0) + " Hồi Xuân Đan",
                ),
            ],
            components: [L],
          }));
        }
        const ddReg = { ...(pl.dan_duoc || {}) };
        const qtyLeft = ddReg[selId] || 0;
        if (qtyLeft <= 0)
          return void (await P.edit({
            embeds: [errE("Không còn đan này trong túi!")],
            components: [L],
          }));
        const phamData = DAN_PHAM[pham] || DAN_PHAM.trung;
        const tuVi = Math.floor(dan.tu_vi * phamData.he_so);
        ddReg[selId] -= 1;
        if (ddReg[selId] <= 0) delete ddReg[selId];
        let camNgoLine = "";
        if ("cuc" === pham && dan.ngo_dao_cuc) {
          const newCN = Math.min(100, (pl.cam_ngo || 0) + dan.ngo_dao_cuc);
          await db("UPDATE players SET dan_duoc=$1,exp=exp+$2,cam_ngo=$3 WHERE user_id=$4", [
            JSON.stringify(ddReg),
            tuVi,
            newCN,
            t,
          ]);
          camNgoLine =
            "\n" +
            CE("tucn", "OK") +
            " **Cực Phẩm!** Cảm Ngộ +" +
            dan.ngo_dao_cuc +
            "% (" +
            newCN +
            "%)";
        } else {
          await db("UPDATE players SET dan_duoc=$1,exp=exp+$2 WHERE user_id=$3", [
            JSON.stringify(ddReg),
            tuVi,
            t,
          ]);
        }
        const totalLeft = Object.values(ddReg).reduce((a, b) => a + Number(b), 0);
        return void (await P.edit({
          embeds: [
            new EmbedBuilder()
              .setTitle(dan.emoji + " " + phamData.emoji + " Uống " + phamData.ten + " " + dan.ten)
              .setColor(phamData.color)
              .setDescription(
                "*Linh khí thấm vào kinh mạch...*\n\n" +
                  CE("tutv", "TV") +
                  " +**" +
                  fmt(tuVi) +
                  " Tu Vi**" +
                  camNgoLine +
                  "\n\n" +
                  CE("tucn", "OK") +
                  " *Còn **" +
                  totalLeft +
                  " viên** trong túi*",
              )
              .setFooter({ text: "Phẩm: " + phamData.ten + " (×" + phamData.he_so + ")" }),
          ],
          components: [L],
        }));
      }
      if (n.customId === `tuicho_${t}`) {
        const pl = await getPlayer(t);
        const opts = [];
        for (const [id, qty] of Object.entries(pl.dan_duoc || {})) {
          if (!qty) continue;
          let baseId = id,
            pham = "trung";
          for (const p of ["cuc", "thuong", "trung", "ha"])
            if (id.endsWith("_" + p)) {
              baseId = id.slice(0, -(p.length + 1));
              pham = p;
              break;
            }
          const dan = DAN_DUOC.find((d) => d.id === baseId);
          if (dan?.limited) continue;
          const phamData = DAN_PHAM[pham] || DAN_PHAM.trung;
          opts.push(
            new StringSelectMenuOptionBuilder()
              .setValue(id)
              .setLabel(phamData.ten + " " + (dan?.ten || baseId) + " ×" + qty)
              .setDescription("Phẩm: " + phamData.ten + " | Kho: " + qty + " viên"),
          );
        }
        if (!opts.length)
          return void (await P.edit({
            embeds: [warnE("Không có đan dược để cho!")],
            components: [L],
          }));
        const buff = typeof pl.buff_active === "object" && pl.buff_active ? pl.buff_active : {};
        const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
        const choCount = buff.cho_dan_date === today ? buff.cho_dan_count || 0 : 0;
        return void (await P.edit({
          embeds: [
            new EmbedBuilder()
              .setTitle("🎁 Cho Đan Đạo Hữu")
              .setColor(3447003)
              .setDescription(
                "Chọn đan dược muốn cho:\n\nHôm nay đã cho: **" +
                  choCount +
                  "/10 đan**\nTối đa 10 đan/ngày",
              )
              .setFooter({ text: "Menu tự động sau 90s" }),
          ],
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`tuichosel_${t}`)
                .setPlaceholder("🎁 Chọn đan...")
                .addOptions(opts.slice(0, 25)),
            ),
          ],
        }));
      }
      if (n.customId === `tuisel_${t}`) {
        const selectedVals = n.values;
        const pl = await getPlayer(t);
        pendingVutItems = [];
        const lines = [];
        for (const val of selectedVals) {
          const [type, id] = val.split("|");
          let label = id, qty = 0, isFixed = false;
          if (type === "lt") {
            qty = Number((pl.linh_thao || {})[id] || 0);
            const item = LINH_THAO.find(x => x.id === id);
            label = `${item?.emoji || "🌿"} **${item?.ten || id}** ×${qty}`;
          } else if (type === "dd") {
            qty = Number((pl.dan_duoc || {})[id] || 0);
            let baseId = id, pham = "trung";
            for (const p of ["cuc", "thuong", "trung", "ha"])
              if (id.endsWith("_" + p)) { baseId = id.slice(0, -(p.length + 1)); pham = p; break; }
            const dan = DAN_DUOC.find(x => x.id === baseId);
            const phamData = DAN_PHAM[pham] || DAN_PHAM.trung;
            label = `${dan?.emoji || ""}${phamData.emoji} **${phamData.ten} ${dan?.ten || baseId}** ×${qty}`;
          } else if (type === "pl") {
            qty = Number((pl.phu_luc || {})[id] || 0);
            const item = PHU_LUC_DATA.find(x => x.id === id);
            label = `${item?.emoji || "📄"} **${item?.ten || id}** ×${qty}`;
          } else if (type === "bb") {
            isFixed = true;
            const item = BAO_BOI.find(x => x.id === id);
            label = `${CE(item?.ce_name, '🔮')} **${item?.ten || id}**`;
          } else if (type === "bp") {
            isFixed = true;
            const item = BI_PHAP.find(x => x.id === id);
            label = `${CE('bp_' + id, '📜')} **${item?.ten || id}**`;
          } else if (type === "vp") {
            qty = Number((pl.vat_pham || {})[id] || 0);
            const item = LINH_THU_LOOT_ITEMS[id];
            label = `${item?.emoji || "🎒"} **${item?.ten || id}** ×${qty}`;
          }
          if (!isFixed && qty <= 0) continue;
          const needsQtySelect = !isFixed && qty > 1;
          pendingVutItems.push({ type, id, qty, maxQty: qty, needsQtySelect, isFixed, label });
          lines.push(`• ${label}`);
        }
        if (!pendingVutItems.length)
          return void (await P.edit({ embeds: [errE("Vật phẩm không còn trong túi!")], components: [] }), v.stop());
        // Nếu có item stackable cần chọn số lượng → hiện qty buttons
        const firstQtyIdx = pendingVutItems.findIndex(x => x.needsQtySelect);
        if (firstQtyIdx >= 0) {
          S = firstQtyIdx;
          const cur = pendingVutItems[firstQtyIdx];
          const totalNeedsQty = pendingVutItems.filter(x => x.needsQtySelect).length;
          const amounts = [1, 5, 10, 25, 50].filter(n => n < cur.maxQty);
          const btns = amounts.map(n =>
            new ButtonBuilder()
              .setCustomId(`tuivutqty_${t}_${firstQtyIdx}_${n}`)
              .setLabel(`×${n}`)
              .setStyle(ButtonStyle.Secondary)
          );
          btns.push(
            new ButtonBuilder()
              .setCustomId(`tuivutqty_${t}_${firstQtyIdx}_all`)
              .setLabel(`Tất cả ×${cur.maxQty}`)
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`tuihuy_${t}`)
              .setLabel("❌ Hủy")
              .setStyle(ButtonStyle.Secondary),
          );
          const qtyRows = [];
          for (let i = 0; i < btns.length; i += 5)
            qtyRows.push(new ActionRowBuilder().addComponents(btns.slice(i, i + 5)));
          return void (await P.edit({
            embeds: [
              new EmbedBuilder()
                .setTitle(`🗑️ Chọn Số Lượng [1/${totalNeedsQty}]`)
                .setColor(15158332)
                .setDescription(`${cur.label}\n\nMuốn vứt bao nhiêu?`)
                .setFooter({ text: "Menu tự đóng sau 90s" }),
            ],
            components: qtyRows,
          }));
        }
        // Không cần chọn qty → confirm thẳng
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`tuimultivut_${t}`)
            .setLabel(`✅ Xác nhận vứt ${pendingVutItems.length} loại`)
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`tuihuy_${t}`)
            .setLabel("❌ Hủy")
            .setStyle(ButtonStyle.Secondary),
        );
        return void (await P.edit({
          embeds: [
            new EmbedBuilder()
              .setTitle("🗑️ Xác Nhận Vứt Đồ")
              .setColor(15158332)
              .setDescription(
                `Sắp vứt bỏ **${pendingVutItems.length} loại** vật phẩm:\n\n${lines.join("\n")}\n\n${CE('warn_icon','⚠️')} **Đồ đã vứt không thể lấy lại!**`,
              )
              .setFooter({ text: "Menu tự đóng sau 90s" }),
          ],
          components: [confirmRow],
        }));
      }
      if (n.customId.startsWith(`tuivutqty_${t}_`)) {
        if (!pendingVutItems) return;
        const rest = n.customId.slice(`tuivutqty_${t}_`.length);
        const firstUnder = rest.indexOf("_");
        const idx = parseInt(rest.slice(0, firstUnder));
        const amtStr = rest.slice(firstUnder + 1);
        if (isNaN(idx) || !pendingVutItems[idx]) return;
        const cur = pendingVutItems[idx];
        cur.qty = amtStr === "all" ? cur.maxQty : Math.min(parseInt(amtStr) || 1, cur.maxQty);
        cur.needsQtySelect = false;
        // Tìm item tiếp theo cần chọn qty
        const nextIdx = pendingVutItems.findIndex((x, i) => i > idx && x.needsQtySelect);
        if (nextIdx >= 0) {
          S = nextIdx;
          const next = pendingVutItems[nextIdx];
          const doneCount = pendingVutItems.filter((x, i) => i <= nextIdx && !x.needsQtySelect).length;
          const totalNeedsQty = pendingVutItems.filter(x => !x.needsQtySelect || x === next).length;
          const amounts = [1, 5, 10, 25, 50].filter(n => n < next.maxQty);
          const btns = amounts.map(n =>
            new ButtonBuilder()
              .setCustomId(`tuivutqty_${t}_${nextIdx}_${n}`)
              .setLabel(`×${n}`)
              .setStyle(ButtonStyle.Secondary)
          );
          btns.push(
            new ButtonBuilder()
              .setCustomId(`tuivutqty_${t}_${nextIdx}_all`)
              .setLabel(`Tất cả ×${next.maxQty}`)
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`tuihuy_${t}`)
              .setLabel("❌ Hủy")
              .setStyle(ButtonStyle.Secondary),
          );
          const qtyRows = [];
          for (let i = 0; i < btns.length; i += 5)
            qtyRows.push(new ActionRowBuilder().addComponents(btns.slice(i, i + 5)));
          return void (await P.edit({
            embeds: [
              new EmbedBuilder()
                .setTitle(`🗑️ Chọn Số Lượng [${doneCount + 1}/${totalNeedsQty}]`)
                .setColor(15158332)
                .setDescription(`${next.label}\n\nMuốn vứt bao nhiêu?`)
                .setFooter({ text: "Menu tự đóng sau 90s" }),
            ],
            components: qtyRows,
          }));
        }
        // Xong hết → hiện confirm với qty đã chọn
        const lines = pendingVutItems.map(x =>
          x.isFixed ? `• ${x.label}` : `• ${x.label.replace(/×\d+$/, `×${x.qty}`)}`
        );
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`tuimultivut_${t}`)
            .setLabel(`✅ Xác nhận vứt ${pendingVutItems.length} loại`)
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`tuihuy_${t}`)
            .setLabel("❌ Hủy")
            .setStyle(ButtonStyle.Secondary),
        );
        return void (await P.edit({
          embeds: [
            new EmbedBuilder()
              .setTitle("🗑️ Xác Nhận Vứt Đồ")
              .setColor(15158332)
              .setDescription(
                `Sắp vứt bỏ **${pendingVutItems.length} loại** vật phẩm:\n\n${lines.join("\n")}\n\n${CE('warn_icon','⚠️')} **Đồ đã vứt không thể lấy lại!**`,
              )
              .setFooter({ text: "Menu tự đóng sau 90s" }),
          ],
          components: [confirmRow],
        }));
      }
      if (n.customId === `tuimultivut_${t}`) {
        if (!pendingVutItems || !pendingVutItems.length) return;
        const pl = await getPlayer(t);
        const lt = { ...(pl.linh_thao || {}) };
        const dd = { ...(pl.dan_duoc || {}) };
        const plu = { ...(pl.phu_luc || {}) };
        const vp = { ...(pl.vat_pham || {}) };
        for (const item of pendingVutItems) {
          if (item.type === "lt") {
            const cur = Number(lt[item.id] || 0);
            lt[item.id] = Math.max(0, cur - item.qty);
            if (lt[item.id] <= 0) delete lt[item.id];
          } else if (item.type === "dd") {
            const cur = Number(dd[item.id] || 0);
            dd[item.id] = Math.max(0, cur - item.qty);
            if (dd[item.id] <= 0) delete dd[item.id];
          } else if (item.type === "pl") {
            const cur = Number(plu[item.id] || 0);
            plu[item.id] = Math.max(0, cur - item.qty);
            if (plu[item.id] <= 0) delete plu[item.id];
          } else if (item.type === "vp") {
            const cur = Number(vp[item.id] || 0);
            vp[item.id] = Math.max(0, cur - item.qty);
            if (vp[item.id] <= 0) delete vp[item.id];
          } else if (item.type === "bb") {
            await db("UPDATE players SET bao_boi=array_remove(bao_boi,$1) WHERE user_id=$2", [item.id, t]);
          } else if (item.type === "bp") {
            await db("UPDATE players SET bi_phap=array_remove(bi_phap,$1) WHERE user_id=$2", [item.id, t]);
          }
        }
        await db(
          "UPDATE players SET linh_thao=$1, dan_duoc=$2, phu_luc=$3, vat_pham=$4 WHERE user_id=$5",
          [JSON.stringify(lt), JSON.stringify(dd), JSON.stringify(plu), JSON.stringify(vp), t],
        );
        pendingVutItems = null;
        return void (await P.edit({
          embeds: [okE(`🗑️ Đã vứt bỏ thành công! Túi đã được dọn dẹp.`)],
          components: [],
        }), v.stop());
      }
      if (n.customId.startsWith(`tuiqty_${t}_`)) {
        if (!S || !A) return;
        const e = n.customId.slice(`tuiqty_${t}_`.length),
          h = await getPlayer(t);
        if ("lt" === S) {
          const n = { ...(h.linh_thao || {}) },
            i = Number(n[A] || 0),
            a = "all" === e ? i : Math.min(parseInt(e) || 1, i);
          ((n[A] = i - a),
            n[A] <= 0 && delete n[A],
            await db("UPDATE players SET linh_thao=$1 WHERE user_id=$2", [JSON.stringify(n), t]));
          const o = LINH_THAO.find((n) => n.id === A);
          await P.edit({
            embeds: [okE(`🗑️ Vứt bỏ **${a}× ${o?.emoji || ""}${o?.ten || A}** thành công!`)],
            components: [],
          });
        } else if ("dd" === S) {
          const n = { ...(h.dan_duoc || {}) },
            i = Number(n[A] || 0),
            a = "all" === e ? i : Math.min(parseInt(e) || 1, i);
          ((n[A] = i - a),
            n[A] <= 0 && delete n[A],
            await db("UPDATE players SET dan_duoc=$1 WHERE user_id=$2", [JSON.stringify(n), t]),
            await P.edit({
              embeds: [okE(`🗑️ Vứt bỏ **${a}× ${A}** thành công!`)],
              components: [],
            }));
        } else if ("pl" === S) {
          const n = { ...(h.phu_luc || {}) },
            i = Number(n[A] || 0),
            a = "all" === e ? i : Math.min(parseInt(e) || 1, i);
          ((n[A] = i - a),
            n[A] <= 0 && delete n[A],
            await db("UPDATE players SET phu_luc=$1 WHERE user_id=$2", [JSON.stringify(n), t]));
          const o = PHU_LUC_DATA.find((n) => n.id === A);
          await P.edit({
            embeds: [okE(`🗑️ Vứt bỏ **${a}× ${o?.emoji || ""}${o?.ten || A}** thành công!`)],
            components: [],
          });
        } else if ("bb" === S) {
          const n = BAO_BOI.find((n) => n.id === A);
          (await db("UPDATE players SET bao_boi=array_remove(bao_boi,$1) WHERE user_id=$2", [A, t]),
            await P.edit({
              embeds: [
                new EmbedBuilder()
                  .setColor(15158332)
                  .setTitle("🗑️ Vứt Bỏ Linh Bảo")
                  .setDescription(
                    `${n ? CE(n.ce_name, '🔮') : CE('ft_linh_bao','🔮')} **${n?.ten || A}** đã bị vứt đi.\n*-${n?.kg || 0}kg túi trữ vật*`,
                  ),
              ],
              components: [],
            }));
        } else if ("bp" === S) {
          const n = BI_PHAP.find((n) => n.id === A);
          (await db("UPDATE players SET bi_phap=array_remove(bi_phap,$1) WHERE user_id=$2", [A, t]),
            await P.edit({
              embeds: [
                new EmbedBuilder()
                  .setColor(15158332)
                  .setTitle("🗑️ Vứt Bỏ Bí Pháp")
                  .setDescription(`${n ? CE('bp_' + n.id, '📜') : '📜'} **${n?.ten || A}** đã bị xóa khỏi túi.`),
              ],
              components: [],
            }));
        }
        return void v.stop();
      }
      n.customId === `tuihuy_${t}` &&
        (await P.edit({ embeds: [f], components: [L] }), (S = null), (A = null));
    }),
      v.on("end", (n, t) => {
        "time" === t && P.edit({ components: [] }).catch(() => {});
      }));
  });

