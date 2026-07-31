'use strict';
/**
 * core/interaction_guard.js
 * Rate-limit cho Discord interactions (button / select menu / modal).
 *
 * Vấn đề: messageCreate đã có rate limit 3s, nhưng tương tác nút bấm chạy
 * qua interactionCreate và KHÔNG bị giới hạn gì. Kẻ tấn công hoặc macro
 * có thể spam click nút PvP/đấu giá/shop để flood DB mà không bị phát hiện.
 *
 * Giải pháp: dùng client.prependListener để chạy guard TRƯỚC tất cả handler,
 * reply ephemeral nếu quá ngưỡng — handler sau thử reply/update sẽ nhận
 * "AlreadyReplied" error (bị bắt bởi .catch(() => {}) của chúng) → không xử lý.
 *
 * Ngưỡng mặc định: 8 interactions / 5 giây → bị khóa 3 phút.
 */
const { MessageFlags } = require('discord.js');
const antiraid = require('./antiraid');

const ADMIN_ID = process.env.ADMIN_ID || '';

function envNum(key, def) {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

const MAX_PER_WINDOW = envNum('ANTIRAID_INTERACTION_MAX', 8);
const WINDOW_MS      = envNum('ANTIRAID_INTERACTION_WINDOW_MS', 5_000);
const LOCKOUT_MS     = envNum('ANTIRAID_INTERACTION_LOCKOUT_MS', 3 * 60_000);

/** @type {Map<string, number[]>} userId → interaction timestamps trong window */
const _times = new Map();

/**
 * Ghi nhận interaction. Trả về true nếu user đã vượt ngưỡng (spam).
 * @param {string} userId
 * @returns {boolean}
 */
function _recordAndCheck(userId) {
  const now = Date.now();
  let times = _times.get(userId);
  if (!times) { times = []; _times.set(userId, times); }
  times.push(now);
  const cutoff = now - WINDOW_MS;
  while (times.length && times[0] < cutoff) times.shift();
  return times.length >= MAX_PER_WINDOW;
}

// Prune định kỳ để tránh rò bộ nhớ
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [id, times] of _times) {
    while (times.length && times[0] < cutoff) times.shift();
    if (!times.length) _times.delete(id);
  }
}, 60_000).unref();

/**
 * Đăng ký interaction guard lên Discord client.
 *
 * QUAN TRỌNG: gọi sau tất cả setupX(client) để prependListener chèn guard
 * vào đầu danh sách listener → guard luôn chạy trước mọi handler.
 *
 * @param {import('discord.js').Client} client
 */
function setupInteractionGuard(client) {
  client.prependListener('interactionCreate', async (interaction) => {
    // Chỉ quan tâm các loại interaction có thể bị spam
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

    const userId = interaction.user?.id;
    if (!userId || userId === ADMIN_ID) return;

    if (!_recordAndCheck(userId)) return; // chưa vượt ngưỡng

    // ── Spam phát hiện ──────────────────────────────────────────────────────
    // Khóa lệnh bot luôn (forceLockUser không cần violations threshold)
    antiraid.forceLockUser(userId, LOCKOUT_MS);

    const lockMin = Math.round(LOCKOUT_MS / 60_000);
    const replyContent = `🔒 Bạn tương tác quá nhanh! Bị khóa **${lockMin} phút** — vui lòng bình tĩnh.`;

    try {
      if (interaction.replied || interaction.deferred) {
        // Đã được acknowledge trước đó (race condition edge case)
        await interaction.followUp({ content: replyContent, flags: MessageFlags.Ephemeral }).catch(() => {});
      } else if (interaction.isMessageComponent()) {
        // deferUpdate: acknowledge silently (không edit original message, không hiện loading)
        // Sau đó followUp để gửi cảnh báo ephemeral.
        // Các handler sau khi gọi update()/editReply() sẽ nhận error → bị catch → không xử lý.
        await interaction.deferUpdate().catch(() => {});
        await interaction.followUp({ content: replyContent, flags: MessageFlags.Ephemeral }).catch(() => {});
      } else {
        // Modal submit
        await interaction.reply({ content: replyContent, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    } catch (_) {}
  });
}

module.exports = { setupInteractionGuard };
