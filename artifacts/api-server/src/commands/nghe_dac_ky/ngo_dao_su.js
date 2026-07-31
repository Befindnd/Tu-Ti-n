'use strict';
// ── 🌀  Ngộ Đạo Sư — Đặc Kỹ Mới ──
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
  PHU_LUC_DATA, NGHE, getNgoTinh,
} = require('../../data');
const {
  fmt, fTime, cdRem, cdRemMin, cdTs,
  errE, warnE, okE,
  tinhCS, calcEXP_active, calcMaxLinhThach,
  reg, SEP, calcSpend, totalLT,
} = require('../../utils');


// ═══════════════════════════════════════════════════════════════════════════════
// 🌀  NGỘ ĐẠO SƯ — TÍNH NĂNG MỚI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * -cong_huong @người
 * Cộng Hưởng Thiền Định — thiền cùng đồng đạo, cả hai +2% Cảm Ngộ.
 * CD 4h | Miễn phí
 */
reg('cong_huong', ['conghuong', 'ch_ngo', 'thien_cong'], async (msg) => {
  const userId = msg.author.id;
  const target = msg.mentions.users.first();
  if (!target || target.bot || target.id === userId)
    return msg.reply({ embeds: [errE('Cú pháp: `-cong_huong @người_chơi`')] });

  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'ngo_dao_su')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **🌀 Ngộ Đạo Sư**!')] });

  const buff   = typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};
  const cdLeft = cdRem(buff.cong_huong_cd, 4);
  if (cdLeft) return msg.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Đạo tâm chưa đủ bình tĩnh để cộng hưởng! Hết CD ${cdTs(buff.cong_huong_cd, 4)}`)] });

  const tgt = await getPlayer(target.id);
  if (!tgt) return msg.reply({ embeds: [errE(`**${target.username}** chưa tu tiên!`)] });

  const hasTP     = player.thien_phu_nghe === 'ngo_dao_su';
  const gain_self = hasTP ? 3 : 2;
  const gain_tgt  = 2;

  const selfNgoTinh = Number(player.ngo_tinh || 50);
  const tgtNgoTinh  = Number(tgt.ngo_tinh || 50);

  // Bonus: nếu đối phương cũng là Ngộ Đạo Sư → +1% thêm cho cả hai
  const doubleMaster = tgt.nghe === 'ngo_dao_su';
  const bonus = doubleMaster ? 1 : 0;

  const newSelfCam = Math.min(100, Number(player.cam_ngo || 0) + gain_self + bonus);
  const newTgtCam  = Math.min(100, Number(tgt.cam_ngo || 0) + gain_tgt + bonus);

  await db('UPDATE players SET cam_ngo=$1, buff_active=$2 WHERE user_id=$3',
    [newSelfCam, JSON.stringify({ ...buff, cong_huong_cd: Date.now() }), userId]);
  await db('UPDATE players SET cam_ngo=$1 WHERE user_id=$2', [newTgtCam, target.id]);

  try {
    await target.send({
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('🌀 Cộng Hưởng Thiền Định!')
        .setDescription(
          `${CE("ft_tu_luyen","🧘")} **${msg.author.username}** (Ngộ Đạo Sư) đã mời bạn cộng hưởng thiền định!\n\n` +
          `${CE('tip_icon','💡')} **Cảm Ngộ +${gain_tgt + bonus}%** *(${Number(tgt.cam_ngo || 0)}% → ${newTgtCam}%)*\n` +
          (doubleMaster ? '✨ **Đồng Đạo Cộng Hưởng** — +1% thêm vì cả hai đều là Ngộ Đạo Sư!\n' : '') +
          `\n${CE('tip_icon','💡')} Dùng \`-dot_pha\` khi Cảm Ngộ ≥80% để đột phá cảnh giới!`,
        )],
    });
  } catch {}

  return msg.reply({
    embeds: [new EmbedBuilder()
      .setTitle('🌀 Cộng Hưởng Thiền Định — Đạo Tâm Hòa Nhịp!')
      .setColor(0x9b59b6)
      .setDescription(
        `*Hai đạo tâm chạm vào nhau trong không gian thiền định — linh lực cộng hưởng bùng nổ!*\n\n` +
        `${CE("ft_tu_luyen","🧘")} Bản thân: Cảm Ngộ +**${gain_self + bonus}%** → **${newSelfCam}%**\n` +
        `${CE('tunt','🎯')} **${target.username}**: Cảm Ngộ +**${gain_tgt + bonus}%** → **${newTgtCam}%**\n` +
        (doubleMaster ? `✨ **Đồng Đạo Cộng Hưởng** — Cả hai Ngộ Đạo Sư → +1% thêm!\n` : '') +
        (hasTP ? `✨ **Đạo Tâm Bất Diệt** — Bản thân được +3% thay vì +2%!\n` : '') +
        `\n💸 **Miễn phí** · CD: **4h**`,
      )
      .setFooter({ text: 'Ngộ Đạo Sư | Cộng Hưởng | CD: 4h | Miễn phí' })],
  });
});

/**
 * -dao_kinh
 * Chép Đạo Kinh — viết kinh nghiệm tu hành, nhận Cảm Ngộ và đôi khi Linh Thạch.
 * CD 12h | 3,750💠
 */
const DAO_KINH_OUTCOMES = [
  { mo_ta: 'Đạo lý vô cùng thâm sâu... tâm thần đột nhiên khai sáng!', cam_ngo: [3, 6], lt: 0, emoji: '🌟' },
  { mo_ta: 'Tay bút viết theo dòng cảm xúc — từng chữ đều đượm đạo khí.', cam_ngo: [2, 5], lt: 500, emoji: '📖' },
  { mo_ta: 'Ghi lại bài học từ trận đấu cũ — ngộ ra sự sơ hở trong đạo pháp.', cam_ngo: [1, 4], lt: 1000, emoji: '⚔️' },
  { mo_ta: 'Cảm ngộ từ thiên nhiên xung quanh — vũ trụ và ta là một.', cam_ngo: [2, 4], lt: 0, emoji: '🌿' },
  { mo_ta: 'Đạo tâm thăng hoa — mỗi chữ viết ra đều tụ linh khí!', cam_ngo: [4, 7], lt: 1500, emoji: '✨' },
];

reg('dao_kinh', ['daokinh', 'dk_ngo', 'viet_kinh'], async (msg) => {
  const userId = msg.author.id;
  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (player.nghe !== 'ngo_dao_su')
    return msg.reply({ embeds: [errE('Lệnh này chỉ dành cho **🌀 Ngộ Đạo Sư**!')] });

  const buff   = typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};
  const cdLeft = cdRem(buff.dao_kinh_cd, 12);
  if (cdLeft) return msg.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Đạo kinh cần thời gian chiêm nghiệm! Hết CD ${cdTs(buff.dao_kinh_cd, 12)}`)] });

  const PHI = 3750;
  const _sDK = calcSpend(player, PHI);
  if (!_sDK)
    return msg.reply({ embeds: [errE(`Cần **${fmt(PHI)}** ${CE('tult','💠')} để sắm bút mực viết đạo kinh!`)] });

  const hasTP    = player.thien_phu_nghe === 'ngo_dao_su';
  const ngoTinh  = Number(player.ngo_tinh || 50);
  const camNgo   = Number(player.cam_ngo || 0);

  // Outcome chọn theo Ngộ Tính
  const weightIdx = ngoTinh >= 80 ? 4 : ngoTinh >= 60 ? Math.floor(Math.random() * 2) + 2 : Math.floor(Math.random() * 3);
  const outcome  = DAO_KINH_OUTCOMES[hasTP ? 4 : weightIdx];

  const [minG, maxG] = outcome.cam_ngo;
  const gain = minG + Math.floor(Math.random() * (maxG - minG + 1)) + (hasTP ? 1 : 0);
  const lt   = outcome.lt;

  const newCam = Math.min(100, camNgo + gain);
  const newBuff = { ...buff, dao_kinh_cd: Date.now() };

  // Trả phí trước rồi cộng thưởng LT vào thường
  await db('UPDATE players SET linh_thach=$1,linh_thach_trung=$2,linh_thach_cao=$3,cam_ngo=$4,buff_active=$5 WHERE user_id=$6',
    [_sDK.newThuong + lt, _sDK.newTrung, _sDK.newCao, newCam, JSON.stringify(newBuff), userId]);

  const ngoTinh_desc = ngoTinh >= 81 ? 'Tiên Phẩm' : ngoTinh >= 61 ? 'Thiên Phẩm' : ngoTinh >= 41 ? 'Địa Phẩm' : 'Phàm Phẩm';

  return msg.reply({
    embeds: [new EmbedBuilder()
      .setTitle(`${outcome.emoji} Đạo Kinh Hoàn Thành — Đạo Tâm Thăng Hoa!`)
      .setColor(0x8e44ad)
      .setDescription(
        `*${outcome.mo_ta}*\n\n` +
        `📿 **Ngộ Tính:** ${ngoTinh} *(${ngoTinh_desc})*\n` +
        `${CE('tip_icon','💡')} **Cảm Ngộ:** ${camNgo}% → **${newCam}%** *(+${gain}%)*\n` +
        (lt > 0 ? `${CE('tult','💠')} **Đạo Kinh Thu Hút Linh Khí:** +${fmt(lt)} Linh Thạch\n` : '') +
        (hasTP ? `✨ **Đạo Tâm Bất Diệt** — +1% Cảm Ngộ thêm từ Thiên Phú!\n` : '') +
        `💸 Chi phí: **${fmt(PHI)}** ${CE('tult','💠')}\n\n` +
        `${CE("tip_icon","💡")} Cảm Ngộ ≥80% → \`-dot_pha\` để bứt phá cảnh giới!`,
      )
      .setFooter({ text: `Ngộ Đạo Sư | Đạo Kinh | CD: 12h | Ngộ Tính: ${ngoTinh}` })],
  });
});


// ═══ NGỘ ĐẠO SƯ — Đặc Kỹ Cũ (dai_ngo, truyen_dao, thach_ngo, pha_binh_canh) ═══
const NGO_DAO_SU_NGHE = 'ngo_dao_su';
const DAI_NGO_CD_H    = 8;
const TRUYEN_DAO_CD_H = 6;
const THACH_NGO_CD_H  = 16;

function kiemTraNghe(player) {
  if (player.nghe !== NGO_DAO_SU_NGHE)
    return `Lệnh này chỉ dành cho **🌀 Ngộ Đạo Sư**!\nDùng \`-nghe chon ngo_dao_su\` để chuyển đổi.`;
  return null;
}

function getBuff(player) {
  return typeof player.buff_active === 'object' && player.buff_active ? player.buff_active : {};
}

// ─── 1. Đại Ngộ ─────────────────────────────────────────────────────────────
// CD 8h, 5625 LT, chỉ boost Cảm Ngộ — KHÔNG xóa bình cảnh
// Gains: Tiên ≥81: 3-5%, Thiên 61-80: 2-4%, Địa 41-60: 1-3%, Phàm: 1-2%
reg("dai_ngo", ["daingngo", "dailngo", "dngo"], async (n) => {
  const userId = n.author.id;
  const player = await getPlayer(userId, n.author.username);
  if (!player) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });

  const err = kiemTraNghe(player);
  if (err) return n.reply({ embeds: [errE(err)] });

  const buff = getBuff(player);
  const cdLeft = cdRem(buff.dai_ngo_cd, DAI_NGO_CD_H);
  if (cdLeft)
    return n.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Tâm thần chưa hồi phục đủ để thiền định tiếp!\nHết CD ${cdTs(buff.dai_ngo_cd, DAI_NGO_CD_H)}.`)] });

  const phi = 5625;
  const _sDN = calcSpend(player, phi);
  if (!_sDN)
    return n.reply({ embeds: [errE(`Cần **${fmt(phi)}** ${CE("tult","💠")} để thiền định!\nHiện có: **${fmt(totalLT(player))}** ${CE("tult","💠")}`)] });

  const ngoTinh    = Number(player.ngo_tinh || 50);
  const camNgo     = Number(player.cam_ngo || 0);
  const coThienPhu = player.thien_phu_nghe === NGO_DAO_SU_NGHE;
  const tier       = getNgoTinh(ngoTinh);
  const rand       = Math.random();

  let gain, moTa, clr;

  if (ngoTinh >= 81) {
    gain = Math.floor(Math.random() * 3) + 3 + (coThienPhu ? 1 : 0); // 3-5% (TP: 4-6%)
    if (rand < 0.4) { moTa = '✨ **Đại Ngộ Tiên Cảnh!** Linh tâm thấu suốt — đạo lý tuôn vào như thác!'; clr = 16766720; }
    else            { moTa = '🌟 Thiền định sâu — pháp lực ổn định, Cảm Ngộ tích lũy vững.'; clr = 3447003; }
  } else if (ngoTinh >= 61) {
    gain = Math.floor(Math.random() * 3) + 2 + (coThienPhu ? 1 : 0); // 2-4% (TP: 3-5%)
    if (rand < 0.35) { moTa = '🔮 **Thiên Ngộ!** Đạo lý uyên thâm tuôn vào tâm trí từng lớp.'; clr = 9699539; }
    else             { moTa = '💭 Thiền định ổn định — tích lũy dần từng bước.'; clr = 3447003; }
  } else if (ngoTinh >= 41) {
    gain = Math.floor(Math.random() * 3) + 1 + (coThienPhu ? 1 : 0); // 1-3% (TP: 2-4%)
    moTa = '🌿 Đạo tâm dần sáng tỏ — Cảm Ngộ tăng từng chút một.'; clr = 1752220;
  } else {
    gain = Math.floor(Math.random() * 2) + 1; // 1-2%
    moTa = '🌱 Tâm trí còn non nớt — thiền định đạt chút hiệu quả nhỏ.'; clr = 9807270;
  }

  const newCamNgo = Math.min(100, camNgo + gain);
  const newBuff   = { ...buff, dai_ngo_cd: Date.now() };

  await db(
    "UPDATE players SET linh_thach=$1,linh_thach_trung=$2,linh_thach_cao=$3,cam_ngo=$4,buff_active=$5 WHERE user_id=$6",
    [_sDN.newThuong, _sDN.newTrung, _sDN.newCao, newCamNgo, JSON.stringify(newBuff), userId],
  );

  return n.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('🌀 Đại Ngộ — Thiền Định Sâu')
        .setColor(clr)
        .setDescription(
          `${moTa}\n\n` +
          `📿 Ngộ Tính: **${ngoTinh}** *(${tier.ten})*\n` +
          `${CE('tip_icon','💡')} Cảm Ngộ: **${camNgo}%** → **${newCamNgo}%** *(+${gain}%)*\n` +
          `💸 Linh Thạch: **-${fmt(phi)}** ${CE("tult","💠")}\n\n` +
          `${CE("tip_icon","💡")} Cảm Ngộ ≥80% → dùng \`-dot_pha\` để đột phá · Nếu bị Bình Cảnh → dùng \`-pha_binh_canh\` trước`,
        )
        .setFooter({ text: `CD: ${DAI_NGO_CD_H}h | Ngộ Tính càng cao Cảm Ngộ tăng càng nhiều` }),
    ],
  });
});

// ─── 2. Truyền Đạo ──────────────────────────────────────────────────────────
// CD 6h, 3750 LT, tặng target Cảm Ngộ 1-3%, bản thân +Đạo Tâm 1 (rất chậm)
reg("truyen_dao", ["truyendao", "tdao_ngo"], async (n) => {
  const userId = n.author.id;
  const target = n.mentions.users.first();
  if (!target || target.bot)
    return n.reply({ embeds: [errE("Cú pháp: `-truyen_dao @người_chơi`")] });
  if (target.id === userId)
    return n.reply({ embeds: [errE("Không thể truyền đạo cho chính mình — hãy tìm đồng đạo!")] });

  const player = await getPlayer(userId, n.author.username);
  if (!player) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });

  const err = kiemTraNghe(player);
  if (err) return n.reply({ embeds: [errE(err)] });

  const buff   = getBuff(player);
  const cdLeft = cdRem(buff.truyen_dao_cd, TRUYEN_DAO_CD_H);
  if (cdLeft)
    return n.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Đạo tâm chưa hồi đủ để tiếp tục truyền đạo!\nHết CD ${cdTs(buff.truyen_dao_cd, TRUYEN_DAO_CD_H)}.`)] });

  const phi = 3750;
  const _sTD = calcSpend(player, phi);
  if (!_sTD)
    return n.reply({ embeds: [errE(`Cần **${fmt(phi)}** ${CE("tult","💠")} để truyền đạo!\nHiện có: **${fmt(totalLT(player))}** ${CE("tult","💠")}`)] });

  const targetPlayer = await getPlayer(target.id);
  if (!targetPlayer) return n.reply({ embeds: [errE(`**${target.username}** chưa tu tiên!`)] });

  const ngoTinh    = Number(player.ngo_tinh || 50);
  const coThienPhu = player.thien_phu_nghe === NGO_DAO_SU_NGHE;

  // Target nhận Cảm Ngộ 1-3% (scale theo ngộ tính), Thiên Phú +1%
  const camNgoBonus  = Math.floor(1.5 + (ngoTinh / 100) * 1.5) + (coThienPhu ? 1 : 0); // 1-3% (+1% TP)
  const targetCamNgo = Math.min(100, Number(targetPlayer.cam_ngo || 0) + camNgoBonus);

  // Bản thân +Đạo Tâm 1 (chậm rãi — tích lũy dài hạn), Cảm Ngộ +1%
  const daoTamBonus = player.la_ma_tu ? 0 : 1;
  const selfCamNgo  = Math.min(100, Number(player.cam_ngo || 0) + 1);
  const newTamMa    = player.la_ma_tu
    ? Number(player.tam_ma || 0)
    : Math.min(100, Number(player.tam_ma || 0) + daoTamBonus);
  const newBuff = { ...buff, truyen_dao_cd: Date.now() };

  await db(
    "UPDATE players SET linh_thach=$1,linh_thach_trung=$2,linh_thach_cao=$3,cam_ngo=$4,tam_ma=$5,buff_active=$6 WHERE user_id=$7",
    [_sTD.newThuong, _sTD.newTrung, _sTD.newCao, selfCamNgo, newTamMa, JSON.stringify(newBuff), userId],
  );
  await db("UPDATE players SET cam_ngo=$1 WHERE user_id=$2", [targetCamNgo, target.id]);

  try {
    await target.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🌀 Bạn Nhận Được Truyền Đạo!')
          .setColor(1752220)
          .setDescription(
            `✨ **${n.author.username}** (Ngộ Đạo Sư) vừa truyền đạo cho bạn!\n\n` +
            `${CE('tip_icon','💡')} Cảm Ngộ **+${camNgoBonus}%** → **${targetCamNgo}%**\n\n` +
            `${CE("tip_icon","💡")} Dùng \`-dot_pha\` khi đủ Cảm Ngộ để đột phá cảnh giới!`,
          ),
      ],
    });
  } catch {}

  const tamMaLine = (player.la_ma_tu || daoTamBonus === 0)
    ? '' : ` · ☯️ Đạo Tâm **+${daoTamBonus}** → **${newTamMa}**`;

  return n.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('☯️ Truyền Đạo — Chia Sẻ Thiên Ngộ')
        .setColor(1752220)
        .setDescription(
          `*Ngươi ngồi đối diện ${target.username}, pháp lực lan tỏa như dòng sông yên tĩnh...*\n\n` +
          `${CE('tunt','🎯')} **${target.username}** nhận: ${CE('tip_icon','💡')} Cảm Ngộ **+${camNgoBonus}%** → **${targetCamNgo}%**\n` +
          `🌀 **Bản thân** nhận: ${CE('tip_icon','💡')} Cảm Ngộ **+1%**${tamMaLine}\n\n` +
          `💸 **-${fmt(phi)}** ${CE("tult","💠")}`,
        )
        .setFooter({ text: `CD: ${TRUYEN_DAO_CD_H}h | Đạo Tâm tích lũy chậm — kiên trì mới thành đạo` }),
    ],
  });
});

// ─── 3. Thạch Ngộ ───────────────────────────────────────────────────────────
// CD 16h, 1875 LT, Cảm Ngộ +4-9%, rủi ro bình cảnh 15-25%
reg("thach_ngo", ["thachngo", "tngo", "da_ngo"], async (n) => {
  const userId = n.author.id;
  const player = await getPlayer(userId, n.author.username);
  if (!player) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });

  const err = kiemTraNghe(player);
  if (err) return n.reply({ embeds: [errE(err)] });

  const buff   = getBuff(player);
  const cdLeft = cdRem(buff.thach_ngo_cd, THACH_NGO_CD_H);
  if (cdLeft)
    return n.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Thân thể chưa hồi phục sau lần nhập định trước!\nHết CD ${cdTs(buff.thach_ngo_cd, THACH_NGO_CD_H)}.`)] });

  if (player.binh_canh)
    return n.reply({ embeds: [warnE("🧱 Đang bị Bình Cảnh — không thể nhập định Thạch Ngộ!\nDùng `-pha_binh_canh` để khai thông trước.")] });

  const phi = 1875;
  const _sTN = calcSpend(player, phi);
  if (!_sTN)
    return n.reply({ embeds: [errE(`Cần **${fmt(phi)}** ${CE("tult","💠")} để nhập định!\nHiện có: **${fmt(totalLT(player))}** ${CE("tult","💠")}`)] });

  const ngoTinh    = Number(player.ngo_tinh || 50);
  const camNgo     = Number(player.cam_ngo || 0);
  const coThienPhu = player.thien_phu_nghe === NGO_DAO_SU_NGHE;

  // Rủi ro bình cảnh: 15~25%, Ngộ Tính càng cao càng ít (Tiên Phẩm ~15%, Phàm ~25%)
  const riskRate   = Math.max(0.15, 0.25 - (ngoTinh / 100) * 0.10) * (coThienPhu ? 0.85 : 1.0);
  // Cảm Ngộ gain: 4-9%
  const camNgoGain = Math.floor(Math.random() * 6) + 4;
  const newCamNgo  = Math.min(100, camNgo + camNgoGain);
  const newBuff    = { ...buff, thach_ngo_cd: Date.now() };

  const triggered = Math.random() < riskRate;

  if (triggered) {
    await db(
      "UPDATE players SET linh_thach=$1,linh_thach_trung=$2,linh_thach_cao=$3,cam_ngo=$4,binh_canh=TRUE,buff_active=$5 WHERE user_id=$6",
      [_sTN.newThuong, _sTN.newTrung, _sTN.newCao, newCamNgo, JSON.stringify(newBuff), userId],
    );
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🧱 Thạch Ngộ Phản Tác!')
          .setColor(9109504)
          .setDescription(
            `*Nhập định quá sâu, pháp lực cuồn cuộn mất kiểm soát — kinh mạch tắc nghẽn!*\n\n` +
            `${CE('tip_icon','💡')} Cảm Ngộ **+${camNgoGain}%** → **${newCamNgo}%**\n` +
            `🧱 **Bình Cảnh hình thành!**\n` +
            `💸 **-${fmt(phi)}** ${CE("tult","💠")}\n\n` +
            `${CE("tip_icon","💡")} Tích đủ điều kiện rồi dùng \`-pha_binh_canh\` để khai thông tâm cảnh (20%)!`,
          )
          .setFooter({ text: `CD: ${THACH_NGO_CD_H}h | Rủi ro: ${Math.round(riskRate * 100)}% | Ngộ Tính cao → ít nguy hiểm hơn` }),
      ],
    });
  }

  await db(
    "UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1), cam_ngo=$2, buff_active=$3 WHERE user_id=$4",
    [phi, newCamNgo, JSON.stringify(newBuff), userId],
  );

  return n.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('🪨 Thạch Ngộ — Nhập Định Cực Sâu')
        .setColor(6559305)
        .setDescription(
          `*Ngươi ngồi bất động như tảng đá nghìn năm, thiên địa linh khí chầm chậm thấm vào tâm trí...*\n\n` +
          `${CE('tip_icon','💡')} Cảm Ngộ: **${camNgo}%** → **${newCamNgo}%** *(+${camNgoGain}%)*\n` +
          `${CE('warn_icon','⚠️')} Rủi ro bình cảnh phản tác: **${Math.round(riskRate * 100)}%** — lần này an toàn!\n` +
          `💸 **-${fmt(phi)}** ${CE("tult","💠")}`,
        )
        .setFooter({ text: `CD: ${THACH_NGO_CD_H}h | Ngộ Tính ${ngoTinh} → rủi ro ${Math.round(riskRate * 100)}%` }),
    ],
  });
});

// ─── 4. Phá Bình Cảnh ───────────────────────────────────────────────────────
// Lệnh riêng của Ngộ Đạo Sư, CD 2h khi thất bại
// Điều kiện: Ngộ Tính, Cảm Ngộ ≥80%, Đạo Tâm, Linh Thạch
reg("pha_binh_canh", ["phabinhcanh", "pbc", "pha_bc"], async (n) => {
  const userId = n.author.id;
  const player = await getPlayer(userId, n.author.username);
  if (!player) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });

  const err = kiemTraNghe(player);
  if (err) return n.reply({ embeds: [errE(err)] });

  if (!player.binh_canh)
    return n.reply({ embeds: [warnE("☀️ Ngươi đang không bị Bình Cảnh — tâm cảnh thông suốt, không cần phá!")] });

  if (Number(player.canh_gioi) < 9)
    return n.reply({ embeds: [errE(`Cần đạt **Luyện Khí Tầng 9** (cảnh giới ≥ 9) trở lên mới có thể tự phá Bình Cảnh!\nCảnh giới hiện tại: **${player.canh_gioi}**`)] });

  const ngoTinh    = Number(player.ngo_tinh || 50);
  const camNgo     = Number(player.cam_ngo || 0);
  const tamMa      = Number(player.tam_ma || 0);
  const coThienPhu = player.thien_phu_nghe === NGO_DAO_SU_NGHE;

  const nguongNgoTinh = coThienPhu ? 51 : 71;
  const nguongDaoTam  = coThienPhu ? 60 : 80;
  const phiBinhCanh   = coThienPhu ? 5000 : 7500;
  const fixedRate     = coThienPhu ? 0.25 : 0.20;

  const buff   = getBuff(player);
  const cdLeft = cdRem(buff.pha_binh_canh_cd, 2);
  if (cdLeft)
    return n.reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Tâm ngộ chưa hồi phục sau lần phá bình cảnh trước!\nHết CD ${cdTs(buff.pha_binh_canh_cd, 2)}.`)] });

  const lacks = [];
  if (ngoTinh < nguongNgoTinh) lacks.push(`Ngộ Tính ≥ **${nguongNgoTinh}** *(hiện tại: ${ngoTinh})*`);
  if (camNgo < 80)             lacks.push(`Cảm Ngộ ≥ **80%** *(hiện tại: ${camNgo}%)*`);
  if (tamMa < nguongDaoTam)    lacks.push(`Đạo Tâm ≥ **${nguongDaoTam}** *(hiện tại: ${tamMa})*`);
  if (totalLT(player) < phiBinhCanh)
    lacks.push(`Linh Thạch ≥ **${fmt(phiBinhCanh)}** ${CE("tult","💠")} *(hiện có: ${fmt(totalLT(player))})*`);

  if (lacks.length > 0)
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(15105570)
          .setTitle('🧱 Điều Kiện Phá Bình Cảnh Chưa Đủ')
          .setDescription(
            `*Tâm ngộ chưa đủ sâu để xuyên thấu vách ngăn!*\n\n` +
            `Cần thỏa mãn **đủ cả ${lacks.length < 4 ? lacks.length : 4} điều kiện**:\n` +
            lacks.map(l => `• ${l}`).join('\n') + '\n\n' +
            `${CE("tip_icon","💡")} Dùng \`-dai_ngo\` / \`-thach_ngo\` để tăng Cảm Ngộ, \`-linh_ngo\` tăng Ngộ Tính, \`-dao_tam tinh_hoa\` tu dưỡng Đạo Tâm.`
          ),
      ],
    });

  const _sBC = calcSpend(player, phiBinhCanh);
  if (!_sBC)
    return n.reply({ embeds: [errE(`Không đủ **${fmt(phiBinhCanh)}** ${CE("tult","💠")} để phá bình cảnh!`)] });
  await db(
    "UPDATE players SET linh_thach=$1,linh_thach_trung=$2,linh_thach_cao=$3 WHERE user_id=$4",
    [_sBC.newThuong, _sBC.newTrung, _sBC.newCao, userId],
  );

  if (Math.random() < fixedRate) {
    const newBuff = { ...buff };
    delete newBuff.pha_binh_canh_cd;
    await db(
      "UPDATE players SET binh_canh=FALSE, buff_active=$1 WHERE user_id=$2",
      [JSON.stringify(newBuff), userId],
    );
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🌀 PHÁ BÌNH CẢNH THÀNH CÔNG!')
          .setColor(16766720)
          .setDescription(
            `*Ngộ Tính bùng phát — vách ngăn tâm cảnh tan vỡ như sương buổi sáng!*\n\n` +
            `🧱 **Bình Cảnh đã bị xuyên phá!** Đường đột phá giờ rộng mở.\n` +
            `💸 **-${fmt(phiBinhCanh)}** ${CE("tult","💠")}\n\n` +
            `${CE("tip_icon","💡")} Dùng \`-dot_pha\` để tiếp tục đột phá cảnh giới!`
          )
          .setFooter({ text: `Xác suất: ${Math.round(fixedRate * 100)}%${coThienPhu ? ' (Thiên Phú)' : ''}` }),
      ],
    });
  }

  const camNgoMat   = Math.floor(0.3 * camNgo);
  const camNgoConLai = Math.max(0, camNgo - camNgoMat);
  const newBuff     = { ...buff, pha_binh_canh_cd: Date.now() };
  await db(
    "UPDATE players SET cam_ngo=$1, buff_active=$2 WHERE user_id=$3",
    [camNgoConLai, JSON.stringify(newBuff), userId],
  );
  return n.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('💔 Phá Bình Cảnh Thất Bại!')
        .setColor(15158332)
        .setDescription(
          `*Tâm ngộ chưa đủ sâu — bình cảnh vẫn nguyên vẹn!*\n\n` +
          `${CE('tip_icon','💡')} Cảm Ngộ **-${camNgoMat}%** → còn **${camNgoConLai}%**\n` +
          `${CE("cd_timer","⏳")} Tâm thần tổn hao — cần **2 giờ** trước khi thử lại.\n` +
          `💸 **-${fmt(phiBinhCanh)}** ${CE("tult","💠")}\n\n` +
          `*Dùng \`-dai_ngo\` hoặc \`-thach_ngo\` để tích lũy thêm Cảm Ngộ.*`
        )
        .setFooter({ text: `Xác suất: ${Math.round(fixedRate * 100)}%${coThienPhu ? ' (Thiên Phú)' : ''} | CD: 2h` }),
    ],
  });
});
