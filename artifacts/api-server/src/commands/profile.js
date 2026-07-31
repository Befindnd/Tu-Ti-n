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
  CONG_PHAP, BI_PHAP, NGHE, DAO_TU, VU_KHI, BAO_BOI, LINH_THAO,
  NGOC_GIAN_DATA, DAN_DUOC, DAN_PHAM, REN_LUYEN_CAP, calcDanTyLe, PHU_LUC_DATA,
  THIEN_KIEP_KQ, THIEN_KIEP_NGUONG, getThienKiepLoai,
  PHONG_THUY_VAN, DONG_PHU, TRUYEN_THUA_LIST,
  TONG_MON_CAP_BAC, TONG_MON, CO_DUYEN_EVENTS,
  BI_CANH_SESSIONS, BI_CANH_CD_H, BI_CANH_LUA_CHON,
  NHIEM_VU_LIST,
  CG_EMOJI, getNgoTinh, getKhiVanBonus, getNhanQua, getTT,
  randomGiaToc, getGiaToc, GIA_TOC_MAU, GIA_TOC_DO_QUY_EMOJI,
} = require('../data');
const {
  getDailyMissionState,
  BAG_WEIGHTS, getDanKg, getBagCapacity, calcBagWeight, canAddToBag,
  DONATE_DATA, findDonateGoi, buildDonateEmbed, buildDonateButtons, buildDonateCatSelect,
  fmt, getCG, pBar, fTime, cdRem, cdRemMin, cdTs, embedClr,
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
const { critRate, critMult } = require('../game/combat_engine');
const ADMIN_ID = process.env.ADMIN_ID || '';
const TU_LUYEN_CD_H = 1;

(setInterval(() => {
  const n = Date.now() - 6e4;
  for (const [t, e] of RATE_LIMIT) e < n && RATE_LIMIT.delete(t);
}, 6e5),
  reg("bat_dau", ["bd", "batdau"], async (n) => {
    const t = n.author.id,
      e = n.author.username;
    if ((await db("SELECT user_id FROM players WHERE user_id=$1", [t])).rows.length)
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(15965202)
            .setTitle("☁️ Thiên Mệnh Đã Khai Mở")
            .setDescription(
              `**${e}**, ngươi đã bước vào con đường tu tiên từ trước rồi!\n\n› \`-thong_tin\` — Xem hồ sơ\n› \`-tu_luyen\` — Tiếp tục tu luyện\n› \`-huong_dan\` — Xem toàn bộ lệnh`,
            ),
        ],
      });
    const h = randomLC(),
      i = randomHM(),
      a = LINH_CAN[h],
      o = HUYET_MACH[i],
      c = Math.floor(61 * Math.random()) + 20,
      _ = Math.floor(51 * Math.random()) + 15,
      gt = randomGiaToc();
    await db(
      "INSERT INTO players(user_id,username,linh_can,huyet_mach,hp,hp_max,ngo_tinh,khi_van,gia_toc) VALUES($1,$2,$3,$4,100,100,$5,$6,$7)",
      [t, e, h, i, c, _, gt.id],
    );
    const u = getNgoTinh(c);
    const gtDoQuyEmoji = GIA_TOC_DO_QUY_EMOJI[gt.do_quy] || '⬜';
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("✦ Khai Thiên Tư — Bước Lên Con Đường Tu Tiên!")
          .setColor(GIA_TOC_MAU[gt.do_quy] || 53247)
          .setThumbnail(n.author.displayAvatarURL())
          .setDescription(
            `*Thiên địa rung chuyển, linh khí bốn phương quy tụ...*\n*Thiên mệnh khai mở — **${e}** chính thức bước vào con đường tu tiên!*\n\n${SEP2}\n\n${a.emoji} **Linh Căn: ${a.ten}**\n*${LINH_CAN_MO_TA[h]}*\n\n${CE(o.ce_name, o.emoji)} **Huyết Mạch: ${o.ten}** — ×${o.multiplier}\n\n${u.emoji} **Ngộ Tính: ${u.ten}** (${c}/100)\n*${u.mo_ta}*\n\n${CE("tukv", "🍀")} **Khí Vận: ${_}/100**\n\n${SEP2}\n\n${gtDoQuyEmoji} **Gia Tộc: ${gt.emoji} ${gt.ten}** *(${gt.do_quy_ten})*\n*${gt.mo_ta}*\n✨ **Bonus:** ${gt.bonus}\n\n${SEP2}\n\n**✦ Bước Đầu Tiên:**\n\`-nghe xem\` · Chọn Đạo Pháp\n\`-tu_luyen\` · Tích lũy Tu Vi *(CD 1h)*\n\`-linh_ngo\` · Đọc cổ thư lĩnh ngộ công pháp\n\`-gia_toc\` · Xem thông tin gia tộc của ngươi\n\`-huong_dan\` · Xem toàn bộ hướng dẫn`,
          )
          .setFooter({ text: `Hành trình vạn dặm khởi từ một bước ✦ Tu Tiên Thế Giới · Gia tộc: ${gt.ten}` }),
      ],
    });
  }),
  reg("thong_tin", ["tt", "hoso", "thongtin"], async (n) => {
    const t = n.mentions.users.first() || n.author,
      e = await getPlayer(t.id);
    if (!e)
      return n.reply({
        embeds: [
          errE(
            `**${t.username}** chưa bước vào con đường tu tiên!\nDùng \`-bat_dau\` để khai mở thiên tư.`,
          ),
        ],
      });
    const h = getCG(e.canh_gioi),
      i = CANH_GIOI[e.canh_gioi + 1],
      a = LINH_CAN[e.linh_can] || LINH_CAN.moc,
      o = HUYET_MACH[e.huyet_mach] || HUYET_MACH.pham,
      c = CONG_PHAP.find((n) => n.id === e.cong_phap) || CONG_PHAP[0],
      _ = NGHE[e.nghe],
      _dt = DAO_TU[e.dao_tu],
      u = getTamMa(e.tam_ma),
      r = tinhCS(e),
      s = VU_KHI.find((n) => n.id === e.vu_khi),
      l = e.vu_khi_cap || 0,
      m = Number(e.exp),
      g = i ? i.exp_can : null,
      d = g ? Math.min(100, Math.floor((m / g) * 100)) : 100,
      p = e.dong_phu ? DONG_PHU.find((n) => n.id === e.dong_phu) : null,
      T = getNgoTinh(e.ngo_tinh || 50),
      b = getNhanQua(e.nhan_qua || 0),
      $ =
        TONG_MON_CAP_BAC.find((n) => n.id === (e.tong_mon_cap || "ngoai_mon")) ||
        TONG_MON_CAP_BAC[0],
      y = e.cam_ngo || 0,
      bkRate = critRate(e),
      bkMult = critMult(e),
      E = (Date.now() - Number(e.tu_luyen_cd || 0)) / 36e5,
      f =
        E >= TU_LUYEN_CD_H
          ? "✅ Sẵn sàng tu luyện!"
          : `${CE("cd_timer","⏳")} CD: **${cdTs(e.tu_luyen_cd, TU_LUYEN_CD_H)}**`;
    const thaonThong = Array.isArray(e.than_thong) ? e.than_thong : [];
    return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CG_EMOJI(e.canh_gioi)} ${t.username} — ${h.ten}`)
            .setColor(embedClr(e.canh_gioi))
            .setThumbnail(t.displayAvatarURL())
            .setDescription([
              `${CE("tult","💠")} **${fmt(e.linh_thach)}**${Number(e.linh_thach_trung||0)>0?` · ${CE("tult_trung","🔮")} **${fmt(e.linh_thach_trung)}**`:""}${Number(e.linh_thach_cao||0)>0?` · ${CE("tult_cao","💚")} **${fmt(e.linh_thach_cao)}**`:""} ❧ ${CE('ft_pvp','⚔️')} **${e.pvp_wins}W/${e.pvp_losses}L**${(e.dao_thuong||0)>0?` ❧ ${["",...[CE('dt_nhe','🟡'),CE('dt_trung','🟠'),CE('dt_nang','🔴')]][e.dao_thuong]} Đạo Thương **${e.dao_thuong}**`:""}  `,
              `${pBar(d)} ${d < 100 ? `**${d}%** *(+${fmt(g?g-m:0)} TV)*` : "**ĐẠT ĐỈNH**"} ❧ ${f}`,
            ].join("\n"))
            .addFields(
              {
                name: `${CE('ft_pvp','⚔️')} Chiến Lực`,
                value: `${CE("tuatk","⚔️")} **${fmt(r.atk)}** · ${CE("tudef","🛡️")} **${fmt(r.def)}** · ${CE("tuhp","💜")} **${fmt(r.hp_max)}** · ${CE('ft_dot_pha','💥')} BK **${Math.round(bkRate*100)}%** ×${bkMult.toFixed(1)}`,
                inline: false,
              },
              {
                name: `${CE('tucn','🌟')} Căn Cốt`,
                value: `${a.emoji} ${a.ten} · ${CE(o.ce_name,o.emoji)} ${o.ten} ×${o.multiplier}\n${u.emoji} ${u.ten} (Đạo Tâm ${e.tam_ma}) · ${CE('ft_linh_ngo','💭')} Cảm Ngộ ${y}% · ${CE('tukv','🍀')} KV ${e.khi_van||30}`,
                inline: true,
              },
              {
                name: `${CE('ft_tong_mon','🏯')} Môn Phái & Gia Tộc`,
                value: (() => {
                  const gtInfo = e.gia_toc ? getGiaToc(e.gia_toc) : null;
                  const gtLine = gtInfo
                    ? `${GIA_TOC_DO_QUY_EMOJI[gtInfo.do_quy] || '⬜'} ${gtInfo.emoji} **${gtInfo.ten}** *(${gtInfo.do_quy_ten})*`
                    : "🏚️ *Chưa có gia tộc*";
                  const monLine = e.tong_mon
                    ? (TONG_MON[e.tong_mon] ? `${TONG_MON[e.tong_mon].emoji} ${TONG_MON[e.tong_mon].ten} · ${$.emoji} ${$.ten}` : "*Không rõ*")
                    : "*Chưa gia nhập*";
                  return `${gtLine}\n${monLine}\n${p ? `${p.emoji} ${p.ten}` : `${CE("dp_linh_son","🏔️")} *Chưa có động phủ*`}`;
                })(),
                inline: true,
              },
              {
                name: `${CE('ft_cong_phap','📖')} Tu Luyện`,
                value: [`${c.ten}`,`${_?.emoji||"？"} ${_?.ten||"Chưa chọn"}${e.thien_phu_nghe===e.nghe&&NGHE[e.thien_phu_nghe]?" ✨":""}${s?` · ${CE(s.ce_name, s.pham || '⚔️')} ${s.ten}${l>0?` +${l}`:""}`:""}`,`${_dt?`${_dt.emoji} ${_dt.ten}`:`${CE("tt_hon_don","🌀")} Chưa chọn Đạo Tu`}`].join("\n"),
                inline: false,
              },
              ...(thaonThong.length>0?[{
                name: `${CE("nt_tien","✨")} Thần Thông`,
                value: thaonThong.map(id=>{const tt=NGOC_GIAN_DATA.find(x=>x.id===id);return tt?`${tt.emoji} ${tt.ten}`:id;}).join(" · "),
                inline: false,
              }]:[]),
            )
            .setFooter({
              text: `✦ Ngộ Tính ${e.ngo_tinh||50} · Bí Pháp ${e.bi_phap?.length||0}/8 · Linh Bảo ${e.bao_boi?.length||0}/8 · ${b.ten}`,
            }),
        ],
      });
    }));
