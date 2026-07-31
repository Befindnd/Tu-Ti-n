'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer, awardBiPhap, awardLinhThao } = require('../db/players');
const { CE, CEu } = require('../systems/emoji');
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
  fmt, getCG, pBar, fTime, cdRem, cdRemMin, cdTs, cdTsMin, embedClr,
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
const { calcDotPhaSuccess } = require('../game/cultivation_engine');
const ADMIN_ID = process.env.ADMIN_ID || '';





reg("nghe", ["duong_tu", "dao_phap"], async (n, t) => {
    const e = n.author.id,
      h = (t[0] || "xem").toLowerCase();
    if ("xem" === h || "list" === h) {
      const t = {
          exp_bonus: "Tu Tốc",
          atk_bonus: "Công Lực",
          def_bonus: "Thủ Lực",
          crit: "Bạo Kích",
          drop_bonus: "Cơ Duyên",
        },
        h = await getPlayer(e),
        i = h?.nghe,
        a = Object.entries(NGHE).map(([n, e]) => {
          const a = Object.entries(e.bonus)
              .map(([n, e]) => `+${Math.round(100 * e)}% ${t[n] || n}`)
              .join(" · "),
            c = i === n ? " ◀" : "",
            _ = h && h.thien_phu_nghe === n ? " ✨" : "";
          return `${e.emoji} **${e.ten}** \`${n}\`${c}${_}\n┗ ${a} | *${e.mo_ta}*`;
        }),
        o = new EmbedBuilder()
          .setTitle("🌌 Đạo Pháp — Con Đường Tu Luyện")
          .setColor(1752220)
          .setDescription(
            (h
              ? `📌 Đang tu: ${NGHE[i]?.emoji || "？"} **${NGHE[i]?.ten || "Chưa chọn"}**` +
                (h.ve_doi_nghe > 0 ? ` · ${CE("ve_nghe","🎫")} ${h.ve_doi_nghe} Vé` : "") +
                "\n"
              : "") +
              `\`-nghe chon <id>\` — Chọn *(miễn phí lần đầu)* · \`-nghe doi <id>\` — Đổi *(50k ${CE("tult", "💠")})*\n\`-nghe_info\` — Xem chi tiết nghề hiện tại\n${SEP}\n` +
              a.join("\n"),
          );
      return n.reply({ embeds: [o] });
    }
    if ("chon" === h) {
      const h = (t[1] || "").toLowerCase();
      if (!NGHE[h])
        return n.reply({
          embeds: [errE(`Đạo Pháp \`${h}\` không tồn tại!\nDùng \`-nghe xem\` để xem danh sách.`)],
        });
      const i = await getPlayer(e);
      if (!i) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });
      if (i.nghe === h)
        return n.reply({ embeds: [warnE(`Ngươi đã chọn **${NGHE[h].ten}** rồi!`)] });
      return i.nghe_locked
          ? n.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle(`${CE('lock_icon','🔒')} Đường Tu Đã Định!`)
                  .setColor(15158332)
                  .setDescription(
                    `*Đã chọn đường tu rồi, không thể thay đổi tùy tiện...*\n\nĐường Tu hiện tại: **${NGHE[i.nghe]?.emoji} ${NGHE[i.nghe]?.ten || i.nghe}**\n\n${CE("tip_icon","💡")} Dùng \`-nghe doi <id>\` để đổi đường tu *(tốn 50,000 ${CE("tult", "💠")})*`,
                  ),
              ],
            })
          : (await db("UPDATE players SET nghe=$1, nghe_locked=TRUE WHERE user_id=$2", [h, e]),
            n.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle(`${NGHE[h].emoji} Chọn Đường Tu — ${NGHE[h].ten}`)
                  .setColor(1752220)
                  .setDescription(
                    `*Thiên mệnh đã định, đường tu đã rõ...*\n\n✅ Ngươi đã chọn **${NGHE[h].emoji} ${NGHE[h].ten}**!\n*${NGHE[h].mo_ta}*\n\n${CE('warn_icon','⚠️')} Đây là lần chọn đầu tiên — **không thể đổi miễn phí**.\nDùng \`-nghe doi <id>\` để đổi sau *(50,000 ${CE("tult", "💠")})*.`,
                  ),
              ],
            }));
    }
    if ("doi" === h) {
      const h = (t[1] || "").toLowerCase();
      if (!NGHE[h])
        return n.reply({
          embeds: [errE(`Đạo Pháp \`${h}\` không tồn tại!\nDùng \`-nghe xem\` để xem danh sách.`)],
        });
      const i = await getPlayer(e);
      if (!i) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });
      if (i.nghe === h)
        return n.reply({ embeds: [warnE(`Ngươi đã đang dùng **${NGHE[h].ten}** rồi!`)] });
      const o = NGHE[i.nghe];
      if (Number(i.ve_doi_nghe || 0) > 0)
        return (
          await db(
            "UPDATE players SET nghe=$1, nghe_locked=TRUE, ve_doi_nghe=GREATEST(0,ve_doi_nghe-1) WHERE user_id=$2",
            [h, e],
          ),
          n.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`${CE("ve_nghe","🎫")} Đổi Đường Tu — Dùng Vé Đổi Nghề`)
                .setColor(3066993)
                .setDescription(
                  `*Vé Đổi Nghề tan thành ánh sáng vàng, đạo tâm chuyển hóa...*\n\n${o?.emoji} **${o?.ten || "Chưa có"}** → ${NGHE[h].emoji} **${NGHE[h].ten}**\n*${NGHE[h].mo_ta}*\n\n${CE("ve_nghe","🎫")} **-1 Vé Đổi Nghề** *(miễn phí linh thạch!)*\n${CE("ni_dac_ky","⭐")} **Đặc Kỹ:** ${NGHE[h].dac_ky}`,
                ),
            ],
          })
        );
      const c = 5e4;
      return Number(i.linh_thach) < c
        ? n.reply({
            embeds: [
              errE(
                `Cần **${fmt(c)} ${CE("tult", "💠")}** *(hoặc ${CE('ve_nghe','🎫')} Vé Đổi Nghề)* để đổi đường tu!\nHiện có: **${fmt(i.linh_thach)} ${CE("tult", "💠")}**\n${CE("tip_icon","💡")} Vé Đổi Nghề có thể nhận qua Giftcode đặc biệt!`,
              ),
            ],
          })
        : (await db(
            "UPDATE players SET nghe=$1, nghe_locked=TRUE, linh_thach=linh_thach-$2 WHERE user_id=$3",
            [h, c, e],
          ),
          n.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("🔄 Đổi Đường Tu")
                .setColor(15965202)
                .setDescription(
                  `*Trải qua dằng dặc tu hành, đạo tâm bỗng thay đổi...*\n\n${o?.emoji} **${o?.ten || "Chưa có"}** → ${NGHE[h].emoji} **${NGHE[h].ten}**\n*${NGHE[h].mo_ta}*\n\n${CE("ni_dac_ky","⭐")} **Đặc Kỹ:** ${NGHE[h].dac_ky}\n\n-**${fmt(c)} ${CE("tult", "💠")}**`,
                ),
            ],
          }));
    }
    return n.reply({
      embeds: [
        errE(
          "`-nghe xem` — Xem Đạo Pháp\n`-nghe chon <id>` — Chọn Đạo Pháp *(1 lần miễn phí)*\n`-nghe doi <id>` — Đổi Đạo Pháp *(50,000 " +
            CE("tult", "💠") +
            ` hoặc ${CE("ve_nghe","🎫")} Vé)*`,
        ),
      ],
    });
});

reg("nghe_info", ["ni", "nghethongtin", "nghe_tt", "ngheinfo", "ho_so_nghe", "hsn", "hsnge", "hoso_nghe"], async (n) => {
  const uid = n.author.id;
  const e = await getPlayer(uid, n.author.username);
  if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });
  if (!e.nghe)
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("❓ Chưa Chọn Nghề")
          .setColor(0x95A5A6)
          .setDescription(
            `*Ngươi chưa bước vào một con đường tu hành cụ thể...*\n\n` +
            `${CE("tip_icon","💡")} Dùng **\`-nghe xem\`** để xem danh sách các nghề.\n` +
            `${CE("tip_icon","💡")} Dùng **\`-nghe chon <id>\`** để chọn nghề *(1 lần miễn phí)*.\n\n` +
            `${CE('warn_icon','⚠️')} Cần có Nghề mới có thể **đột phá cảnh giới**!`,
          ),
      ],
    });

  const NGHE_COLOR = {
    luyen_dan:  0xF0A500,
    luyen_khi:  0x3498DB,
    phu_luc:    0x9B59B6,
    an_sat:     0xE74C3C,
    phong_thuy: 0x1ABC9C,
    duoc_su:    0x2ECC71,
    ngo_dao_su: 0x8E44AD,
  };

  const h = NGHE[e.nghe];
  const bonusTen = { exp_bonus: "Tu Tốc", atk_bonus: "Công Lực", def_bonus: "Thủ Lực", crit: "Bạo Kích", drop_bonus: "Cơ Duyên" };
  const bonusStr = Object.entries(h.bonus)
    .map(([k, v]) => `\`+${Math.round(100 * v)}%\` ${bonusTen[k] || k}`)
    .join("  ·  ");

  // ── Thiên Phú ──────────────────────────────────────────────────────────
  let tpField = null;
  if (e.thien_phu_nghe === e.nghe && NGHE[e.thien_phu_nghe]) {
    const tp = NGHE[e.thien_phu_nghe];
    tpField = { name: `✨ Thiên Phú: ${tp.thien_phu_ten}`, value: `*${tp.thien_phu_mo_ta}*`, inline: false };
  } else if (e.thien_phu_nghe && e.thien_phu_nghe !== e.nghe && NGHE[e.thien_phu_nghe]) {
    const tp = NGHE[e.thien_phu_nghe];
    tpField = { name: `💤 Thiên Phú (không hoạt động)`, value: `**${tp.thien_phu_ten}** — dành cho ${NGHE[e.thien_phu_nghe].emoji} ${NGHE[e.thien_phu_nghe].ten}`, inline: false };
  }

  // ── CD helpers ─────────────────────────────────────────────────────────
  const cdStr = (ts, minutes) => {
    const rem = cdRemMin(ts, minutes);
    return rem > 0 ? `${CE("cd_timer","⏳")} ${cdTsMin(ts, minutes)}` : "✅ Sẵn sàng";
  };
  const cdMsStr = (ts, ms) => {
    const rem = Math.max(0, Number(ts || 0) - Date.now());
    return rem > 0 ? `${CE("cd_timer","⏳")} <t:${Math.floor(Number(ts||0)/1000)}:R>` : "✅ Sẵn sàng";
  };

  // ── Resource / cooldown fields per nghề ───────────────────────────────
  let resourceFields = [];
  switch (e.nghe) {
    case "luyen_dan": {
      const dan = e.dan_duoc || {};
      const tongDan = Object.values(dan).reduce((s, v) => s + Number(v || 0), 0);
      const coPham = Object.entries(dan).some(([k, v]) => k.includes("_cuc") && Number(v) > 0);
      const buff = typeof e.buff_active === 'object' && e.buff_active ? e.buff_active : {};
      resourceFields = [
        { name: `${CE("ni_dan_duoc","⚗️")} Kho Đan Dược`, value: `**${tongDan}** viên${coPham ? " · ✨ Có **Cực Phẩm**" : ""}`, inline: true },
        { name: `${CE("ni_kiem_linh_thao","🌿")} -kiem_linh_thao`, value: cdStr(e.kiem_thao_cd, 30), inline: true },
        { name: `${CE("ni_dan_duoc","⚗️")} -luyen_dan`, value: "Luyện đan mới", inline: true },
        { name: `${CE("ni_vien_dan","💊")} -dung_dan`, value: "Dùng đan dược", inline: true },
        { name: `${CE("ni_ban_dan","🏪")} -ban_dan`, value: "Bán đan NPC (50% hoàn phí)", inline: true },
        { name: `${CE("ni_tang_dan","🎁")} -tang_dan`, value: cdRem(buff.tang_dan_cd, 2) ? `${CE("cd_timer","⏳")} ${cdTs(buff.tang_dan_cd, 2)}` : "✅ Sẵn sàng", inline: true },
      ];
      break;
    }
    case "luyen_khi": {
      const khoang = e.khoang_vat || {};
      const satTinh = Number(khoang.sat_tinh || 0);
      const buff = typeof e.buff_active === 'object' && e.buff_active ? e.buff_active : {};
      resourceFields = [
        { name: `${CE("ni_phi_khi","🔱")} Phi Khí`, value: `Cấp **+${e.vu_khi_cap || 0}** / +10`, inline: true },
        { name: `${CE("ni_sat_tinh","⚙️")} Sắt Tinh`, value: `**${satTinh}** khối`, inline: true },
        { name: `${CE("ni_khai_quang","⛏️")} -khai_quang`, value: cdStr(e.khai_quang_cd, 60), inline: true },
        { name: `${CE("ni_ren_luyen","🔨")} -ren_luyen`, value: "Tôi luyện phi khí", inline: true },
        { name: `${CE("ni_sac_ben","⚡")} -sac_ben`, value: (buff.sac_ben_charges || 0) > 0 ? "⚡ Active (+20% ATK)" : cdRem(buff.sac_ben_cd, 2) ? `${CE("cd_timer","⏳")} ${cdTs(buff.sac_ben_cd, 2)}` : "✅ Sẵn sàng", inline: true },
        { name: `${CE("ni_phi_khi","🔱")} -bo_khi`, value: cdRem(buff.bo_khi_cd, 3) ? `${CE("cd_timer","⏳")} ${cdTs(buff.bo_khi_cd, 3)}` : "✅ Sẵn sàng", inline: true },
      ];
      break;
    }
    case "phu_luc": {
      const pl = e.phu_luc || {};
      const tongPhu = Object.values(pl).reduce((s, v) => s + Number(v || 0), 0);
      const buff = typeof e.buff_active === 'object' && e.buff_active ? e.buff_active : {};
      resourceFields = [
        { name: `${CE("ni_phu_luc","📜")} Kho Phù Lục`, value: `**${tongPhu}** tờ`, inline: true },
        { name: `${CE("ni_ve_phu","✍️")} -ve_phu`, value: "Vẽ phù mới", inline: true },
        { name: `${CE("ni_dung_phu","🔖")} -dung_phu <id>`, value: "Kích hoạt phù", inline: true },
        { name: `${CE("ni_phu_pham","📦")} -phu_pham`, value: "Xem kho phù", inline: true },
        { name: `${CE("ni_ve_phong_an","🛡️")} -ve_phong_an`, value: cdRem(buff.ve_phong_an_cd, 3) ? `${CE("cd_timer","⏳")} ${cdTs(buff.ve_phong_an_cd, 3)}` : "✅ Sẵn sàng", inline: true },
        { name: `${CE("ni_phu_bo_tro","🤝")} -phu_bo_tro @người`, value: cdRem(buff.phu_bo_tro_cd, 2) ? `${CE("cd_timer","⏳")} ${cdTs(buff.phu_bo_tro_cd, 2)}` : "✅ Sẵn sàng", inline: true },
      ];
      break;
    }
    case "an_sat": {
      const buff = typeof e.buff_active === 'object' && e.buff_active ? e.buff_active : {};
      const satYActive = Number(buff.sat_y_until || 0) > Date.now();
      const anNguActive = Number(e.an_ngu_until || 0) > Date.now();
      resourceFields = [
        { name: `${CE("ni_pvp","⚔️")} Thắng PvP`, value: `**${e.pvp_wins || 0}** trận *(đột phá cần ≥3)*`, inline: true },
        { name: `${CE("ni_am_sat","🗡️")} -am_sat @người`, value: cdStr(e.am_sat_cd, 45), inline: true },
        { name: `${CE("ni_an_ngu","😴")} -an_ngu`, value: anNguActive ? `🛡️ Ẩn mình còn ${fTime(Math.ceil((Number(e.an_ngu_until) - Date.now()) / 1000))}` : "✅ Sẵn sàng", inline: true },
        { name: `${CE("ni_trinh_sat","🕵️")} -trinh_sat @người`, value: cdStr(buff.trinh_sat_cd || 0, 30), inline: true },
        { name: `${CE("ni_xa_tinh","🏹")} -xa_tinh`, value: cdRem(buff.xa_tinh_cd, 2) ? `${CE("cd_timer","⏳")} ${cdTs(buff.xa_tinh_cd, 2)}` : "✅ Sẵn sàng", inline: true },
        { name: `${CE("ni_sat_y","🌑")} -sat_y`, value: satYActive ? `⚡ Active (+12% Crit)` : cdRem(buff.sat_y_cd, 6) ? `${CE("cd_timer","⏳")} ${cdTs(buff.sat_y_cd, 6)}` : "✅ Sẵn sàng", inline: true },
      ];
      break;
    }
    case "phong_thuy": {
      const buff = typeof e.buff_active === 'object' && e.buff_active ? e.buff_active : {};
      resourceFields = [
        { name: `${CE("ni_khi_van","🌬️")} Khí Vận`, value: `**${e.khi_van || 30}** *(≥60 → +5% đột phá)*`, inline: true },
        { name: `${CE("ni_boi","🔮")} -phong_thuy boi`, value: cdStr(e.phong_thuy_cd, 90), inline: true },
        { name: `${CE("ni_khai_van","🌟")} -khai_van`, value: cdStr(e.khai_van_cd, 180), inline: true },
        { name: `${CE("ni_tien_tri","🔭")} -tien_tri`, value: cdRem(buff.tien_tri_cd, 3) ? `${CE("cd_timer","⏳")} ${cdTs(buff.tien_tri_cd, 3)}` : "✅ Sẵn sàng", inline: true },
        { name: `${CE("ni_tran_van","⛅")} -tran_van`, value: cdRem(buff.tran_van_cd, 5) ? `${CE("cd_timer","⏳")} ${cdTs(buff.tran_van_cd, 5)}` : "✅ Sẵn sàng", inline: true },
        { name: `${CE("ni_cau_phuc","🤝")} -cau_phuc @người`, value: cdRem(buff.cau_phuc_cd, 4) ? `${CE("cd_timer","⏳")} ${cdTs(buff.cau_phuc_cd, 4)}` : "✅ Sẵn sàng", inline: true },
      ];
      break;
    }
    case "duoc_su": {
      const hpPct = Math.round((Number(e.hp) / Math.max(1, Number(e.hp_max))) * 100);
      const buff = typeof e.buff_active === 'object' && e.buff_active ? e.buff_active : {};
      resourceFields = [
        { name: `${CE("ni_than_the","❤️")} Thần Thể`, value: `HP **${hpPct}%** · Đạo Thương: **${e.dao_thuong > 0 ? `Cấp ${e.dao_thuong} ${CE('warn_icon','⚠️')}` : "Không ✅"}**`, inline: false },
        { name: `${CE("ni_chua_thuong","💉")} -chua_thuong`, value: cdStr(e.chua_thuong_cd, Number(e.la_ma_tu) ? 300 : 600), inline: true },
        { name: "🧪 -luyen_thuoc", value: cdStr(e.luyen_thuoc_cd, 45), inline: true },
        { name: `${CE("ni_che_doc","☠️")} -che_doc @người`, value: cdRem(buff.che_doc_cd, 3) ? `${CE("cd_timer","⏳")} ${cdTs(buff.che_doc_cd, 3)}` : "✅ Sẵn sàng", inline: true },
        { name: `${CE("ni_giai_doc","💊")} -giai_doc`, value: cdRem(buff.giai_doc_cd, 1) ? `${CE("cd_timer","⏳")} ${cdTs(buff.giai_doc_cd, 1)}` : "✅ Sẵn sàng", inline: true },
        { name: "🏥 -kham_benh @người", value: "Khám đạo thương", inline: true },
      ];
      break;
    }
    case "ngo_dao_su": {
      const nt = Number(e.ngo_tinh || 50);
      const coTP = e.thien_phu_nghe === "ngo_dao_su";
      const buff = typeof e.buff_active === 'object' && e.buff_active ? e.buff_active : {};
      resourceFields = [
        { name: `${CE("ni_ngo_tinh","🌀")} Ngộ Tính`, value: `**${nt}** *(bonus đột phá tối đa +8%)*`, inline: true },
        { name: `${CE("ni_binh_canh","🧱")} Bình Cảnh`, value: e.binh_canh ? `${CE('warn_icon','⚠️')} Có · NT>${coTP?50:70} · ĐT≥${coTP?60:80} · CN≥80%` : "✅ Không có", inline: true },
        { name: `${CE("ni_dai_ngo","🧘")} -dai_ngo`, value: cdMsStr(buff.dai_ngo_cd, 8*3600*1000), inline: true },
        { name: `${CE("ni_thach_ngo","🪨")} -thach_ngo`, value: cdMsStr(buff.thach_ngo_cd, 16*3600*1000), inline: true },
        { name: `${CE("ni_truyen_dao","☯️")} -truyen_dao @người`, value: cdRem(buff.truyen_dao_cd, 6) ? `${CE("cd_timer","⏳")} ${cdTs(buff.truyen_dao_cd, 6)}` : "✅ Sẵn sàng", inline: true },
        { name: `${CE("ni_ngo_tinh","🌀")} -cong_huong`, value: cdRem(buff.cong_huong_cd, 4) ? `${CE("cd_timer","⏳")} ${cdTs(buff.cong_huong_cd, 4)}` : "✅ Sẵn sàng", inline: true },
      ];
      break;
    }
    default:
      resourceFields = [];
  }

  // ── Điều kiện đột phá ──────────────────────────────────────────────────
  const ngheCheck = checkNgheDotPha(e);
  let dotPhaStr;
  if (ngheCheck.ok) {
    const bonusPct = Math.round(100 * (ngheCheck.bonus || 0));
    const rate = Math.round(100 * calcDotPhaSuccess(e, ngheCheck));
    dotPhaStr = `✅ **Đủ điều kiện**${bonusPct > 0 ? ` · Bonus nghề: **+${bonusPct}%**` : ""}\n📊 Tỉ lệ thành công: **~${rate}%** *(Cảm Ngộ ${e.cam_ngo || 0}%)*`;
  } else {
    dotPhaStr = `❌ **Chưa đủ:**\n${ngheCheck.msg}`;
  }

  const veStr = Number(e.ve_doi_nghe || 0) > 0 ? `  · ${CE("ve_nghe","🎫")} ${e.ve_doi_nghe} Vé đổi nghề` : "";

  const embed = new EmbedBuilder()
    .setTitle(`${h.emoji} ${h.ten}`)
    .setColor(NGHE_COLOR[e.nghe] ?? 0x1752220)
    .setThumbnail(n.author.displayAvatarURL())
    .setDescription(`*${h.mo_ta}*`)
    .addFields(
      { name: "✦ Passive Bonus", value: bonusStr + veStr, inline: false },
      { name: `${CE("ni_dac_ky","⭐")} Đặc Kỹ`, value: h.dac_ky, inline: false },
    );

  if (tpField) embed.addFields(tpField);
  for (const f of resourceFields) embed.addFields(f);
  embed.addFields({ name: "─── Điều Kiện Đột Phá ───", value: dotPhaStr, inline: false });
  embed.setFooter({ text: `Tầng ${e.canh_gioi}/39 · Cảm Ngộ ${e.cam_ngo||0}% · Đạo Tâm ${e.tam_ma} | Đổi: -nghe doi <id> · 50k 💠 hoặc ${CEu("ve_nghe","🎫")} Vé` });

  return n.reply({ embeds: [embed] });
});

