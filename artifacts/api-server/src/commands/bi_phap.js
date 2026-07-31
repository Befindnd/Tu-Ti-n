'use strict';
const { LINH_THU_CRAFT, LINH_THU_LOOT_ITEMS } = require('../data/linh_thu_data');
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer, awardBiPhap, awardLinhThao } = require('../db/players');
const { CE, CEu, getCEUrl, getCardAttachment } = require('../systems/emoji');
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
  fmt, fmtLT, calcSpend, calcMultiSpend, MIXED_SPEND_THRESHOLD, getCG, pBar, fTime, cdRem, cdRemMin, embedClr,
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
      ? `${CE("lt_linh_chi","🌿")} Hái được **${e.ten} ×${e.gia_tri}**!`
      : "${CE('warn_icon','⚠️')} **Túi quá nặng** — linh thảo rơi xuống đất! Dùng `-tui` để kiểm tra.";
  }
  return { kq: a, resultStr: o };
}


reg("bi_phap", ["bp", "biphap"], async (n, t) => {
    const e = n.author.id,
      h = (t[0] || "xem").toLowerCase(),
      i = await getPlayer(e);
    if (!i) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("xem" === h) {
      const t = (n, t) => {
          const e = CANH_GIOI[n.canh_gioi] || {},
            h = n.bi_phap || [],
            i = CONG_PHAP.find((t) => t.id === n.cong_phap),
            a = [...new Set([...(n.co_phap_ngo || []), n.cong_phap].filter(Boolean))],
            o = new EmbedBuilder().setTitle("📘 Bí Pháp & Công Pháp").setColor(10181046);
          let c = `${SEP2}\n`;
          if (
            ((c += `🌌 **Cảnh giới:** ${e.ten || "Chưa rõ"}\n`),
            (c += `${CE('cp_thap_huyen','📜')} **Bí pháp đã học:** ${h.length}/8\n`),
            (c += `${i ? CE('cp_' + i.id, '📖') : '📖'} **Công pháp đang tu:** ${i ? i.ten : "*Chưa có*"}\n${SEP}\n`),
            "da_hoc" === t)
          )
            h.length
              ? (h.forEach((n, t) => {
                  const e = BI_PHAP.find((t) => t.id === n);
                  if (!e) return;
                  const h = BP_COMBAT[n];
                  let i = "";
                  (h &&
                    ("heal" === h.type
                      ? (i = `${CE("lt_linh_chi","🌿")} Hồi ${Math.round(100 * h.mult)}% HP`)
                      : "shield" === h.type
                        ? (i = `${CE("tudef", "🛡️")} Giảm ${Math.round(100 * h.mult)}% sát thương`)
                        : "atk" === h.type &&
                          (i = `${CE("tuatk", "⚔️")} ${Math.round(100 * h.mult)}% Công Lực · CD ${h.cd} lượt`)),
                    (c += `${CE('bp_' + e.id, '📜')} **${t + 1}. ${e.ten}** \`${e.id}\`\n${e.mo_ta}\n${i ? `${i} · ` : ""}Hồi chiêu: ${e.hoi_chieu} lượt · YC: cảnh giới ${e.yeu_cau_cap}\n\n`));
                }),
                (c += "*PvP: nút 📜 · Ngoài PvP: `-bi_phap su_dung <id>`*"))
              : (c += "*Chưa có bí pháp nào.*\nHọc tại tab **Có Thể Học** ở đây hoặc ngộ qua `-co_duyen`");
          else if ("co_the_hoc" === t) {
            const playerGiaToc = n.gia_toc || null;
            const t = BI_PHAP.filter((t) =>
              t.yeu_cau_cap <= n.canh_gioi &&
              !h.includes(t.id) &&
              !t.donate_only &&
              !t.gia_toc_only
            );
            t.length
              ? (t.forEach((n, t) => {
                  const e = BP_GIA[n.id] || 0;
                  c += `${CE('bp_' + n.id, '📜')} **${t + 1}. ${n.ten}** — ${fmtLT(e)}\n${n.mo_ta}\nYêu cầu: cảnh giới ${n.yeu_cau_cap}\n\n`;
                }),
                (c += "*Chọn bí pháp từ menu bên dưới để học*"))
              : (c += "*Không có bí pháp nào phù hợp để học thêm — hoặc đã học hết rồi!*");
            // Ghi chú bí pháp gia tộc
            if (playerGiaToc) {
              const { GIA_TOC } = require('../data/gia_toc');
              const gt = GIA_TOC.find(x => x.id === playerGiaToc);
              if (gt && gt.bi_phap_id && !h.includes(gt.bi_phap_id)) {
                const canLearn = (n.canh_gioi || 0) >= (gt.bi_phap_yc || 0);
                c += `\n${SEP}\n${CE("nq_nghiep","🩸")} **Bí Pháp Gia Tộc:** ${gt.bi_phap_ten}\n`;
                if (canLearn) {
                  c += `*${CE("nt_tien","✨")} Có thể học ngay — miễn phí! Dùng \`-gia_toc hoc\` để khai ngộ.*`;
                } else {
                  c += `*${CE('lock_icon','🔒')} Yêu cầu cảnh giới **${gt.bi_phap_yc}** (hiện tại: ${n.canh_gioi || 0}). Dùng \`-gia_toc hoc\` khi đủ điều kiện.*`;
                }
              }
            }
          } else if ("cong_phap" === t)
            if (a.length) {
              a.forEach((t, e) => {
                const h = CONG_PHAP.find((n) => n.id === t);
                if (!h) return;
                const i = n.cong_phap === t;
                ((c += `${CE('cp_' + h.id, '📖')} **${e + 1}. ${h.ten}**${i ? " ✅ **[Đang tu]**" : ""}\n`),
                  (c += `${CE("tutv", "📈")} +${Math.round(100 * h.exp_bonus)}% Tu · ${CE("tuatk", "⚔️")} +${Math.round(100 * h.atk_bonus)}% Công · ${CE("tudef", "🛡️")} +${Math.round(100 * h.def_bonus)}% Thủ\n`),
                  (c += `*${h.mo_ta}*\n\n`));
              });
              const t = CONG_PHAP.filter((t) => t.yeu_cau_cap <= n.canh_gioi && !a.includes(t.id));
              t.length &&
                ((c += `${SEP}\n**Có thể học thêm:**\n`),
                t.forEach((n) => {
                  const t = CP_GIA[n.id] || 0;
                  c += `${CE('cp_' + n.id, '📖')} **${n.ten}** — ${fmtLT(t)} · YC: cảnh giới ${n.yeu_cau_cap}\n`;
                }),
                (c += "\n*Chọn công pháp từ menu bên dưới để mua/đổi*"));
            } else c += "*Chưa học công pháp nào.*\nChọn từ menu bên dưới để mua";
          o.setDescription(c);
          o.setFooter({ text: `${CEu("tult","💠")} ${fmt(n.linh_thach||0)}${Number(n.linh_thach_trung||0)>0?` · ${CEu("tult_trung","🔮")} ${fmt(n.linh_thach_trung)} Trung`:''}${Number(n.linh_thach_cao||0)>0?` · ${CEu("tult_cao","💚")} ${fmt(n.linh_thach_cao)} Cao`:''}` });
          const _files = [];
          let _cardKey = null;
          if ("da_hoc" === t && h.length) {
            const firstBp = BI_PHAP.find((x) => x.id === h[0]);
            if (firstBp) _cardKey = 'bp_' + firstBp.id;
          } else if ("cong_phap" === t && i) {
            _cardKey = 'cp_' + i.id;
          } else if ("co_the_hoc" === t) {
            const avail = BI_PHAP.filter((x) => x.yeu_cau_cap <= n.canh_gioi && !h.includes(x.id));
            if (avail.length) _cardKey = 'bp_' + avail[0].id;
          }
          if (_cardKey) {
            const att = getCardAttachment(_cardKey);
            if (att) { _files.push(att); o.setImage('attachment://card.png'); }
          }
          return { embed: o, files: _files };
        },
        h = (n, t) => {
          const e = [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("bp_view_da_hoc")
                .setLabel("Đã Học")
                .setStyle("da_hoc" === t ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji("📘"),
              new ButtonBuilder()
                .setCustomId("bp_view_co_the_hoc")
                .setLabel("Có Thể Học")
                .setStyle("co_the_hoc" === t ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji(CE("nt_tien","✨")),
              new ButtonBuilder()
                .setCustomId("bp_view_cong_phap")
                .setLabel("Công Pháp")
                .setStyle("cong_phap" === t ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji("📖"),
              new ButtonBuilder()
                .setCustomId("bp_view_reload")
                .setLabel("Tải Lại")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("🔄"),
            ),
          ];
          if ("co_the_hoc" === t) {
            const t = n.bi_phap || [],
              _playerGiaToc = n.gia_toc || null,
              h = BI_PHAP.filter((e) =>
                e.yeu_cau_cap <= n.canh_gioi &&
                !t.includes(e.id) &&
                !e.donate_only &&
                !e.gia_toc_only
              );
            h.length > 0 &&
              e.push(
                new ActionRowBuilder().addComponents(
                  new StringSelectMenuBuilder()
                    .setCustomId("bp_buy_select")
                    .setPlaceholder("📜 Chọn bí pháp để học ngay...")
                    .addOptions(
                      h
                        .slice(0, 25)
                        .map((n) => ({
                          label: n.ten,
                          value: n.id,
                          description: `${CEu("tult", "💠")} ${fmt(BP_GIA[n.id] || 0)} · YC cảnh giới ${n.yeu_cau_cap}`,
                          emoji: "📜",
                        })),
                    ),
                ),
              );
          } else if ("cong_phap" === t) {
            const t = [...new Set([...(n.co_phap_ngo || []), n.cong_phap].filter(Boolean))],
              h = CONG_PHAP.filter((e) => e.yeu_cau_cap <= n.canh_gioi && !t.includes(e.id)),
              i = CONG_PHAP.filter((e) => t.includes(e.id) && e.id !== n.cong_phap),
              a = [];
            (h.forEach((n) =>
              a.push({
                label: `🛒 Mua: ${n.ten}`,
                value: `buy_${n.id}`,
                description: `${CEu("tult", "💠")} ${fmt(CP_GIA[n.id] || 0)} · +${Math.round(100 * n.exp_bonus)}% Tu · +${Math.round(100 * n.atk_bonus)}% Công`,
              }),
            ),
              i.forEach((n) =>
                a.push({
                  label: `🔄 Đổi sang: ${n.ten}`,
                  value: `sw_${n.id}`,
                  description: `+${Math.round(100 * n.exp_bonus)}% Tu · +${Math.round(100 * n.atk_bonus)}% Công · +${Math.round(100 * n.def_bonus)}% Thủ`,
                }),
              ),
              a.length > 0 &&
                e.push(
                  new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                      .setCustomId("cp_action_select")
                      .setPlaceholder("📖 Mua hoặc đổi công pháp...")
                      .addOptions(a.slice(0, 25)),
                  ),
                ));
          }
          if ("da_hoc" === t && (n.bi_phap || []).length > 0) {
            e.push(
              new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                  .setCustomId("bp_delete_select")
                  .setPlaceholder("🗑️ Xóa bí pháp... (chọn bí pháp muốn xóa)")
                  .addOptions(
                    (n.bi_phap || []).map((id) => {
                      const bp = BI_PHAP.find((x) => x.id === id);
                      return {
                        label: `Xóa: ${bp ? bp.ten : id}`,
                        value: id,
                        description: bp ? bp.mo_ta.slice(0, 50) : id,
                        emoji: "🗑️",
                      };
                    })
                  )
              )
            );
          }
          return e;
        };
      let a = "da_hoc",
        o = "";
      const { embed: _ie, files: _if } = t(i, a);
      const c = await n.reply({ embeds: [_ie], files: _if, components: h(i, a) }),
        _ = c.createMessageComponentCollector({ filter: (n) => n.user.id === e, time: 9e4 });
      return (
        _.on("collect", async (n) => {
          if ("bp_buy_select" === n.customId) {
            await n.deferUpdate();
            const i = n.values[0],
              _ = await getPlayer(e),
              u = BI_PHAP.find((n) => n.id === i),
              r = BP_GIA[i] || 0;
            u
              ? u.donate_only
                ? (o = `❌ **${u.ten}** là bí pháp Độc Quyền — chỉ nhận được qua \`-donate\`!`)
                : u.gia_toc_only && u.gia_toc_id !== (_.gia_toc || null)
                  ? (o = `❌ **${u.ten}** là bí pháp huyết thống — chỉ gia tộc **${u.gia_toc_id}** mới có thể học!`)
                  : (_.bi_phap || []).includes(i)
                    ? (o = `${CE('warn_icon','⚠️')} Đã học ${u.ten} rồi!`)
                    : (_.bi_phap || []).length >= 8
                      ? (o = "❌ Đã tối đa 8 bí pháp!")
                      : canAddToBag(_, "bi_phap", 1)
                        ? !(r >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(_, r) : calcSpend(_, r))
                          ? (o = `❌ Thiếu Linh Thạch! Cần ${fmt(r)} ${CE("tult", "💠")} | Có ${CE("tult","💠")}${fmt(_.linh_thach)}${Number(_.linh_thach_trung||0)>0?` ${CE("tult_trung","🔮")}${fmt(_.linh_thach_trung)}Trung`:''}${Number(_.linh_thach_cao||0)>0?` ${CE("tult_cao","💚")}${fmt(_.linh_thach_cao)}Cao`:''}`)
                          : (await db(
                              "UPDATE players SET bi_phap=array_append(bi_phap,$1), linh_thach=$2, linh_thach_trung=$3, linh_thach_cao=$4 WHERE user_id=$5",
                              (() => { const _s = r >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(_, r) : calcSpend(_, r); return [i, _s.newThuong, _s.newTrung, _s.newCao, e]; })(),
                            ),
                            (o = `✅ Học được ${u.ten}! -${fmt(r)} ${CE("tult", "💠")}`))
                        : (o = "❌ Túi quá nặng!")
              : (o = "❌ Không tìm thấy bí pháp!");
            const s = await getPlayer(e);
            const { embed: l, files: lf } = t(s, a);
            l.setFooter({ text: o });
            return void (await c.edit({ embeds: [l], files: lf, components: h(s, a) }));
          }
          if ("bp_delete_select" === n.customId) {
            await n.deferUpdate();
            const bpId = n.values[0];
            const _p = await getPlayer(e);
            const bpInfo = BI_PHAP.find((x) => x.id === bpId);
            if (!(_p.bi_phap || []).includes(bpId)) {
              o = `${CE('warn_icon','⚠️')} Không tìm thấy bí pháp này trong danh sách của ngươi!`;
            } else {
              await db("UPDATE players SET bi_phap=array_remove(bi_phap,$1) WHERE user_id=$2", [bpId, e]);
              o = `🗑️ Đã xóa **${bpInfo?.ten || bpId}**! Slot bí pháp đã được giải phóng.`;
            }
            const _ps = await getPlayer(e);
            const { embed: _pe, files: _pf } = t(_ps, a);
            _pe.setFooter({ text: o });
            return void (await c.edit({ embeds: [_pe], files: _pf, components: h(_ps, a) }));
          }
          if ("cp_action_select" === n.customId) {
            await n.deferUpdate();
            const i = n.values[0],
              _ = await getPlayer(e);
            if (i.startsWith("buy_")) {
              const n = i.slice(4),
                t = CONG_PHAP.find((t) => t.id === n),
                h = CP_GIA[n] || 0;
              if (t)
                if (_.canh_gioi < (t.yeu_cau_cap || 0))
                  o = `❌ Cảnh giới chưa đủ (cần tầng ${t.yeu_cau_cap})`;
                else if (!(h >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(_, h) : calcSpend(_, h)))
                  o = `❌ Thiếu Linh Thạch! Cần ${fmt(h)} ${CE("tult","💠")} | Có ${CE("tult","💠")}${fmt(_.linh_thach)}${Number(_.linh_thach_trung||0)>0?` ${CE("tult_trung","🔮")}${fmt(_.linh_thach_trung)}Trung`:''}${Number(_.linh_thach_cao||0)>0?` ${CE("tult_cao","💚")}${fmt(_.linh_thach_cao)}Cao`:''}`;
                else {
                  const _s = h >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(_, h) : calcSpend(_, h);
                  const i = [...(_.co_phap_ngo || [])];
                  (i.includes(n) || i.push(n),
                    await db(
                      "UPDATE players SET cong_phap=$1, linh_thach=$2, linh_thach_trung=$3, linh_thach_cao=$4, co_phap_ngo=$5 WHERE user_id=$6",
                      [n, _s.newThuong, _s.newTrung, _s.newCao, i, e],
                    ),
                    (o = `✅ Học và tu luyện ${t.ten}! -${fmt(h)} ${CE("tult", "💠")}`));
                }
              else o = "❌ Không tìm thấy công pháp!";
            } else if (i.startsWith("sw_")) {
              const n = i.slice(3),
                t = CONG_PHAP.find((t) => t.id === n);
              t
                ? (await db("UPDATE players SET cong_phap=$1 WHERE user_id=$2", [n, e]),
                  (o = `✅ Chuyển sang tu luyện ${t.ten}!`))
                : (o = "❌ Không tìm thấy công pháp!");
            }
            const u = await getPlayer(e);
            const { embed: r, files: rf } = t(u, a);
            r.setFooter({ text: o });
            return void (await c.edit({ embeds: [r], files: rf, components: h(u, a) }));
          }
          (await n.deferUpdate(),
            "bp_view_da_hoc" === n.customId
              ? (a = "da_hoc")
              : "bp_view_co_the_hoc" === n.customId
                ? (a = "co_the_hoc")
                : "bp_view_cong_phap" === n.customId && (a = "cong_phap"));
          const i = await getPlayer(e);
          const { embed: te, files: tf } = t(i, a);
          await c.edit({ embeds: [te], files: tf, components: h(i, a) });
        }),
        void _.on("end", () => {
          c.edit({ components: [] }).catch(() => {});
        })
      );
    }
    if ("su_dung" === h) {
      const h = (t[1] || "").toLowerCase();
      if (!h)
        return n.reply({
          embeds: [errE("Cú pháp: `-bi_phap su_dung <id>`\nXem ID bí pháp bằng `-bi_phap xem`")],
        });
      const a = BI_PHAP.find((n) => n.id === h);
      if (!a)
        return n.reply({
          embeds: [errE(`Bí pháp \`${h}\` không tồn tại!\nXem ID đúng bằng \`-bi_phap xem\``)],
        });
      const o = BP_COMBAT[h];
      if (!o)
        return n.reply({
          embeds: [
            errE(`**${a.ten}** chỉ có thể dùng trong PvP!\nNhấn nút 📜 Bí Pháp khi tham chiến.`),
          ],
        });
      if (!(i.bi_phap || []).includes(h))
        return n.reply({ embeds: [errE(`Ngươi chưa học **${a.ten}**!`)] });
      // ── CD ngoài PvP: hoi_chieu × 1 giờ ─────────────────────────────
      {
        const _cdMs = (a.hoi_chieu || 3) * 3_600_000;
        const _cdMap = (i.bi_phap_cd && typeof i.bi_phap_cd === 'object' && !Array.isArray(i.bi_phap_cd))
          ? i.bi_phap_cd : {};
        const _cdRem = _cdMs - (Date.now() - Number(_cdMap[h] || 0));
        if (_cdRem > 0) {
          const _rs   = Math.ceil(_cdRem / 1000);
          const _rh   = Math.floor(_rs / 3600);
          const _rm   = Math.floor((_rs % 3600) / 60);
          const _rsec = _rs % 60;
          const _rt   = _rh > 0 ? `${_rh}h ${_rm}p` : _rm > 0 ? `${_rm}p ${_rsec}s` : `${_rsec}s`;
          return n.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} **${a.ten}** đang hồi chiêu! Còn **${_rt}**.\n*(CD ngoài PvP: ${a.hoi_chieu || 3}h)*`)] });
        }
      }
      if ("atk" === o.type)
        return n.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${CE('cp_thap_huyen','📜')} ${a.ten}`)
              .setColor(15158332)
              .setDescription(
                `${CE("tuatk", "⚔️")} Bí pháp công kích này chỉ phát huy uy lực trong PvP!\nTrong trận tỷ thí, nhấn nút **📜 Bí Pháp** để thi triển.`,
              )
              .setFooter({ text: "Công Kích Bí Pháp — Chỉ Dùng Trong PvP" }),
          ],
        });
      const c = tinhCS(i),
        _ = c?.hp_max || 100;
      let u = "";
      if ("heal" === o.type) {
        const t = Math.max(0, Math.floor(Number(i.hp) || _));
        if (t >= _)
          return n.reply({
            embeds: [
              warnE(
                `${CE("tuhp", "💜")} Linh Lực của ngươi đã đầy **(${fmt(t)} / ${fmt(_)})**!\nKhông cần thi triển **${a.ten}**.`,
              ),
            ],
          });
        const h = Math.floor(_ * o.mult),
          c = Math.min(_, t + h);
        (await db("UPDATE players SET hp=$1 WHERE user_id=$2", [c, e]),
          (u = `🌿 **${a.ten}** thi triển!\n\n${CE("tuhp", "💜")} Hồi phục **${fmt(c - t)}** Linh Lực\n*(${fmt(c)} / ${fmt(_)})*`));
      } else {
        if ("shield" !== o.type)
          return n.reply({ embeds: [errE("Bí pháp loại này chỉ dùng được trong PvP!")] });
        {
          const n = Math.floor(0.2 * _),
            t = Math.max(0, Math.floor(Number(i.hp) || _)),
            h = Math.min(_, t + n);
          (await db("UPDATE players SET hp=$1 WHERE user_id=$2", [h, e]),
            (u = `${CE("tudef", "🛡️")} **${a.ten}** thi triển!\n\n${CE("tuhp", "💜")} Linh Giáp hộ thể, hồi **${fmt(h - t)}** Linh Lực\n*(${fmt(h)} / ${fmt(_)})*\n*Trong PvP: giảm ${Math.round(100 * o.mult)}% tổn thương nhận vào.*`));
        }
      }
      // Ghi CD vào DB sau khi thi triển thành công
      const _bpCdH = a.hoi_chieu || 3;
      await db(
        "UPDATE players SET bi_phap_cd=COALESCE(bi_phap_cd,'{}') || jsonb_build_object($1, $2::bigint) WHERE user_id=$3",
        [h, Date.now(), e],
      );
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE("nt_tien","✨")} Thi Triển Bí Pháp!`)
            .setColor(10181046)
            .setDescription(u)
            .setFooter({ text: `${a.ten} — Ngoài PvP · CD: ${_bpCdH}h` }),
        ],
      });
    }
    return n.reply({
      embeds: [errE("`-bi_phap xem` — Xem bí pháp\n`-bi_phap su_dung <id>` — Thi triển bí pháp")],
    });
  });

