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

  reg("vut", ["but_do", "buoc_do", "xoa_do", "drop"], async (n, t) => {
    const e = n.author.id,
      h = await getPlayer(e);
    if (!h) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });
    const i = (t[0] || "").toLowerCase(),
      a = (t[1] || "").toLowerCase(),
      o = t[2] || "1",
      c = Math.max(1, parseInt(o) || 1),
      _ = errE(
        "**Cách dùng lệnh vứt đồ:**\n`-vut linh_thao <id> <số>` — Vứt linh thảo\n`-vut dan_duoc <id_phẩm> <số>` — Vứt đan dược *(vd: hoi_phuc_dan_trung)*\n`-vut phu_luc <id> <số>` — Vứt phù lục\n`-vut bao_boi <id>` — Vứt linh bảo\n\n*Dùng `-tui` để xem ID vật phẩm*",
      );
    if ("linh_thao" === i) {
      if (!a) return n.reply({ embeds: [_] });
      const t = { ...(h.linh_thao || {}) },
        i = Number(t[a] || 0);
      if (i <= 0) return n.reply({ embeds: [errE(`Không có **${a}** trong túi!`)] });
      const o = Math.min(c, i);
      ((t[a] = i - o),
        t[a] <= 0 && delete t[a],
        await db("UPDATE players SET linh_thao=$1 WHERE user_id=$2", [JSON.stringify(t), e]));
      const u = LINH_THAO.find((n) => n.id === a),
        r = (o * (u?.kg || 0.3)).toFixed(1);
      return n.reply({
        embeds: [okE(`🗑️ Vứt bỏ **${o}x ${u?.emoji || ""}${u?.ten || a}** — *-${r}kg*`)],
      });
    }
    if ("dan_duoc" === i) {
      if (!a) return n.reply({ embeds: [_] });
      const t = { ...(h.dan_duoc || {}) },
        i = Number(t[a] || 0);
      if (i <= 0)
        return n.reply({
          embeds: [
            errE(
              `Không có **${a}** trong túi!\n*Tên đầy đủ gồm phẩm cấp, ví dụ: \`hoi_phuc_dan_trung\`*`,
            ),
          ],
        });
      const o = Math.min(c, i);
      ((t[a] = i - o),
        t[a] <= 0 && delete t[a],
        await db("UPDATE players SET dan_duoc=$1 WHERE user_id=$2", [JSON.stringify(t), e]));
      const u = getDanKg(a);
      return n.reply({ embeds: [okE(`🗑️ Vứt bỏ **${o}x ${a}** — *-${(o * u).toFixed(1)}kg*`)] });
    }
    if ("phu_luc" === i) {
      if (!a) return n.reply({ embeds: [_] });
      const t = { ...(h.phu_luc || {}) },
        i = Number(t[a] || 0);
      if (i <= 0) return n.reply({ embeds: [errE(`Không có **${a}** trong túi!`)] });
      const o = Math.min(c, i);
      ((t[a] = i - o),
        t[a] <= 0 && delete t[a],
        await db("UPDATE players SET phu_luc=$1 WHERE user_id=$2", [JSON.stringify(t), e]));
      const u = PHU_LUC_DATA.find((n) => n.id === a),
        r = (o * (u?.kg || 0.1)).toFixed(1);
      return n.reply({
        embeds: [okE(`🗑️ Vứt bỏ **${o}x ${u?.emoji || ""}${u?.ten || a}** — *-${r}kg*`)],
      });
    }
    if ("bao_boi" === i || "linh_bao" === i) {
      if (!a) return n.reply({ embeds: [_] });
      if (!(h.bao_boi || []).includes(a))
        return n.reply({ embeds: [errE(`Không có linh bảo **${a}** trong túi!`)] });
      const t = BAO_BOI.find((n) => n.id === a);
      return (
        await db("UPDATE players SET bao_boi=array_remove(bao_boi,$1) WHERE user_id=$2", [a, e]),
        n.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(15158332)
              .setTitle("🗑️ Vứt Bỏ Linh Bảo")
              .setDescription(
                `${t?.pham || "🔮"} **${t?.ten || a}** đã bị vứt đi.\n*-${t?.kg || 0}kg túi trữ vật*\n\n${CE('warn_icon','⚠️')} Linh bảo đã vứt không thể lấy lại!`,
              ),
          ],
        })
      );
    }
    if ("het" === i || "all" === i) {
      // Tính trước những gì sẽ bị xóa
      const danDuocHienTai = h.dan_duoc || {};
      const linhThaoHienTai = h.linh_thao || {};
      const phuLucHienTai = h.phu_luc || {};

      // Giữ lại dan_duoc limited/giftcode_only/special
      const danDuocGiu = {};
      const danDuocXoa = {};
      for (const [id, qty] of Object.entries(danDuocHienTai)) {
        const item = DAN_DUOC.find(x => x.id === id);
        if (item && (item.limited || item.giftcode_only || item.special)) {
          danDuocGiu[id] = qty;
        } else {
          danDuocXoa[id] = qty;
        }
      }

      const soLinhThao = Object.values(linhThaoHienTai).reduce((s, v) => s + Number(v), 0);
      const soDanXoa = Object.values(danDuocXoa).reduce((s, v) => s + Number(v), 0);
      const soPhu = Object.values(phuLucHienTai).reduce((s, v) => s + Number(v), 0);

      if (soLinhThao === 0 && soDanXoa === 0 && soPhu === 0)
        return n.reply({ embeds: [warnE("Túi không có đồ thường nào để vứt!")] });

      const dongXoa = [];
      if (soLinhThao > 0) dongXoa.push(`🌿 **${soLinhThao}x** linh thảo`);
      if (soDanXoa > 0) dongXoa.push(`💊 **${soDanXoa}x** đan dược thường`);
      if (soPhu > 0) dongXoa.push(`📜 **${soPhu}x** phù lục`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`vut_het_confirm_${e}`)
          .setLabel("✅ Xác nhận vứt hết")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`vut_het_cancel_${e}`)
          .setLabel("❌ Hủy")
          .setStyle(ButtonStyle.Secondary),
      );

      const msg = await n.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(15158332)
            .setTitle("🗑️ Vứt Hết Đồ Thường")
            .setDescription(
              `Sắp vứt bỏ toàn bộ đồ **không phải limited** trong túi:\n\n${dongXoa.join("\n")}\n\n` +
              `💎 **Giữ lại:** Đan dược Limited & Giftcode Độc Quyền\n\n` +
              `${CE('warn_icon','⚠️')} Hành động này **không thể hoàn tác!**`,
            ),
        ],
        components: [row],
        fetchReply: true,
      });

      const collector = msg.createMessageComponentCollector({ time: 30000 });
      collector.on("collect", async inter => {
        if (inter.user.id !== e) return inter.reply({ content: "Không phải túi của bạn!", ephemeral: true });
        collector.stop();
        if (inter.customId === `vut_het_cancel_${e}`) {
          return inter.update({ embeds: [warnE("Đã hủy vứt đồ.")], components: [] });
        }
        // Thực hiện xóa
        await db(
          "UPDATE players SET linh_thao=$1, dan_duoc=$2, phu_luc=$3 WHERE user_id=$4",
          [JSON.stringify({}), JSON.stringify(danDuocGiu), JSON.stringify({}), e],
        );
        const dongDaXoa = [];
        if (soLinhThao > 0) dongDaXoa.push(`🌿 ${soLinhThao}x linh thảo`);
        if (soDanXoa > 0) dongDaXoa.push(`💊 ${soDanXoa}x đan dược thường`);
        if (soPhu > 0) dongDaXoa.push(`📜 ${soPhu}x phù lục`);
        return inter.update({
          embeds: [
            new EmbedBuilder()
              .setColor(3066993)
              .setTitle("🗑️ Đã Vứt Hết Đồ Thường")
              .setDescription(
                `Đã dọn sạch túi:\n${dongDaXoa.join("\n")}\n\n` +
                (Object.keys(danDuocGiu).length > 0
                  ? `💎 Giữ lại **${Object.values(danDuocGiu).reduce((s,v)=>s+Number(v),0)}x** đan dược limited/giftcode.`
                  : ""),
              ),
          ],
          components: [],
        });
      });
      collector.on("end", (_, reason) => {
        if (reason === "time") msg.edit({ components: [] }).catch(() => {});
      });
      return;
    }
    return n.reply({ embeds: [_] });
});

