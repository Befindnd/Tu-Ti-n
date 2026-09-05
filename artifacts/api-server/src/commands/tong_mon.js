'use strict';

const { EmbedBuilder } = require('discord.js');
const { db, dbTx } = require('../db/pool');
const { getPlayer } = require('../db/players');
const { CE } = require('../systems/emoji');
const {
  fmt, fmtLT, calcSpend, SEP, SEP2, errE, warnE, okE, reg,
} = require('../utils');
const {
  canManage,
  canManageMembers,
  getMembership,
  getPendingRequest,
  getSectByName,
  normalizeSectName,
  normalizeUserId,
  recordTreasuryLog,
  roleLabel,
} = require('../services/sectManager');

const MIN_CANH_GIOI_TAO = 10;
const PHI_TAO_TONG_MON = 5_000;
const MAX_SECT_NAME = 32;
const MAX_SLOGAN = 120;

function targetId(value) {
  const id = normalizeUserId(value);
  return /^\d{5,25}$/.test(id) ? id : null;
}

function memberLimit(level) {
  return 20 + Math.max(0, Number(level || 1) - 1) * 5;
}

function roleEmoji(role) {
  return {
    leader: CE('tmcb_tong_chu', '👑'),
    deputy: CE('tmcb_thanh_tu', '🛡️'),
    elder: CE('tmcb_chan_truyen', '⚜️'),
    member: CE('tmcb_ngoai_mon', '🪶'),
  }[role] || CE('tmcb_ngoai_mon', '🪶');
}

function sectSummary(s) {
  return [
    `${CE('ft_tong_mon', '🏯')} **${s.name}** · Cấp **${s.level}**`,
    `${CE('tmcb_tong_chu', '👑')} Tông Chủ: **${s.leader_name}**`,
    `📜 ${s.slogan || 'Chưa lập khẩu hiệu.'}`,
    `${CE('tult', '💠')} Ngân khố: **${fmt(s.spirit_treasury)}**`,
    `${CE('tutv', '📈')} Cống hiến: **${fmt(s.total_contribution || 0)}** · Thành viên tối đa: **${s.max_members}**`,
    `${CE('tuatk', '⚔️')} PK: **${fmt(s.pk_points)}** · Thắng **${s.wars_won}** / Thua **${s.wars_lost}**`,
  ].join('\n');
}

async function showHelp(msg) {
  const embed = new EmbedBuilder()
    .setTitle(`${CE('ft_tong_mon', '🏯')} HỆ THỐNG TÔNG MÔN — PHIÊN BẢN MỚI`)
    .setColor(0x9b59b6)
    .setDescription(
      `*Một tông môn thật sự có người, chức vụ, ngân khố và lịch sử riêng.*\n\n${SEP}\n` +
      `🔹 \`-tongmon tao <tên> [khẩu hiệu]\` — Khai sơn lập phái\n` +
      `🔹 \`-tongmon thongtin [tên]\` — Xem hồ sơ tông môn\n` +
      `🔹 \`-tongmon gia_nhap <tên>\` — Gửi đơn xin nhập môn\n` +
      `🔹 \`-tongmon thanhvien\` — Xem môn nhân\n` +
      `🔹 \`-tongmon duyet [user_id]\` — Duyệt đơn gia nhập\n` +
      `🔹 \`-tongmon tuchoi [user_id]\` — Từ chối đơn\n` +
      `🔹 \`-tongmon chucvu [user_id] <pho|truonglao|de_tu>\` — Đổi chức vụ\n` +
      `🔹 \`-tongmon truyenvi [user_id]\` — Truyền vị Tông Chủ\n` +
      `🔹 \`-tongmon donggop <số lượng>\` — Cống hiến vào ngân khố\n` +
      `🔹 \`-tongmon nangcap\` — Nâng cấp tông môn bằng ngân khố\n` +
      `🔹 \`-tongmon nhatky\` — Xem lịch sử ngân khố\n` +
      `🔹 \`-tongmon roi\` — Rời tông môn\n` +
      `${CE('tuatk', '⚔️')} \`-tongmon tuyenchien <tên>\` — Tuyên chiến\n` +
      `${CE('tuatk', '⚔️')} \`-tongmon tapkich\` — Tấn công hộ sơn trận pháp\n` +
      `${CE('ft_bxh', '🏆')} \`-tongmon bxh\` — Bảng xếp hạng thế lực\n${SEP}`,
    )
    .setFooter({ text: 'Tu Tiên Bot · Tông Môn v3' });
  return msg.reply({ embeds: [embed] });
}

async function showInfo(msg, name, membership) {
  const sect = name ? await getSectByName(name) : membership;
  if (!sect) {
    return msg.reply({ embeds: [warnE('Không tìm thấy Tông Môn. Dùng `-tongmon bxh` để xem danh sách.')] });
  }

  const count = await db(
    "SELECT COUNT(*)::int AS count FROM sect_members WHERE sect_id=$1 AND status='active'",
    [sect.sect_id || sect.id],
  );
  const pending = await db(
    "SELECT COUNT(*)::int AS count FROM sect_join_requests WHERE sect_id=$1 AND status='pending'",
    [sect.sect_id || sect.id],
  );

  const embed = new EmbedBuilder()
    .setTitle(`${CE('ft_tong_mon', '🏯')} ${sect.name}`)
    .setColor(0x9b59b6)
    .setDescription(
      `${sectSummary(sect)}\n` +
       `${CE('ft_social', '👥')} Thành viên: **${count.rows[0].count}/${sect.max_members}**\n` +
       `${CE('ft_social', '📨')} Đơn đang chờ: **${pending.rows[0].count}**\n` +
       `${CE('tudef', '🛡️')} Hộ Sơn Trận Pháp: **Cấp ${sect.formation_level}** — ` +
      `${fmt(sect.formation_durability)}/${fmt(sect.max_formation_durability)} HP`,
    )
    .setFooter({ text: 'Muốn xem môn nhân: -tongmon thanhvien' });
  return msg.reply({ embeds: [embed] });
}

async function showRanking(msg) {
  const result = await db(
    `SELECT s.*, COUNT(sm.id)::int AS member_count
     FROM sects s
     LEFT JOIN sect_members sm ON sm.sect_id=s.id AND sm.status='active'
     GROUP BY s.id
     ORDER BY s.level DESC, s.level_xp DESC, s.pk_points DESC
     LIMIT 10`,
  );
  if (!result.rows.length) {
    return msg.reply({ embeds: [warnE('Hiện chưa có Tông Môn nào trong thiên hạ!')] });
  }

  const lines = result.rows.map((s, index) => {
    const medal = [CE('rarity_than_thanh', '🥇'), CE('rarity_hiem', '🥈'), CE('rarity_su_thi', '🥉')][index]
      || `**#${index + 1}**`;
    return `${medal} **${s.name}** · Cấp ${s.level} · ${s.member_count}/${s.max_members} người\n` +
      `   ${CE('tult', '💠')} ${fmt(s.spirit_treasury)} · XP ${fmt(s.level_xp)} · ${CE('tuatk', '⚔️')} ${fmt(s.pk_points)}`;
  });

  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`${CE('ft_bxh', '🏆')} BẢNG XẾP HẠNG TÔNG MÔN`)
        .setColor(0xf1c40f)
        .setDescription(`${SEP2}\n${lines.join('\n\n')}\n${SEP}`),
    ],
  });
}

async function createSect(msg, player, args) {
  const name = normalizeSectName(args[1]);
  const slogan = args.slice(2).join(' ').trim() || 'Nhất đạo thông thiên, vạn cổ trường tồn!';

  if (!name || name.length < 2 || name.length > MAX_SECT_NAME) {
    return msg.reply({ embeds: [errE(`Tên Tông Môn phải dài 2-${MAX_SECT_NAME} ký tự.`)] });
  }
  if (slogan.length > MAX_SLOGAN) {
    return msg.reply({ embeds: [errE(`Khẩu hiệu tối đa ${MAX_SLOGAN} ký tự.`)] });
  }
  if (Number(player.canh_gioi || 0) < MIN_CANH_GIOI_TAO) {
    return msg.reply({ embeds: [errE(`Khai tông cần cảnh giới **${MIN_CANH_GIOI_TAO}** trở lên.`)] });
  }
  if (await getMembership(msg.author.id)) {
    return msg.reply({ embeds: [warnE('Đạo hữu đã thuộc một Tông Môn.')] });
  }

  const spent = calcSpend(player, PHI_TAO_TONG);
  if (!spent) {
    return msg.reply({ embeds: [errE(`Không đủ ${fmtLT(PHI_TAO_TONG)} để khai tông.`)] });
  }

  try {
    const sect = await dbTx(async (tx) => {
      const lockedPlayer = await tx.query(
        'SELECT * FROM players WHERE user_id=$1 FOR UPDATE',
        [msg.author.id],
      );
      const locked = lockedPlayer.rows[0];
      if (!locked) throw new Error('PLAYER_NOT_FOUND');
      const lockedSpent = calcSpend(locked, PHI_TAO_TONG_MON);
      if (!lockedSpent) throw new Error('NOT_ENOUGH');

      const existing = await tx.query(
        'SELECT id FROM sect_members WHERE user_id=$1 AND status=$2 LIMIT 1',
        [msg.author.id, 'active'],
      );
      if (existing.rows.length) throw new Error('ALREADY_MEMBER');

      const duplicate = await tx.query(
        'SELECT id FROM sects WHERE LOWER(name)=LOWER($1) LIMIT 1',
        [name],
      );
      if (duplicate.rows.length) throw new Error('NAME_TAKEN');

      const created = await tx.query(
        `INSERT INTO sects
          (name, leader_id, leader_name, slogan, max_members, join_policy)
         VALUES ($1, $2, $3, $4, $5, 'approval')
         RETURNING *`,
        [name, msg.author.id, msg.author.username, slogan, memberLimit(1)],
      );
      const row = created.rows[0];

      await tx.query(
        `INSERT INTO sect_members
          (sect_id, user_id, username, role)
         VALUES ($1, $2, $3, 'leader')`,
        [row.id, msg.author.id, msg.author.username],
      );
      await tx.query(
        `UPDATE players
         SET linh_thach=$1, linh_thach_trung=$2, linh_thach_cao=$3,
             tong_mon=$4, tong_mon_cap='tong_chu'
         WHERE user_id=$5`,
        [lockedSpent.newThuong, lockedSpent.newTrung, lockedSpent.newCao, name, msg.author.id],
      );
      return row;
    });

    return msg.reply({
      embeds: [
        okE(`🚩 **Khai Tông Lập Phái thành công!**\n\n${sectSummary(sect)}\n\n` +
          `Dùng \`-tongmon help\` để xem quyền hạn và các bước tiếp theo.`),
      ],
    });
  } catch (error) {
    if (error.message === 'NAME_TAKEN') {
      return msg.reply({ embeds: [warnE(`Tông Môn **${name}** đã tồn tại.`)] });
    }
    if (error.message === 'ALREADY_MEMBER') {
      return msg.reply({ embeds: [warnE('Đạo hữu đã thuộc một Tông Môn.')] });
    }
    if (error.message === 'NOT_ENOUGH') {
      return msg.reply({ embeds: [errE(`Không đủ ${fmtLT(PHI_TAO_TONG_MON)} để khai tông.`)] });
    }
    console.error('[sect] create error:', error);
    return msg.reply({ embeds: [errE('Khai tông thất bại, hãy thử lại sau.')] });
  }
}

async function requestJoin(msg, player, args) {
  const name = normalizeSectName(args.slice(1).join(' '));
  if (!name) return msg.reply({ embeds: [errE('Cú pháp: `-tongmon gia_nhap <Tên Tông Môn>`')] });
  if (await getMembership(msg.author.id)) {
    return msg.reply({ embeds: [warnE('Đạo hữu đã ở trong một Tông Môn.')] });
  }
  const pending = await getPendingRequest(msg.author.id);
  if (pending) {
    return msg.reply({ embeds: [warnE(`Đơn xin vào **${pending.sect_name}** của đạo hữu đang chờ duyệt.`)] });
  }

  const sect = await getSectByName(name);
  if (!sect) return msg.reply({ embeds: [errE(`Không tìm thấy Tông Môn **${name}**.`)] });

  try {
    await db(
      `INSERT INTO sect_join_requests (sect_id, user_id, username, message)
       VALUES ($1, $2, $3, $4)`,
      [sect.id, msg.author.id, msg.author.username, args.slice(1).join(' ').slice(0, 240)],
    );
    return msg.reply({
      embeds: [okE(`📨 Đã gửi đơn xin gia nhập **${sect.name}**.\n` +
        'Tông Chủ hoặc Trưởng Lão sẽ xem xét đơn của đạo hữu.')],
    });
  } catch (error) {
    if (error.code === '23505') {
      return msg.reply({ embeds: [warnE('Đạo hữu đã có một đơn đang chờ duyệt.')] });
    }
    console.error('[sect] join request error:', error);
    return msg.reply({ embeds: [errE('Không thể gửi đơn gia nhập lúc này.')] });
  }
}

async function showMembers(msg, membership) {
  if (!membership) return msg.reply({ embeds: [warnE('Đạo hữu chưa gia nhập Tông Môn nào.')] });
  const result = await db(
    `SELECT user_id, username, role, contribution, joined_at
     FROM sect_members
     WHERE sect_id=$1 AND status='active'
     ORDER BY CASE role
       WHEN 'leader' THEN 0 WHEN 'deputy' THEN 1 WHEN 'elder' THEN 2 ELSE 3
     END, contribution DESC`,
    [membership.sect_id],
  );
  const lines = result.rows.map((m, i) =>
    `**${i + 1}.** ${roleEmoji(m.role)} **${m.username}** — ${roleLabel(m.role)}\n` +
    `   ID: \`${m.user_id}\` · Cống hiến: ${fmt(m.contribution)}`,
  );
  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`👥 MÔN NHÂN — ${membership.name}`)
        .setColor(0x3498db)
        .setDescription(lines.join('\n') || 'Tông Môn chưa có môn nhân.'),
    ],
  });
}

async function showRequests(msg, membership) {
  if (!membership || !canManageMembers(membership.role)) {
    return msg.reply({ embeds: [errE('Chỉ Trưởng Lão, Phó Tông Chủ hoặc Tông Chủ mới được xem đơn.')] });
  }
  const result = await db(
    `SELECT id, user_id, username, message, created_at
     FROM sect_join_requests
     WHERE sect_id=$1 AND status='pending'
     ORDER BY created_at ASC
     LIMIT 20`,
    [membership.sect_id],
  );
  if (!result.rows.length) return msg.reply({ embeds: [warnE('Hiện không có đơn xin gia nhập nào.')] });
  const lines = result.rows.map((r, i) =>
    `**${i + 1}. ${r.username}** — ID \`${r.user_id}\`\n` +
    `   ${r.message || 'Không có lời nhắn.'}`,
  );
  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`📨 ĐƠN GIA NHẬP — ${membership.name}`)
        .setColor(0xf1c40f)
        .setDescription(`${lines.join('\n\n')}\n\nDuyệt: \`-tongmon duyet <user_id>\``),
    ],
  });
}

async function reviewRequest(msg, membership, args, approve) {
  if (!membership || !canManageMembers(membership.role)) {
    return msg.reply({ embeds: [errE('Đạo hữu không có quyền duyệt thành viên.')] });
  }
  const userId = targetId(args[1]);
  if (!userId) return msg.reply({ embeds: [errE('Cần user ID Discord. Ví dụ: `-tongmon duyet 123456789`')] });
  if (userId === msg.author.id) return msg.reply({ embeds: [errE('Không thể duyệt chính mình.')] });

  try {
    const result = await dbTx(async (tx) => {
      const request = await tx.query(
        `SELECT * FROM sect_join_requests
         WHERE sect_id=$1 AND user_id=$2 AND status='pending'
         FOR UPDATE`,
        [membership.sect_id, userId],
      );
      if (!request.rows.length) throw new Error('REQUEST_NOT_FOUND');
      const row = request.rows[0];

      if (!approve) {
        await tx.query(
          `UPDATE sect_join_requests
           SET status='rejected', reviewed_by=$1, reviewed_at=NOW()
           WHERE id=$2`,
          [msg.author.id, row.id],
        );
        return { username: row.username, approved: false };
      }

      const sect = await tx.query('SELECT * FROM sects WHERE id=$1 FOR UPDATE', [membership.sect_id]);
      const memberCount = await tx.query(
        "SELECT COUNT(*)::int AS count FROM sect_members WHERE sect_id=$1 AND status='active'",
        [membership.sect_id],
      );
      if (Number(memberCount.rows[0].count) >= Number(sect.rows[0].max_members)) {
        throw new Error('SECT_FULL');
      }

      const already = await tx.query(
        "SELECT sect_id FROM sect_members WHERE user_id=$1 AND status='active' FOR UPDATE",
        [userId],
      );
      if (already.rows.length) throw new Error('ALREADY_MEMBER');

      await tx.query(
        `INSERT INTO sect_members (sect_id, user_id, username, role)
         VALUES ($1, $2, $3, 'member')
         ON CONFLICT (sect_id, user_id) DO UPDATE SET
           username=EXCLUDED.username, role='member', status='active', updated_at=NOW()`,
        [membership.sect_id, userId, row.username],
      );
      await tx.query(
        `UPDATE players
         SET tong_mon=$1, tong_mon_cap='ngoai_mon'
         WHERE user_id=$2`,
        [membership.name, userId],
      );
      await tx.query(
        `UPDATE sect_join_requests
         SET status='approved', reviewed_by=$1, reviewed_at=NOW()
         WHERE id=$2`,
        [msg.author.id, row.id],
      );
      return { username: row.username, approved: true };
    });

    return msg.reply({
      embeds: [okE(result.approved
        ? `✅ Đã thu nhận **${result.username}** vào **${membership.name}**.`
        : `🚫 Đã từ chối đơn của **${result.username}**.`)],
    });
  } catch (error) {
    if (error.message === 'REQUEST_NOT_FOUND') {
      return msg.reply({ embeds: [warnE('Không tìm thấy đơn đang chờ của user này.')] });
    }
    if (error.message === 'SECT_FULL') {
      return msg.reply({ embeds: [errE('Tông Môn đã đủ nhân số. Hãy nâng cấp trước.')] });
    }
    if (error.message === 'ALREADY_MEMBER') {
      return msg.reply({ embeds: [warnE('User này đã ở trong một Tông Môn khác.')] });
    }
    console.error('[sect] review request error:', error);
    return msg.reply({ embeds: [errE('Xử lý đơn gia nhập thất bại.')] });
  }
}

async function contribute(msg, membership, args) {
  if (!membership) return msg.reply({ embeds: [warnE('Đạo hữu chưa gia nhập Tông Môn nào.')] });
  const amount = Number(args[1]);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000) {
    return msg.reply({ embeds: [errE('Số cống hiến phải là số nguyên từ 1 đến 1 tỷ.')] });
  }

  try {
    const result = await dbTx(async (tx) => {
      const playerResult = await tx.query(
        'SELECT * FROM players WHERE user_id=$1 FOR UPDATE',
        [msg.author.id],
      );
      const player = playerResult.rows[0];
      const spent = calcSpend(player, amount);
      if (!spent) throw new Error('NOT_ENOUGH');

      await tx.query(
        `UPDATE players
         SET linh_thach=$1, linh_thach_trung=$2, linh_thach_cao=$3
         WHERE user_id=$4`,
        [spent.newThuong, spent.newTrung, spent.newCao, msg.author.id],
      );
      const sectResult = await tx.query(
        `UPDATE sects
         SET spirit_treasury=spirit_treasury+$1,
             total_contribution=total_contribution+$1,
             level_xp=level_xp+$1,
             updated_at=NOW()
         WHERE id=$2
         RETURNING spirit_treasury`,
        [amount, membership.sect_id],
      );
      await tx.query(
        `UPDATE sect_members
         SET contribution=contribution+$1, updated_at=NOW()
         WHERE sect_id=$2 AND user_id=$3 AND status='active'`,
        [amount, membership.sect_id, msg.author.id],
      );
      await recordTreasuryLog(tx, {
        sectId: membership.sect_id,
        userId: msg.author.id,
        type: 'contribution',
        amount,
        balanceAfter: sectResult.rows[0].spirit_treasury,
        reason: `Cống hiến bởi ${msg.author.username}`,
      });
      return sectResult.rows[0].spirit_treasury;
    });
    return msg.reply({
      embeds: [okE(`💠 Đã cống hiến **${fmt(amount)}** vào ngân khố **${membership.name}**.\n` +
        `Số dư mới: **${fmt(result)}** ${CE('tult', '💠')}`)],
    });
  } catch (error) {
    if (error.message === 'NOT_ENOUGH') {
      return msg.reply({ embeds: [errE('Linh Thạch không đủ để thực hiện cống hiến.')] });
    }
    console.error('[sect] contribution error:', error);
    return msg.reply({ embeds: [errE('Cống hiến thất bại, giao dịch đã được hoàn tác.')] });
  }
}

async function upgrade(msg, membership) {
  if (!membership || !canManage(membership.role)) {
    return msg.reply({ embeds: [errE('Chỉ Phó Tông Chủ hoặc Tông Chủ mới được nâng cấp Tông Môn.')] });
  }
  const cost = Number(membership.level) * 10_000;
  try {
    const result = await dbTx(async (tx) => {
      const sect = await tx.query('SELECT * FROM sects WHERE id=$1 FOR UPDATE', [membership.sect_id]);
      const current = sect.rows[0];
      if (Number(current.spirit_treasury) < cost) throw new Error('NOT_ENOUGH');

      const upgraded = await tx.query(
        `UPDATE sects
         SET level=level+1,
             max_members=$1,
             spirit_treasury=spirit_treasury-$2,
             updated_at=NOW()
         WHERE id=$3
         RETURNING level, max_members, spirit_treasury`,
        [memberLimit(Number(current.level) + 1), cost, membership.sect_id],
      );
      await recordTreasuryLog(tx, {
        sectId: membership.sect_id,
        userId: msg.author.id,
        type: 'upgrade',
        amount: -cost,
        balanceAfter: upgraded.rows[0].spirit_treasury,
        reason: `Nâng cấp Tông Môn lên cấp ${upgraded.rows[0].level}`,
      });
      return upgraded.rows[0];
    });
    return msg.reply({
      embeds: [okE(`🏯 **${membership.name}** đã lên **Cấp ${result.level}**!\n` +
        `👥 Sức chứa: **${result.max_members}** · Chi phí: **${fmt(cost)}** ${CE('tult', '💠')}`)],
    });
  } catch (error) {
    if (error.message === 'NOT_ENOUGH') {
      return msg.reply({ embeds: [errE(`Ngân khố cần ít nhất **${fmt(cost)}** ${CE('tult', '💠')}.`)] });
    }
    console.error('[sect] upgrade error:', error);
    return msg.reply({ embeds: [errE('Nâng cấp thất bại, ngân khố không bị trừ.')] });
  }
}

async function changeRole(msg, membership, args) {
  if (!membership || membership.role !== 'leader') {
    return msg.reply({ embeds: [errE('Chỉ Tông Chủ mới được bổ nhiệm chức vụ.')] });
  }
  const userId = targetId(args[1]);
  const requested = String(args[2] || '').toLowerCase();
  const role = {
    pho: 'deputy',
    pho_tong_chu: 'deputy',
    truonglao: 'elder',
    truong_lao: 'elder',
    de_tu: 'member',
    member: 'member',
  }[requested];
  if (!userId || !role) {
    return msg.reply({ embeds: [errE('Cú pháp: `-tongmon chucvu <user_id> <pho|truonglao|de_tu>`')] });
  }
  const result = await db(
    `UPDATE sect_members
     SET role=$1, updated_at=NOW()
     WHERE sect_id=$2 AND user_id=$3 AND status='active'
     RETURNING username`,
    [role, membership.sect_id, userId],
  );
  if (!result.rows.length) return msg.reply({ embeds: [warnE('Không tìm thấy môn nhân này.')] });
  await db(
    `UPDATE players SET tong_mon_cap=$1 WHERE user_id=$2`,
    [role === 'deputy' ? 'pho_tong_chu' : role === 'leader' ? 'tong_chu' : 'ngoai_mon', userId],
  );
  return msg.reply({ embeds: [okE(`⚜️ Đã bổ nhiệm **${result.rows[0].username}** làm **${roleLabel(role)}**.`)] });
}

async function transferLeadership(msg, membership, args) {
  if (!membership || membership.role !== 'leader') {
    return msg.reply({ embeds: [errE('Chỉ Tông Chủ mới có thể truyền vị.')] });
  }
  const userId = targetId(args[1]);
  if (!userId) return msg.reply({ embeds: [errE('Cú pháp: `-tongmon truyenvi <user_id>`')] });
  if (userId === msg.author.id) return msg.reply({ embeds: [warnE('Đạo hữu đã là Tông Chủ rồi.')] });

  const result = await dbTx(async (tx) => {
    const target = await tx.query(
      `SELECT username FROM sect_members
       WHERE sect_id=$1 AND user_id=$2 AND status='active' FOR UPDATE`,
      [membership.sect_id, userId],
    );
    if (!target.rows.length) throw new Error('NOT_MEMBER');
    await tx.query(
      `UPDATE sect_members SET role='deputy', updated_at=NOW()
       WHERE sect_id=$1 AND user_id=$2`,
      [membership.sect_id, msg.author.id],
    );
    await tx.query(
      `UPDATE sect_members SET role='leader', updated_at=NOW()
       WHERE sect_id=$1 AND user_id=$2`,
      [membership.sect_id, userId],
    );
    await tx.query(
      `UPDATE sects SET leader_id=$1, leader_name=$2, updated_at=NOW() WHERE id=$3`,
      [userId, target.rows[0].username, membership.sect_id],
    );
    await tx.query(
      `UPDATE players SET tong_mon_cap='pho_tong_chu' WHERE user_id=$1`,
      [msg.author.id],
    );
    await tx.query(
      `UPDATE players SET tong_mon_cap='tong_chu' WHERE user_id=$1`,
      [userId],
    );
    return target.rows[0].username;
  });
  return msg.reply({ embeds: [okE(`👑 Đã truyền vị Tông Chủ cho **${result}**.`)] });
}

async function leaveSect(msg, membership) {
  if (!membership) return msg.reply({ embeds: [warnE('Đạo hữu chưa gia nhập Tông Môn nào.')] });
  if (membership.role === 'leader') {
    return msg.reply({ embeds: [errE('Tông Chủ phải dùng `-tongmon truyenvi <user_id>` trước khi rời môn.')] });
  }
  await dbTx(async (tx) => {
    await tx.query(
      `UPDATE sect_members SET status='left', updated_at=NOW()
       WHERE sect_id=$1 AND user_id=$2`,
      [membership.sect_id, msg.author.id],
    );
    await tx.query(
      `UPDATE players SET tong_mon=NULL, tong_mon_cap='ngoai_mon' WHERE user_id=$1`,
      [msg.author.id],
    );
  });
  return msg.reply({ embeds: [okE(`Đạo hữu đã rời khỏi **${membership.name}**.`)] });
}

async function treasuryLog(msg, membership) {
  if (!membership) return msg.reply({ embeds: [warnE('Đạo hữu chưa gia nhập Tông Môn nào.')] });
  const result = await db(
    `SELECT type, amount, balance_after, reason, created_at
     FROM sect_treasury_logs
     WHERE sect_id=$1 ORDER BY id DESC LIMIT 10`,
    [membership.sect_id],
  );
  if (!result.rows.length) return msg.reply({ embeds: [warnE('Ngân khố chưa có giao dịch nào.')] });
  const lines = result.rows.map((row) => {
    const sign = Number(row.amount) >= 0 ? '+' : '';
    return `• **${sign}${fmt(row.amount)}** ${CE('tult', '💠')} — ${row.reason}\n` +
      `  Số dư: ${fmt(row.balance_after)}`;
  });
  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`📒 NHẬT KÝ NGÂN KHỐ — ${membership.name}`)
        .setColor(0x2ecc71)
        .setDescription(lines.join('\n')),
    ],
  });
}

async function declareWar(msg, membership, args) {
  if (!membership || !canManage(membership.role)) {
    return msg.reply({ embeds: [errE('Chỉ Phó Tông Chủ hoặc Tông Chủ mới được tuyên chiến.')] });
  }
  const name = normalizeSectName(args.slice(1).join(' '));
  const enemy = await getSectByName(name);
  if (!enemy) return msg.reply({ embeds: [errE('Không tìm thấy Tông Môn địch.')] });
  if (enemy.id === membership.sect_id) return msg.reply({ embeds: [errE('Không thể tuyên chiến với chính mình.')] });

  const active = await db(
    `SELECT id FROM sect_wars
     WHERE status='active' AND
       (attacker_sect_id=$1 OR defender_sect_id=$1 OR attacker_sect_id=$2 OR defender_sect_id=$2)
     LIMIT 1`,
    [membership.sect_id, enemy.id],
  );
  if (active.rows.length) return msg.reply({ embeds: [warnE('Một trong hai Tông Môn đang có chiến tranh active.')] });

  await db(
    `INSERT INTO sect_wars (attacker_sect_id, defender_sect_id, status)
     VALUES ($1, $2, 'active')`,
    [membership.sect_id, enemy.id],
  );
  return msg.reply({ embeds: [okE(`⚔️ **${membership.name}** đã phát hịch tuyên chiến với **${enemy.name}**!\n` +
    'Môn nhân có thể dùng `-tongmon tapkich` để công phá hộ sơn trận pháp.')] });
}

async function attack(msg, membership) {
  if (!membership) return msg.reply({ embeds: [warnE('Đạo hữu chưa gia nhập Tông Môn nào.')] });
  const war = await db(
    `SELECT w.*, s.name AS defender_name
     FROM sect_wars w JOIN sects s ON s.id=w.defender_sect_id
     WHERE w.attacker_sect_id=$1 AND w.status='active'
     ORDER BY w.id DESC LIMIT 1`,
    [membership.sect_id],
  );
  if (!war.rows.length) return msg.reply({ embeds: [warnE('Tông Môn chưa có cuộc chiến active.')] });

  const damage = Math.max(500, Number(membership.level || 1) * 250 + Math.floor(Math.random() * 500));
  try {
    const outcome = await dbTx(async (tx) => {
      const defender = await tx.query('SELECT * FROM sects WHERE id=$1 FOR UPDATE', [war.rows[0].defender_sect_id]);
      const current = BigInt(String(defender.rows[0].formation_durability));
      const next = current > BigInt(damage) ? current - BigInt(damage) : 0n;
      if (next > 0n) {
        await tx.query('UPDATE sects SET formation_durability=$1 WHERE id=$2', [next.toString(), defender.rows[0].id]);
        return { won: false, remaining: next.toString(), defender: defender.rows[0].name };
      }

      const plunder = BigInt(String(defender.rows[0].spirit_treasury || 0)) / 5n;
      await tx.query(
        `UPDATE sects
         SET spirit_treasury=spirit_treasury-$1, formation_durability=max_formation_durability,
             pk_points=GREATEST(0, pk_points-100), wars_lost=wars_lost+1, updated_at=NOW()
         WHERE id=$2`,
        [plunder.toString(), defender.rows[0].id],
      );
      await tx.query(
        `UPDATE sects
         SET spirit_treasury=spirit_treasury+$1, pk_points=pk_points+250,
             wars_won=wars_won+1, updated_at=NOW()
         WHERE id=$2`,
        [plunder.toString(), membership.sect_id],
      );
      await tx.query(
        `UPDATE sect_wars
         SET status='attacker_won', plundered_stones=$1, pk_points_exchanged=250, ended_at=NOW()
         WHERE id=$2`,
        [plunder.toString(), war.rows[0].id],
      );
      return { won: true, plunder: plunder.toString(), defender: defender.rows[0].name };
    });

    if (!outcome.won) {
      return msg.reply({ embeds: [okE(`⚔️ Đạo hữu gây **${fmt(damage)}** sát thương lên trận pháp **${outcome.defender}**.\n` +
        `🛡️ Độ bền còn **${fmt(outcome.remaining)}**.`)] });
    }
    return msg.reply({ embeds: [okE(`💥 Hộ Sơn Trận Pháp của **${outcome.defender}** đã sụp đổ!\n` +
      `**${membership.name}** chiến thắng và đoạt **${fmt(outcome.plunder)}** ${CE('tult', '💠')}.`)] });
  } catch (error) {
    console.error('[sect] attack error:', error);
    return msg.reply({ embeds: [errE('Tập kích thất bại, giao dịch đã được hoàn tác.')] });
  }
}

reg('tong_mon', ['tm', 'mon_phai', 'tongmon'], async (msg, args) => {
  const subCmd = (args[0] || 'help').toLowerCase();
  if (subCmd === 'help' || subCmd === 'huong_dan') return showHelp(msg);
  if (subCmd === 'bxh' || subCmd === 'top') return showRanking(msg);

  const player = await getPlayer(msg.author.id, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` để khai mở nhân vật trước.')] });
  const membership = await getMembership(msg.author.id);

  if (subCmd === 'tao' || subCmd === 'create' || subCmd === 'lap') {
    return createSect(msg, player, args);
  }
  if (subCmd === 'thongtin' || subCmd === 'info' || subCmd === 'xem') {
    return showInfo(msg, args.slice(1).join(' ').trim(), membership);
  }
  if (subCmd === 'gia_nhap' || subCmd === 'gianhap' || subCmd === 'join') {
    return requestJoin(msg, player, args);
  }
  if (subCmd === 'thanhvien' || subCmd === 'members' || subCmd === 'tv') {
    return showMembers(msg, membership);
  }
  if (subCmd === 'don' || subCmd === 'don_cho' || subCmd === 'requests') {
    return showRequests(msg, membership);
  }
  if (subCmd === 'duyet' || subCmd === 'approve') {
    return reviewRequest(msg, membership, args, true);
  }
  if (subCmd === 'tuchoi' || subCmd === 'reject') {
    return reviewRequest(msg, membership, args, false);
  }
  if (subCmd === 'chucvu' || subCmd === 'role') {
    return changeRole(msg, membership, args);
  }
  if (subCmd === 'truyenvi' || subCmd === 'transfer') {
    return transferLeadership(msg, membership, args);
  }
  if (subCmd === 'donggop' || subCmd === 'dong_gop' || subCmd === 'donate') {
    return contribute(msg, membership, args);
  }
  if (subCmd === 'nangcap' || subCmd === 'nang_cap' || subCmd === 'upgrade') {
    return upgrade(msg, membership);
  }
  if (subCmd === 'nhatky' || subCmd === 'treasury' || subCmd === 'log') {
    return treasuryLog(msg, membership);
  }
  if (subCmd === 'tuyenchien' || subCmd === 'tuyen_chien' || subCmd === 'war') {
    return declareWar(msg, membership, args);
  }
  if (subCmd === 'tapkich' || subCmd === 'tap_kich' || subCmd === 'attack') {
    return attack(msg, membership);
  }
  if (subCmd === 'roi' || subCmd === 'leave') {
    return leaveSect(msg, membership);
  }

  return msg.reply({ embeds: [errE('Lệnh không hợp lệ. Gõ `-tongmon help` để xem hướng dẫn.')] });
});