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
  tinhCS,
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


const {
  SU_KIEN_TU,
  calcTuLuyenResult,
  calcDotPhaSuccess,
  buildVuotKiepTable,
  rollVuotKiepResult,
} = require('../game/cultivation_engine');

const TU_LUYEN_CD_H = 1;
const { checkNgheDotPha } = require('./cultivation');


  reg("vuot_kiep", ["vk", "thien_kiep", "vuotkiep"], async (n) => {
    const t = n.author.id,
      e = await getPlayer(t);
    if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });
    const h = CANH_GIOI[e.canh_gioi + 1];
    if (!h || !THIEN_KIEP_NGUONG.has(h.cap) || Number(e.exp) < h.exp_can)
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🌩 Chưa Đến Ngưỡng Thiên Kiếp")
            .setColor(9807270)
            .setDescription(
              "*Ngươi chưa tích lũy đủ tu vi để đối mặt với Thiên Kiếp!*\n\nThiên Kiếp chỉ xảy ra khi đột phá tầng: **10, 14, 18, 22, 26, 30, 34, 38, 39**\n\nTiếp tục dùng `-tu_luyen` để tích lũy tu vi.",
            ),
        ],
      });
    const kiep_cd_remain = Math.max(0, Number(e.vuot_kiep_cd || 0) - Date.now());
    if (kiep_cd_remain > 0)
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE("cd_timer","⏳")} Thiên Kiếp Chưa Tái Hiện`)
            .setColor(15105570)
            .setDescription(
              `*Thiên địa linh khí chưa kịp tụ — Thiên Kiếp cần thời gian để hình thành trở lại!*\n\n${CE("cd_timer","⏳")} Có thể thử lại sau: <t:${Math.floor(Number(e.vuot_kiep_cd || 0) / 1000)}:R> (lúc <t:${Math.floor(Number(e.vuot_kiep_cd || 0) / 1000)}:t>)`,
            ),
        ],
      });
    if (e.la_ma_tu ? e.tam_ma < -20 : e.tam_ma < 30) {
      const t = e.la_ma_tu
        ? `*Ma Tâm lún quá sâu — đương đầu Thiên Kiếp trong trạng thái này chỉ là tự diệt!*\n\n📊 Ma Tâm hiện tại: **${e.tam_ma}** | Yêu cầu: **≥ -20**\n\n${CE("tip_icon","💡")} Dùng \`-dao_tam tinh_hoa <lần>\` để ổn định tâm thần (1,000 ${CE("tult", "💠")}/lần, +10 điểm)`
        : `*Nội tâm còn nhiễu loạn — đương đầu Thiên Kiếp lúc này chỉ là cầu tử!*\n\n📊 Đạo Tâm hiện tại: **${e.tam_ma}** | Yêu cầu: **≥ 30**\n\n${CE("tip_icon","💡")} Dùng \`-dao_tam tinh_hoa <lần>\` để tịnh hóa (1,000 ${CE("tult", "💠")}/lần, +10 điểm)`;
      return n.reply({
        embeds: [
          new EmbedBuilder().setTitle(`${CE("tam_ma","😈")} Đạo Tâm Không Đủ!`).setColor(15158332).setDescription(t),
        ],
      });
    }
    // ── Linh Thạch Trung/Cao cho Thiên Kiếp cao cấp ─────────────────────
    // tier 26+ (Hợp Thể): 1 Trung | tier 30+ (Đại Thừa): 2 Trung | tier 34+ (Độ Kiếp): 1 Cao | tier 38+ (Tiên Nhân): 2 Cao | tier 39: 3 Cao
    const vk_trung_can = h.cap === 26 ? 1 : h.cap === 30 ? 2 : 0;
    const vk_cao_can   = h.cap === 34 ? 1 : h.cap >= 38 && h.cap < 39 ? 2 : h.cap === 39 ? 3 : 0;
    if (vk_trung_can > 0 && Number(e.linh_thach_trung || 0) < vk_trung_can)
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(9699539)
            .setTitle("🔮 Linh Thạch Trung Không Đủ!")
            .setDescription(
              `*Thiên Kiếp **${h.ten}** đòi hỏi sức mạnh linh thạch thượng phẩm làm vật dẫn!*\n\n` +
              `${CE("tult_trung","🔮")} Cần: **${vk_trung_can} Linh Thạch Trung** | Hiện có: **${Number(e.linh_thach_trung||0)}**\n\n` +
              `*Quy đổi: \`-tb\` → tab ${CE('tult','💠')} Linh Thạch (5.000 Linh Thạch = 1 Trung)*`,
            ),
        ],
      });
    if (vk_cao_can > 0 && Number(e.linh_thach_cao || 0) < vk_cao_can)
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(5025616)
            .setTitle("💚 Linh Thạch Cao Không Đủ!")
            .setDescription(
              `*Thiên Kiếp **${h.ten}** đòi hỏi linh thạch thiên phẩm để ổn định kinh mạch!*\n\n` +
              `${CE("tult_cao","💚")} Cần: **${vk_cao_can} Linh Thạch Cao** | Hiện có: **${Number(e.linh_thach_cao||0)}**\n\n` +
              `*Quy đổi: \`-tb\` → tab ${CE('tult','💠')} Linh Thạch (10 Trung = 1 Cao)*`,
            ),
        ],
      });
    // ── Delegate table building + roll to cultivation_engine ─────────────
    // Trừ Trung/Cao (vật tế thiên — atomic guard chống race condition)
    if (vk_trung_can > 0) {
      const rvk2 = await db(
        "UPDATE players SET linh_thach_trung=linh_thach_trung-$1 WHERE user_id=$2 AND linh_thach_trung>=$1 RETURNING linh_thach_trung",
        [vk_trung_can, t],
      );
      if (!rvk2.rows.length)
        return n.reply({ embeds: [errE(`Linh Thạch Trung đã thay đổi — không đủ ${vk_trung_can} ${CE("tult_trung","🔮")} để vượt kiếp!`)] });
    }
    if (vk_cao_can > 0) {
      const rvk3 = await db(
        "UPDATE players SET linh_thach_cao=linh_thach_cao-$1 WHERE user_id=$2 AND linh_thach_cao>=$1 RETURNING linh_thach_cao",
        [vk_cao_can, t],
      );
      if (!rvk3.rows.length) {
        if (vk_trung_can > 0) await db("UPDATE players SET linh_thach_trung=linh_thach_trung+$1 WHERE user_id=$2", [vk_trung_can, t]);
        return n.reply({ embeds: [errE(`Linh Thạch Cao đã thay đổi — không đủ ${vk_cao_can} ${CE("tult_cao","💚")} để vượt kiếp!`)] });
      }
    }
    // ── Bảo vệ LT: nếu DB lỗi sau khi đã trừ tiền, hoàn lại toàn bộ ─────────
    let _dbErrRestored = false;
    try {
    const i  = getThienKiepLoai(h.cap);
    const a  = i.hieu_ung_them(e);
    const u  = buildVuotKiepTable(e, a);
    const d  = rollVuotKiepResult(u);
    const p = Math.max(-100, Math.min(100, e.tam_ma + d.tam_ma)),
      T = !e.la_ma_tu && p < 0;
    let b = e.canh_gioi,
      $ = Number(e.exp),
      y = 0;
    const cd_success = Date.now() + 2 * 3600 * 1000;
    const cd_fail = Date.now() + 8 * 3600 * 1000;
    let kiep_cd_set = cd_success;
    if (d.thanh_cong) {
      ((b = h.cap), d.exp_bonus > 0 && (y = Math.floor($ * d.exp_bonus)), ($ += y));
      const n = "ngo_dao" === d.id ? 5 : 2;
      await db("UPDATE players SET khi_van=LEAST(100,khi_van+$1) WHERE user_id=$2", [n, t]);
    } else {
      $ = Math.floor(h.exp_can * 0.75);
      kiep_cd_set = cd_fail;
      await db(
        "UPDATE players SET nhan_qua=GREATEST(-100,nhan_qua-5), ma_khi=ma_khi+5, binh_canh=TRUE, dao_thuong=LEAST(3,dao_thuong+2) WHERE user_id=$1",
        [t],
      );
    }
    const { hp_max: E } = tinhCS({ ...e, canh_gioi: b }),
      f = d.thanh_cong
        ? Math.min(E, Math.max(1, Math.floor(E * d.hp_pct)))
        : Math.max(1, Math.floor(E * d.hp_pct)),
      C = d.thanh_cong ? 0 : e.cam_ngo || 0;
    await db(
      "UPDATE players SET exp=$1, canh_gioi=$2, hp_max=$3, hp=$4, tam_ma=$5, la_ma_tu=$6, cam_ngo=$7, vuot_kiep_cd=$8 WHERE user_id=$9",
      [$, b, E, f, p, e.la_ma_tu || T, C, kiep_cd_set, t],
    );

    // ── Nội tại ẩn: Cổ Thần — mở khoá khi đạt Nguyên Anh (cảnh giới 18) ──
    if (d.thanh_cong && b >= 18 && e.huyet_mach === 'co_than' && !e.noi_tai_an_unlocked) {
      await db('UPDATE players SET noi_tai_an_unlocked=TRUE WHERE user_id=$1', [t]).catch(() => {});
      n.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('✨ NỘI TẠI ẨN — THỨC TỈNH!')
            .setColor(0xC0C0FF)
            .setDescription(
              `<@${t}>\n\n` +
              `*Vượt qua Thiên Kiếp Nguyên Anh, linh hồn cổ thần trong huyết mạch ngươi đã tỉnh giấc nghìn năm!*\n\n` +
              `${CE('hm_co_than', '✨')} **Cổ Thần Huyết** · Nội Tại Ẩn Hiển Lộ:\n\n` +
              `> ${CE("tudef","🛡️")} **Cổ Thần Bất Diệt**\n` +
              `> *Thần minh cổ đại, thiên địa nan địch — không có ngũ hành nào có thể khắc chế ngươi.*\n` +
              `> ✦ Miễn toàn bộ khắc chế ngũ hành + DEF **+20%** vĩnh viễn!`
            )
            .setFooter({ text: 'Nội tại ẩn đã khai mở — thực lực thật sự của ngươi hiện ra!' })
        ],
      }).catch(() => {});
    }

    const k = getCG(b),
      N = CANH_GIOI[b + 1],
      D = N ? Math.min(100, Math.floor(($ / N.exp_can) * 100)) : 100;
    const _ = getNhanQua(e.nhan_qua || 0);
    const s = getNgoTinh(e.ngo_tinh || 50);
    let L = `*${i.mo_ta}*\n\n`;
    ((L += `🌩 **${i.emoji} ${i.ten} — Tầng ${h.cap}**\n${d.emoji} **${d.ten}**\n*${d.mo_ta}*\n\n`),
      a.mo_ta && (L += `*${a.mo_ta}*\n`),
      _.emoji && 0 !== (e.nhan_qua || 0) && (L += `*${_.emoji} Nhân Quả: ${_.ten}*\n`),
      (L += "\n"),
      d.thanh_cong
        ? ((L += `✅ **Đột phá thành công!** Tiến vào **${k.ten}**!\n`),
          y > 0 && (L += `${CE("tutv", "📈")} Ngộ Đạo: +**${fmt(y)}** Tu Vi\n`),
          (L += `\n${CE("cd_timer","⏳")} CD Thiên Kiếp: **2 giờ**`))
        : ((L += `❌ **Thất bại nặng nề!** Tu Vi lùi về **${Math.round(75)}%** ngưỡng.\n`),
          (L += `🧱 **Bình Cảnh kích hoạt** — phải khai thông trước khi đột phá!\n`),
          (L += `${CE("nq_nghiep","🩸")} **Đạo Thương +2** — cần chữa trị gấp!\n`),
          (L += `\n${CE("cd_timer","⏳")} CD Thiên Kiếp: **8 giờ**`)),
      0 !== d.tam_ma &&
        (L += `\n${d.tam_ma > 0 ? CE("tam_nhan","😇") : CE("tam_ma","😈")} Đạo Tâm: **${e.tam_ma}** → **${p}**`),
      T && (L += `\n\n${CE("tam_ac","👿")} **NGỘ VÀO MA ĐẠO!** Dùng `-dao_tam` xem hậu quả.`));
    const rateNgoDao    = u.find((row) => row.id === "ngo_dao")?.rate    ?? 0,
      rateThanhCong     = u.find((row) => row.id === "thanh_cong")?.rate ?? 0,
      rateTrongThuong   = u.find((row) => row.id === "trong_thuong")?.rate ?? 0,
      rateTauHoa        = u.find((row) => row.id === "tau_hoa")?.rate    ?? 0;
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(
            d.thanh_cong
              ? "ngo_dao" === d.id
                ? `${CE("nt_tien","✨")} Ngộ Đạo Vượt Kiếp — Thiên Tài Xuất Thế!`
                : `${CE("tia_set","⚡")} Vượt ${i.ten} Thành Công!`
              : `${CE("nq_chuong","☠️")} ${i.ten} Thất Bại — Tẩu Hỏa Nhập Ma!`,
          )
          .setColor(d.thanh_cong ? ("ngo_dao" === d.id ? 16766720 : 49151) : 9109504)
          .setDescription(L)
          .addFields(
            {
              name: "✦ Cảnh Giới",
              value: `${CG_EMOJI(b)} **${k.ten}**\n${pBar(D)} **${D}%**`,
              inline: !0,
            },
            { name: `${i.emoji} Loại Kiếp`, value: `**${i.ten}**`, inline: !0 },
            {
              name: "🎲 Tỉ Lệ Kết Quả",
              value: `${CE("tucn","🌟")} Ngộ ${rateNgoDao}% · ${CE("tia_set","⚡")} Thắng ${rateThanhCong}% · 💔 Thương ${rateTrongThuong}% · ${CE("nq_chuong","☠️")} Tẩu Hỏa ${rateTauHoa}%`,
              inline: !1,
            },
          )
          .setFooter({ text: `Ngộ Tính ${s.ten} | Nhân Quả ${_.ten} | Tầng ${b}/39` }),
      ],
    });
    } catch (dbErr) {
      // DB lỗi sau khi đã trừ LT → hoàn lại Trung/Cao để tránh mất tiền oan
      if (!_dbErrRestored) {
        console.error('[vuot_kiep] DB error after LT deduction — restoring:', dbErr.message);
        if (vk_trung_can > 0) await db("UPDATE players SET linh_thach_trung=linh_thach_trung+$1 WHERE user_id=$2", [vk_trung_can, t]).catch(() => {});
        if (vk_cao_can   > 0) await db("UPDATE players SET linh_thach_cao=linh_thach_cao+$1 WHERE user_id=$2", [vk_cao_can, t]).catch(() => {});
        _dbErrRestored = true;
      }
      return n.reply({ embeds: [errE('Lỗi hệ thống — Linh Thạch đã được hoàn trả. Thử lại sau!')] }).catch(() => {});
    }
  });

