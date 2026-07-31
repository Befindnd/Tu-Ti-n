'use strict';
// ── 📜  Phù Lục Sư — Đặc Kỹ Mới ──
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
  fmt, fTime, cdRem, cdRemMin, cdTs,
  errE, warnE, okE,
  tinhCS, calcEXP_active, calcMaxLinhThach, getCG,
  reg, SEP, calcSpend,
} = require('../../utils');


// ═══════════════════════════════════════════════════════════════════════════════
// 📜  PHÙ LỤC SƯ — TÍNH NĂNG MỚI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * -phu_pham
 * Hiển thị kho phù lục với thông tin đầy đủ và trạng thái buff.
 */
reg('phu_pham', ['phupham', 'pp_phu', 'kho_phu'], async (msg) => {
  const userId = msg.author.id;
  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'phu_luc')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **📜 Phù Lục Sư**!')] });

  const kho   = player.phu_luc || {};
  const buff  = typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};
  const hasTP = player.thien_phu_nghe === 'phu_luc';

  const tongSo = Object.values(kho).reduce((s, v) => s + Number(v || 0), 0);

  const phuLines = PHU_LUC_DATA.filter(p => !p.limited).map(p => {
    const qty    = kho[p.id] || 0;
    const status = qty > 0 ? `**${qty}×**` : '`Hết`';
    return `${p.emoji} **${p.ten}** ${status} · *${p.mo_ta}*`;
  });

  const limitedLines = PHU_LUC_DATA.filter(p => p.limited && (kho[p.id] || 0) > 0)
    .map(p => `${p.emoji} **${p.ten}** ×${kho[p.id]}`);

  // Active buffs
  const buffLines = [];
  if (Number(buff.ho_than_phu_until || 0) > Date.now())
    buffLines.push(`${CE('tudef','🛡️')} **Hộ Thân Phù** — còn <t:${Math.floor(Number(buff.ho_than_phu_until)/1000)}:R>`);
  if (Number(buff.sat_phong_phu_until || 0) > Date.now())
    buffLines.push(`${CE('tuatk','⚔️')} **Sát Phong Phù** — còn <t:${Math.floor(Number(buff.sat_phong_phu_until)/1000)}:R>`);
  if (Number(buff.tu_toc_phu_until || 0) > Date.now())
    buffLines.push(`${CE("tia_set","⚡")} **Tu Tốc Phù** — còn <t:${Math.floor(Number(buff.tu_toc_phu_until)/1000)}:R>`);
  if (Number(buff.phong_an_until || 0) > Date.now())
    buffLines.push(`🌿 **Phong An Phù** (nhận) — còn <t:${Math.floor(Number(buff.phong_an_until)/1000)}:R>`);

  const embed = new EmbedBuilder()
    .setTitle(`${CE('ng_phu_luc_su','📜')} Phù Lục Tàng Thư — ${msg.author.username}`)
    .setColor(0x9b59b6)
    .setDescription(
      `*${tongSo > 0 ? `Tàng thư đang lưu **${tongSo}** phù lục sẵn sàng kích hoạt.` : 'Tàng thư trống — vẽ phù mới bằng `-ve_phu tao <id>`!'}*\n\n` +
      `**━━━ Kho Phù Lục ━━━**\n` +
      phuLines.join('\n') +
      (limitedLines.length ? `\n\n${CE('tukv','💎')} **Limited:** ${limitedLines.join(' · ')}` : '') +
      (buffLines.length ? `\n\n**━━━ Buff Đang Hoạt Động ━━━**\n${buffLines.join('\n')}` : '\n\n*Không có buff phù lục nào đang hoạt động.*') +
      `\n\n**━━━ Đặc Kỹ Phù Lục Sư ━━━**\n` +
      `\`-ve_phu tao <id>\` Vẽ phù · \`-dung_phu <id>\` Dùng phù\n` +
      `\`-phu_bo_tro @người\` Tặng Tu Vi · \`-ve_phong_an @người\` *(MỚI)* Phù Phòng Hộ\n` +
      (hasTP ? `✨ **Thiên Phù Hoàn Hảo** — ×3 phần thưởng khi dùng phù` : ''),
    )
    .setFooter({ text: `Phù Lục Sư | Tổng: ${tongSo} phù` });

  return msg.reply({ embeds: [embed] });
});

/**
 * -ve_phong_an @người
 * Vẽ Phong An Phù tặng đồng đạo — giảm 20% sát thương PvP tiếp theo trong 4h.
 * CD 3h | 5 Linh Thảo + 5,000💠
 */
reg('ve_phong_an', ['vephongan', 'vpa', 'phong_ho_phu'], async (msg) => {
  const userId = msg.author.id;
  const target = msg.mentions.users.first();
  if (!target || target.bot || target.id === userId)
    return msg.reply({ embeds: [errE('Cú pháp: `-ve_phong_an @người_chơi`')] });

  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'phu_luc')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **📜 Phù Lục Sư**!')] });

  const buff   = typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};
  const cdLeft = cdRem(buff.ve_phong_an_cd, 3);
  if (cdLeft) return msg.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Bút thần cần nghỉ ngơi! Hết CD ${cdTs(buff.ve_phong_an_cd, 3)}`)] });

  const PHI       = 5000;
  const THAO_CAN  = 5;
  const thao      = player.linh_thao || {};
  const tongThao  = Object.values(thao).reduce((s, v) => s + Number(v || 0), 0);

  if (tongThao < THAO_CAN)
    return msg.reply({ embeds: [errE(`Cần **${THAO_CAN} Linh Thảo**! Hiện có: **${tongThao}**`)] });
  const _sVPA = calcSpend(player, PHI);
  if (!_sVPA)
    return msg.reply({ embeds: [errE(`Cần **${fmt(PHI)}** ${CE('tult','💠')}!`)] });

  const tgt = await getPlayer(target.id);
  if (!tgt) return msg.reply({ embeds: [errE(`**${target.username}** chưa tu tiên!`)] });

  // Trừ 5 linh thảo
  let thaoCon = THAO_CAN;
  const newThao = { ...thao };
  for (const k of Object.keys(newThao)) {
    if (thaoCon <= 0) break;
    const take = Math.min(thaoCon, Number(newThao[k] || 0));
    newThao[k] = (Number(newThao[k]) || 0) - take;
    thaoCon -= take;
    if (newThao[k] <= 0) delete newThao[k];
  }

  const until    = Date.now() + 4 * 3600 * 1000;
  const hasTP    = player.thien_phu_nghe === 'phu_luc';
  const defBonus = hasTP ? 0.25 : 0.20; // TP: 25% giảm thay vì 20%

  const tgtBuff = typeof tgt.buff_active === 'object' && tgt.buff_active ? tgt.buff_active : {};
  await db('UPDATE players SET linh_thao=$1,linh_thach=$2,linh_thach_trung=$3,linh_thach_cao=$4,buff_active=$5 WHERE user_id=$6',
    [JSON.stringify(newThao), _sVPA.newThuong, _sVPA.newTrung, _sVPA.newCao, JSON.stringify({ ...buff, ve_phong_an_cd: Date.now() }), userId]);
  await db('UPDATE players SET buff_active=$1 WHERE user_id=$2',
    [JSON.stringify({ ...tgtBuff, phong_an_until: until, phong_an_def: defBonus }), target.id]);

  try {
    await target.send({
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('📜 Nhận Được Phong An Phù!')
        .setDescription(`✨ **${msg.author.username}** (Phù Lục Sư) vừa vẽ **Phong An Phù** bảo vệ bạn!\n\n🛡️ **-${Math.round(defBonus*100)}% sát thương nhận vào** trong 4h tiếp theo!\n⏱️ Hết hạn: <t:${Math.floor(until/1000)}:R>`)],
    });
  } catch {}

  return msg.reply({
    embeds: [new EmbedBuilder()
      .setTitle('📜 Phong An Phù — Thiên Thư Hộ Thể!')
      .setColor(0x9b59b6)
      .setDescription(
        `*Bút thần vẽ thiên thư trên không, phù văn xoay tròn bay đến bảo vệ ${target.username}...*\n\n` +
        `${CE('tunt','🎯')} **${target.username}** được bảo vệ!\n` +
        `${CE('tudef','🛡️')} **-${Math.round(defBonus*100)}% sát thương nhận vào** trong **4h**\n` +
        (hasTP ? `✨ **Thiên Phù Hoàn Hảo** — +5% phòng thủ thêm!\n` : '') +
        `\n💸 Tiêu: **${THAO_CAN} Linh Thảo** + **${fmt(PHI)}** ${CE('tult','💠')}`,
      )
      .setFooter({ text: 'Phù Lục Sư | Phong An Phù | CD: 3h' })],
  });
});


// ═══ PHÙ LỤC SƯ — Đặc Kỹ Cũ (phu_bo_tro, phu_bao_ho) ═══
reg("phu_bo_tro", ["pbt", "phubotro"], async (n) => {
    const t = n.author.id,
      e = n.mentions.users.first();
    if (!e || e.bot) return n.reply({ embeds: [errE("Cú pháp: `-phu_bo_tro @người_chơi`")] });
    if (e.id === t)
      return n.reply({
        embeds: [errE("Không thể vẽ phù cho bản thân! Hãy chọn đồng đạo cần giúp.")],
      });
    const h = await getPlayer(t, n.author.username);
    if (!h) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("phu_luc" !== h.nghe)
      return n.reply({
        embeds: [errE("Lệnh này chỉ dành cho **📜 Phù Lục Sư**!\nĐổi: `-nghe chon phu_luc`")],
      });
    const i = 6000,
      a = "object" == typeof h.buff_active && h.buff_active ? h.buff_active : {},
      o = cdRem(a.phu_bo_tro_cd, 2);
    if (o)
      return n.reply({
        embeds: [warnE(`${CE("cd_timer","⏳")} Cần thời gian dưỡng tâm vẽ phù!\nHết CD ${cdTs(a.phu_bo_tro_cd, 2)}.`)],
      });
    const c = h.linh_thao || {},
      _ = Object.values(c).reduce((n, t) => n + Number(t || 0), 0);
    if (_ < 3)
      return n.reply({
        embeds: [errE(`Cần **3 Linh Thảo** để vẽ phù bổ trợ!\nHiện có: **${_}**.`)],
      });
    if (Number(h.linh_thach) < i)
      return n.reply({
        embeds: [
          errE(
            `Cần **${fmt(i)}** ${CE("tult", "💠")} Linh Thạch để kích hoạt phù!\nHiện có: **${fmt(Number(h.linh_thach))}** ${CE("tult", "💠")}`,
          ),
        ],
      });
    if (!(await getPlayer(e.id)))
      return n.reply({ embeds: [errE(`**${e.username}** chưa tu tiên!`)] });
    const u = getCG(h.canh_gioi),
      r = Math.floor(0.15 * u.exp_can);
    let s = 3;
    const l = { ...c };
    for (const n of Object.keys(l)) {
      if (s <= 0) break;
      const t = Math.min(s, Number(l[n] || 0));
      ((l[n] = (Number(l[n]) || 0) - t), (s -= t), l[n] <= 0 && delete l[n]);
    }
    const m = { ...a, phu_bo_tro_cd: Date.now() };
    (await db(
      "UPDATE players SET linh_thao=$1, linh_thach=GREATEST(0,linh_thach-$2), buff_active=$3 WHERE user_id=$4",
      [JSON.stringify(l), i, JSON.stringify(m), t],
    ),
      await db("UPDATE players SET exp=exp+$1 WHERE user_id=$2", [r, e.id]));
    try {
      await e.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE('ng_phu_luc_su','📜')} Bạn Nhận Được Phù Bổ Trợ!`)
            .setColor(15965202)
            .setDescription(
              `✨ **${n.author.username}** (Phù Lục Sư) vừa vẽ **Phù Bổ Trợ** tặng bạn!\n\n📖 **+${fmt(r)} Tu Vi** ngay lập tức!\n\n${CE("tip_icon","💡")} Dùng \`-tu_luyen\` hoặc xem \`-info\` để kiểm tra.`,
            ),
        ],
      });
    } catch (n) {}
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${CE('ng_phu_luc_su','📜')} Phù Bổ Trợ — Tu Vi Truyền Công!`)
          .setColor(15965202)
          .setDescription(
            `*Thiên phù vẽ xong, linh lực theo đường phù văn cuồn cuộn truyền vào thân **${e.username}**!*\n\n${CE('tunt','🎯')} Mục tiêu: **${e.username}**\n📖 Tu Vi tặng ngay: **+${fmt(r)}** *(15% ngưỡng cảnh giới ${u.ten} của ngươi)*\n\n💸 Tiêu: **-3 Linh Thảo** · **-${fmt(i)}** ${CE("tult", "💠")}`,
          )
          .setFooter({ text: "Phù Lục Sư Đặc Kỹ | Tặng Tu Vi Trực Tiếp | CD: 2h" }),
      ],
    });
});

  reg("phu_bao_ho", ["pbh", "phubaoho"], async (n) => {
    const t = n.author.id,
      e = await getPlayer(t, n.author.username);
    if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("phu_luc" !== e.nghe)
      return n.reply({ embeds: [errE("Lệnh này chỉ dành cho **📜 Phù Lục Sư**!")] });
    const h = n.mentions.users.first();
    if (!h || h.bot || h.id === t)
      return n.reply({
        embeds: [errE("Cú pháp: `-phu_bao_ho @người`\nDùng phù để bảo hộ đồng đạo trước trận!")],
      });
    const i = await getPlayer(h.id);
    if (!i) return n.reply({ embeds: [errE("Người kia chưa tham gia game!")] });
    const a = "object" == typeof e.buff_active && e.buff_active ? e.buff_active : {},
      o = 1200,
      c = cdRem(a.phu_bao_ho_cd, 3);
    if (c) return n.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Phù chưa nguội!\nHết CD ${cdTs(a.phu_bao_ho_cd, 3)}.`)] });
    if (Number(e.linh_thach) < o)
      return n.reply({ embeds: [errE(`Cần **${fmt(o)} ${CE("tult", "💠")}** để vẽ Phù Bảo Hộ!`)] });
    const _ = e.linh_thao || {},
      u = Object.values(_).reduce((n, t) => n + Number(t), 0);
    if (u < 2)
      return n.reply({
        embeds: [errE(`Cần **2 Linh Thảo** (bất kỳ loại nào) để vẽ phù!\nHiện có: **${u}**`)],
      });
    const r = { ..._ };
    let s = 0;
    for (const n of Object.keys(r)) {
      if (s >= 2) break;
      const t = Math.min(2 - s, Number(r[n] || 0));
      ((r[n] = (Number(r[n]) || 0) - t), r[n] <= 0 && delete r[n], (s += t));
    }
    const l = {
        ...("object" == typeof i.buff_active && i.buff_active ? i.buff_active : {}),
        phu_bao_ho: 1,
      },
      m = { ...a, phu_bao_ho_cd: Date.now() };
    (await db(
      "UPDATE players SET linh_thach=linh_thach-$1, buff_active=$2, linh_thao=$3 WHERE user_id=$4",
      [o, JSON.stringify(m), JSON.stringify(r), t],
    ),
      await db("UPDATE players SET buff_active=$1 WHERE user_id=$2", [JSON.stringify(l), h.id]));
    try {
      await h.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE('ng_phu_luc_su','📜')} Được Phù Bảo Hộ!`)
            .setColor(49151)
            .setDescription(
              `✨ **${n.author.username}** (Phù Lục Sư) vừa vẽ **Phù Bảo Hộ** cho bạn!\n\n${CE("tudef", "🛡️")} **Giảm 30% sát thương** nhận vào trong **trận PVP tiếp theo**!\n\n${CE("tip_icon","💡")} Hãy tận dụng trước khi thách đấu ai đó!`,
            ),
        ],
      });
    } catch (n) {}
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📜 Phù Bảo Hộ Hoàn Thành!")
          .setColor(49151)
          .setDescription(
            `${CE("tudef", "🛡️")} **${h.username}** được **Phù Bảo Hộ**!\n📜 Giảm **30% sát thương** nhận vào trong trận PVP tiếp theo.\n\n${CE("tult", "💠")} Chi phí: **-${fmt(o)} ${CE("tult", "💠")}** + **2 Linh Thảo**`,
          )
          .setFooter({ text: "Phù Lục Sư Đặc Kỹ | CD: 1.5h" }),
      ],
    });
  });
