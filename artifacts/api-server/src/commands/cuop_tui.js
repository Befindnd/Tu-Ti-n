'use strict';
/**
 * commands/cuop_tui.js
 * Tính năng Cướp Túi Đồ — cướp vật phẩm và Linh Thạch từ túi đồ của người khác.
 *
 * Cơ chế:
 *   - Thành công: ăn 25–40% Linh Thạch + 1–3 linh thảo ngẫu nhiên + 1–2 đan dược
 *   - Thất bại:   mất 8% Linh Thạch + nhận Đạo Thương + ma khí tăng
 *   - Thất bại nghiêm trọng (20%): lộ danh tính cho nạn nhân
 *   - Server announce khi vụ cướp lớn (≥10.000 Linh Thạch)
 *   - CD: 60 phút | Không cướp đồng môn | Cần cảnh giới ≥ 5
 */
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { db }                          = require('../db/pool');
const { getPlayer }                   = require('../db/players');
const { CE }                          = require('../systems/emoji');
const {
  CANH_GIOI, getDaiCanhGioiIndex,
  LINH_THAO, DAN_DUOC, DAN_PHAM,
  getKhiVanBonus, getNgoTinh,
} = require('../data');
const {
  fmt, cdRemMin, cdTsMin, embedClr,
  SEP, errE, warnE, okE,
  tinhCS,
  COMMANDS, reg,
  calcMaxLinhThach, getBagCapacity, calcBagWeight,
} = require('../utils');

// ── Hằng số ──────────────────────────────────────────────────────────────────
const CD_CUOP_TUI_MIN = 360; // 6 giờ

// Địa danh ngẫu nhiên cho flavor text
const DIA_DANH = [
  'con đường Linh Sơn vắng lặng',
  'ngõ tối Hắc Phong thành',
  'rừng Độc Vụ âm u',
  'vách đá Thiên Uyên cheo leo',
  'chợ Linh Thảo lúc nửa đêm',
  'cầu Đoạn Hồn sương mù',
  'bờ suối Quỷ Khốc lạnh lẽo',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Chọn ngẫu nhiên N phần tử từ object {id: qty} (chỉ lấy qty > 0) */
function sampleFromDict(dict, n) {
  const entries = Object.entries(dict).filter(([, q]) => Number(q) > 0);
  const result = [];
  const pool = [...entries];
  while (result.length < n && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

/** Tính xác suất cướp thành công */
function calcCuopRate(attacker, target) {
  const atkCG = attacker.canh_gioi || 0;
  const defCG = target.canh_gioi   || 0;
  const diff  = getDaiCanhGioiIndex(atkCG) - getDaiCanhGioiIndex(defCG);

  // Base rate: 35%, +5% mỗi đại cảnh giới hơn, -8% mỗi đại cảnh giới kém hơn
  let base = 0.35 + diff * 0.05;
  base = Math.min(0.75, Math.max(0.10, base));

  // Ngộ tính bonus (tốc độ phản ứng)
  const s    = getNgoTinh(attacker.ngo_tinh || 50);
  const ngoB = 0.20 * s.linh_ngo_bonus;

  // Khí vận bonus
  const kvB = getKhiVanBonus(attacker.khi_van || 30).bi_canh_bonus;

  return Math.min(0.80, Math.max(0.05, base + ngoB * 0.5 + kvB * 0.3));
}

// ── Command: -cuop_tui ────────────────────────────────────────────────────────
reg('cuop_tui', ['cuop', 'giattui', 'rob'], async (msg, args) => {
  const userId = msg.author.id;

  // Lấy mention
  const mention = msg.mentions.users.first();
  if (!mention) {
    return msg.reply({
      embeds: [warnE(
        `${CE('ft_am_sat','🗡️')} **Cướp Túi Đồ**\n\nDùng: \`-cuop_tui @người_chơi\`\n` +
        `*Ám sát rồi tẩu thoát với chiến lợi phẩm từ túi đồ của nạn nhân!*\n\n` +
        `**Luật:**\n` +
        `› Thành công: ăn 25–40% Linh Thạch + vật phẩm ngẫu nhiên\n` +
        `› Thất bại: mất 8% Linh Thạch + Đạo Thương\n` +
        `› Thất bại nặng: lộ danh tính cho nạn nhân!\n` +
        `› CD: **6 giờ** · Cần cảnh giới ≥ **Luyện Khí Tầng 5**`,
      )],
    });
  }

  if (mention.id === userId) return msg.reply({ embeds: [errE('Tự cướp bản thân? Đây không phải pháp môn đó…')] });
  if (mention.bot)           return msg.reply({ embeds: [errE('Không thể cướp bot!')] });

  const [attacker, target] = await Promise.all([
    getPlayer(userId, msg.author.username),
    getPlayer(mention.id),
  ]);

  if (!attacker) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });
  if (!target)   return msg.reply({ embeds: [errE('Nạn nhân chưa bắt đầu tu tiên!')] });

  // ── Kiểm tra điều kiện ────────────────────────────────────────────────────
  if ((attacker.canh_gioi || 0) < 5)
    return msg.reply({ embeds: [warnE('Cần đạt **Luyện Khí Tầng 5** trở lên mới dùng được kỹ năng này!')] });

  if ((attacker.dao_thuong || 0) >= 3)
    return msg.reply({ embeds: [warnE('Đang thân mang trọng thương — chữa lành trước đã!')] });

  // Không cướp đồng môn
  if (attacker.tong_mon && attacker.tong_mon === target.tong_mon)
    return msg.reply({ embeds: [warnE('Không thể ra tay với huynh đệ đồng môn!')] });

  // Không cướp người yếu quá (Phàm Nhân) — không có gì đáng ăn
  if ((target.canh_gioi || 0) < 1)
    return msg.reply({ embeds: [warnE('Nạn nhân còn là Phàm Nhân, túi đồ trống rỗng không đáng ra tay!')] });

  // Không cướp người mạnh hơn ≥3 đại cảnh giới
  const cgDiff = getDaiCanhGioiIndex(target.canh_gioi || 0) - getDaiCanhGioiIndex(attacker.canh_gioi || 0);
  if (cgDiff >= 3)
    return msg.reply({ embeds: [warnE('Đối thủ quá mạnh — khác biệt hơn 3 đại cảnh giới, liều mạng vô ích!')] });

  // Kiểm tra CD
  const cdLeft = cdRemMin(attacker.cuop_tui_cd || 0, CD_CUOP_TUI_MIN);
  if (cdLeft > 0) {
    return msg.reply({
      embeds: [warnE(
        `${CE('ft_am_sat','🗡️')} Đang ẩn náu chờ thời cơ!\nHết CD ${cdTsMin(attacker.cuop_tui_cd || 0, CD_CUOP_TUI_MIN)}.`,
      )],
    });
  }

  // Cập nhật CD ngay
  await db('UPDATE players SET cuop_tui_cd=$1 WHERE user_id=$2', [Date.now(), userId]);

  // ── Tính toán ──────────────────────────────────────────────────────────────
  const successRate = calcCuopRate(attacker, target);
  const isSuccess   = Math.random() < successRate;
  const diaName     = DIA_DANH[Math.floor(Math.random() * DIA_DANH.length)];
  const targetName  = target.username || mention.username;

  // ────────────────────────────────────────────────────────────────────────────
  // THÀNH CÔNG
  // ────────────────────────────────────────────────────────────────────────────
  if (isSuccess) {
    const stealPct   = 0.25 + Math.random() * 0.15; // 25-40%
    const rawLT      = Math.floor(Number(target.linh_thach || 0) * stealPct);
    const stolenLT   = Math.max(0, calcMaxLinhThach(attacker, rawLT));

    // Chọn vật phẩm ngẫu nhiên từ túi nạn nhân
    const numHerbs    = Math.min(3, Math.floor(Math.random() * 3) + 1); // 1-3
    const numPills    = Math.min(2, Math.floor(Math.random() * 2) + 1); // 1-2
    const stolenHerbs = sampleFromDict(target.linh_thao  || {}, numHerbs);
    const stolenPills = sampleFromDict(target.dan_duoc   || {}, numPills);

    // Giới hạn số lượng bị ăn (1 loại = lấy tối đa 3 cái)
    const herbsToTake = stolenHerbs.map(([id, qty]) => [id, Math.min(Number(qty), 3)]);
    const pillsToTake = stolenPills.map(([id, qty]) => [id, Math.min(Number(qty), 2)]);

    // DB: trừ nạn nhân, cộng kẻ cướp (trong transaction)
    await db('BEGIN');
    try {
      // Linh Thạch
      if (stolenLT > 0) {
        await db('UPDATE players SET linh_thach = GREATEST(0, linh_thach - $1) WHERE user_id=$2', [stolenLT, mention.id]);
        await db('UPDATE players SET linh_thach = linh_thach + $1 WHERE user_id=$2', [stolenLT, userId]);
      }
      // Linh Thảo
      for (const [id, qty] of herbsToTake) {
        await db(`UPDATE players SET linh_thao = jsonb_set(linh_thao, '{${id}}', (GREATEST(0, (linh_thao->>'${id}')::int - $1))::text::jsonb) WHERE user_id=$2`, [qty, mention.id]);
        const cur = Number((attacker.linh_thao || {})[id] || 0);
        await db(`UPDATE players SET linh_thao = jsonb_set(linh_thao, '{${id}}', ($1)::text::jsonb) WHERE user_id=$2`, [cur + qty, userId]);
      }
      // Đan Dược
      for (const [id, qty] of pillsToTake) {
        await db(`UPDATE players SET dan_duoc = jsonb_set(dan_duoc, '{${id}}', (GREATEST(0, (dan_duoc->>'${id}')::int - $1))::text::jsonb) WHERE user_id=$2`, [qty, mention.id]);
        const cur = Number((attacker.dan_duoc || {})[id] || 0);
        await db(`UPDATE players SET dan_duoc = jsonb_set(dan_duoc, '{${id}}', ($1)::text::jsonb) WHERE user_id=$2`, [cur + qty, userId]);
      }
      // Nhân quả -3
      await db('UPDATE players SET nhan_qua = GREATEST(-100, nhan_qua - 3), ma_khi = ma_khi + 2 WHERE user_id=$1', [userId]);
      await db('COMMIT');
    } catch (e) {
      await db('ROLLBACK');
      return msg.reply({ embeds: [errE('Lỗi khi xử lý giao dịch! Thử lại sau.')] });
    }

    // Tạo danh sách vật phẩm đã cướp
    const lootLines = [];
    if (stolenLT > 0) lootLines.push(`${CE('tult','💠')} **${fmt(stolenLT)}** Linh Thạch *(${Math.round(stealPct * 100)}%)*`);
    for (const [id, qty] of herbsToTake) {
      const herb = LINH_THAO.find(h => h.id === id);
      if (herb) lootLines.push(`${herb.emoji} **${herb.ten}** ×${qty}`);
    }
    for (const [id, qty] of pillsToTake) {
      let baseName = id;
      let phamKey  = 'trung';
      for (const g of ['cuc','thuong','trung','ha']) {
        if (id.endsWith('_' + g)) { baseName = id.slice(0, -(g.length + 1)); phamKey = g; break; }
      }
      const pill = DAN_DUOC.find(d => d.id === baseName);
      const pham = DAN_PHAM[phamKey] || DAN_PHAM.trung;
      if (pill) lootLines.push(`${pill.emoji} ${pham.emoji} **${pill.ten}** [${pham.ten}] ×${qty}`);
    }
    if (lootLines.length === 0) lootLines.push('*Túi đồ rỗng — chỉ lấy được gió…*');

    const embed = new EmbedBuilder()
      .setTitle(`${CE('ft_am_sat','🗡️')} Cướp Túi Đồ — Thành Công!`)
      .setColor(0x2ecc71)
      .setDescription(
        `*Tại ${diaName}, **${msg.author.username}** bất ngờ ra tay — tẩu thoát với túi đồ của **${targetName}** trước khi nạn nhân kịp phản ứng!*\n${SEP}`,
      )
      .addFields(
        {
          name: '💰 Chiến Lợi Phẩm',
          value: lootLines.join('\n') || '*Không có gì*',
          inline: false,
        },
        {
          name: '📊 Thống Kê',
          value: `Tỉ lệ thành công: **${Math.round(successRate * 100)}%** · Nghiệp Lực −3 · Ma Khí +2`,
          inline: false,
        },
      )
      .setFooter({ text: `CD: 6h · Cướp càng nhiều — Nghiệp Lực càng nặng` });

    await msg.reply({ embeds: [embed] });

    // Thông báo cho nạn nhân (ẩn danh)
    try {
      const victimUser = await msg.client.users.fetch(mention.id);
      const lootSummary = lootLines.join(', ');
      await victimUser.send(
        `${CE('warn_icon','⚠️')} **Cảnh Báo!** Túi đồ của ngươi vừa bị cướp tại *${diaName}*!\n` +
        `**Mất:** ${lootSummary}\n` +
        `*Kẻ trộm đã tẩu thoát — danh tính không rõ.*`,
      ).catch(() => {});
    } catch {}

    // Server announce nếu số linh thạch bị cướp lớn
    if (stolenLT >= 10000) {
      try {
        const announceEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🚨 Đại Án Cướp Đường — Tin Nóng!')
          .setDescription(
            `Một tên cướp vô danh vừa đoạt ${CE('tult','💠')} **${fmt(stolenLT)} Linh Thạch** từ tay **${targetName}** tại *${diaName}*!\n` +
            `*Kẻ gian lộng hành — chư vị tu sĩ hãy đề cao cảnh giác!*`,
          );
        await msg.channel.send({ embeds: [announceEmbed] }).catch(() => {});
      } catch {}
    }

    return;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // THẤT BẠI
  // ────────────────────────────────────────────────────────────────────────────
  const isExposed    = Math.random() < 0.20; // 20% bị lộ danh tính
  const loseLT       = Math.floor(Number(attacker.linh_thach || 0) * 0.08);
  const oldDT        = attacker.dao_thuong || 0;
  const newDT        = Math.min(3, oldDT + 1);
  const dtTimestamp  = newDT > 0 ? Date.now() : 0;

  await db(
    'UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1), dao_thuong=$2, dao_thuong_at=CASE WHEN $2>0 THEN $3::BIGINT ELSE 0::BIGINT END, nhan_qua=GREATEST(-100,nhan_qua-5), ma_khi=ma_khi+5 WHERE user_id=$4',
    [loseLT, newDT, dtTimestamp, userId],
  );

  const failEmbed = new EmbedBuilder()
    .setTitle(`${CE('ft_am_sat','🗡️')} Cướp Túi Đồ — Thất Bại!`)
    .setColor(0xe74c3c)
    .setDescription(
      `*Tại ${diaName}, **${targetName}** bất ngờ quay lại — phát hiện ngươi và phản công dữ dội!*\n${SEP}`,
    )
    .addFields(
      {
        name: '💸 Thiệt Hại',
        value: `Đánh rơi ${CE('tult','💠')} **${fmt(loseLT)}** Linh Thạch khi tháo chạy *(8%)*\n` +
               `${newDT > oldDT ? `🩸 Nhận **Đạo Thương ${newDT}** — cần chữa trị!` : '🛡️ May mắn né được đòn phản công!'}` +
               `\n${CE('tam_ma','😈')} Nghiệp Lực −5 · Ma Khí +5`,
        inline: false,
      },
      {
        name: '📊 Tỉ Lệ',
        value: `Xác suất thành công đã là: **${Math.round(successRate * 100)}%** — vận may không theo!`,
        inline: false,
      },
    )
    .setFooter({ text: `CD: 60ph | Bị lộ danh tính: ${isExposed ? 'CÓ' : 'KHÔNG'}` });

  await msg.reply({ embeds: [failEmbed] });

  // Thông báo cho nạn nhân
  try {
    const victimUser = await msg.client.users.fetch(mention.id);
    if (isExposed) {
      // Lộ danh tính — DRAMA START
      await victimUser.send(
        `${CE('warn_icon','⚠️')} **Tên Trộm Bị Bắt Quả Tang!**\n` +
        `**${msg.author.username}** (`+"`"+`${msg.author.id}`+"`"+`) vừa bị bắt quả tang khi cố cướp túi đồ của ngươi tại *${diaName}*!\n` +
        `*Hắn đã bỏ chạy — nhưng ngươi đã ghi rõ mặt kẻ đó rồi đấy!*\n` +
        `${CE('tip_icon','💡')} Dùng \`-am_sat @${msg.author.username}\` để trả thù!`,
      ).catch(() => {});
    } else {
      await victimUser.send(
        `${CE('warn_icon','⚠️')} **Cảnh Báo!** Có kẻ vô danh vừa cố cướp túi đồ của ngươi tại *${diaName}* nhưng **thất bại**!\n` +
        `*Ngươi đã đẩy lui được — nhưng hắn có thể quay lại…*`,
      ).catch(() => {});
    }
  } catch {}
});
