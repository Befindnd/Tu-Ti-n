'use strict';
// ── 🔱  Phi Khí Sư — Đặc Kỹ Mới ──
'use strict';
/**
 * nghe_dac_ky_moi.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tính năng đặc kỹ MỚI cho tất cả 7 nghề:
 *   🗡️  Ám Vệ      — trinh_sat, xa_tinh, sat_y
 *   🔱  Phi Khí Sư — bo_khi, linh_bieu
 *   📜  Phù Lục Sư — phu_pham, ve_phong_an
 *   🧭  Phong Thủy — tien_tri, tran_van
 *   💉  Dược Sư    — che_doc, giai_doc
 *   ⚗️  Luyện Đan  — dan_kho, tang_dan
 *   🌀  Ngộ Đạo Sư — cong_huong, dao_kinh
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db }        = require('../../db/pool');
const { getPlayer } = require('../../db/players');
const { CE, CEu }   = require('../../systems/emoji');
const {
  CANH_GIOI, VU_KHI, LINH_THAO, DAN_DUOC, DAN_PHAM, DAN_PHAM_ORDER, KHOANG_VAT,
  PHU_LUC_DATA, NGHE, REN_LUYEN_CAP,
} = require('../../data');
const { LINH_THU_LOOT_ITEMS } = require('../../data/linh_thu_data');
const {
  fmt, fmtLT, calcSpend, calcMultiSpend, MIXED_SPEND_THRESHOLD, fTime, cdRem, cdRemMin, cdTs,
  errE, warnE, okE,
  tinhCS, calcEXP_active, calcMaxLinhThach,
  reg, SEP,
} = require('../../utils');


// ═══════════════════════════════════════════════════════════════════════════════
// 🔱  PHI KHÍ SƯ — TÍNH NĂNG MỚI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * -bo_khi @người
 * Truyền linh khí vào phi khí của đồng đạo — +15% ATK cho PvP tiếp theo.
 * CD 3h | 3 Sắt Tinh + 3,000💠
 */
reg('bo_khi', ['bokhi', 'bk_phi', 'truyen_khi'], async (msg) => {
  const userId = msg.author.id;
  const target = msg.mentions.users.first();
  if (!target || target.bot || target.id === userId)
    return msg.reply({ embeds: [errE('Cú pháp: `-bo_khi @người_chơi`')] });

  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'luyen_khi')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **🔱 Phi Khí Sư**!')] });

  const buff    = typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};
  const cdLeft  = cdRem(buff.bo_khi_cd, 3);
  if (cdLeft) return msg.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Linh khí chưa tụ đủ! Hết CD ${cdTs(buff.bo_khi_cd, 3)}`)] });

  const PHI     = 3000;
  const SAT_CAN = 3;
  const kv      = player.khoang_vat || {};
  const satTinh = Number(kv.sat_tinh || 0);

  if (satTinh < SAT_CAN)
    return msg.reply({ embeds: [errE(`Cần **${SAT_CAN} ⚙️ Sắt Tinh**! Hiện có: **${satTinh}**\n${CE('tip_icon','💡')} Dùng \`-khai_quang\` để khai mỏ.`)] });
  if (!calcSpend(player, PHI))
    return msg.reply({ embeds: [errE(`Cần **${fmt(PHI)}** ${CE('tult','💠')}!\nHiện có: **${CE('tult','💠')}${fmt(player.linh_thach)}**${Number(player.linh_thach_trung||0)>0?` · **${CE('tult_trung','🔮')}${fmt(player.linh_thach_trung)} Trung**`:''}${Number(player.linh_thach_cao||0)>0?` · **${CE('tult_cao','💚')}${fmt(player.linh_thach_cao)} Cao**`:''}`)] });

  const tgt = await getPlayer(target.id);
  if (!tgt) return msg.reply({ embeds: [errE(`**${target.username}** chưa tu tiên!`)] });

  const newKv   = { ...kv, sat_tinh: satTinh - SAT_CAN };
  if (newKv.sat_tinh <= 0) delete newKv.sat_tinh;

  const tgtBuff = typeof tgt.buff_active === 'object' && tgt.buff_active ? tgt.buff_active : {};
  const newTgtBuff = { ...tgtBuff, bo_khi_charges: 1 };

  { const _s = calcSpend(player, PHI);
    await db('UPDATE players SET khoang_vat=$1, linh_thach=$2, linh_thach_trung=$3, linh_thach_cao=$4, buff_active=$5 WHERE user_id=$6',
      [JSON.stringify(newKv), _s.newThuong, _s.newTrung, _s.newCao, JSON.stringify({ ...buff, bo_khi_cd: Date.now() }), userId]); }
  await db('UPDATE players SET buff_active=$1 WHERE user_id=$2',
    [JSON.stringify(newTgtBuff), target.id]);

  try {
    await target.send({
      embeds: [new EmbedBuilder()
        .setColor(0xff8c00)
        .setTitle('🔱 Phi Khí Nhận Được Linh Khí Bổ Sung!')
        .setDescription(`✨ **${msg.author.username}** (Phi Khí Sư) vừa bổ sung linh khí cho phi khí của bạn!\n\n⚔️ **+15% Công Lực** trong **PvP tiếp theo**!\n${CE('tip_icon','💡')} Dùng \`-pvp @người\` để kích hoạt buff!`)],
    });
  } catch {}

  return msg.reply({
    embeds: [new EmbedBuilder()
      .setTitle('🔱 Bổ Khí — Linh Khí Truyền Vào Phi Khí!')
      .setColor(0xff8c00)
      .setDescription(
        `*Linh khí thuần khiết từ mỏ quặng tuôn vào phi khí ${target.username} — hào quang sáng rực!*\n\n` +
        `${CE('tunt','🎯')} Mục tiêu: **${target.username}**\n` +
        `⚔️ Buff: **+15% Công Lực** cho PvP tiếp theo\n\n` +
        `💸 Tiêu: **${SAT_CAN} ⚙️ Sắt Tinh** + **${fmt(PHI)}** ${CE('tult','💠')}`,
      )
      .setFooter({ text: 'Phi Khí Sư | Bổ Khí | CD: 3h' })],
  });
});

/**
 * -linh_bieu
 * Xem toàn bộ trạng thái phi khí và khoáng vật — bảng hiển thị mới đẹp hơn.
 */
reg('linh_bieu', ['linhbieu', 'lb_phi', 'phikhi_info'], async (msg) => {
  const userId = msg.author.id;
  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'luyen_khi')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **🔱 Phi Khí Sư**!')] });

  const cs         = tinhCS(player);
  const vuKhi      = require('../../data').VU_KHI.find(v => v.id === player.vu_khi);
  const vu_khi_cap = player.vu_khi_cap || 0;
  const kv         = player.khoang_vat || {};
  const hasTP      = player.thien_phu_nghe === 'luyen_khi';

  // Bonus từ rèn luyện
  const REN_LUYEN_CAP = require('../../data').REN_LUYEN_CAP;
  const renCap = REN_LUYEN_CAP.find(r => r.cap === vu_khi_cap) || null;
  const atk_bonus_pct = renCap ? Math.round(100 * renCap.atk_bonus) : 0;

  // Khoáng vật inventory
  const KHOANG_VAT_DATA = KHOANG_VAT || [];
  const kvLines = KHOANG_VAT_DATA.map(k => {
    const qty = kv[k.id] || 0;
    return qty > 0 ? `${k.emoji} **${k.ten}** ×${qty}` : null;
  }).filter(Boolean);

  // Buff states
  const buff = typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};
  const sacBenActive = (buff.sac_ben_charges || 0) > 0;
  const boKhiActive  = (buff.bo_khi_charges || 0) > 0;

  const embed = new EmbedBuilder()
    .setTitle(`🔱 Linh Biểu — ${vuKhi?.ten || 'Chưa có Phi Khí'}`)
    .setColor(0xff8c00)
    .setDescription(
      `*Phi khí là linh hồn của Phi Khí Sư — càng tôi luyện, sức mạnh càng vô biên...*\n\n` +
      `🗡️ **Phi Khí:** ${vuKhi ? `${CE(vuKhi.ce_name, vuKhi.pham || '⚔️')} ${vuKhi.ten}` : '⚪ Chưa trang bị'}\n` +
      `🔨 **Tôi Luyện:** +${vu_khi_cap}/+10 ${vu_khi_cap >= 10 ? '*(Tối đa ✨)*' : ''}\n` +
      `⚔️ **Công Lực Phi Khí:** +${atk_bonus_pct}% *(${hasTP ? '+10% Thiên Phú' : 'thường'})*\n` +
      `📊 **Tổng Công Lực:** ${fmt(cs.atk)}\n\n` +
      `**━━━ Kho Khoáng Vật ━━━**\n` +
      (kvLines.length ? kvLines.join(' · ') : '*Kho trống — dùng `-khai_quang` để khai mỏ!*') + '\n\n' +
      `**━━━ Buff Hiện Tại ━━━**\n` +
      `🗡️ **Sắc Bén:** ${sacBenActive ? '✅ Kích hoạt — +20% ATK PvP tiếp' : '❌ Chưa kích hoạt'}\n` +
      `🔱 **Bổ Khí (nhận):** ${boKhiActive ? '✅ Được buff — +15% ATK PvP tiếp' : '❌ Không có'}\n\n` +
      `**━━━ Lệnh Đặc Kỹ ━━━**\n` +
      `\`-khai_quang\` · \`-bao_linh\` · \`-sac_ben\` · \`-vo_trang @người\`\n` +
      `\`-bo_khi @người\` *(MỚI)* · \`-ren_luyen nang_cap\``,
    )
    .setThumbnail(msg.author.displayAvatarURL())
    .setFooter({ text: `Phi Khí Sư | ${hasTP ? '✨ Thần Binh Giác Tỉnh đang hoạt động' : 'Tôi luyện mỗi giờ!'}` });

  return msg.reply({ embeds: [embed] });
});


// ═══ PHI KHÍ SƯ — Đặc Kỹ Cũ (ren_luyen, sac_ben, vo_trang) ═══
reg("ren_luyen", ["rl", "renluyen"], async (n, t) => {
    const e = n.author.id,
      h = (t[0] || "xem").toLowerCase(),
      i = await getPlayer(e);
    if (!i) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("luyen_khi" !== i.nghe)
      return n.reply({
        embeds: [errE("Lệnh này chỉ dành cho **🔱 Phi Khí Sư**!\nĐổi: `-nghe chon luyen_khi`")],
      });
    const a = VU_KHI.find((n) => n.id === i.vu_khi),
      o = i.vu_khi_cap || 0,
      c = REN_LUYEN_CAP.find((n) => n.cap === o + 1);
    if ("xem" === h) {
      const kv_stock = i.khoang_vat || {};
      const vp_stock = i.vat_pham   || {};
      const t = REN_LUYEN_CAP.map((n) => {
          const t = n.cap <= o ? "✅" : n.cap === o + 1 ? "▶️" : CE('lock_icon','🔒');
          let matStr;
          if (n.vat_pham_lieu) {
            matStr = Object.entries(n.vat_pham_lieu)
              .map(([id, qty]) => {
                const info = LINH_THU_LOOT_ITEMS[id];
                const have = vp_stock[id] || 0;
                return `${info?.emoji || '🧪'}${info?.ten || id}×${qty}(${have})`;
              })
              .join(" ");
          } else {
            matStr = Object.entries(n.vat_lieu || {})
              .map(([id, qty]) => {
                const kd = KHOANG_VAT.find((k) => k.id === id);
                const have = kv_stock[id] || 0;
                return `${kd?.emoji || '🪨'}${kd?.ten || id}×${qty}(${have})`;
              })
              .join(" ");
          }
          return `${t} **+${n.cap}** T${n.yeu_cau_cap} · ${fmtLT(n.phi)} · ${matStr} — *${n.mo_ta.replace("Công Lực", "").trim()}*`;
        }),
        e =
          !!c &&
          i.canh_gioi >= (c.yeu_cau_cap || 0) &&
          Number(i.linh_thach || 0) >= c.phi &&
          (c.vat_pham_lieu
            ? Object.entries(c.vat_pham_lieu).every(([id, qty]) => (i.vat_pham || {})[id] >= qty)
            : Object.entries(c.vat_lieu || {}).every(([id, qty]) => (i.khoang_vat || {})[id] >= qty)),
        h = c
          ? new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("rl_nang_cap")
                .setLabel(`🔨 Tôi Luyện → Cấp +${c.cap}`)
                .setStyle(e ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(!e),
            )
          : null,
        _ = "luyen_khi" === i.thien_phu_nghe,
        kv_line = KHOANG_VAT.map(k => {
          const qty = kv_stock[k.id] || 0;
          return qty > 0 ? `${k.emoji}${k.ten}:${qty}` : null;
        }).filter(Boolean).join(' · ') || 'Kho trống — dùng `-khai_quang` để khai mỏ',
        u =
          `\n\n📦 **Kho Khoáng Vật:** ${kv_line}\n\n🔱 **Đặc Kỹ Phi Khí Sư:**\n• \`-khai_quang\` — Khai mỏ thu **khoáng vật** tôi luyện phi khí · CD 1h\n• \`-bao_linh\` — 3⚙️Sắt Tinh + 1,500${CE("tult", "💠")} → **Tu Vi tức thì** · CD 45ph\n• \`-sac_ben\` — 2⚙️Sắt Tinh + 2,250${CE("tult", "💠")} → **+20% Công Lực** PVP tiếp · CD 2h\n• \`-vo_trang @người\` — 2,250${CE("tult", "💠")} → **Phong Tỏa Phi Khí** đối thủ · CD 4h\n• \`-tb\` → tab Linh Bảo → 🔨 Chế Tạo Bảo Bối từ nguyên liệu Linh Thú\n` +
          (_ ? "• ✨ **Thần Binh Giác Tỉnh** — +10% Công Lực bổ sung từ phi khí rèn luyện" : ""),
        r = new EmbedBuilder()
          .setTitle(`🔱 Tôi Luyện — ${a ? CE(a.ce_name, a.pham || '⚪') : '⚪'} ${a?.ten || "Chưa có phi khí"} (+${o})`)
          .setColor(15105570)
          .setDescription(t.join("\n") + u)
          .setFooter({
            text: `${CEu("tult","💠")} ${fmt(i.linh_thach||0)}${Number(i.linh_thach_trung||0)>0?` · ${CEu("tult_trung","🔮")} ${fmt(i.linh_thach_trung)} Trung`:''}${Number(i.linh_thach_cao||0)>0?` · ${CEu("tult_cao","💚")} ${fmt(i.linh_thach_cao)} Cao`:''} ${c ? `| Tiếp theo: +${c.cap} · ${fmt(c.phi)}${CEu("tult","💠")}` : '| ✨ Đã đạt tối đa +10!'}`,
          });
      return n.reply({ embeds: [r], ...(h ? { components: [h] } : {}) });
    }
    if ("nang_cap" === h || "up" === h) {
      if (!c)
        return n.reply({
          embeds: [okE("✨ Phi khí đã đạt **Cấp Tối Đa (+10)** — Thần Thú Tuyệt Đỉnh!")],
        });
      if (i.canh_gioi < (c.yeu_cau_cap || 0))
        return n.reply({
          embeds: [
            errE(
              `Cảnh giới chưa đủ để tôi luyện **Cấp +${c.cap}**!\nCần tầng **${c.yeu_cau_cap}** | Hiện tại tầng **${i.canh_gioi}**`,
            ),
          ],
        });
      const _spend = c.phi >= MIXED_SPEND_THRESHOLD ? calcMultiSpend(i, c.phi) : calcSpend(i, c.phi);
      if (!_spend)
        return n.reply({
          embeds: [
            errE(
              `Cần **${fmt(c.phi)} ${CE("tult","💠")}**!\nHiện có: **${CE("tult","💠")}${fmt(i.linh_thach)}**${Number(i.linh_thach_trung||0)>0?` · **${CE("tult_trung","🔮")}${fmt(i.linh_thach_trung)} Trung**`:''}${Number(i.linh_thach_cao||0)>0?` · **${CE("tult_cao","💚")}${fmt(i.linh_thach_cao)} Cao**`:''}`,
            ),
          ],
        });

      // Kiểm tra vật liệu — vat_pham_lieu (loot linh thú) hoặc vat_lieu (khoáng vật)
      if (c.vat_pham_lieu) {
        const vp = i.vat_pham || {};
        for (const [id, qty] of Object.entries(c.vat_pham_lieu)) {
          if ((vp[id] || 0) < qty) {
            const info = LINH_THU_LOOT_ITEMS[id];
            return n.reply({
              embeds: [errE(`Thiếu **${info?.emoji || '🧪'}${info?.ten || id}**! Cần ${qty}, có ${vp[id] || 0}.\n${CE("tip_icon","💡")} Dùng \`-san_linh_thu\` để săn Linh Thú.`)],
            });
          }
        }
        const newVp = { ...vp };
        for (const [id, qty] of Object.entries(c.vat_pham_lieu)) {
          newVp[id] = (newVp[id] || 0) - qty;
          if (newVp[id] <= 0) delete newVp[id];
        }
        await db(
          "UPDATE players SET linh_thach=$1, linh_thach_trung=$2, linh_thach_cao=$3, vat_pham=$4, vu_khi_cap=$5 WHERE user_id=$6",
          [_spend.newThuong, _spend.newTrung, _spend.newCao, JSON.stringify(newVp), c.cap, e],
        );
      } else {
        const kv = i.khoang_vat || {};
        for (const [id, qty] of Object.entries(c.vat_lieu || {})) {
          if ((kv[id] || 0) < qty) {
            const kd = KHOANG_VAT.find((n) => n.id === id);
            return n.reply({
              embeds: [errE(`Thiếu **${kd?.emoji || '🪨'}${kd?.ten || id}**! Cần ${qty}, có ${kv[id] || 0}.\n${CE("tip_icon","💡")} Dùng \`-khai_quang\` để khai mỏ.`)],
            });
          }
        }
        const newKv = { ...kv };
        for (const [id, qty] of Object.entries(c.vat_lieu || {})) {
          newKv[id] = (newKv[id] || 0) - qty;
          if (newKv[id] <= 0) delete newKv[id];
        }
        await db(
          "UPDATE players SET linh_thach=$1, linh_thach_trung=$2, linh_thach_cao=$3, khoang_vat=$4, vu_khi_cap=$5 WHERE user_id=$6",
          [_spend.newThuong, _spend.newTrung, _spend.newCao, JSON.stringify(newKv), c.cap, e],
        );
      }

      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔱 Tôi Luyện Phi Khí Thành Công!")
            .setColor(15105570)
            .setDescription(
              `${a ? CE(a.ce_name, a.pham || '') : ''} **${a?.ten || "Phi Khí"}** đã tôi luyện lên **Cấp +${c.cap}**!\n\n✨ ${c.mo_ta}\n${CE("tuatk", "⚔️")} Công Lực phi khí: **+${Math.round(100 * c.atk_bonus)}%**\n\n${CE("tult", "💠")} -${fmt(c.phi)} Linh Thạch`,
            ),
        ],
      });
    }
    return n.reply({ embeds: [errE("`-ren_luyen xem` | `-ren_luyen nang_cap`")] });
  });

reg("sac_ben", ["sb_phi", "sacben"], async (n) => {
    const t = n.author.id,
      e = await getPlayer(t, n.author.username);
    if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("luyen_khi" !== e.nghe)
      return n.reply({
        embeds: [errE("Lệnh này chỉ dành cho **🔱 Phi Khí Sư**!\nĐổi: `-nghe chon luyen_khi`")],
      });
    const h = 2250,
      i = "object" == typeof e.buff_active && e.buff_active ? e.buff_active : {};
    if ((i.sac_ben_charges || 0) > 0) {
      const t = tinhCS(e);
      return n.reply({
        embeds: [
          warnE(`🔱 Phi khí đang **Sắc Bén** (+${CE("tuatk","⚔️")} **${fmt(t.atk)}**) — vào PVP để kích hoạt!`),
        ],
      });
    }
    const a = cdRem(i.sac_ben_cd, 2);
    if (a)
      return n.reply({
        embeds: [warnE(`${CE("cd_timer","⏳")} Phi khí cần thời gian phục hồi!\nHết CD ${cdTs(i.sac_ben_cd, 2)} để mài sắc.`)],
      });
    const kv = e.khoang_vat || {},
      sat = kv.sat_tinh || 0;
    if (sat < 2)
      return n.reply({
        embeds: [
          errE(
            `Cần **2 ⚙️ Sắt Tinh** để mài sắc phi khí!\nHiện có: **${sat}**.\n${CE("tip_icon","💡")} Dùng \`-khai_quang\` để khai mỏ.`,
          ),
        ],
      });
    if (!calcSpend(e, h))
      return n.reply({
        embeds: [
          errE(
            `Cần **${fmt(h)} ${CE("tult","💠")}** để mài sắc phi khí!\nHiện có: **${CE("tult","💠")}${fmt(Number(e.linh_thach))}**${Number(e.linh_thach_trung||0)>0?` · **${CE("tult_trung","🔮")}${fmt(e.linh_thach_trung)} Trung**`:''}${Number(e.linh_thach_cao||0)>0?` · **${CE("tult_cao","💚")}${fmt(e.linh_thach_cao)} Cao**`:''}`,
          ),
        ],
      });
    const newKv = { ...kv, sat_tinh: sat - 2 };
    if (newKv.sat_tinh <= 0) delete newKv.sat_tinh;
    const r = { ...i, sac_ben_charges: 1, sac_ben_cd: Date.now() },
      s = tinhCS(e);
    return (
      await (async () => { const _s = calcSpend(e, h); await db("UPDATE players SET khoang_vat=$1, buff_active=$2, linh_thach=$3, linh_thach_trung=$4, linh_thach_cao=$5 WHERE user_id=$6", [JSON.stringify(newKv), JSON.stringify(r), _s.newThuong, _s.newTrung, _s.newCao, t]); })(),
      n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔱 Phi Khí Sắc Bén — Sẵn Sàng!")
            .setColor(3447003)
            .setDescription(
              `*Sắt Tinh nung chảy, linh lực ép chặt vào lưỡi — phi khí tỏa hào quang lạnh lẽo!*\n\n${CE("tuatk", "⚔️")} **+20% Công Lực** cho **trận PVP tiếp theo**\n🗡️ Công Lực gốc: **${fmt(s.atk)}** → Khi PVP: **${fmt(Math.floor(1.2 * s.atk))}**\n⚙️ Tiêu **-2 Sắt Tinh** · ${CE("tult", "💠")} **-${fmt(h)} Linh Thạch**\n\n${CE("tip_icon","💡")} Buff tự kích hoạt khi vào **\`-pvp @người\`** — tiêu 1 lần duy nhất!\n🔄 CD tiếp theo: **2h** từ bây giờ`,
            )
            .setFooter({ text: "Phi Khí Sư Đặc Kỹ | 1 charge PVP | CD: 2h" }),
        ],
      })
    );
});

  reg("vo_trang", ["votrang", "phong_toa"], async (n) => {
    const t = n.author.id,
      e = await getPlayer(t, n.author.username);
    if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("luyen_khi" !== e.nghe)
      return n.reply({ embeds: [errE("Lệnh này chỉ dành cho **🔱 Phi Khí Sư**!")] });
    const h = n.mentions.users.first();
    if (!h || h.bot || h.id === t)
      return n.reply({
        embeds: [errE("Cú pháp: `-vo_trang @người`\nKhông thể phong tỏa chính mình!")],
      });
    const i = await getPlayer(h.id);
    if (!i) return n.reply({ embeds: [errE("Người kia chưa tham gia game!")] });
    const a = "object" == typeof e.buff_active && e.buff_active ? e.buff_active : {},
      o = 2250,
      c = cdRem(a.vo_trang_cd, 4);
    if (c)
      return n.reply({
        embeds: [warnE(`${CE("cd_timer","⏳")} Phi Khí chưa đủ linh lực phong tỏa!\nHết CD ${cdTs(a.vo_trang_cd, 4)}.`)],
      });
    if (!calcSpend(e, o))
      return n.reply({
        embeds: [errE(`Cần **${fmt(o)} ${CE("tult","💠")}** để kích hoạt Phong Tỏa Phi Khí!\nHiện có: **${CE("tult","💠")}${fmt(e.linh_thach)}**${Number(e.linh_thach_trung||0)>0?` · **${CE("tult_trung","🔮")}${fmt(e.linh_thach_trung)} Trung**`:''}${Number(e.linh_thach_cao||0)>0?` · **${CE("tult_cao","💚")}${fmt(e.linh_thach_cao)} Cao**`:''}`)],
      });
    const _ = {
        ...("object" == typeof i.buff_active && i.buff_active ? i.buff_active : {}),
        vo_trang: 1,
      },
      u = { ...a, vo_trang_cd: Date.now() };
    (await (async () => { const _s = calcSpend(e, o); await db("UPDATE players SET linh_thach=$1, linh_thach_trung=$2, linh_thach_cao=$3, buff_active=$4 WHERE user_id=$5", [_s.newThuong, _s.newTrung, _s.newCao, JSON.stringify(u), t]); })(),
      await db("UPDATE players SET buff_active=$1 WHERE user_id=$2", [JSON.stringify(_), h.id]));
    try {
      await h.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE('warn_icon','⚠️')} Phi Khí Bị Phong Tỏa!`)
            .setColor(15158332)
            .setDescription(
              `🔱 Một **Phi Khí Sư** vừa phong tỏa phi khí của bạn!\n\n⚔️ **-30% Công Lực** trong trận PVP tiếp theo!\n\n${CE('tip_icon','💡')} Thử thách đấu với kẻ địch yếu hơn, hoặc chờ phong tỏa tự giải.`,
            ),
        ],
      });
    } catch (n) {}
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🔱 Phong Tỏa Phi Khí!")
          .setColor(15158332)
          .setDescription(
            `${CE('tunt','🎯')} **${h.username}** bị **Phong Tỏa Phi Khí**!\n${CE("tuatk", "⚔️")} Công Lực giảm **-30%** trong trận PVP tiếp theo.\n\n${CE("tult", "💠")} Chi phí: **-${fmt(o)} ${CE("tult", "💠")}**`,
          )
          .setFooter({ text: "Phi Khí Sư Đặc Kỹ | CD: 4h" }),
      ],
    });
  });
