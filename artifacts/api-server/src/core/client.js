'use strict';
/**
 * core/client.js
 * Discord client factory.
 * Centralises intent configuration so index.js stays minimal.
 */
const { Client, GatewayIntentBits } = require('discord.js');

/**
 * Create and return a configured Discord.js Client instance.
 * The client is NOT yet logged in — call client.login() in index.js.
 * @returns {import('discord.js').Client}
 */
function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildEmojisAndStickers,
      // Required for guildMemberAdd — powers the anti-raid mass-join detector.
      // ⚠️ PRIVILEGED INTENT — phải bật thủ công trong Discord Developer Portal:
      //    Bot → Privileged Gateway Intents → Server Members Intent
      // Nếu KHÔNG bật: bot vẫn login được BÌNH THƯỜNG nhưng guildMemberAdd
      // sẽ KHÔNG BAO GIỜ được nhận → toàn bộ join-burst detector bị tắt hoàn toàn
      // mà không có bất kỳ lỗi hay cảnh báo nào!
      GatewayIntentBits.GuildMembers,
    ],
  });
}

module.exports = { createClient };
