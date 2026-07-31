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
  fmt, fmtLT, calcSpend, calcMultiSpend, MIXED_SPEND_THRESHOLD, getCG, pBar, fTime, cdRem, cdRemMin, cdTs, embedClr,
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
// Tu Luyện events: see game/cultivation_engine.js → SU_KIEN_TU
function checkNgheDotPha(n) {
  if (!n.nghe)
    return {
      ok: !1,
      msg: `*Đột phá cảnh giới đòi hỏi phải có một con đường tu hành rõ ràng — ngươi chưa chọn **Nghề** cho mình!*\n\n${CE('tunt','🎯')} Mỗi nghề mang lại điều kiện và phần thưởng đột phá riêng.\n\n${CE("tip_icon","💡")} Dùng **\`-chon_nghe\`** để chọn nghề trước khi đột phá.`,
    };
  const t = n.dan_duoc || {},
    e = n.phu_luc || {};
  switch (n.nghe) {
    case "luyen_dan":
      if (Object.values(t).reduce((n, t) => n + Number(t || 0), 0) < 1)
        return {
          ok: !1,
          msg: `*Luyện Đan Sư cần có ít nhất **1 đan dược** trong kho để hỗ trợ đột phá — đan dược giúp ổn định pháp lực khi phá vỡ vách ngăn!*\n\n${CE("tip_icon","💡")} Dùng \`-luyen_dan lam <id>\` để luyện đan trước.`,
        };
      return {
        ok: !0,
        bonus: Object.entries(t).some(([n, t]) => n.includes("_cuc") && Number(t) > 0)
          ? 0.08
          : 0.03,
      };
    case "luyen_khi":
      return (n.vu_khi_cap || 0) < 1
        ? {
            ok: !1,
            msg: `*Phi Khí Sư cần tôi luyện phi khí ít nhất **Cấp +1** trước khi đột phá — phi khí là nguồn sức mạnh cốt lõi, thiếu tôi luyện thì không thể bùng phát!*\n\n${CE("tip_icon","💡")} Dùng \`-ren_luyen nang_cap\` để tôi luyện phi khí.`,
          }
        : { ok: !0, bonus: Math.min(0.08, 0.01 * (n.vu_khi_cap || 0)) };
    case "phu_luc": {
      const n = Object.values(e).reduce((n, t) => n + Number(t || 0), 0);
      return n < 1
        ? {
            ok: !1,
            msg: `*Phù Lục Sư cần có ít nhất **1 Phù Lục** trong kho để ổn định kinh mạch khi đột phá — phù lục dẫn hướng pháp lực, thiếu chúng tâm cảnh sẽ loạn!*\n\n${CE("tip_icon","💡")} Dùng \`-ve_phu tao <id>\` để vẽ phù lục.`,
          }
        : { ok: !0, bonus: n >= 3 ? 0.05 : 0.02 };
    }
    case "an_sat":
      return (n.pvp_wins || 0) < 3
        ? {
            ok: !1,
            msg: `*Ám Vệ cần tích lũy **3 chiến thắng PvP** trước khi đột phá — bước vào cảnh giới cao hơn trên con đường ám sát đòi hỏi kinh nghiệm thực chiến!*\n\n${CE("tuatk", "⚔️")} Thắng hiện tại: **${n.pvp_wins || 0}/3**\n${CE("tip_icon","💡")} Dùng \`-pvp @người\` hoặc \`-am_sat @người\` để tích lũy.`,
          }
        : { ok: !0, bonus: Math.min(0.06, 0.02 * Math.floor((n.pvp_wins || 0) / 5)) };
    case "phong_thuy":
      return n.phong_thuy_cd && 0 !== Number(n.phong_thuy_cd)
        ? { ok: !0, bonus: (n.khi_van || 30) >= 60 ? 0.05 : 0 }
        : {
            ok: !1,
            msg: `*Phong Thủy Sư cần xem thiên cơ **ít nhất 1 lần** trước khi đột phá — thiên thời địa lợi phải được tính toán trước khi phá vỡ vách ngăn cảnh giới!*\n\n${CE("tip_icon","💡")} Dùng \`-phong_thuy boi\` để xem thiên cơ.`,
          };
    case "duoc_su": {
      if ((n.dao_thuong || 0) > 0)
        return { ok: !1, msg: "*Dược Sư cần **thần thể lành mạnh** (không có Đạo Thương) trước khi đột phá!*\n\n💉 Dùng `-chua_thuong` để chữa lành." };
      return { ok: !0, bonus: Number(n.hp) / Math.max(1, Number(n.hp_max)) >= 0.8 ? 0.05 : 0 };
    }
    case "ngo_dao_su": {
      const ngoTinh = Number(n.ngo_tinh || 50);
      const camNgo = Number(n.cam_ngo || 0);
      const tamMa = Number(n.tam_ma || 0);
      const coThienPhu = n.thien_phu_nghe === 'ngo_dao_su';
      const nguongNgoTinh = coThienPhu ? 51 : 71;
      const nguongDaoTam = coThienPhu ? 60 : 80;
      const phiBinhCanh = coThienPhu ? 5000 : 10000;
      const fixedRate = coThienPhu ? 0.25 : 0.20;
      if (n.binh_canh) {
        const lacks = [];
        if (ngoTinh < nguongNgoTinh) lacks.push(`Ngộ Tính > **${nguongNgoTinh - 1}** *(hiện tại: ${ngoTinh})*`);
        if (camNgo < 80) lacks.push(`Cảm Ngộ ≥ **80%** *(hiện tại: ${camNgo}%)*`);
        if (tamMa < nguongDaoTam) lacks.push(`Đạo Tâm ≥ **${nguongDaoTam}** *(hiện tại: ${tamMa})*`);
        if (Number(n.linh_thach) < phiBinhCanh) lacks.push(`Linh Thạch ≥ **${fmt(phiBinhCanh)}** ${CE("tult","💠")} *(hiện có: ${fmt(Number(n.linh_thach))})*`);
        if (lacks.length > 0)
          return {
            ok: !1,
            msg: `*Ngộ Đạo Sư có thể tự phá bình cảnh — nhưng tâm ngộ chưa đủ sâu để xuyên thấu vách ngăn!*\n\n🧱 Cần thỏa mãn **đủ cả 4 điều kiện**:\n${lacks.map(l => `• ${l}`).join('\n')}\n\n${CE("tip_icon","💡")} Dùng \`-linh_ngo\` để tăng Ngộ Tính & Cảm Ngộ, \`-dao_tam tinh_hoa\` để tu dưỡng Đạo Tâm.`,
          };
        return { ok: !0, fixed_rate: fixedRate, tu_pha_binh_canh: !0, phi_binh_canh: phiBinhCanh };
      }
      if (ngoTinh < 30)
        return {
          ok: !1,
          msg: `*Ngộ Đạo Sư cần Ngộ Tính ≥ **30** để khai phá cảnh giới — ngộ tính còn quá thấp, thiên đạo chưa hiển lộ!*\n\nNgộ Tính hiện tại: **${ngoTinh}** | Cần: **30**\n${CE("tip_icon","💡")} Dùng \`-linh_ngo\` để đọc sách tăng Ngộ Tính.`,
        };
      return { ok: !0, bonus: Math.min(0.08, ((ngoTinh - 30) / 70) * 0.08) };
    }
    default:
      return { ok: !0, bonus: 0 };
  }
}

  reg("linh_ngo", ["ngo", "doc_sach", "linhngo"], async (n, t) => {
    const e = n.author.id,
      h = (t[0] || "xem").toLowerCase(),
      i = await getPlayer(e);
    if (!i) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });
    const a = getNgoTinh(i.ngo_tinh || 50);
    if ("xem" === h || "list" === h) {
      const t = i.co_phap_ngo || [],
        e = new EmbedBuilder()
          .setTitle("📚 Lĩnh Ngộ Công Pháp — Đọc Cổ Thư")
          .setColor(10181046)
          .setDescription(
            `*Đọc cổ thư → Lĩnh Ngộ → Có thể nhận công pháp*\n\n${a.emoji} **Ngộ Tính: ${a.ten}** (${i.ngo_tinh || 50}/100)\nTỉ lệ lĩnh ngộ: +${Math.round(100 * a.linh_ngo_bonus)}% | Thần Thông: ${Math.round(100 * a.than_thong_rate)}%\n\nCD: **2h** · \`-linh_ngo doc <id_sach>\` để đọc\n${SEP}`,
          );
      for (const n of CO_THU) {
        const h = t.some((t) => n.kha_nang.includes(t)),
          a = i.canh_gioi >= n.yeu_cau_cap,
          o = (i.ngo_tinh || 50) >= n.yeu_cau_ngo,
          c = a ? (o ? (h ? "✅" : "📖") : "🧠") : CE('lock_icon','🔒');
        e.addFields({
          name: `${c} ${n.ten} | \`${n.id}\``,
          value: `Tầng ${n.yeu_cau_cap} · Ngộ Tính ≥${n.yeu_cau_ngo} · ${fmtLT(n.phi)}\nCông Pháp khả dụng: ${n.kha_nang.map((n) => CONG_PHAP.find((t) => t.id === n)?.ten || n).join(", ")}\n*${n.mo_ta}*`,
          inline: !1,
        });
      }
      return n.reply({ embeds: [e] });
    }
    if ("doc" === h) {
      const h = (t[1] || "").toLowerCase(),
        o = CO_THU.find((n) => n.id === h);
      if (!o)
        return n.reply({
          embeds: [errE(`Không tìm thấy \`${h}\`.\nDùng \`-linh_ngo xem\` để xem danh sách.`)],
        });
      const c = (Date.now() - Number(i.linh_ngo_cd || 0)) / 36e5;
      if (c < 2) {
        return n.reply({
          embeds: [
            warnE(
              `Tâm trí còn chưa hồi phục, cần nghỉ ngơi trước khi đọc sách!\nHết CD ${cdTs(i.linh_ngo_cd, 2)}`,
            ),
          ],
        });
      }
      if (i.canh_gioi < o.yeu_cau_cap)
        return n.reply({ embeds: [errE(`Cần tầng **${o.yeu_cau_cap}** để đọc **${o.ten}**!`)] });
      const _ = i.ngo_tinh || 50;
      if (_ < o.yeu_cau_ngo)
        return n.reply({
          embeds: [
            errE(
              `Ngộ Tính cần ≥**${o.yeu_cau_ngo}** để lĩnh hội **${o.ten}**!\nNgộ Tính hiện tại: **${_}**`,
            ),
          ],
        });
      if (!(o.phi >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(i, o.phi) : calcSpend(i, o.phi)))
        return n.reply({
          embeds: [
            errE(
              `Cần **${fmt(o.phi)} ${CE("tult", "💠")}** để mua cổ thư!\nHiện có: **${fmt(i.linh_thach)} ${CE("tult", "💠")}**`,
            ),
          ],
        });
      { const _s = o.phi >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(i, o.phi) : calcSpend(i, o.phi);
        await db("UPDATE players SET linh_ngo_cd=$1, linh_thach=$2, linh_thach_trung=$3, linh_thach_cao=$4 WHERE user_id=$5", [
          Date.now(), _s.newThuong, _s.newTrung, _s.newCao, e,
        ]); }
      const u = 0.3 + 0.5 * a.linh_ngo_bonus,
        r = Math.random();
      if ("ma_kinh_co_qua" === o.id) {
        const n = 20;
        await db("UPDATE players SET tam_ma=GREATEST(-100,tam_ma-$1) WHERE user_id=$2", [n, e]);
      }
      if (r < u) {
        const t = o.kha_nang[Math.floor(Math.random() * o.kha_nang.length)],
          h = CONG_PHAP.find((n) => n.id === t),
          a = [...(i.co_phap_ngo || [])];
        a.includes(t) ||
          (a.push(t),
          await db("UPDATE players SET co_phap_ngo=$1, cong_phap=$2 WHERE user_id=$3", [a, t, e]));
        const c = Math.floor(3 * Math.random()) + 1;
        return (
          await db("UPDATE players SET ngo_tinh=LEAST(100,ngo_tinh+$1) WHERE user_id=$2", [c, e]),
          n.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`${CE('tip_icon','💡')} Lĩnh Ngộ Thành Công!`)
                .setColor(16766720)
                .setDescription(
                  `*Tâm hồn trầm xuống trong cổ thư, đạo lý ẩn sâu bỗng dưng hiển lộ...*\n\n📖 Đọc xong **${o.ten}**\n\n✨ **Ngộ được: ${h?.ten || t}!**\n*${h?.mo_ta || ""}*\n\n${CE("tunt", "🧠")} Ngộ Tính +${c}!${"ma_kinh_co_qua" === o.id ? "\n\n😈 *Đạo Tâm -20 vì đọc ma kinh!*" : ""}`,
                )
                .setFooter({ text: `Tỉ lệ lĩnh ngộ: ${Math.round(100 * u)}% | CD: 2h` }),
            ],
          })
        );
      }
      {
        const t = Math.random() < 0.3 ? 1 : 0;
        return (
          t &&
            (await db("UPDATE players SET ngo_tinh=LEAST(100,ngo_tinh+1) WHERE user_id=$1", [e])),
          n.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("😔 Lĩnh Ngộ Thất Bại")
                .setColor(9807270)
                .setDescription(
                  `*Tâm trí cố gắng thấm nhuần đạo lý nhưng vẫn còn mù mờ...*\n\n📖 Đã đọc **${o.ten}** nhưng chưa lĩnh hội được.\n\n*Tiếp tục tu luyện và thử lại sau.${t ? " Nhưng tâm cảnh tăng trưởng thêm chút (+1 Ngộ Tính)." : ""}*` +
                    ("ma_kinh_co_qua" === o.id ? `\n\n${CE("tam_ma","😈")} *Đạo Tâm -20 vì đọc ma kinh!*` : ""),
                )
                .setFooter({ text: `Tỉ lệ lĩnh ngộ: ${Math.round(100 * u)}% | CD: 2h` }),
            ],
          })
        );
      }
    }
    return n.reply({
      embeds: [
        errE(
          "`-linh_ngo xem` — Xem cổ thư lĩnh ngộ\n`-linh_ngo doc <id>` — Đọc cổ thư (RNG)",
        ),
      ],
    });
  });

  reg(
    "an_tinh",
    ["ngotinh", "ngo_tinh", "nt", "nhanqua", "nhan_qua", "nq", "karma", "antinh"],
    async (n) => {
      const t = n.author.id,
        e = await getPlayer(t);
      if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });
      const h = getNgoTinh(e.ngo_tinh || 50),
        i = getKhiVanBonus(e.khi_van || 30),
        a = getNhanQua(e.nhan_qua || 0),
        o = e.nhan_qua || 0;
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`✦ Ẩn Tính — ${n.author.username}`)
            .setColor(9323693)
            .setDescription(`*Ba chỉ số ẩn ảnh hưởng vận mệnh tu tiên của ngươi...*\n${SEP2}`)
            .addFields(
              {
                name: `${CE("tunt", "🧠")} Ngộ Tính — ${h.emoji} ${h.ten} (${e.ngo_tinh || 50}/100)`,
                value: `${pBar(e.ngo_tinh || 50)}\n*${h.mo_ta}*\n${CE("tutv", "📈")} Lĩnh Ngộ +${Math.round(100 * h.linh_ngo_bonus)}% · ✨ Thần Thông ${Math.round(100 * h.than_thong_rate)}% · ${CE("tip_icon","💡")} Ngộ Đạo ${Math.round(100 * h.ngo_dao_rate)}%\n*Tăng khi: Đọc cổ thư, Ngộ Đạo khi Thiên Kiếp, Đại Ngộ trong Cơ Duyên.*`,
                inline: !1,
              },
              {
                name: `${CE("tukv", "🍀")} Khí Vận — ${i.desc} (${e.khi_van || 30}/100)`,
                value: `${pBar(e.khi_van || 30)}\n${CE('ng_phu_luc_su','📜')} Truyền Thừa +${Math.round(100 * i.truyen_thua_rate)}% · ${CE('tukv','💎')} Bảo Vật ${Math.round(100 * i.bao_vat_rate)}% · 🗺️ Bí Cảnh +${Math.round(100 * i.bi_canh_bonus)}%\n*Tăng khi: Vượt Thiên Kiếp, Cứu Người, Ngộ Đạo. Giảm khi: Giết người, Ám Sát.*`,
                inline: !1,
              },
              {
                name: `⚖️ Nhân Quả — ${a.emoji} ${a.ten} (${o > 0 ? "+" : ""}${o})`,
                value: `${pBar(Math.max(0, Math.min(100, (o + 100) / 2)))}\n*${a.mo_ta}*\n✨ Công Đức: **${e.cong_duc || 0}** · 😈 Ma Khí: **${e.ma_khi || 0}**\n${CE("tukv", "🍀")} Khí Vận Bonus: ${a.khi_van_bonus >= 0 ? "+" : ""}${a.khi_van_bonus} · ⚡ Thiên Kiếp: ${a.kiep_giam > 0 ? `+${a.kiep_giam}%` : a.kiep_giam < 0 ? `${a.kiep_giam}%` : "Bình thường"}\n*Tăng khi: Cứu người (-co_duyen), Vượt kiếp. Giảm khi: Ám Sát, Hấp Thu.*`,
                inline: !1,
              },
            )
            .setFooter({ text: "-an_tinh | bí danh: -nt -kv -nq" }),
        ],
      });
  });

