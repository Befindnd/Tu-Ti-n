'use strict';
// ── 🧭  Phong Thủy — Đặc Kỹ Mới ──
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
const { CE, CEu } = require('../../systems/emoji');
const {
  CANH_GIOI, VU_KHI, LINH_THAO, DAN_DUOC, DAN_PHAM, DAN_PHAM_ORDER, KHOANG_VAT,
  PHU_LUC_DATA, NGHE, PHONG_THUY_VAN,
} = require('../../data');
const {
  fmt, fTime, cdRem, cdRemMin, cdTs,
  errE, warnE, okE,
  tinhCS, calcEXP_active, calcMaxLinhThach, getCG,
  reg, SEP, calcSpend,
} = require('../../utils');


// ═══════════════════════════════════════════════════════════════════════════════
// 🧭  PHONG THỦY SƯ — TÍNH NĂNG MỚI
// ═══════════════════════════════════════════════════════════════════════════════

const TIEN_TRI_OUTCOMES = [
  { emoji: '🌟', mo_ta: 'Vận khí thuận lợi — tu luyện hôm nay sẽ cho kết quả ngoài mong đợi!', bonus: 'Cảm Ngộ tăng thêm 3-8% lần tu luyện tiếp theo.' },
  { emoji: '💰', mo_ta: 'Tài khí vượng — khám phá và bí cảnh hôm nay có thể thu được nhiều Linh Thạch hơn.', bonus: '+20% Linh Thạch từ bí cảnh trong 2h tới.' },
  { emoji: '⚔️', mo_ta: 'Chiến khí bừng bừng — ra tay PvP hôm nay sẽ thắng dễ hơn!', bonus: '+8% Crit trong PvP trong 3h tới.' },
  { emoji: '🌿', mo_ta: 'Linh thảo ứng nghiệm — hái thảo hôm nay được phẩm cao hơn thường lệ.', bonus: '+1 Linh Thảo phẩm cao trong lần hái tiếp theo.' },
  { emoji: `${CE('warn_icon','⚠️')}`, mo_ta: 'Vận khí hao tán — nên tránh giao chiến hôm nay, dễ thất bại.', bonus: 'Cảnh báo: PvP hôm nay có thể bất lợi!' },
  { emoji: '🔮', mo_ta: 'Thiên cơ khó đoán — vận mệnh biến đổi không ngừng, cần thêm thời gian quan sát.', bonus: 'Không rõ ràng — thử lại sau!' },
  { emoji: '🌈', mo_ta: 'Đại vận đến — đây là ngày tuyệt vời để đột phá cảnh giới!', bonus: '+5% xác suất đột phá trong 4h tới.' },
];

/**
 * -tien_tri
 * Tiên tri vận mệnh — xem trước điềm lành/dữ trong thời gian tới.
 * CD 3h | 4,000💠
 */
reg('tien_tri', ['tientri', 'tt_van', 'xem_van'], async (msg) => {
  const userId = msg.author.id;
  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'phong_thuy')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **🧭 Phong Thủy Sư**!')] });

  const buff   = typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};
  const cdLeft = cdRem(buff.tien_tri_cd, 3);
  if (cdLeft) return msg.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Thiên cơ chưa vận chuyển đủ! Hết CD ${cdTs(buff.tien_tri_cd, 3)}`)] });

  const PHI = 4000;
  const _sTT = calcSpend(player, PHI);
  if (!_sTT)
    return msg.reply({ embeds: [errE(`Cần **${fmt(PHI)}** ${CE('tult','💠')} để khảo sát thiên cơ!`)] });

  const hasTP  = player.thien_phu_nghe === 'phong_thuy';
  const khiVan = Number(player.khi_van || 30);

  // Vận khí cao → kết quả tốt hơn
  const goodChance = 0.3 + (khiVan / 100) * 0.35; // 30-65% tùy khí vận
  let outcome;
  if (hasTP || Math.random() < goodChance) {
    // Kết quả tốt (5 đầu)
    outcome = TIEN_TRI_OUTCOMES[Math.floor(Math.random() * 5)];
  } else {
    outcome = TIEN_TRI_OUTCOMES[Math.floor(Math.random() * TIEN_TRI_OUTCOMES.length)];
  }

  await db('UPDATE players SET linh_thach=$1,linh_thach_trung=$2,linh_thach_cao=$3,buff_active=$4 WHERE user_id=$5',
    [_sTT.newThuong, _sTT.newTrung, _sTT.newCao, JSON.stringify({ ...buff, tien_tri_cd: Date.now() }), userId]);

  // Stars animation based on khiVan
  const stars = khiVan >= 80 ? '✦✦✦✦✦' : khiVan >= 60 ? '✦✦✦✦☆' : khiVan >= 40 ? '✦✦✦☆☆' : '✦✦☆☆☆';

  return msg.reply({
    embeds: [new EmbedBuilder()
      .setTitle(`${outcome.emoji} Thiên Cơ Tiên Tri — Vận Mệnh Hiển Lộ`)
      .setColor(hasTP ? 0xf1c40f : 0x1abc9c)
      .setDescription(
        `*Khí vận thiên địa xoay vần, tiên cơ hiện ra trước mắt...*\n\n` +
        `🧭 **Khí Vận Của Ngươi:** ${khiVan}/100 ${stars}\n\n` +
        `**━━━ Thiên Cơ Phán Định ━━━**\n` +
        `${outcome.emoji} *${outcome.mo_ta}*\n\n` +
        `🔮 **Gợi Ý:** ${outcome.bonus}\n\n` +
        (hasTP ? `✨ **Thiên Cơ Minh Đạt** — Tiên tri chính xác hơn!\n` : '') +
        `💸 Chi phí: **${fmt(PHI)}** ${CE('tult','💠')}`,
      )
      .setFooter({ text: `Phong Thủy Sư | Tiên Tri | CD: 3h | Khí Vận: ${khiVan}` })],
  });
});

/**
 * -tran_van @người
 * Trấn Vận — gieo điềm xấu lên kẻ thù, giảm Khí Vận của họ trong 6h.
 * CD 5h | 8,000💠 | Giảm -20 Khí Vận (Thiên Phú: -30)
 */
reg('tran_van', ['tranvan', 'tv_phong', 'giao_van'], async (msg) => {
  const userId = msg.author.id;
  const target = msg.mentions.users.first();
  if (!target || target.bot || target.id === userId)
    return msg.reply({ embeds: [errE('Cú pháp: `-tran_van @người_chơi`')] });

  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'phong_thuy')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **🧭 Phong Thủy Sư**!')] });

  const buff   = typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};
  const cdLeft = cdRem(buff.tran_van_cd, 5);
  if (cdLeft) return msg.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Thiên cơ chưa sẵn sàng! Hết CD ${cdTs(buff.tran_van_cd, 5)}`)] });

  const PHI = 8000;
  const _sTV = calcSpend(player, PHI);
  if (!_sTV)
    return msg.reply({ embeds: [errE(`Cần **${fmt(PHI)}** ${CE('tult','💠')} để trấn vận!`)] });

  const tgt = await getPlayer(target.id);
  if (!tgt) return msg.reply({ embeds: [errE(`**${target.username}** chưa tu tiên!`)] });

  const hasTP    = player.thien_phu_nghe === 'phong_thuy';
  const giamVan  = hasTP ? 30 : 20;
  const oldKhiVan = Number(tgt.khi_van || 30);
  const newKhiVan = Math.max(0, oldKhiVan - giamVan);

  await db('UPDATE players SET linh_thach=$1,linh_thach_trung=$2,linh_thach_cao=$3,buff_active=$4 WHERE user_id=$5',
    [_sTV.newThuong, _sTV.newTrung, _sTV.newCao, JSON.stringify({ ...buff, tran_van_cd: Date.now() }), userId]);
  await db('UPDATE players SET khi_van=$1 WHERE user_id=$2', [newKhiVan, target.id]);

  try {
    await target.send({
      embeds: [new EmbedBuilder()
        .setColor(0x992d22)
        .setTitle('🌑 Vận Khí Bị Trấn!')
        .setDescription(`${CE('warn_icon','⚠️')} Một **Phong Thủy Sư** đã gieo điềm xấu lên bạn!\n\n🧭 Khí Vận: **${oldKhiVan}** → **${newKhiVan}** *(-${giamVan})*\n${CE('tip_icon','💡')} Dùng \`-khai_van\` để khôi phục Khí Vận!`)],
    });
  } catch {}

  return msg.reply({
    embeds: [new EmbedBuilder()
      .setTitle('🌑 Trấn Vận — Điềm Xấu Giáng Xuống!')
      .setColor(0x992d22)
      .setDescription(
        `*Âm khí phong thủy cuồn cuộn bao phủ, vận mệnh ${target.username} bỗng tối sầm lại...*\n\n` +
        `${CE('tunt','🎯')} **${target.username}** bị trấn vận!\n` +
        `🧭 Khí Vận: **${oldKhiVan}** → **${newKhiVan}** *(-${giamVan})*\n` +
        (hasTP ? `✨ **Thiên Cơ Minh Đạt** — Trấn vận mạnh hơn (-30 thay vì -20)!\n` : '') +
        `\n💸 Chi phí: **${fmt(PHI)}** ${CE('tult','💠')} · CD: **5h**`,
      )
      .setFooter({ text: 'Phong Thủy Sư | Trấn Vận | CD: 5h' })],
  });
});


// ═══ PHONG THỦY SƯ — Đặc Kỹ Cũ (phong_thuy, khai_van, cau_phuc, boi_tuong) ═══
reg("phong_thuy", ["pt", "phongthuy"], async (n, t) => {
    const e = n.author.id,
      h = (t[0] || "boi").toLowerCase(),
      i = await getPlayer(e);
    if (!i) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("phong_thuy" !== i.nghe)
      return n.reply({
        embeds: [errE("Lệnh này chỉ dành cho **🧭 Phong Thủy Sư**!\nĐổi: `-nghe chon phong_thuy`")],
      });
    const a = 5400,
      o = (Date.now() - Number(i.phong_thuy_cd || 0)) / 1e3;
    if ("xem" === h) {
      const t = "phong_thuy" === i.thien_phu_nghe,
        e = i.khi_van || 30;
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🧭 Phong Thủy Sư — Thiên Cơ")
            .setColor(15965202)
            .setDescription(
              "🔮 Bói thiên cơ mỗi 1.5h — nhận thưởng hoặc bị phạt Linh Thạch trực tiếp!\n\n🌟 Đại Cát **(10%)** — **+600 Linh Thạch**\n✨ Tiểu Cát **(35%)** — **+200 Linh Thạch**\n⚖️ Bình Thường **(30%)** — Không có gì\n☁️ Tiểu Hung **(15%)** — **-150 Linh Thạch**\n💀 Đại Hung **(10%)** — **-500 Linh Thạch**\n\n" +
                (t
                  ? "✨ **Thiên Cơ Minh Đạt:** +30% Cơ Duyên/Bí Cảnh · Tỉ lệ sự kiện tốt ×2\n\n"
                  : "") +
                "**📋 Lệnh đặc thù Phong Thủy Sư:**\n• `-phong_thuy boi` — Bói thiên cơ · CD 1.5h\n" +
                `• \`-khai_van\` — **${fmt(Math.floor(5e3 + 1e3 * (i.canh_gioi || 0)))}${CE("tult", "💠")}** (tăng theo cảnh giới) → **+15 Khí Vận** *(hiện: ${e}/100)* · CD 3h\n` +
                `• \`-cau_phuc @người\` — 5,000${CE("tult", "💠")} → Tặng **+10 Khí Vận** cho đồng đạo · CD 4h\n` +
                `• ${CE("tukv", "🍀")} Passive: **+15% thưởng Cơ Duyên & Bí Cảnh** mọi lúc\n\n` +
                (o < a
                  ? `${CE("cd_timer","⏳")} Bói lại ${cdTs(i.phong_thuy_cd, 1.5)}`
                  : "✅ Sẵn sàng! Dùng `-phong_thuy boi`"),
            ),
        ],
      });
    }
    if ("boi" === h) {
      if (o < a) return n.reply({ embeds: [warnE(`Bói lại ${cdTs(i.phong_thuy_cd, 1.5)}.`)] });
      const ptPlayer = i;
      let t = 0,
        h = PHONG_THUY_VAN[2];
      const rnd = 100 * Math.random();
      for (const van of PHONG_THUY_VAN)
        if (((t += van.rate), rnd < t)) {
          h = van;
          break;
        }
      await db("UPDATE players SET phong_thuy_cd=$1 WHERE user_id=$2", [Date.now(), e]);
      let c = "";
      if (h.hieu_ung) {
        const hieu = h.hieu_ung;
        if ("linh_thach" === hieu.loai) {
          const ltPT = calcMaxLinhThach(ptPlayer, hieu.gia_tri);
          if (ltPT > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [ltPT, e]);
          c = `\n\n${CE("tult", "💠")} **+${fmt(ltPT)} Linh Thạch** đã nhận!${ltPT < hieu.gia_tri ? " *(túi đầy)*" : ""}`;
        } else if ("mat_linh_thach_flat" === hieu.loai) {
          await db("UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1) WHERE user_id=$2", [hieu.gia_tri, e]);
          c = `\n\n💸 Mất **${fmt(hieu.gia_tri)} Linh Thạch**!`;
        }
      }
      const _ = h.ten.includes("Cát") ? 16766720 : h.ten.includes("Hung") ? 15158332 : 9807270;
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`🧭 Xem Thiên Cơ — ${h.emoji} ${h.ten}`)
            .setColor(_)
            .setDescription(
              `**${n.author.username}**: **${h.emoji} ${h.ten}**!\n\n${h.mo_ta}${c}`,
            )
            .setFooter({ text: "CD: 4 giờ/lần" }),
        ],
      });
    }
    return n.reply({ embeds: [errE("`-phong_thuy boi` | `-phong_thuy xem`")] });
});

reg("khai_van", ["kv", "khaivan"], async (n) => {
    const t = n.author.id,
      e = await getPlayer(t, n.author.username);
    if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("phong_thuy" !== e.nghe)
      return n.reply({
        embeds: [errE("Lệnh này chỉ dành cho **🧭 Phong Thủy Sư**!\nĐổi: `-nghe chon phong_thuy`")],
      });
    const h = cdRem(e.khai_van_cd, 3);
    if (h)
      return n.reply({
        embeds: [warnE(`${CE("cd_timer","⏳")} Thiên cơ chưa vận chuyển đủ!\nHết CD ${cdTs(e.khai_van_cd, 3)}.`)],
      });
    const i = Math.floor(5e3 + 1e3 * (e.canh_gioi || 0));
    if (Number(e.linh_thach) < i)
      return n.reply({
        embeds: [
          errE(
            `Cần **${fmt(i)} ${CE("tult", "💠")}** để khai mở vận số! *(Tầng ${e.canh_gioi || 0})*\nHiện có: **${fmt(Number(e.linh_thach))} ${CE("tult", "💠")}**`,
          ),
        ],
      });
    const a = e.khi_van || 30,
      o = Math.min(100, a + 15);
    return (
      await db(
        "UPDATE players SET khi_van=$1, khai_van_cd=$2, linh_thach=GREATEST(0,linh_thach-$3) WHERE user_id=$4",
        [o, Date.now(), i, t],
      ),
      n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🧭 Khai Vận — Thiên Cơ Ứng Vận!")
            .setColor(15965202)
            .setDescription(
              `🌟 Khí Vận: **${a}** ➜ **${o}** *(+15)*\n${CE("tult", "💠")} Tiêu **-${fmt(i)} Linh Thạch** *(Tầng ${e.canh_gioi || 0}: 5,000 + ${e.canh_gioi || 0}×1,000)*\n\n✦ Khí Vận cao → tăng xác suất **Đại Cát** khi bói thiên cơ\n✦ Khí Vận ≥ 60 → **+5%** xác suất đột phá cảnh giới!\n✦ Khí Vận hiện tại: **${o}/100** ${o >= 60 ? "✅ Đủ bonus đột phá!" : `(cần ${60 - o} nữa để đạt bonus)`}`,
            )
            .setFooter({ text: "Phong Thủy Sư Đặc Kỹ | Giá tăng theo cảnh giới | CD: 3h" }),
        ],
      })
    );
});

reg("cau_phuc", ["cf_van", "cauphuc"], async (n) => {
    const t = n.author.id,
      e = n.mentions.users.first();
    if (!e || e.bot) return n.reply({ embeds: [errE("Cú pháp: `-cau_phuc @người_chơi`")] });
    if (e.id === t)
      return n.reply({ embeds: [errE("Không thể cầu phúc cho bản thân! Hãy giúp đồng đạo.")] });
    const h = await getPlayer(t, n.author.username);
    if (!h) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("phong_thuy" !== h.nghe)
      return n.reply({
        embeds: [errE("Lệnh này chỉ dành cho **🧭 Phong Thủy Sư**!\nĐổi: `-nghe chon phong_thuy`")],
      });
    const i = 7500,
      a = "object" == typeof h.buff_active && h.buff_active ? h.buff_active : {},
      o = cdRem(a.cau_phuc_cd, 4);
    if (o)
      return n.reply({
        embeds: [warnE(`${CE("cd_timer","⏳")} Thiên cơ chưa thuận!\nHết CD ${cdTs(a.cau_phuc_cd, 4)} để cầu phúc.`)],
      });
    if (Number(h.linh_thach) < i)
      return n.reply({
        embeds: [
          errE(
            `Cần **${fmt(i)}** ${CE("tult", "💠")} để thiết lập phong thủy cầu phúc!\nHiện có: **${fmt(Number(h.linh_thach))}** ${CE("tult", "💠")}`,
          ),
        ],
      });
    const c = await getPlayer(e.id);
    if (!c) return n.reply({ embeds: [errE(`**${e.username}** chưa tu tiên!`)] });
    const _ = Number(c.khi_van || 0),
      u = Math.min(100, _ + 10),
      r = u - _,
      s = { ...a, cau_phuc_cd: Date.now() };
    (await db(
      "UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1), buff_active=$2 WHERE user_id=$3",
      [i, JSON.stringify(s), t],
    ),
      await db("UPDATE players SET khi_van=$1 WHERE user_id=$2", [u, e.id]));
    try {
      await e.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🧭 Bạn Nhận Được Cầu Phúc!")
            .setColor(1752220)
            .setDescription(
              `🌟 **${n.author.username}** (Phong Thủy Sư) vừa cầu phúc cho bạn!\n\n${CE('tunt','🎯')} Khí Vận: **${_}** ➜ **${u}** *(+${r})*\n\n${CE("tip_icon","💡")} Khí Vận cao giúp sự kiện may mắn xuất hiện thường hơn!`,
            ),
        ],
      });
    } catch (n) {}
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🧭 Cầu Phúc Thành Công!")
          .setColor(1752220)
          .setDescription(
            `*Vận khí thiên địa xoay chuyển, phong thủy cát tường bay đến **${e.username}**...*\n\n${CE('tunt','🎯')} Mục tiêu: **${e.username}**\n🎰 Khí Vận: **${_}** ➜ **${u}** *(+${r})*\n` +
              (r < 10 ? `*(Khí Vận đã tối đa ${u}/100 nên chỉ tăng được ${r})*\n` : "") +
              `\n💸 Tiêu: **-${fmt(i)}** ${CE("tult", "💠")} Linh Thạch`,
          )
          .setFooter({ text: "Phong Thủy Sư Đặc Kỹ | CD: 4h" }),
      ],
    });
});

  reg("boi_tuong", ["bt_van", "boituong"], async (n) => {
    const t = n.author.id,
      e = await getPlayer(t, n.author.username);
    if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("phong_thuy" !== e.nghe)
      return n.reply({ embeds: [errE("Lệnh này chỉ dành cho **🧭 Phong Thủy Sư**!")] });
    const h = n.mentions.users.first();
    if (!h || h.bot || h.id === t)
      return n.reply({
        embeds: [
          errE("Cú pháp: `-boi_tuong @người`\nPhong Thủy Sư nhìn thấu tướng số người khác!"),
        ],
      });
    const i = await getPlayer(h.id);
    if (!i) return n.reply({ embeds: [errE("Người kia chưa tham gia game!")] });
    const a = "object" == typeof e.buff_active && e.buff_active ? e.buff_active : {},
      o = 1500,
      c = cdRem(a.boi_tuong_cd, 2);
    if (c)
      return n.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Linh nhãn chưa hồi phục!\nHết CD ${cdTs(a.boi_tuong_cd, 2)}.`)] });
    if (Number(e.linh_thach) < o)
      return n.reply({
        embeds: [errE(`Cần **${fmt(o)} ${CE("tult", "💠")}** để mở **Thiên Nhãn Thuật**!`)],
      });
    const _ = { ...a, boi_tuong_cd: Date.now() };
    await db("UPDATE players SET linh_thach=linh_thach-$1, buff_active=$2 WHERE user_id=$3", [
      o,
      JSON.stringify(_),
      t,
    ]);
    const u = i.linh_thao || {},
      r = Object.entries(u).reduce((n, [, t]) => n + Number(t), 0),
      s = i.dan_duoc || {},
      l = Object.entries(s).reduce((n, [, t]) => n + Number(t), 0),
      m = "object" == typeof i.buff_active && i.buff_active ? i.buff_active : {},
      g = Number(i.an_ngu_until || 0),
      d = Date.now() < g,
      p = (m.sac_ben_charges || 0) > 0,
      T = (m.vo_trang || 0) > 0,
      b = (m.phu_bao_ho || 0) > 0,
      $ = (m.dam_doc || 0) > 0,
      y = getCG(i.canh_gioi),
      E = [
        d ? "🌙 **An Ngụ** — không thể tấn công/lục soát" : "⚔️ Đang hoạt động",
        p ? "🔱 Có **Sắc Bén** (PVP +20% ATK)" : "",
        T ? "🚫 Đang bị **Phong Tỏa Phi Khí** (-30% ATK)" : "",
        b ? "🛡️ Có **Phù Bảo Hộ** (-30% damage)" : "",
        $ ? "☠️ Đang mang **Độc Tố** tiềm ẩn" : "",
      ]
        .filter(Boolean)
        .join("\n");
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🧭 Thiên Nhãn Thuật — Nhìn Thấu Tướng Số!")
          .setColor(15965202)
          .setDescription(`*Mắt thần mở ra, tất cả bí mật của **${h.username}** hiện rõ...*`)
          .addFields(
            { name: "👤 Thân Phận", value: `**${h.username}** — ${y.emoji} ${y.ten}`, inline: !1 },
            {
              name: "" + CE("tult", "💠") + " Linh Thạch Thật",
              value: `**${fmt(Number(i.linh_thach))} ${CE("tult", "💠")}**`,
              inline: !0,
            },
            { name: "🌿 Tổng Linh Thảo", value: `**${r}** thảo dược`, inline: !0 },
            { name: "💊 Tổng Đan Dược", value: `**${l}** viên đan`, inline: !0 },
            {
              name: "🔮 Trạng Thái Buff/Debuff",
              value: E || "Không có buff/debuff đặc biệt",
              inline: !1,
            },
          )
          .setFooter({ text: `Phong Thủy Sư Đặc Kỹ | CD: 2h | -1,500 ${CEu("tult","💠")}` }),
      ],
    });
  });
