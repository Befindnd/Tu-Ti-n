'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { db } = require('../db/pool');
const { awardDanhVong, DV_POINTS } = require('../utils/danh_vong');
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
  reg("nhiem_vu", ["nv", "quest", "mission", "nhiemvu"], async (n, t) => {
    const e = n.author.id,
      h = await getPlayer(e, n.author.username);
    if (!h) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });
    const i = getDailyMissionState(h),
      a = i.claimed || [],
      o = (t[0] || "xem").toLowerCase();

    if ("xem" === o || "list" === o || "ds" === o || "xem" === o) {
      const done = Math.min(a.length, NHIEM_VU_LIST.length),
        total = NHIEM_VU_LIST.length,
        pct = Math.round((done / total) * 100),
        barLen = 12,
        filled = Math.min(barLen, Math.max(0, Math.round((done / total) * barLen))),
        bar = "█".repeat(filled) + "░".repeat(barLen - filled),
        allDone = a.length >= total;

      // Tính tổng thưởng còn lại có thể nhận
      let totalLT = 0, totalExpPct = 0;
      for (const nv of NHIEM_VU_LIST) {
        if (!a.includes(nv.id)) {
          totalLT += nv.phan_thuong.linh_thach;
          totalExpPct += nv.phan_thuong.exp_pct;
        }
      }
      const totalExpVal = Math.floor(calcEXP_active(h) * totalExpPct);

      // Build từng dòng nhiệm vụ
      const lines = NHIEM_VU_LIST.map((nv) => {
        const claimed = a.includes(nv.id),
          ready = !!nv.trust_based || nv.kiem_tra(h),
          lt = nv.phan_thuong.linh_thach,
          expVal = Math.floor(calcEXP_active(h) * nv.phan_thuong.exp_pct),
          statusIcon = claimed ? "✅" : ready ? "🎁" : "⬜",
          rewardStr = `${CE("tult","💠")} ${fmt(lt)} · ${CE("tutv","📈")} ${fmt(expVal)} TV`,
          claimHint = claimed ? "" : ready ? `  ← \`-nv thu ${nv.id}\`` : "";
        return `${statusIcon} **${nv.emoji} ${nv.ten}**  ${rewardStr}${claimHint}\n   └ *${nv.mo_ta}*`;
      });

      const headerColor = allDone ? 0xf1c40f : done > 0 ? 0x5865f2 : 0x2f3136;
      const progressLine = allDone
        ? `\`${bar}\` **${done}/${total}** — 🌟 Hoàn thành tất cả!`
        : `\`${bar}\` **${done}/${total}** (${pct}%) · Còn lại: ${CE("tult","💠")} **${fmt(totalLT)}** · ${CE("tutv","📈")} **${fmt(totalExpVal)}** TV`;

      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("📋 Nhiệm Vụ Hằng Ngày")
            .setColor(headerColor)
            .setDescription(
              `${progressLine}\n${SEP2}\n\n${lines.join("\n\n")}\n\n${SEP2}\n› \`-nv thu <id>\` nhận thưởng · Reset lúc **00:00** giờ VN`
            )
            .setFooter({ text: `${n.author.username} · ${done}/${total} nhiệm vụ hôm nay` })
            .setTimestamp(),
        ],
      });
    }

    if ("thu" === o || "nhan" === o) {
      const nvId = (t[1] || "").toLowerCase(),
        nv = NHIEM_VU_LIST.find((x) => x.id === nvId);
      if (!nv)
        return n.reply({
          embeds: [errE(`Không có nhiệm vụ \`${nvId}\`!\nDùng \`-nv xem\` để xem danh sách.`)],
        });
      if (a.includes(nvId))
        return n.reply({
          embeds: [warnE(`Đã nhận thưởng **${nv.ten}** hôm nay rồi!\nQuay lại ngày mai nhé.`)],
        });
      if (!nv.trust_based && !nv.kiem_tra(h))
        return n.reply({
          embeds: [warnE(`Chưa hoàn thành **${nv.ten}** hôm nay!\n📌 ${nv.mo_ta}`)],
        });

      const ltBase = nv.phan_thuong.linh_thach,
        ltGain = calcMaxLinhThach(h, ltBase),
        expGain = Math.floor(calcEXP_active(h) * nv.phan_thuong.exp_pct),
        capped = ltGain < ltBase;

      a.push(nvId);
      i.claimed = a;
      await db(
        "UPDATE players SET linh_thach=linh_thach+$1, exp=exp+$2, daily_missions=$3 WHERE user_id=$4",
        [ltGain, expGain, JSON.stringify(i), e],
      );
      awardDanhVong(e, DV_POINTS.MISSION_CLAIM);

      const remaining = Math.max(0, NHIEM_VU_LIST.length - a.length),
        allDone = remaining === 0;

      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${nv.emoji} ${nv.ten} — Hoàn Thành!`)
            .setColor(allDone ? 0xf1c40f : 0x57f287)
            .setDescription(
              `${SEP2}\n\n${CE("tult","💠")} +**${fmt(ltGain)}** Linh Thạch${capped ? ` *(túi đầy, tối đa ${fmt(ltGain)}/${fmt(ltBase)})*` : ""}\n${CE("tutv","📈")} +**${fmt(expGain)}** Tu Vi\n\n${SEP2}\n\n` +
              (allDone
                ? "🌟 **Xuất sắc! Hoàn thành toàn bộ nhiệm vụ hôm nay!**"
                : `Còn **${remaining}** nhiệm vụ · \`-nv xem\` để xem danh sách`)
            )
            .setFooter({ text: `Tiến độ: ${a.length}/${NHIEM_VU_LIST.length} nhiệm vụ hôm nay` }),
        ],
      });
    }

    return n.reply({
      embeds: [errE("`-nv xem` — Xem danh sách nhiệm vụ\n`-nv thu <id>` — Nhận thưởng")],
    });
  });