'use strict';
// ── 💉  Dược Sư — Đặc Kỹ Mới ──
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
  tinhCS, calcEXP_active, calcMaxLinhThach,
  reg, SEP, calcSpend,
} = require('../../utils');


// ═══════════════════════════════════════════════════════════════════════════════
// 💉  DƯỢC SƯ — TÍNH NĂNG MỚI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * -che_doc @người
 * Chế độc dược và tiêm vào phi khí kẻ thù — ATK -20%, DEF -15% cho PvP tiếp theo.
 * CD 3h | 5 Linh Thảo + 5,000💠
 */
reg('che_doc', ['chedoc', 'cd_duoc', 'doc_duoc'], async (msg) => {
  const userId = msg.author.id;
  const target = msg.mentions.users.first();
  if (!target || target.bot || target.id === userId)
    return msg.reply({ embeds: [errE('Cú pháp: `-che_doc @người_chơi`')] });

  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'duoc_su')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **💉 Dược Sư**!')] });

  const buff   = typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};
  const cdLeft = cdRem(buff.che_doc_cd, 3);
  if (cdLeft) return msg.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Độc dược cần thời gian pha chế! Hết CD ${cdTs(buff.che_doc_cd, 3)}`)] });

  const PHI      = 5000;
  const THAO_CAN = 5;
  const thao     = player.linh_thao || {};
  const tongThao = Object.values(thao).reduce((s, v) => s + Number(v || 0), 0);

  if (tongThao < THAO_CAN)
    return msg.reply({ embeds: [errE(`Cần **${THAO_CAN} Linh Thảo** để pha chế độc dược!\nHiện có: **${tongThao}**`)] });
  const _sChe = calcSpend(player, PHI);
  if (!_sChe)
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

  const hasTP  = player.thien_phu_nghe === 'duoc_su';
  const atkDeb = hasTP ? 0.25 : 0.20;
  const defDeb = hasTP ? 0.20 : 0.15;

  const tgtBuff = typeof tgt.buff_active === 'object' && tgt.buff_active ? tgt.buff_active : {};
  await db('UPDATE players SET linh_thao=$1,linh_thach=$2,linh_thach_trung=$3,linh_thach_cao=$4,buff_active=$5 WHERE user_id=$6',
    [JSON.stringify(newThao), _sChe.newThuong, _sChe.newTrung, _sChe.newCao, JSON.stringify({ ...buff, che_doc_cd: Date.now() }), userId]);
  await db('UPDATE players SET buff_active=$1 WHERE user_id=$2',
    [JSON.stringify({ ...tgtBuff, doc_atk_deb: atkDeb, doc_def_deb: defDeb, doc_charges: 1 }), target.id]);

  try {
    await target.send({
      embeds: [new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('☠️ Bạn Bị Trúng Độc Dược!')
        .setDescription(`${CE('warn_icon','⚠️')} Một **Dược Sư** đã tiêm độc vào phi khí của bạn!\n\n☠️ **ATK -${Math.round(atkDeb*100)}%** · **DEF -${Math.round(defDeb*100)}%** trong **PvP tiếp theo**!\n${CE('tip_icon','💡')} Dùng \`-giai_doc\` để giải độc!`)],
    });
  } catch {}

  return msg.reply({
    embeds: [new EmbedBuilder()
      .setTitle('☠️ Chế Độc — Độc Dược Thấm Vào Phi Khí!')
      .setColor(0x2ecc71)
      .setDescription(
        `*Linh thảo tán nhuyễn, độc dược chế thành — phi tiêu bạc mỏng tẩm độc bay đến...*\n\n` +
        `${CE('tunt','🎯')} **${target.username}** trúng độc!\n` +
        `☠️ **ATK -${Math.round(atkDeb*100)}%** · **DEF -${Math.round(defDeb*100)}%** cho PvP tiếp theo\n` +
        (hasTP ? `✨ **Diệu Thủ Thần Y** — Độc mạnh hơn: ATK -25%, DEF -20%!\n` : '') +
        `\n💸 Tiêu: **${THAO_CAN} Linh Thảo** + **${fmt(PHI)}** ${CE('tult','💠')}`,
      )
      .setFooter({ text: 'Dược Sư | Chế Độc | CD: 3h' })],
  });
});

/**
 * -giai_doc [@người]
 * Giải độc — bản thân (miễn phí) hoặc cho đồng đạo (2,000💠 + 1 Linh Thảo).
 * CD 1h
 */
reg('giai_doc', ['giaidoc', 'gd_duoc', 'chay_doc'], async (msg) => {
  const userId  = msg.author.id;
  const target  = msg.mentions.users.first();
  const isSelf  = !target || target.id === userId;
  const tgtId   = isSelf ? userId : target.id;
  const tgtName = isSelf ? 'bản thân' : target.username;

  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'duoc_su')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **💉 Dược Sư**!')] });

  const buff   = typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};
  const cdLeft = cdRem(buff.giai_doc_cd, 1);
  if (cdLeft) return msg.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Kỹ thuật giải độc cần phục hồi! Hết CD ${cdTs(buff.giai_doc_cd, 1)}`)] });

  const tgt = isSelf ? player : await getPlayer(tgtId);
  if (!tgt) return msg.reply({ embeds: [errE(`**${target.username}** chưa tu tiên!`)] });

  const tgtBuff = typeof tgt.buff_active === 'object' && tgt.buff_active ? tgt.buff_active : {};
  const hasPoison = (tgtBuff.doc_charges || 0) > 0;

  if (!hasPoison)
    return msg.reply({ embeds: [warnE(`✅ **${tgtName}** không bị trúng độc nào!`)] });

  // Chi phí nếu giải độc cho người khác
  if (!isSelf) {
    const PHI      = 2000;
    const THAO_CAN = 1;
    const thao     = player.linh_thao || {};
    const tongThao = Object.values(thao).reduce((s, v) => s + Number(v || 0), 0);

    if (tongThao < THAO_CAN)
      return msg.reply({ embeds: [errE(`Cần **1 Linh Thảo** để giải độc cho đồng đạo!`)] });
    const _sGiai = calcSpend(player, PHI);
    if (!_sGiai)
      return msg.reply({ embeds: [errE(`Cần **${fmt(PHI)}** ${CE('tult','💠')} để giải độc!`)] });

    // Trừ 1 linh thảo
    const newThao = { ...thao };
    for (const k of Object.keys(newThao)) {
      const take = Math.min(1, Number(newThao[k] || 0));
      if (take <= 0) continue;
      newThao[k] = (Number(newThao[k]) || 0) - take;
      if (newThao[k] <= 0) delete newThao[k];
      break;
    }
    await db('UPDATE players SET linh_thao=$1,linh_thach=$2,linh_thach_trung=$3,linh_thach_cao=$4,buff_active=$5 WHERE user_id=$6',
      [JSON.stringify(newThao), _sGiai.newThuong, _sGiai.newTrung, _sGiai.newCao, JSON.stringify({ ...buff, giai_doc_cd: Date.now() }), userId]);
  } else {
    await db('UPDATE players SET buff_active=$1 WHERE user_id=$2',
      [JSON.stringify({ ...buff, giai_doc_cd: Date.now() }), userId]);
  }

  const cleanBuff = { ...tgtBuff };
  delete cleanBuff.doc_atk_deb;
  delete cleanBuff.doc_def_deb;
  delete cleanBuff.doc_charges;
  await db('UPDATE players SET buff_active=$1 WHERE user_id=$2', [JSON.stringify(cleanBuff), tgtId]);

  if (!isSelf) {
    try {
      await target.send({
        embeds: [new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('💉 Độc Đã Được Giải!')
          .setDescription(`✅ **${msg.author.username}** (Dược Sư) đã giải độc cho bạn!\n\nCác debuff độc dược đã được xóa hoàn toàn!`)],
      });
    } catch {}
  }

  return msg.reply({
    embeds: [new EmbedBuilder()
      .setTitle('💉 Giải Độc Thành Công!')
      .setColor(0x2ecc71)
      .setDescription(
        `*Tay dược sư điêu luyện bổ đúng huyệt đạo — độc tố tiêu tan!*\n\n` +
        `✅ **${tgtName}** đã được giải độc hoàn toàn!\n` +
        `☠️ Đã xóa: **ATK debuff** · **DEF debuff**`,
      )
      .setFooter({ text: 'Dược Sư | Giải Độc | CD: 1h' })],
  });
});


// ═══ DƯỢC SƯ — Đặc Kỹ Cũ (dai_hoi_phuc) ═══
  reg("dai_hoi_phuc", ["dhp", "dahoiphuc"], async (n) => {
    const t = n.author.id,
      e = await getPlayer(t, n.author.username);
    if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("duoc_su" !== e.nghe)
      return n.reply({ embeds: [errE("Lệnh này chỉ dành cho **💉 Dược Sư**!")] });
    const h = n.mentions.users.first();
    if (!h || h.bot || h.id === t)
      return n.reply({
        embeds: [errE("Cú pháp: `-dai_hoi_phuc @người`\nHồi phục toàn diện cho đồng đạo!")],
      });
    const i = await getPlayer(h.id);
    if (!i) return n.reply({ embeds: [errE("Người kia chưa tham gia game!")] });
    const a = "object" == typeof e.buff_active && e.buff_active ? e.buff_active : {},
      o = 3000,
      c = cdRem(a.dai_hoi_phuc_cd, 4);
    if (c)
      return n.reply({
        embeds: [warnE(`${CE("cd_timer","⏳")} Đại Hồi Phục chưa sạc đủ năng lượng!\nHết CD ${cdTs(a.dai_hoi_phuc_cd, 4)}.`)],
      });
    const _sDaiHoi = calcSpend(e, o);
    if (!_sDaiHoi)
      return n.reply({
        embeds: [errE(`Cần **${fmt(o)} ${CE("tult", "💠")}** + **5 Linh Thảo** để thi triển!`)],
      });
    const _ = e.linh_thao || {},
      u = Object.values(_).reduce((n, t) => n + Number(t), 0);
    if (u < 5)
      return n.reply({ embeds: [errE(`Cần **5 Linh Thảo** (bất kỳ)!\nHiện có: **${u}**`)] });
    const r = { ..._ };
    let s = 0;
    for (const n of Object.keys(r)) {
      if (s >= 5) break;
      const t = Math.min(5 - s, Number(r[n] || 0));
      ((r[n] = (Number(r[n]) || 0) - t), r[n] <= 0 && delete r[n], (s += t));
    }
    const { hp_max: l } = tinhCS({ ...i }),
      m = i.dao_thuong || 0,
      g = { ...a, dai_hoi_phuc_cd: Date.now() };
    (await db(
      "UPDATE players SET linh_thach=$1,linh_thach_trung=$2,linh_thach_cao=$3,buff_active=$4,linh_thao=$5 WHERE user_id=$6",
      [_sDaiHoi.newThuong, _sDaiHoi.newTrung, _sDaiHoi.newCao, JSON.stringify(g), JSON.stringify(r), t],
    ),
      await db("UPDATE players SET hp=$1, hp_max=$2, dao_thuong=0 WHERE user_id=$3", [l, l, h.id]));
    try {
      await h.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("💉 Đại Hồi Phục — Thần Thể Tái Sinh!")
            .setColor(65407)
            .setDescription(
              `💊 **${n.author.username}** (Dược Sư) vừa cứu chữa toàn diện cho bạn!\n\n❤️ HP hồi đầy: **${fmt(l)}/${fmt(l)}**${m > 0 ? `\n✨ Đạo Thương Cấp ${m} đã được **chữa sạch**!` : ""}\n\n🙏 Nhớ tri ân vị Dược Sư tốt bụng này!`,
            ),
        ],
      });
    } catch (n) {}
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("💉 Đại Hồi Phục Thành Công!")
          .setColor(65407)
          .setDescription(
            `❤️ **${h.username}** hồi phục:\n  • HP: **${fmt(l)}/${fmt(l)}** *(đầy tràn)*\n` +
              (m > 0 ? `  • Đạo Thương Cấp ${m} → **Đã chữa sạch** ✨\n` : "") +
              `\n${CE("tult", "💠")} Chi phí: **-${fmt(o)} ${CE("tult", "💠")}** + **5 Linh Thảo**`,
          )
          .setFooter({ text: "Dược Sư Đặc Kỹ | CD: 4h" }),
      ],
    });
  });
