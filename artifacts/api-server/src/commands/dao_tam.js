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
  CP_GIA, BP_GIA,
  CG_EMOJI, getNgoTinh, getKhiVanBonus, getNhanQua, getTT,
} = require('../data');
const {
  getDailyMissionState,
  BAG_WEIGHTS, getDanKg, getBagCapacity, calcBagWeight, canAddToBag,
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
const { checkNgheDotPha } = require('./cultivation');
const ADMIN_ID = process.env.ADMIN_ID || '';




reg("dao_tam", ["tam_ma", "tamma", "dt", "daotam"], async (msg, args) => {
    const e = msg.author.id,
      h = (args[0] || "xem").toLowerCase(),
      i = await getPlayer(e);
    if (!i) return msg.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    const a = getTamMa(i.tam_ma);
    if ("xem" === h) {
      const t = getNhanQua(i.nhan_qua || 0),
        e = i.nhan_qua || 0;
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🧿 Đạo Tâm & Nhân Quả")
            .setColor(i.tam_ma >= 40 ? 3447003 : 9109504)
            .addFields(
              {
                name: `${a.emoji} Đạo Tâm — ${a.ten} (${i.tam_ma}/100)`,
                value: `${pBar(Math.max(0, i.tam_ma))}\n*${a.mo_ta}*\n\n${CE("tam_nhan","😇")} **Nhân Đạo** (≥80): +15% Tu Tốc, +10% Thủ\n${CE("tam_trung","😐")} **Trung Dung** (40-79): Bình thường\n${CE("tam_ma","😈")} **Ma Đạo** (0-39): +20% Công, -10% Thủ\n${CE("tam_ac","👿")} **Ác Ma** (<0): +35% Công, -20% Thủ\n\n\`-dao_tam tinh_hoa <lần>\` — 1,000${CE("tult", "💠")}/lần · \`-dao_tam sa_ma <lần>\``,
                inline: !1,
              },
              {
                name: `${t.emoji} Nhân Quả — ${t.ten} (${e >= 0 ? "+" : ""}${e})`,
                value: `${pBar(Math.max(0, Math.min(100, (e + 100) / 2)))}\n*${t.mo_ta}*\n✨ Công Đức: **${i.cong_duc || 0}** · ${CE("tam_ma","😈")} Ma Khí: **${i.ma_khi || 0}**\n${CE("tia_set","⚡")} Thiên Kiếp: ${t.kiep_giam > 0 ? `+${t.kiep_giam}%` : t.kiep_giam < 0 ? `${t.kiep_giam}%` : "Bình thường"} · ${CE("tukv", "🍀")} Khí Vận: ${t.khi_van_bonus >= 0 ? "+" : ""}${t.khi_van_bonus}`,
                inline: !1,
              },
            ),
        ],
      });
    }
    if ("tinh_hoa" === h || "tu_tam" === h) {
      const h = parseInt(args[1]) || 1;
      if (h < 1 || h > 10) return msg.reply({ embeds: [errE("Số lần tịnh hóa: 1-10!")] });
      const a = 1e3 * h;
      if (Number(i.linh_thach) < a)
        return msg.reply({
          embeds: [errE(`Cần **${fmt(a)} ${CE("tult", "💠")}** để tịnh hóa ${h} lần!`)],
        });
      if (i.tam_ma >= 100) return msg.reply({ embeds: [okE("Đạo tâm đã đạt tối cao rồi!")] });
      const o = Math.min(100 - i.tam_ma, 10 * h),
        c = i.tam_ma + o;
      await db(
        "UPDATE players SET tam_ma=$1, linh_thach=linh_thach-$2, nhan_qua=LEAST(100,nhan_qua+$3), cong_duc=cong_duc+$4 WHERE user_id=$5",
        [c, a, h, h, e],
      );
      const _ = getTamMa(c);
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✨ Tịnh Hóa Đạo Tâm")
            .setColor(3447003)
            .setDescription(
              `Đạo Tâm: **${i.tam_ma}** → **${c}** (${_.emoji} ${_.ten})\n⚖️ Công Đức +${h}\n\n-**${fmt(a)} ${CE("tult", "💠")}**`,
            ),
        ],
      });
    }
    if ("pha_binh" === h || "khai_thong" === h) {
      if (!i.binh_canh)
        return msg.reply({
          embeds: [okE("✅ Kinh mạch thông suốt — không có Bình Cảnh nào cần phá!")],
        });
      const t = 1e4;
      if (Number(i.linh_thach) < t)
        return msg.reply({
          embeds: [
            errE(
              `Cần **${fmt(t)} ${CE("tult", "💠")}** để thực hiện Phá Bình Đại Pháp!\nHiện có: **${fmt(i.linh_thach)} ${CE("tult", "💠")}**`,
            ),
          ],
        });
      const h = Math.min(0.85, 0.45 + 0.005 * (i.tam_ma - 20) + 0.003 * (i.cam_ngo || 0));
      return (
        await db("UPDATE players SET linh_thach=linh_thach-$1 WHERE user_id=$2", [t, e]),
        Math.random() < h
          ? (await db("UPDATE players SET binh_canh=FALSE WHERE user_id=$1", [e]),
            msg.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle(`${CE("tia_set","⚡")} Phá Bình Cảnh Thành Công!`)
                  .setColor(65416)
                  .setDescription(
                    `✅ **Bình Cảnh đã bị phá vỡ!** Đường đột phá thông suốt trở lại.\n\n${CE("tip_icon","💡")} Dùng \`-dot_pha\` để tiếp tục đột phá cảnh giới!\n\n-**${fmt(t)} ${CE("tult", "💠")}**`,
                  )
                  .setFooter({ text: `Tỉ lệ: ${Math.round(100 * h)}%` }),
              ],
            }))
          : msg.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle("💔 Phá Bình Cảnh Thất Bại!")
                  .setColor(15158332)
                  .setDescription(
                    `Linh thạch đã tiêu — nhưng bình cảnh chưa tan.\n\n-**${fmt(t)} ${CE("tult", "💠")}**`,
                  )
                  .setFooter({
                    text: `Tỉ lệ: ${Math.round(100 * h)}% | Cảm Ngộ cao → tỉ lệ cao hơn`,
                  }),
              ],
            })
      );
    }
    if ("sa_ma" === h || "nhap_ma" === h) {
      const h = parseInt(args[1]) || 1;
      if (h < 1 || h > 10) return msg.reply({ embeds: [errE("Số lần: 1-10!")] });
      if (i.tam_ma <= -100)
        return msg.reply({
          embeds: [
            new EmbedBuilder().setColor(9109504).setDescription(`${CE("nq_chuong","☠️")} Đã hoàn toàn sa vào ma đạo!`),
          ],
        });
      const a = Math.min(i.tam_ma + 100, 15 * h),
        o = i.tam_ma - a;
      await db(
        "UPDATE players SET tam_ma=$1, nhan_qua=GREATEST(-100,nhan_qua-$2), ma_khi=ma_khi+$3 WHERE user_id=$4",
        [o, 2 * h, 5 * h, e],
      );
      const c = getTamMa(o);
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE("tam_ma","😈")} Đạo Tâm Ô Nhiễm`)
            .setColor(9109504)
            .setDescription(
              `Đạo Tâm: **${i.tam_ma}** → **${o}** (${c.emoji} ${c.ten})\n${CE("tam_ma","😈")} Ma Khí +${5 * h} | Nghiệp Lực -${2 * h}`,
            ),
        ],
      });
    }
    return msg.reply({
      embeds: [errE("`-dao_tam [xem | tinh_hoa <lần> | sa_ma <lần> | pha_binh]`")],
    });
  });

