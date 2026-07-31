'use strict';
/**
 * commands/gacha.js
 * Tính năng Gacha — dùng Vé Gacha để quay nhận phần thưởng ngẫu nhiên.
 * Vé Gacha chỉ nhận được qua Giftcode.
 *
 * ATOMIC: ticket deduction + reward grant chạy trong 1 transaction,
 * đảm bảo không bao giờ mất vé mà không nhận được thưởng.
 */
const { EmbedBuilder } = require('discord.js');
const { db, dbTx } = require('../db/pool');
const { getPlayer } = require('../db/players');
const { CE } = require('../systems/emoji');
const {
  fmt, reg, errE, SEP,
  calcMaxLinhThach, calcMaxLinhThachTrung,
} = require('../utils');
const { logger } = require('../utils/logger');
const log = logger.child('gacha');

// ── Bảng phần thưởng Gacha ─────────────────────────────────────────────────
// weight càng cao → xuất hiện càng nhiều
const GACHA_POOL = [
  {
    id: 'linh_thach',
    rarity: 'pho_thong',
    rarityLabel: 'Phổ Thông',
    color: 0x95a5a6,
    weight: 30,
  },
  {
    id: 'hop_linh_thach',
    rarity: 'hiem',
    rarityLabel: 'Hiếm',
    color: 0x3498db,
    weight: 20,
  },
  {
    id: 've_doi_nghe',
    rarity: 'hiem',
    rarityLabel: 'Hiếm',
    color: 0x3498db,
    weight: 15,
  },
  {
    id: 've_doi_linh_can',
    rarity: 'su_thi',
    rarityLabel: 'Sử Thi',
    color: 0x9b59b6,
    weight: 10,
  },
  {
    id: 've_doi_huyet',
    rarity: 'su_thi',
    rarityLabel: 'Sử Thi',
    color: 0x9b59b6,
    weight: 10,
  },
  {
    id: 'linh_thach_trung',
    rarity: 'huyen_thoai',
    rarityLabel: 'Huyền Thoại',
    color: 0xe74c3c,
    weight: 8,
  },
  {
    id: 'hoi_xuan_dan',
    rarity: 'huyen_thoai',
    rarityLabel: 'Huyền Thoại',
    color: 0xe74c3c,
    weight: 5,
  },
  {
    id: 'pha_canh_phu',
    rarity: 'than_thanh',
    rarityLabel: 'Thần Thánh',
    color: 0xf1c40f,
    weight: 2,
  },
];

const TOTAL_WEIGHT = GACHA_POOL.reduce((s, i) => s + i.weight, 0);

function rollGacha() {
  let rand = Math.random() * TOTAL_WEIGHT;
  for (const item of GACHA_POOL) {
    rand -= item.weight;
    if (rand <= 0) return item;
  }
  return GACHA_POOL[0];
}

// ── Apply reward atomically inside a transaction ────────────────────────────
// txClient là pg PoolClient đã BEGIN — mọi query đều dùng txClient.query()
async function applyGachaRewardTx(txClient, player, userId, rewardId) {
  const lines = [];

  switch (rewardId) {
    case 'linh_thach': {
      const amount = 2000;
      const actual = calcMaxLinhThach(player, amount);
      if (actual > 0) {
        await txClient.query(
          'UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2',
          [actual, userId],
        );
        lines.push(
          `${CE('tult', '💠')} +**${fmt(actual)}** Linh Thạch` +
          (actual < amount ? ` *(túi đầy, chỉ nhận ${fmt(actual)})*` : ''),
        );
      } else {
        // Vẫn cho phép quay, chỉ thông báo túi đầy — không rollback vì đây không phải lỗi
        lines.push(`${CE('tult', '💠')} ~~+${fmt(amount)} Linh Thạch~~ *(túi quá nặng — không nhận được)*`);
      }
      break;
    }

    case 'hop_linh_thach': {
      await txClient.query(
        `UPDATE players SET vat_pham = jsonb_set(
           COALESCE(vat_pham,'{}'),
           '{hop_linh_thach}',
           to_jsonb(COALESCE((vat_pham->>'hop_linh_thach')::int,0) + 1)
         ) WHERE user_id=$1`,
        [userId],
      );
      lines.push(`📦 **Hộp Linh Thạch ×1** → vào Túi Trữ Vật!\nDùng \`-vat_pham mo hop_linh_thach\` để mở.`);
      break;
    }

    case 've_doi_nghe': {
      await txClient.query(
        'UPDATE players SET ve_doi_nghe=ve_doi_nghe+5 WHERE user_id=$1',
        [userId],
      );
      lines.push(`${CE('ve_nghe', '🎫')} **Vé Đổi Nghề ×5** *(dùng \`-nghe doi <id>\` để đổi nghề miễn phí!)*`);
      break;
    }

    case 've_doi_linh_can': {
      await txClient.query(
        'UPDATE players SET ve_doi_linh_can=COALESCE(ve_doi_linh_can,0)+5 WHERE user_id=$1',
        [userId],
      );
      lines.push(`${CE('ve_linh_can', '🔮')} **Vé Đổi Linh Căn ×5** *(dùng \`-linh_can doi\` để đổi ngẫu nhiên!)*`);
      break;
    }

    case 've_doi_huyet': {
      await txClient.query(
        'UPDATE players SET ve_doi_huyet=ve_doi_huyet+5 WHERE user_id=$1',
        [userId],
      );
      lines.push(`${CE('ve_huyet_mach', '🩸')} **Vé Đổi Huyết Mạch ×5** *(dùng \`-huyet_mach doi\` để random huyết mạch mới!)*`);
      break;
    }

    case 'linh_thach_trung': {
      const actual = calcMaxLinhThachTrung(player, 1);
      if (actual > 0) {
        await txClient.query(
          'UPDATE players SET linh_thach_trung=COALESCE(linh_thach_trung,0)+1 WHERE user_id=$1',
          [userId],
        );
        lines.push(`${CE('tult_trung', '🔮')} **Linh Thạch Trung ×1**`);
      } else {
        lines.push(`${CE('tult_trung', '🔮')} ~~Linh Thạch Trung ×1~~ *(túi quá nặng — không nhận được)*`);
      }
      break;
    }

    case 'hoi_xuan_dan': {
      await txClient.query(
        `UPDATE players SET dan_duoc = jsonb_set(
           COALESCE(dan_duoc,'{}'),
           '{hoi_xuan_dan}',
           to_jsonb(COALESCE((dan_duoc->>'hoi_xuan_dan')::int,0) + 1)
         ) WHERE user_id=$1`,
        [userId],
      );
      lines.push(`💊 **Hồi Xuân Đan ×1** *(dùng \`-dung_dan hoi_xuan\` để hồi phục Đạo Thương!)*`);
      break;
    }

    case 'pha_canh_phu': {
      await txClient.query(
        `UPDATE players SET phu_luc = jsonb_set(
           COALESCE(phu_luc,'{}'),
           '{pha_canh_phu}',
           to_jsonb(COALESCE((phu_luc->>'pha_canh_phu')::int,0) + 1)
         ) WHERE user_id=$1`,
        [userId],
      );
      lines.push(`${CE('ni_pha_canh', '💥')} **Phá Cảnh Phù ×1** *(dùng \`-dung_phu pha_canh_phu\` để phá cảnh tức thì!)*`);
      break;
    }

    default:
      lines.push('*(phần thưởng không hợp lệ)*');
  }

  return lines;
}

// ── Command: -gacha ────────────────────────────────────────────────────────
reg('gacha', ['quay_gacha', 'gacha_quay'], async (msg) => {
  const userId = msg.author.id;

  const player = await getPlayer(userId, msg.author.username);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước khi chơi Gacha!')] });

  // ── Kiểm tra vé gacha ──────────────────────────────────────────────────
  const veGacha = Number((player.vat_pham || {}).ve_gacha || 0);
  if (veGacha <= 0) {
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle(`${CE('ve_gacha', '🎰')} Không Đủ Vé Gacha!`)
          .setDescription(
            `Ngươi không có **Vé Gacha** nào!\n\n` +
            `${CE('lock_icon', '🔒')} Vé Gacha chỉ nhận được từ **Giftcode** đặc biệt.\n` +
            `Theo dõi thông báo của server để nhận code!\n\n` +
            `${CE('tip_icon','💡')} Xem túi vật phẩm: \`-vat_pham\``,
          )
          .setFooter({ text: 'Gacha Tu Tiên · Giftcode độc quyền' }),
      ],
    });
  }

  // ── Roll trước để hiển thị kết quả (không ảnh hưởng DB nếu tx fail) ──
  const reward = rollGacha();

  // ── Atomic: trừ vé + phát thưởng trong 1 transaction ─────────────────
  let rewardLines;
  let remaining;

  try {
    const txResult = await dbTx(async (txClient) => {
      // 1. Trừ 1 vé — nếu không đủ vé sẽ throw để rollback
      const deductRes = await txClient.query(
        `UPDATE players
         SET vat_pham = jsonb_set(
           COALESCE(vat_pham,'{}'),
           '{ve_gacha}',
           to_jsonb(GREATEST(0, COALESCE((vat_pham->>'ve_gacha')::int,0) - 1))
         )
         WHERE user_id=$1 AND COALESCE((vat_pham->>'ve_gacha')::int,0) >= 1
         RETURNING vat_pham`,
        [userId],
      );

      if (!deductRes.rowCount) {
        const err = new Error('NO_TICKET');
        err.noTicket = true;
        throw err;
      }

      const newVatPham = deductRes.rows[0].vat_pham;
      const newVeGacha = Number((newVatPham || {}).ve_gacha || 0);

      // 2. Phát thưởng — nếu lỗi sẽ tự rollback, vé không bị mất
      const lines = await applyGachaRewardTx(txClient, player, userId, reward.id);

      return { lines, remaining: newVeGacha };
    });

    rewardLines = txResult.lines;
    remaining = txResult.remaining;

  } catch (err) {
    if (err.noTicket) {
      return msg.reply({ embeds: [errE('Ngươi không còn Vé Gacha!')] });
    }
    log.error('gacha transaction lỗi userId=%s rewardId=%s err=%s', userId, reward.id, err?.message || err, err?.stack || '');
    return msg.reply({ embeds: [errE('Có lỗi khi xử lý Gacha — vé không bị trừ! Thử lại sau.')] });
  }

  // ── Hiển thị độ hiếm với emoji ảnh thật ──────────────────────────────
  const RARITY_META = {
    pho_thong:   { bar: '░░░░░░░░░░', ceKey: 'rarity_pho_thong',   fallback: '⚪' },
    hiem:        { bar: '████░░░░░░', ceKey: 'rarity_hiem',         fallback: '🔵' },
    su_thi:      { bar: '███████░░░', ceKey: 'rarity_su_thi',       fallback: '🟣' },
    huyen_thoai: { bar: '█████████░', ceKey: 'rarity_huyen_thoai',  fallback: '🔴' },
    than_thanh:  { bar: '██████████', ceKey: 'rarity_than_thanh',   fallback: '⭐' },
  };
  const meta = RARITY_META[reward.rarity] || RARITY_META.pho_thong;
  const rarityEmoji = CE(meta.ceKey, meta.fallback);

  const embed = new EmbedBuilder()
    .setColor(reward.color)
    .setTitle(`${CE('ve_gacha', '🎰')} Quay Gacha Tu Tiên!`)
    .setDescription(
      `${SEP}\n` +
      `✨ **Đạo Hữu ${msg.author.username} đã quay được:**\n\n` +
      `${rewardLines.join('\n')}\n\n` +
      `${SEP}\n` +
      `${rarityEmoji} **Độ Hiếm: ${reward.rarityLabel}**\n` +
      `\`${meta.bar}\`\n\n` +
      `${CE('ve_gacha', '🎰')} Vé Gacha còn lại: **${remaining}**`,
    )
    .setAuthor({ name: msg.author.username, iconURL: msg.author.displayAvatarURL() })
    .setFooter({ text: 'Vé Gacha chỉ từ Giftcode đặc biệt · -vat_pham để xem túi' })
    .setTimestamp();

  return msg.reply({ embeds: [embed] });
});
