'use strict';
/**
 * core/client.js
 * Discord client factory.
 * Centralises intent configuration so index.js stays minimal.
 */
const { Client, GatewayIntentBits } = require('discord.js');

/**
 * Discord rejects the whole Gateway connection when a privileged intent is
 * requested but has not been enabled in the Developer Portal. Keep the
 * optional intent switches explicit so a fresh Railway deployment can still
 * boot instead of crash-looping.
 *
 * Message Content stays enabled by default for backwards compatibility with
 * the bot's prefix commands. Guild Members is optional and stays disabled
 * unless the anti-raid join detector has been enabled deliberately.
 */
function envFlag(name, defaultValue = false) {
  const value = process.env[name];
  if (value == null || value === '') return defaultValue;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

/**
 * Create and return a configured Discord.js Client instance.
 * The client is NOT yet logged in — call client.login() in index.js.
 * @returns {import('discord.js').Client}
 */
function createClient() {
  const enableMessageContent = envFlag(
    'DISCORD_ENABLE_MESSAGE_CONTENT_INTENT',
    true,
  );
  const enableGuildMembers = envFlag(
    'DISCORD_ENABLE_GUILD_MEMBERS_INTENT',
    false,
  );

  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildEmojisAndStickers,
  ];

  if (enableMessageContent) {
    // PRIVILEGED — enable "Message Content Intent" in the Developer Portal.
    intents.push(GatewayIntentBits.MessageContent);
  } else {
    console.warn(
      '⚠️ [discord] Message Content Intent đang tắt — các lệnh prefix (-...) sẽ không hoạt động.',
    );
  }

  if (enableGuildMembers) {
    // PRIVILEGED — enable "Server Members Intent" in the Developer Portal.
    // This is only needed by the anti-raid guildMemberAdd detector.
    intents.push(GatewayIntentBits.GuildMembers);
  } else {
    console.warn(
      'ℹ️ [discord] Server Members Intent đang tắt — anti-raid join-burst detector không hoạt động.',
    );
  }

  return new Client({ intents });
}

module.exports = { createClient };
