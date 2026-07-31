'use strict';
// @ts-check
/**
 * db/players.js
 * Player repository — named functions for common player DB operations.
 *
 * Prefer these over raw SQL in command handlers.
 * Re-exports { pool, db, dbTx } so callers only need one import for both.
 */
const { pool, db, dbTx }              = require('./pool');
const { canAddToBag, calcMaxLinhThach } = require('../utils/bag');
const { fmt }                         = require('../utils/format');
const { BI_PHAP, LINH_THAO }         = require('../data');
const { CE }                          = require('../systems/emoji');
const { logger }                      = require("../utils/logger");
const log = logger.child("players");

// ── Auto-heal constants ───────────────────────────────────────────────────
const AUTO_HEAL_H  = 24;
const AUTO_HEAL_MS = AUTO_HEAL_H * 3_600_000;

/**
 * Auto-reduce Dao Thuong (injury) level based on time elapsed since injury.
 * Called transparently inside getPlayer.
 *
 * @param {object} player  Player row (must have dao_thuong, dao_thuong_at)
 * @param {string} userId
 * @returns {Promise<object>} Possibly-updated player object
 */
async function checkAutoHealDT(player, userId) {
  if (!player || (player.dao_thuong || 0) === 0) return player;

  const injuredAt = Number(player.dao_thuong_at || 0);

  // First injury — record timestamp
  if (injuredAt === 0) {
    await db('UPDATE players SET dao_thuong_at=$1 WHERE user_id=$2', [Date.now(), userId])
      .catch(e => log.error('autoHeal dao_thuong_at update failed:', e.message));
    return { ...player, dao_thuong_at: Date.now() };
  }

  const healedLevels = Math.floor((Date.now() - injuredAt) / AUTO_HEAL_MS);
  if (healedLevels <= 0) return player;

  const newDT   = Math.max(0, (player.dao_thuong || 0) - healedLevels);
  const newDTAt = newDT > 0 ? injuredAt + healedLevels * AUTO_HEAL_MS : 0;

  await db(
    'UPDATE players SET dao_thuong=$1, dao_thuong_at=$2 WHERE user_id=$3',
    [newDT, newDTAt, userId],
  ).catch(e => log.error('autoHeal dao_thuong update failed:', e.message));

  return { ...player, dao_thuong: newDT, dao_thuong_at: newDTAt };
}

/**
 * Fetch a player row by Discord user ID.
 * Optionally syncs username and runs auto-heal in the background.
 *
 * @param {string}  userId
 * @param {string}  [username]  If provided, syncs the stored display name.
 * @returns {Promise<object|null>}
 */
async function getPlayer(userId, username) {
  if (username) {
    await db(
      'UPDATE players SET username=$1, last_active=NOW() WHERE user_id=$2 AND username<>$1',
      [username, userId],
    ).catch(e => log.error('getPlayer username sync failed:', e.message));
  }

  let player = null;
  try {
    player = (await db('SELECT * FROM players WHERE user_id=$1', [userId])).rows[0] || null;
  } catch (e) {
    log.error('getPlayer SELECT failed:', e.message);
    return null;
  }

  if (player && (player.dao_thuong || 0) > 0) {
    player = await checkAutoHealDT(player, userId);
  }

  return player;
}

/**
 * Award a random Bi Phap (secret technique) to a player.
 * Returns a localised result string.
 *
 * @param {object} player  Full player row
 * @param {string} userId
 * @returns {Promise<string>} Result message (not an embed)
 */
async function awardBiPhap(player, userId) {
  if (!canAddToBag(player, 'bi_phap', 1)) {
    return `${CE('warn_icon','⚠️')} **Túi trữ vật quá nặng!** Không thể nhận bí pháp — dùng \`-tui\` để kiểm tra.`;
  }

  // Only award bi_phap the player doesn't already know, meets the level requirement,
  // and is NOT donate-only (donate_only items can only be obtained via -donate/-giftcode)
  // and is NOT gia_toc_only (clan-exclusive techniques must be learned via -gia_toc hoc)
  const eligible = BI_PHAP.filter(
    (bp) =>
      !(player.bi_phap || []).includes(bp.id) &&
      (bp.yeu_cau_cap || 0) <= (player.canh_gioi || 0) &&
      !bp.donate_only &&
      !bp.gia_toc_only,
  );

  if (eligible.length > 0) {
    const chosen = eligible[Math.floor(Math.random() * eligible.length)];
    await db('UPDATE players SET bi_phap=array_append(bi_phap,$1) WHERE user_id=$2', [chosen.id, userId]);
    return `✨ Học được bí pháp **${chosen.ten}**!`;
  }

  // No eligible bi_phap — check if the player is simply under-levelled
  // (also exclude donate_only and gia_toc_only from future-check)
  const futureEligible = BI_PHAP.filter(
    (bp) => !(player.bi_phap || []).includes(bp.id) && !bp.donate_only && !bp.gia_toc_only,
  );
  if (futureEligible.length > 0) {
    return '💭 *Cơ duyên mơ hồ... chưa đủ cảnh giới để lĩnh ngộ bí pháp lần này.*';
  }

  // Player knows everything — compensate with Linh Thach
  const ltBu = calcMaxLinhThach(player, 3_000);
  if (ltBu > 0) {
    await db('UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2', [ltBu, userId]);
  }

  return ltBu > 0
    ? `${CE('tult', '💠')} Đã thông thạo tất cả bí pháp! Nhận **${fmt(ltBu)} Linh Thạch** bồi thường.`
    : `${CE('tult', '💠')} Đã thông thạo tất cả bí pháp, nhưng **túi quá nặng** — không nhận được Linh Thạch bù!`;
}

/**
 * Award random Linh Thao (spiritual herb) to a player.
 * Returns null if the bag is too heavy or no herb can be awarded.
 *
 * @param {object} player  Full player row
 * @param {string} userId
 * @param {number} amount  Quantity to award
 * @returns {Promise<{ ten: string, emoji: string, gia_tri: number }|null>}
 */
async function awardLinhThao(player, userId, amount) {
  if (!canAddToBag(player, 'linh_thao', amount)) return null;

  // Weight herbs toward the player's level — higher-tier herbs more likely
  // Exclude special and limited herbs (limited are donate/event-only)
  const eligible = LINH_THAO.filter(
    (h) => (player.canh_gioi || 0) >= (h.yeu_cau_cap || 0) && !h.special && !h.limited,
  );
  const pool2    = eligible.length > 0 ? eligible : [LINH_THAO[0]];
  const weights  = pool2.map((h) => Math.pow(Math.max(1, (player.canh_gioi || 0) - h.yeu_cau_cap + 1), 2));
  const total    = weights.reduce((s, w) => s + w, 0);

  let roll   = Math.random() * total;
  let chosen = pool2[pool2.length - 1];
  for (let i = 0; i < pool2.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { chosen = pool2[i]; break; }
  }

  if (!chosen) return null;

  const inventory = typeof player.linh_thao === 'object' && player.linh_thao !== null
    ? { ...player.linh_thao }
    : {};
  inventory[chosen.id] = (inventory[chosen.id] || 0) + amount;

  await db('UPDATE players SET linh_thao=$1 WHERE user_id=$2', [JSON.stringify(inventory), userId]);

  return { ten: chosen.ten, emoji: chosen.emoji, gia_tri: amount };
}

module.exports = { pool, db, dbTx, getPlayer, checkAutoHealDT, awardBiPhap, awardLinhThao };
