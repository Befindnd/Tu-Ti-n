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
  NGOC_GIAN_DATA, DAN_DUOC, DAN_PHAM, DAN_PHAM_ORDER, REN_LUYEN_CAP, calcDanTyLe, PHU_LUC_DATA,
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


  reg("dung_dan", ["dd", "dungdan"], async (n, t) => {
    const e = n.author.id,
      h = (t[0] || "").toLowerCase();
    if (!h)
      return n.reply({
        embeds: [errE("Cú pháp: `-dung_dan <id>`\nDùng `-luyen_dan xem` để xem kho.")],
      });
    const i = await getPlayer(e);
    if (!i) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    const a = DAN_DUOC.find((n) => n.id === h);
    if (!a) return n.reply({ embeds: [errE(`Không tìm thấy \`${h}\`.`)] });
    const o = { ...(i.dan_duoc || {}) };
    if (a.limited && "pha_canh_dan" === a.id) {
      if ((o.pha_canh_dan || 0) <= 0)
        return n.reply({
          embeds: [errE(`Không có **${a.ten}** trong kho!\n${CE("tukv","💎")} Chỉ có được qua Giftcode đặc biệt.`)],
        });
      if (i.canh_gioi >= CANH_GIOI.length - 1)
        return n.reply({
          embeds: [warnE("Đã đạt cảnh giới tối cao **Tiên Nhân**, không thể đột phá thêm!")],
        });
      const h = i.canh_gioi, c = h + 1, _ = CANH_GIOI[c], u = THIEN_KIEP_NGUONG.has(c);
      const _pcRes = await db(
        "UPDATE players SET dan_duoc=jsonb_set(COALESCE(dan_duoc,'{}'),'{pha_canh_dan}',to_jsonb(GREATEST(0,COALESCE((dan_duoc->>'pha_canh_dan')::int,0)-1))), canh_gioi=$1, exp=$2, hp=hp_max WHERE user_id=$3 AND COALESCE((dan_duoc->>'pha_canh_dan')::int,0) >= 1 RETURNING dan_duoc",
        [c, _.exp_can, e],
      );
      if (!_pcRes.rows.length) return n.reply({ embeds: [errE("Không có Phá Cảnh Đan trong kho (đã dùng rồi)!")] });
      const _newDan = _pcRes.rows[0].dan_duoc || {};
      const r = u ? `\n${CE("tia_set","⚡")} *Tiên đan huyền diệu đã phá vỡ Thiên Kiếp — đột phá an toàn!*` : "";
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🌌 Phá Cảnh Đan — Đột Phá Thành Công!")
            .setColor(10181046)
            .setDescription(
              `${CG_EMOJI(h)} **${CANH_GIOI[h].ten}** ➜ ${CG_EMOJI(c)} **${_.ten}**${r}\n\n${CE("tuhp", "💜")} Linh Lực hồi đầy | 📦 Còn **${_newDan.pha_canh_dan || 0}** Phá Cảnh Đan`,
            )
            .setFooter({ text: "💎 Vật phẩm Limited — chỉ có qua Giftcode" }),
        ],
      });
    }
    // ── Hồi Xuân Đan ──────────────────────────────────────────────────────
    if (a.limited && "hoi_xuan_dan" === a.id) {
      if ((o.hoi_xuan_dan || 0) <= 0)
        return n.reply({ embeds: [errE(`Không có **${a.ten}** trong kho!\n🌸 Chỉ có qua Donate đặc biệt.`)] });
      const dtHien = Math.min(3, Math.max(0, i.dao_thuong || 0));
      if (dtHien === 0)
        return n.reply({ embeds: [warnE("Thần thể đang hoàn toàn lành mạnh — không cần Hồi Xuân Đan!")] });
      const dtMoi = dtHien - 1;
      const _hxRes = await db(
        "UPDATE players SET dan_duoc=jsonb_set(COALESCE(dan_duoc,'{}'),'{hoi_xuan_dan}',to_jsonb(GREATEST(0,COALESCE((dan_duoc->>'hoi_xuan_dan')::int,0)-1))), dao_thuong=$1, hp=hp_max WHERE user_id=$2 AND COALESCE((dan_duoc->>'hoi_xuan_dan')::int,0) >= 1 RETURNING dan_duoc",
        [dtMoi, e],
      );
      if (!_hxRes.rows.length) return n.reply({ embeds: [errE("Không có Hồi Xuân Đan trong kho (đã dùng rồi)!")] });
      const _hxDan = _hxRes.rows[0].dan_duoc || {};
      const DT_TEN_LOC = ['✅ Lành Mạnh', '🟡 Nhẹ', '🟠 Trung', '🔴 Nặng'];
      return n.reply({
        embeds: [new EmbedBuilder()
          .setTitle("🌸 Hồi Xuân Đan — Thần Thể Hồi Phục!")
          .setColor(16711935)
          .setDescription(
            `*Linh khí xuân ấm áp tràn ngập khắp kinh mạch...*\n\n` +
            `🩹 Đạo Thương: **${DT_TEN_LOC[dtHien]}** ➜ **${DT_TEN_LOC[dtMoi]}**\n` +
            `${CE("tuhp", "💜")} **Linh Lực hồi đầy hoàn toàn!**\n\n` +
            `📦 Còn **${_hxDan.hoi_xuan_dan || 0}** Hồi Xuân Đan`,
          )
          .setFooter({ text: "💎 Vật phẩm Limited — chỉ có qua Donate" })],
      });
    }
    // ── Tuyệt Tinh Hoá Đan ────────────────────────────────────────────────
    if (a.limited && "cuu_pham_dan" === a.id) {
      if ((o.cuu_pham_dan || 0) <= 0)
        return n.reply({ embeds: [errE(`Không có **${a.ten}** trong kho!\n${CE("cuu_pham_dan_sp","🔷")} Chỉ có qua Donate đặc biệt.`)] });
      const ngoTinhHien = i.ngo_tinh || 50;
      const khiVanHien  = i.khi_van  || 30;
      const ngoTinhMoi  = Math.min(200, ngoTinhHien + 30);
      const khiVanMoi   = Math.min(150, khiVanHien  + 20);
      const ngoTinhDelta = ngoTinhMoi - ngoTinhHien;
      const khiVanDelta  = khiVanMoi  - khiVanHien;
      const _cpRes = await db(
        "UPDATE players SET dan_duoc=jsonb_set(COALESCE(dan_duoc,'{}'),'{cuu_pham_dan}',to_jsonb(GREATEST(0,COALESCE((dan_duoc->>'cuu_pham_dan')::int,0)-1))), tam_ma=100, ngo_tinh=$1, khi_van=$2 WHERE user_id=$3 AND COALESCE((dan_duoc->>'cuu_pham_dan')::int,0) >= 1 RETURNING dan_duoc",
        [ngoTinhMoi, khiVanMoi, e],
      );
      if (!_cpRes.rows.length) return n.reply({ embeds: [errE("Không có Tuyệt Tinh Hoá Đan trong kho (đã dùng rồi)!")] });
      const _cpDan = _cpRes.rows[0].dan_duoc || {};
      return n.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`${CE("cuu_pham_dan_sp","🔷")} Tuyệt Tinh Hoá Đan — Tâm Linh Thanh Tịnh!`)
          .setColor(3447003)
          .setDescription(
            `*Tinh hoa đan dược tẩy sạch tà khí, tâm hồn sáng trong như gương...*\n\n` +
            `🧠 **Tâm Ma** → Thanh tịnh hoàn toàn *(100/100)*\n` +
            `${CE("nt_tien","✨")} **Ngộ Tính** +${ngoTinhDelta} → **${ngoTinhMoi}** *(vĩnh viễn)*\n` +
            `🌬️ **Khí Vận** +${khiVanDelta} → **${khiVanMoi}** *(vĩnh viễn)*\n\n` +
            `📦 Còn **${_cpDan.cuu_pham_dan || 0}** Tuyệt Tinh Hoá Đan`,
          )
          .setFooter({ text: "💎 Vật phẩm Limited — chỉ có qua Donate" })],
      });
    }
    // ── Tẩy Tủy Đan ───────────────────────────────────────────────────────
    if (a.limited && "linh_tu_dan" === a.id) {
      if ((o.linh_tu_dan || 0) <= 0)
        return n.reply({ embeds: [errE(`Không có **${a.ten}** trong kho!\n${CE("tukv","💎")} Chỉ có qua Donate đặc biệt.`)] });
      const hpBonus  = Math.round(((i.linh_tu_hp_bonus  || 0) + 0.20) * 100);
      const defBonus = Math.round(((i.linh_tu_def_bonus || 0) + 0.10) * 100);
      const _ltRes = await db(
        "UPDATE players SET dan_duoc=jsonb_set(COALESCE(dan_duoc,'{}'),'{linh_tu_dan}',to_jsonb(GREATEST(0,COALESCE((dan_duoc->>'linh_tu_dan')::int,0)-1))), linh_tu_hp_bonus=linh_tu_hp_bonus+0.20, linh_tu_def_bonus=linh_tu_def_bonus+0.10, hp=hp_max WHERE user_id=$1 AND COALESCE((dan_duoc->>'linh_tu_dan')::int,0) >= 1 RETURNING dan_duoc",
        [e],
      );
      if (!_ltRes.rows.length) return n.reply({ embeds: [errE("Không có Tẩy Tủy Đan trong kho (đã dùng rồi)!")] });
      const _ltDan = _ltRes.rows[0].dan_duoc || {};
      return n.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`${CE("tukv","💎")} Tẩy Tủy Đan — Thể Xác Tái Sinh!`)
          .setColor(9442302)
          .setDescription(
            `*Đan lực tẩy luyện tủy xương, từng tế bào thể xác hồi sinh...*\n\n` +
            `${CE("tuhp", "💜")} **HP Tối Đa** +20% *(tổng cộng +${hpBonus}%)*\n` +
            `${CE("tudef","🛡️")} **Thủ Lực** +10% *(tổng cộng +${defBonus}%)*\n` +
            `${CE("tuhp", "💜")} **Linh Lực hồi đầy hoàn toàn!**\n\n` +
            `📦 Còn **${_ltDan.linh_tu_dan || 0}** Tẩy Tủy Đan`,
          )
          .setFooter({ text: "💎 Vật phẩm Limited — stack mỗi lần dùng" })],
      });
    }
    // ── Nguyên Thần Ngưng Tụ Đan ──────────────────────────────────────────
    if (a.limited && "nguyen_than_dan" === a.id) {
      if ((o.nguyen_than_dan || 0) <= 0)
        return n.reply({ embeds: [errE(`Không có **${a.ten}** trong kho!\n${CE("tt_hon_don","🌀")} Chỉ có qua Donate đặc biệt.`)] });
      const critHien    = i.nguyen_than_crit || 0;
      const ngoTinhHien = i.ngo_tinh || 50;
      const critMoi     = Math.min(0.60, critHien + 0.10);
      const ngoTinhMoi  = Math.min(200, ngoTinhHien + 20);
      const critDelta   = Math.round((critMoi - critHien) * 100);
      const ngoTinhDelta = ngoTinhMoi - ngoTinhHien;
      const _ntRes = await db(
        "UPDATE players SET dan_duoc=jsonb_set(COALESCE(dan_duoc,'{}'),'{nguyen_than_dan}',to_jsonb(GREATEST(0,COALESCE((dan_duoc->>'nguyen_than_dan')::int,0)-1))), nguyen_than_crit=LEAST(0.60,nguyen_than_crit+0.10), ngo_tinh=$1 WHERE user_id=$2 AND COALESCE((dan_duoc->>'nguyen_than_dan')::int,0) >= 1 RETURNING dan_duoc",
        [ngoTinhMoi, e],
      );
      if (!_ntRes.rows.length) return n.reply({ embeds: [errE("Không có Nguyên Thần Ngưng Tụ Đan trong kho (đã dùng rồi)!")] });
      const _ntDan = _ntRes.rows[0].dan_duoc || {};
      return n.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`${CE("tt_hon_don","🌀")} Nguyên Thần Ngưng Tụ Đan — Thiên Nhãn Khai Mở!`)
          .setColor(6750054)
          .setDescription(
            `*Nguyên thần cộng hưởng thiên địa, thiên nhãn bừng sáng rực rỡ...*\n\n` +
            `${CE("tia_set","⚡")} **Tỷ Lệ Bạo Kích** +${critDelta}% *(tổng: +${Math.round(critMoi * 100)}%)*  *(vĩnh viễn)*\n` +
            `${CE("nt_tien","✨")} **Ngộ Tính** +${ngoTinhDelta} → **${ngoTinhMoi}** *(vĩnh viễn)*\n\n` +
            `📦 Còn **${_ntDan.nguyen_than_dan || 0}** Nguyên Thần Ngưng Tụ Đan`,
          )
          .setFooter({ text: "💎 Vật phẩm Limited — stack mỗi lần dùng (tối đa +60%)" })],
      });
    }
    let c = null,
      _ = null;
    for (const n of DAN_PHAM_ORDER) {
      const t = "trung" === n ? a.id : `${a.id}_${n}`;
      if ((o[t] || 0) > 0) {
        ((c = t), (_ = n));
        break;
      }
    }
    if (!c)
      return n.reply({
        embeds: [errE(`Không có **${a.ten}** trong kho!\nLuyện đan: \`-luyen_dan lam ${a.id}\``)],
      });
    // c comes from DAN_PHAM_ORDER + a.id (game constants, not user input) — safe to template in SQL
    const _atomicDeduct = `jsonb_set(COALESCE(dan_duoc,'{}'), '{${c}}', to_jsonb(GREATEST(0, COALESCE((dan_duoc->>'${c}')::int,0)-1)))`;
    const _checkWhere = `COALESCE((dan_duoc->>'${c}')::int,0) >= 1`;
    const u = DAN_PHAM[_],
      r = Math.floor((a.tu_vi || 0) * u.he_so);
    // Tính cảm ngộ tự động theo phẩm cấp đan
    const _camNgoBase = a.hieu_ung && "cam_ngo" === a.hieu_ung.loai
      ? Math.floor(a.hieu_ung.gia_tri * (u.he_so || 1))
      : Math.floor((a.ngo_dao_cuc || 1) * (u.he_so || 1));
    const _newCamNgo = Math.min(100, (i.cam_ngo || 0) + _camNgoBase);
    // Hiệu ứng đặc biệt theo loại đan
    let _extraSQL = "", _extraParams = [], _specialDesc = "";
    if ("cuong_the_dan" === a.id) {
      const _bonus = Math.round(8 * u.he_so);
      const _newVal = Math.min(100, (i.tam_ma || 20) + _bonus);
      _extraSQL = `,tam_ma=LEAST(100,tam_ma+$4)`;
      _extraParams = [_bonus];
      _specialDesc = `\n⚔️ **Đạo Tâm +${_bonus}** → **${_newVal}**`;
    } else if ("kim_than_dan" === a.id) {
      const _bonus = Math.round(10 * u.he_so);
      const _newVal = Math.min(100, (i.tam_ma || 20) + _bonus);
      _extraSQL = `,tam_ma=LEAST(100,tam_ma+$4)`;
      _extraParams = [_bonus];
      _specialDesc = `\n${CE("ft_tu_luyen","🧘")} **Tâm Ma giảm ${_bonus}** — Đạo Tâm → **${_newVal}**`;
    } else if ("truong_sinh_dan" === a.id) {
      const _bonus = Math.max(1, Math.round(2 * u.he_so));
      const _newVal = Math.min(100, (i.khi_van || 30) + _bonus);
      _extraSQL = `,khi_van=LEAST(100,khi_van+$4)`;
      _extraParams = [_bonus];
      _specialDesc = `\n🌬️ **Khí Vận +${_bonus}** → **${_newVal}** *(vĩnh viễn)*`;
    } else if ("thien_de_dan" === a.id) {
      _extraSQL = `,binh_canh=false`;
      _extraParams = [];
      _specialDesc = `\n🧱 **Bình Cảnh tan biến!** Đường đột phá hoàn toàn thông suốt.`;
    }
    let l = "";
    const _hu = a.hieu_ung;
    if (_hu && "hoi_hp" === _hu.loai) {
      const _res = await db(
        `UPDATE players SET dan_duoc=${_atomicDeduct},exp=exp+$1,cam_ngo=$2,hp=hp_max${_extraSQL} WHERE user_id=$3 AND ${_checkWhere} RETURNING dan_duoc`,
        [r, _newCamNgo, e, ..._extraParams],
      );
      if (!_res.rows.length) return n.reply({ embeds: [errE(`Đan dược đã thay đổi — không còn **${a.ten}** trong kho!`)] });
      l = `\n${CE("tuhp", "\uD83D\uDC9C")} **Linh Lực hồi đầy hoàn toàn!** · ${CE("tucn", "\uD83D\uDCA1")} Cảm Ngộ +**${_camNgoBase}%** (${_newCamNgo}%)${_specialDesc}`;
    } else {
      const _res = await db(
        `UPDATE players SET dan_duoc=${_atomicDeduct},exp=exp+$1,cam_ngo=$2${_extraSQL} WHERE user_id=$3 AND ${_checkWhere} RETURNING dan_duoc`,
        [r, _newCamNgo, e, ..._extraParams],
      );
      if (!_res.rows.length) return n.reply({ embeds: [errE(`Đan dược đã thay đổi — không còn **${a.ten}** trong kho!`)] });
      l = `\n${CE("tucn", "\uD83D\uDCA1")} Cảm Ngộ +**${_camNgoBase}%** → **${_newCamNgo}%**${_specialDesc}`;
    }
    const _desc_tv = `${CE("tutv", "\uD83D\uDCC8")} +**${fmt(r)} Tu Vi**`;
    const m = await getPlayer(e),
      g = CANH_GIOI[m.canh_gioi + 1],
      d =
        g && Number(m.exp) >= g.exp_can
          ? `\n\n${CE("tip_icon","💡")} *Tu Vi đã đầy — dùng \`-dot_pha\` để đột phá cảnh giới!*`
          : "";
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${a.emoji} ${u.emoji} Uống ${u.ten} ${a.ten}`)
          .setColor(u.color)
          .setDescription(
            `*Đan hương ngào ngạt, linh khí cuồn cuộn thấm vào kinh mạch...*\n\n${_desc_tv}${l}${d}`,
          )
          .setFooter({
            text: `Phẩm cấp: ${u.ten} (×${u.he_so}) | Kho còn: ${Object.values(o).reduce((n, t) => n + t, 0)} viên`,
          }),
      ],
    });
  });

