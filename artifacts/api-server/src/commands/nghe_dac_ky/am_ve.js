'use strict';
// ── 🗡️  Ám Vệ — Đặc Kỹ Mới ──
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
const { CE }        = require('../../systems/emoji');
const {
  CANH_GIOI, VU_KHI, LINH_THAO, DAN_DUOC, DAN_PHAM, DAN_PHAM_ORDER, KHOANG_VAT,
  PHU_LUC_DATA, NGHE,
} = require('../../data');
const {
  fmt, fTime, cdRem, cdRemMin, cdTs, cdTsMin,
  errE, warnE, okE,
  tinhCS, calcEXP_active, calcMaxLinhThach,
  reg, SEP, calcSpend,
} = require('../../utils');


// ═══════════════════════════════════════════════════════════════════════════════
// 🗡️  ÁM VỆ — TÍNH NĂNG MỚI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * -trinh_sat @người
 * Scout / do thám mục tiêu trước khi ám sát.
 * CD 30ph | Miễn phí | Tiên Phú: tiết lộ thêm Linh Thạch chính xác.
 */
reg('trinh_sat', ['trinhsat', 'ts_am', 'dotha'], async (msg) => {
  const userId = msg.author.id;
  const target = msg.mentions.users.first();
  if (!target || target.bot || target.id === userId)
    return msg.reply({ embeds: [errE('Cú pháp: `-trinh_sat @người_chơi`')] });

  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'an_sat')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **🗡️ Ám Vệ**!')] });

  const buff = typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};
  const cdLeft = cdRemMin(buff.trinh_sat_cd, 30);
  if (cdLeft) return msg.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Cần mai phục tiếp! Hết CD ${cdTsMin(buff.trinh_sat_cd, 30)}`)] });

  const tgt = await getPlayer(target.id);
  if (!tgt) return msg.reply({ embeds: [errE(`**${target.username}** chưa tu tiên!`)] });

  await db('UPDATE players SET buff_active=$1 WHERE user_id=$2',
    [JSON.stringify({ ...buff, trinh_sat_cd: Date.now() }), userId]);

  const cs     = tinhCS(tgt);
  const cgInfo = CANH_GIOI[tgt.canh_gioi] || CANH_GIOI[0];
  const isHidden = Number(tgt.an_ngu_until || 0) > Date.now();
  const dtStr  = tgt.dao_thuong > 0 ? `${CE('warn_icon','⚠️')} Cấp ${tgt.dao_thuong} (ATK giảm)` : '✅ Không';
  const hasThienPhu = player.thien_phu_nghe === 'an_sat';

  const ltStr = hasThienPhu
    ? `${CE('tult','💠')} **${fmt(tgt.linh_thach)}** *(tiết lộ nhờ Tuyệt Sát Thiên Tâm)*`
    : `${CE('tult','💠')} Khoảng **${fmt(Math.floor(Number(tgt.linh_thach) * 0.7))}** – **${fmt(Math.ceil(Number(tgt.linh_thach) * 1.3))}**`;

  const pvpWins = tgt.pvp_wins || 0;
  const dangerRating = pvpWins >= 50 ? '🔴 Cực Nguy Hiểm' : pvpWins >= 20 ? '🟠 Nguy Hiểm' : pvpWins >= 5 ? '🟡 Trung Bình' : '🟢 Yếu';

  const embed = new EmbedBuilder()
    .setTitle(`🕵️ Tình Báo — ${target.username}`)
    .setColor(0x2f3136)
    .setDescription(
      `*Ẩn trong bóng tối, ngươi quan sát kỹ mục tiêu...*\n\n` +
      `${CE('tuatk','⚔️')} **Cảnh Giới:** ${cgInfo.ten} (Tầng ${tgt.canh_gioi}/39)\n` +
      `${CE('tudef','🛡️')} **Công Lực:** ${fmt(cs.atk)} | **Thủ Lực:** ${fmt(cs.def)}\n` +
      `💜 **Linh Lực:** ${fmt(cs.hp_max)}\n` +
      `${ltStr}\n` +
      `🩸 **Đạo Thương:** ${dtStr}\n` +
      `🌫️ **Trạng Thái:** ${isHidden ? `${CE('tudef','🛡️')} Đang An Ngụ (miễn ám sát)` : '😴 Bình thường — có thể ám sát!'}\n` +
      `${CE('tuatk','⚔️')} **PvP Wins:** ${pvpWins} trận — ${dangerRating}\n\n` +
      `${SEP}\n` +
      `${CE("tip_icon","💡")} Dùng \`-am_sat @${target.username}\` để hành động · CD ám sát 45ph`,
    )
    .setThumbnail(target.displayAvatarURL ? target.displayAvatarURL() : null)
    .setFooter({ text: `Trinh Sát | Ám Vệ Đặc Kỹ | CD: 30ph${hasThienPhu ? ' | ✨ Thiên Phú' : ''}` });

  return msg.reply({ embeds: [embed] });
});

/**
 * -xa_tinh @người
 * Bắn tỉa tầm xa — ám sát đặc biệt không thể bị chặn bởi An Ngụ.
 * Thành công 60% (TP 70%) | Lấy 10-20% LT | CD 2h | 3,000💠
 */
reg('xa_tinh', ['xatinh', 'xt_am', 'banting'], async (msg) => {
  const userId = msg.author.id;
  const target = msg.mentions.users.first();
  if (!target || target.bot || target.id === userId)
    return msg.reply({ embeds: [errE('Cú pháp: `-xa_tinh @người_chơi`')] });

  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'an_sat')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **🗡️ Ám Vệ**!')] });

  const buff = typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};
  const cdLeft = cdRem(buff.xa_tinh_cd, 2);
  if (cdLeft) return msg.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Phi khí cần nạp năng lượng! Hết CD ${cdTs(buff.xa_tinh_cd, 2)}`)] });

  const PHI = 3000;
  const _sXa = calcSpend(player, PHI);
  if (!_sXa)
    return msg.reply({ embeds: [errE(`Cần **${fmt(PHI)}** ${CE('tult','💠')} để kích hoạt phi khí tầm xa!`)] });

  const tgt = await getPlayer(target.id);
  if (!tgt) return msg.reply({ embeds: [errE(`**${target.username}** chưa tu tiên!`)] });

  const hasThienPhu = player.thien_phu_nghe === 'an_sat';
  const successRate = hasThienPhu ? 0.70 : 0.60;

  await db('UPDATE players SET linh_thach=$1,linh_thach_trung=$2,linh_thach_cao=$3,buff_active=$4 WHERE user_id=$5',
    [_sXa.newThuong, _sXa.newTrung, _sXa.newCao, JSON.stringify({ ...buff, xa_tinh_cd: Date.now() }), userId]);

  if (Math.random() >= successRate) {
    return msg.reply({
      embeds: [new EmbedBuilder()
        .setTitle('🏹 Xạ Tinh Thất Bại')
        .setColor(0x992d22)
        .setDescription(
          `*Phi tiêu xuyên không khí... nhưng mục tiêu bước tránh đúng lúc!*\n\n` +
          `❌ **${target.username}** cảm nhận sát khí và né tránh kịp thời!\n` +
          `💸 Tiêu: **${fmt(PHI)}** ${CE('tult','💠')} · CD: **2h**\n\n` +
          `${CE('tip_icon','💡')} Tỉ lệ thành công: **${Math.round(successRate*100)}%**`,
        )
        .setFooter({ text: 'Ám Vệ | Xạ Tinh Tầm Xa | CD: 2h' })],
    });
  }

  const stolen_pct = 0.10 + Math.random() * 0.10; // 10-20%
  const tgt_lt     = Number(tgt.linh_thach || 0);
  const raw_stolen = Math.floor(tgt_lt * stolen_pct);
  const stolen     = hasThienPhu ? Math.floor(raw_stolen * 1.20) : raw_stolen; // +20% nếu có TP
  const capped     = calcMaxLinhThach(player, stolen);

  if (capped > 0) {
    await db('UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2', [capped, userId]);
    await db('UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1) WHERE user_id=$2', [stolen, target.id]);
  }

  await db('UPDATE players SET pvp_wins=pvp_wins+1 WHERE user_id=$1', [userId]);

  try {
    await target.send({
      embeds: [new EmbedBuilder()
        .setColor(0x992d22)
        .setTitle('🏹 Bạn Bị Xạ Tinh Từ Bóng Tối!')
        .setDescription(`${CE('warn_icon','⚠️')} Một **Ám Vệ** ẩn danh bắn tỉa từ xa lấy đi **${fmt(stolen)}** ${CE('tult','💠')}!\n${CE('tip_icon','💡')} Dùng \`-an_ngu\` để bảo vệ bản thân!`)],
    });
  } catch {}

  return msg.reply({
    embeds: [new EmbedBuilder()
      .setTitle('🏹 Xạ Tinh Thành Công — Bóng Tối Phủ Trùm!')
      .setColor(0x2ecc71)
      .setDescription(
        `*Phi tiêu từ bóng đêm, xuyên qua kết giới phòng thủ — không gì cản được!*\n\n` +
        `${CE('tunt','🎯')} **${target.username}** không kịp phản ứng!\n` +
        `💰 Cướp được: **${fmt(stolen)}** ${CE('tult','💠')} *(${Math.round(stolen_pct*100)}% LT)*\n` +
        (hasThienPhu ? `✨ **Tuyệt Sát Thiên Tâm** — +20% chiến lợi phẩm!\n` : '') +
        `💸 Chi phí: **${fmt(PHI)}** ${CE('tult','💠')} · ⚔️ PvP Win +1`,
      )
      .setFooter({ text: 'Ám Vệ | Xạ Tinh Tầm Xa | CD: 2h | Vượt qua An Ngụ!' })],
  });
});

/**
 * -sat_y
 * Kích hoạt Sát Ý — aura sát khí tăng Crit cho TẤT CẢ PvP trong 4h.
 * +12% Crit | 4h | CD 6h | 5,000💠
 */
reg('sat_y', ['saty', 'satykhi', 'aura_sat'], async (msg) => {
  const userId = msg.author.id;
  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'an_sat')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **🗡️ Ám Vệ**!')] });

  const buff = typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};

  // Kiểm tra nếu đang active
  if (Number(buff.sat_y_until || 0) > Date.now()) {
    const rem = Math.ceil((Number(buff.sat_y_until) - Date.now()) / 1000);
    return msg.reply({ embeds: [warnE(`🌑 **Sát Ý đang hoạt động!** Còn **${fTime(rem)}**\n+12% Crit trong mọi PvP hiện tại.`)] });
  }

  const cdLeft = cdRem(buff.sat_y_cd, 6);
  if (cdLeft) return msg.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Sát khí chưa tụ đủ! Hết CD ${cdTs(buff.sat_y_cd, 6)}`)] });

  const PHI = 5000;
  const _sSat = calcSpend(player, PHI);
  if (!_sSat)
    return msg.reply({ embeds: [errE(`Cần **${fmt(PHI)}** ${CE('tult','💠')} để kích hoạt Sát Ý!`)] });

  const duration = 4 * 3600 * 1000; // 4 giờ
  const until    = Date.now() + duration;
  const newBuff  = { ...buff, sat_y_until: until, sat_y_cd: Date.now() };

  await db('UPDATE players SET linh_thach=$1,linh_thach_trung=$2,linh_thach_cao=$3,buff_active=$4 WHERE user_id=$5',
    [_sSat.newThuong, _sSat.newTrung, _sSat.newCao, JSON.stringify(newBuff), userId]);

  return msg.reply({
    embeds: [new EmbedBuilder()
      .setTitle('🌑 Sát Ý Giác Tỉnh — Aura Huyết Sát Bùng Nổ!')
      .setColor(0x992d22)
      .setDescription(
        `*Ý chí giết chóc từ vạn trận chiến tụ lại, bùng cháy dữ dội xung quanh thân thể...*\n\n` +
        `${CE("tia_set","⚡")} **+12% Bạo Kích** trong mọi PvP trong **4 giờ** tiếp theo!\n` +
        `⏱️ Hiệu lực đến: <t:${Math.floor(until/1000)}:R>\n\n` +
        `💸 Chi phí: **${fmt(PHI)}** ${CE('tult','💠')} · CD tiếp theo: **6h**\n\n` +
        `${CE("tip_icon","💡")} Buff tự động trong **\`-pvp\`** — không cần làm gì thêm!`,
      )
      .setFooter({ text: 'Ám Vệ | Sát Ý | CD: 6h | Hoạt động 4h' })],
  });
});


// ═══ ÁM VỆ — Đặc Kỹ Cũ (luc_soat, dam_doc) ═══
reg("luc_soat", ["ls_am", "lucsoat"], async (n) => {
    const t = n.author.id,
      e = n.mentions.users.first();
    if (!e || e.bot) return n.reply({ embeds: [errE("Cú pháp: `-luc_soat @người_chơi`")] });
    if (e.id === t) return n.reply({ embeds: [errE("Không thể lục soát bản thân!")] });
    const h = await getPlayer(t, n.author.username);
    if (!h) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("an_sat" !== h.nghe)
      return n.reply({
        embeds: [errE("Lệnh này chỉ dành cho **🗡️ Ám Vệ**!\nĐổi: `-nghe chon an_sat`")],
      });
    const i = "object" == typeof h.buff_active && h.buff_active ? h.buff_active : {},
      a = cdRem(i.luc_soat_cd, 1.5);
    if (a)
      return n.reply({
        embeds: [warnE(`${CE("cd_timer","⏳")} Cần ẩn mình phục hồi!\nHết CD ${cdTs(i.luc_soat_cd, 1.5)} để lục soát.`)],
      });
    const o = await getPlayer(e.id);
    if (!o) return n.reply({ embeds: [errE(`**${e.username}** chưa tu tiên!`)] });
    if (Number(o.an_ngu_until || 0) > Date.now()) {
      const h = { ...i, luc_soat_cd: Date.now() };
      return (
        await db("UPDATE players SET buff_active=$1 WHERE user_id=$2", [JSON.stringify(h), t]),
        n.reply({
          embeds: [
            warnE(
              `${CE("tudef", "🛡️")} **${e.username}** đang **An Ngụ** (ẩn thân kết giới)!\nKhông thể lục soát — CD vẫn bị tính.`,
            ),
          ],
        })
      );
    }
    const c = { ...i, luc_soat_cd: Date.now() };
    await db("UPDATE players SET buff_active=$1 WHERE user_id=$2", [JSON.stringify(c), t]);
    if (!(Math.random() < 0.45))
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🗡️ Lục Soát Thất Bại")
            .setColor(9807270)
            .setDescription(
              `*Bóng tối ẩn náu, nhưng **${e.username}** phát hiện kịp thời và né tránh!*\n\n❌ Lục soát thất bại — không lấy được gì.\n${CE("cd_timer","⏳")} CD: **1.5h**`,
            )
            .setFooter({ text: "Ám Vệ Đặc Kỹ | 45% thành công" }),
        ],
      });
    const _ = { ...(o.linh_thao || {}) },
      u = Object.keys(_).filter((n) => Number(_[n] || 0) > 0);
    if (0 === u.length)
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🗡️ Lục Soát — Túi Trống!")
            .setColor(12436423)
            .setDescription(
              `*Khám túi **${e.username}** nhưng... không có một cọng thảo nào!\n\n💨 Lục soát thành công nhưng lấy không được gì.`,
            )
            .setFooter({ text: "CD: 1.5h | Ám Vệ Đặc Kỹ" }),
        ],
      });
    const r = 1 + Math.floor(3 * Math.random()),
      s = { ...(h.linh_thao || {}) },
      l = [];
    let m = 0;
    for (const n of u) {
      if (m >= r) break;
      const t = Math.min(r - m, Number(_[n] || 0));
      if (t <= 0) continue;
      ((_[n] = (Number(_[n]) || 0) - t),
        _[n] <= 0 && delete _[n],
        (s[n] = (s[n] || 0) + t),
        (m += t));
      const e = LINH_THAO.find((t) => t.id === n);
      l.push(`${e ? e.emoji : "🌿"} ${e ? e.ten : n} ×${t}`);
    }
    (await db("UPDATE players SET linh_thao=$1 WHERE user_id=$2", [JSON.stringify(_), e.id]),
      await db("UPDATE players SET linh_thao=$1 WHERE user_id=$2", [JSON.stringify(s), t]));
    try {
      await e.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🗡️ Túi Của Bạn Bị Lục Soát!")
            .setColor(15158332)
            .setDescription(
              `${CE('warn_icon','⚠️')} Một **Ám Vệ** vừa lục soát túi và lấy đi:\n${l.map((n) => `  • ${n}`).join("\n")}\n\n${CE("tip_icon","💡")} Dùng \`-an_ngu\` để bảo vệ bản thân!`,
            ),
        ],
      });
    } catch (n) {}
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🗡️ Lục Soát Thành Công!")
          .setColor(9323693)
          .setDescription(
            `*Bóng tối bao phủ, tay nhanh như chớp lướt qua túi **${e.username}**...*\n\n✅ Lấy được **${m} Linh Thảo**:\n${l.map((n) => `  • ${n}`).join("\n")}`,
          )
          .setFooter({ text: "Ám Vệ Đặc Kỹ | 45% thành công | CD: 1.5h" }),
      ],
    });
});

  reg("dam_doc", ["dd_noc", "damdoc"], async (n) => {
    const t = n.author.id,
      e = await getPlayer(t, n.author.username);
    if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("an_sat" !== e.nghe)
      return n.reply({ embeds: [errE("Lệnh này chỉ dành cho **🗡️ Ám Vệ**!")] });
    const h = n.mentions.users.first();
    if (!h || h.bot || h.id === t)
      return n.reply({
        embeds: [errE("Cú pháp: `-dam_doc @người`\nKhông thể đầu độc chính mình!")],
      });
    const i = await getPlayer(h.id);
    if (!i) return n.reply({ embeds: [errE("Người kia chưa tham gia game!")] });
    const a = "object" == typeof e.buff_active && e.buff_active ? e.buff_active : {},
      o = cdRem(a.dam_doc_cd, 5);
    if (o)
      return n.reply({
        embeds: [warnE(`${CE("cd_timer","⏳")} Thuốc độc chưa bào chế xong!\nHết CD ${cdTs(a.dam_doc_cd, 5)}.`)],
      });
    if (Number(e.linh_thach) < 750)
      return n.reply({
        embeds: [errE(`Cần **${fmt(750)} ${CE("tult", "💠")}** để bào chế Độc Tố!`)],
      });
    const c = Number(i.an_ngu_until || 0);
    if (Date.now() < c)
      return n.reply({
        embeds: [
          warnE(`**${h.username}** đang **An Ngụ** — phòng thủ kiên cố, không thể đầu độc!`),
        ],
      });
    const _ = "object" == typeof i.buff_active && i.buff_active ? i.buff_active : {};
    if ((_.dam_doc || 0) > 0)
      return n.reply({
        embeds: [warnE(`**${h.username}** đã bị đầu độc rồi — chờ lần trước phát tác đã!`)],
      });
    const u = { ..._, dam_doc: 1 },
      r = { ...a, dam_doc_cd: Date.now() };
    return (
      await db("UPDATE players SET linh_thach=linh_thach-$1, buff_active=$2 WHERE user_id=$3", [
        750,
        JSON.stringify(r),
        t,
      ]),
      await db("UPDATE players SET buff_active=$1 WHERE user_id=$2", [JSON.stringify(u), h.id]),
      n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("☠️ Đặt Bẫy Độc Thành Công!")
            .setColor(9323693)
            .setDescription(
              `☠️ **${h.username}** bị **Đầu Độc** tiềm ẩn!\n💸 Khi họ tu luyện lần tới, **35% cơ hội** mất **10% Linh Thạch** do độc tố khuếch tán.\n\n${CE('lock_icon','🔒')} Mục tiêu **không hề hay biết** — bẫy chờ phát tác!`,
            )
            .setFooter({ text: "Ám Vệ Đặc Kỹ | CD: 5h" }),
        ],
      })
    );
  });

