'use strict';
/**
 * core/middleware.js
 * Discord messageCreate event handler — the central command router.
 *
 * Responsibilities:
 *  1. Ignore bots; record ALL user messages to server stats.
 *  2. Mention spam detection — chạy trước khi lọc theo prefix, bắt mọi tin nhắn.
 *  3. Ignore non-prefixed messages (sau khi đã check spam).
 *  4. De-duplicate events (Discord occasionally fires messageCreate twice).
 *  5. Rate-limit users (3 s between commands; admin exempt).
 *  6. Reject banned accounts.
 *  7. Block commands for players with Level-3 Dao Thuong (severe injury).
 *  8. Per-user command lock — prevent race conditions from concurrent triggers.
 *  9. Dispatch to the registered command handler.
 */
const { EmbedBuilder } = require('discord.js');
const { COMMANDS, checkRateLimit } = require('./registry');
const { warnE, errE }              = require('../utils/embeds');
const { CE }                       = require('../systems/emoji');
const { db }                       = require('../db/pool');
const maintenance                  = require('./maintenance');
const channels                     = require('./channels');
const channelPenalty               = require('./channel_penalty');
const pvpChannels                  = require('./pvp_channels');
const ttlChannels                  = require('./ttl_channels');
const sanChannels                  = require('./san_channels');
const dvChannels                   = require('./dv_channels');
const { recordMessage }            = require('./server_stats');
const antiraid                     = require('./antiraid');
const antiraidLog                  = require('./antiraid_log');

const ADMIN_ID = process.env.ADMIN_ID || '';

/**
 * Commands that may be used without a player record OR while severely injured.
 * @type {Set<string>}
 */
const NO_PLAYER_REQUIRED = new Set([
  'chua_thuong', 'ct', 'chua',
  'xem_dao_thuong', 'xdt', 'daothuong', 'dt_xem',
  'bat_dau', 'bd', 'batdau',
  'thong_tin', 'tt', 'hoso',
  'thong_ke', 'adminstats', 'tk',
  'bao_tri', 'maintenance', 'mt',
]);

// De-duplicate message IDs; capped at 1 000 entries.
const _seenMsgIds = new Set();

/**
 * Per-user command lock — prevents race conditions from double-tapping.
 * @type {Set<string>}
 */
const _processingUsers = new Set();

/**
 * Attach the messageCreate listener to a Discord client.
 * @param {import('discord.js').Client} client
 */
function setupMessageHandler(client) {
  // Periodic heartbeat — useful for uptime monitoring.
  setInterval(() => {
    console.log(`💓 ${new Date().toLocaleString('vi-VN')} | Servers: ${client.guilds.cache.size}`);
  }, 600_000);

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    // ── Ghi nhận MỌI tin nhắn (kể cả không phải lệnh) vào thống kê ──────
    recordMessage(msg.author.id, msg.id);

    // ── Mention spam detection (non-command messages too) ─────────────────
    // Chạy trước filter prefix để bắt mọi tin nhắn, không chỉ lệnh.
    // @everyone / @here tính trọng số 10 vì ảnh hưởng cả server.
    if (msg.guildId && msg.author.id !== ADMIN_ID) {
      const mentionWeight = msg.mentions.users.size
        + (msg.mentions.everyone ? 10 : 0)
        + msg.mentions.roles.size;
      if (mentionWeight > 0) {
        const { spam } = antiraid.checkMentionSpam(msg.author.id, mentionWeight);
        if (spam) {
          // Fire-and-forget: xử lý không block event loop
          (async () => {
            // 1) Khóa lệnh bot tạm thời
            antiraid.forceLockUser(msg.author.id, antiraid.getConfig().mentionSpamLockoutMs);
            // 2) Xoá tin nhắn spam (best-effort)
            msg.delete().catch(() => {});
            // 3) Discord timeout nếu bot có quyền
            let timedOut = false;
            try {
              const member = await msg.guild.members.fetch(msg.author.id).catch(() => null);
              if (member && member.moderatable) {
                await member.timeout(antiraid.getConfig().mentionSpamLockoutMs, 'Anti-spam: mention flood');
                timedOut = true;
              }
            } catch (_) {}
            // 4) Gửi cảnh báo tới kênh log của server
            const cfg = antiraid.getConfig();
            const alertEmbed = new EmbedBuilder()
              .setTitle(`${CE('warn_icon','⚠️')} Cảnh Báo — Mention Spam`)
              .setColor(0xFF8800)
              .addFields(
                { name: '👤 User',       value: `<@${msg.author.id}> (\`${msg.author.username}\`)`, inline: false },
                { name: '📣 Spam',       value: `${mentionWeight} mention weight trong ${cfg.mentionSpamWindowMs / 1000}s`, inline: false },
                { name: '🔒 Hành động', value:
                  `Khóa lệnh bot **${cfg.mentionSpamLockoutMs / 60_000} phút**` +
                  (timedOut ? ` + Discord timeout cùng thời gian` : ' (bot thiếu quyền Timeout để timeout Discord)'), inline: false },
              )
              .setTimestamp()
              .setFooter({ text: 'Anti-Spam • Tu Tiên Bot' });
            // Gửi tới kênh log đã cài; nếu chưa cài → fallback gửi ngay tại kênh vi phạm
            if (antiraidLog.getLogChannel(msg.guildId)) {
              antiraidLog.alertGuild(client, msg.guildId, alertEmbed);
            } else {
              msg.channel.send({ embeds: [alertEmbed] }).catch(() => {});
            }
          })().catch(() => {});
        }
      }
    }

    if (!msg.content.startsWith('-')) return;
    if (_seenMsgIds.has(msg.id)) return;

    _seenMsgIds.add(msg.id);
    if (_seenMsgIds.size > 1_000) {
      const iter = _seenMsgIds.values();
      for (let i = 0; i < 500; i++) _seenMsgIds.delete(iter.next().value);
    }

    const rawText = msg.content.slice(1).trim();
    if (!rawText) return;
    const args = rawText.split(/\s+/);
    const cmd  = (args.shift() || '').toLowerCase();
    if (!cmd) return;
    const handler = COMMANDS.get(cmd);
    if (!handler) return;

    const userId = msg.author.id;

    // Fire-and-forget username sync.
    db(
      'UPDATE players SET username=$1, last_active=NOW() WHERE user_id=$2 AND username<>$1',
      [msg.author.username, userId],
    ).catch(() => {});

    // ── Hình phạt sai kênh — đang bị khóa từ lần vi phạm trước ──────────────
    // Chặn TẤT CẢ lệnh (không chỉ lệnh sai kênh) trong lúc đang chịu phạt.
    if (userId !== ADMIN_ID) {
      const penaltyRemaining = channelPenalty.getLockRemaining(userId);
      if (penaltyRemaining > 0) {
        msg.delete().catch(() => {});
        const timeLabel = channelPenalty.formatDuration(penaltyRemaining);
        const offenseCount = channelPenalty.getOffenseCount(userId);
        msg.author.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${CE('lock_icon', '🔒')} Đang Bị Khóa Vì Sai Kênh`)
              .setColor(0x992D22)
              .setDescription(
                `*Ngươi đã dùng lệnh sai kênh (lần thứ ${offenseCount}) — bot tạm khóa để nhắc nhở!*\n\n` +
                `⏳ Còn **${timeLabel}** nữa mới dùng được bot.\n\n` +
                `*Vi phạm thêm sẽ khiến thời gian khóa tăng thêm nữa.*`
              )
              .setFooter({ text: 'Tu Tiên Bot • Dùng đúng kênh để tránh bị khóa' }),
          ],
        }).catch(() => {
          msg.channel.send({
            content: `<@${userId}>`,
            embeds: [
              new EmbedBuilder()
                .setTitle(`${CE('lock_icon', '🔒')} Đang Bị Khóa Vì Sai Kênh`)
                .setColor(0x992D22)
                .setDescription(`Còn **${timeLabel}** nữa mới dùng được bot.`)
                .setFooter({ text: 'Tự xóa sau 5 giây' }),
            ],
          }).then(r => setTimeout(() => r.delete().catch(() => {}), 5_000)).catch(() => {});
        });
        return;
      }
    }

    // ── Channel whitelist ─────────────────────────────────────────────────
    // Exempt: bot owner, server admins chạy lệnh quản lý kênh (-kenh), và DM (msg.guildId null)
    const CHANNEL_MGMT_CMDS = new Set(['kenh', 'channel', 'kenh_setup']);
    const isServerAdmin = !!(msg.member?.permissions?.has?.('ManageGuild') ||
                              msg.member?.permissions?.has?.('Administrator'));
    const bypassWhitelist = userId === ADMIN_ID || (CHANNEL_MGMT_CMDS.has(cmd) && isServerAdmin);
    if (!bypassWhitelist && !channels.isAllowed(msg.guildId, msg.channel.id)) {
      // Xóa tin nhắn lệnh ngay lập tức — không để lại dấu vết ở kênh sai
      msg.delete().catch(() => {});

      // Áp hình phạt leo thang — khóa toàn bộ bot một khoảng thời gian.
      const penalty = userId !== ADMIN_ID ? channelPenalty.recordOffense(userId) : null;
      const penaltyLine = penalty
        ? `\n\n${CE('lock_icon', '🔒')} **Hình phạt:** Bot bị khóa **${penalty.label}**` +
          (penalty.count > 1 ? ` (vi phạm lần thứ ${penalty.count})` : '') + `.`
        : '';

      // Lấy danh sách kênh được phép để hướng dẫn người dùng
      const allowedIds  = channels.list(msg.guildId);
      const channelMentions = allowedIds.length > 0
        ? allowedIds.map(id => `<#${id}>`).join(' · ')
        : null;

      // Gửi DM riêng cho người dùng — chat chung hoàn toàn sạch
      msg.author.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🚫 Sai Kênh — Tu Tiên Bot')
            .setColor(0x95A5A6)
            .setDescription(
              `*Lệnh Tu Tiên không hoạt động tại **#${msg.channel.name}** (server **${msg.guild?.name || 'không rõ'}**).*\n\n` +
              (channelMentions
                ? `📢 **Kênh chơi bot được chỉ định:**\n${channelMentions}\n\nVào kênh đó để tiếp tục nhé!`
                : `📢 Vui lòng hỏi Admin server về kênh chơi bot được chỉ định.\n*(Admin dùng \`-kenh them #kênh\` để thiết lập)*`) +
              penaltyLine
            )
            .setFooter({ text: 'Tu Tiên Bot • Tin nhắn riêng tự động' }),
        ],
      }).catch(() => {
        // Nếu người dùng tắt DM — gửi ephemeral vào kênh sai rồi xóa sau 5s (fallback)
        msg.channel.send({
          content: `<@${userId}>`,
          embeds: [
            new EmbedBuilder()
              .setTitle('🚫 Sai Kênh')
              .setColor(0x95A5A6)
              .setDescription(
                (channelMentions
                  ? `Dùng bot ở: ${channelMentions}`
                  : `Hỏi Admin về kênh chơi bot được chỉ định.`) +
                penaltyLine
              )
              .setFooter({ text: 'Tự xóa sau 5 giây' }),
          ],
        }).then(r => setTimeout(() => r.delete().catch(() => {}), 5_000)).catch(() => {});
      });
      return;
    }

    // ── PvP channel whitelist ─────────────────────────────────────────────
    // Lệnh PvP bị giới hạn kênh riêng — độc lập với allowed_channels.
    // Bao gồm TẤT CẢ alias — cập nhật nếu thêm lệnh PvP mới
    const PVP_CMDS = new Set([
      'pvp', 'ty_thi', 'dau',                          // PvP chính
      'cuong_chien', 'ep_solo', 'bat_solo', 'forcepvp', // Cưỡng chiến
      'am_sat', 'am', 'amsat',                          // Ám sát
    ]);
    const PVP_MGMT_CMDS = new Set(['pvp_kenh', 'pvp_channel']);
    const bypassPvpWhitelist = userId === ADMIN_ID || (PVP_MGMT_CMDS.has(cmd) && isServerAdmin);
    if (!bypassPvpWhitelist && PVP_CMDS.has(cmd) && !pvpChannels.isAllowed(msg.guildId, msg.channel.id)) {
      msg.delete().catch(() => {});

      const penalty = userId !== ADMIN_ID ? channelPenalty.recordOffense(userId) : null;
      const penaltyLine = penalty
        ? `\n\n${CE('lock_icon', '🔒')} **Hình phạt:** Bot bị khóa **${penalty.label}**` +
          (penalty.count > 1 ? ` (vi phạm lần thứ ${penalty.count})` : '') + `.`
        : '';

      const allowedPvpIds = pvpChannels.list(msg.guildId);
      const pvpMentions   = allowedPvpIds.length > 0
        ? allowedPvpIds.map(id => `<#${id}>`).join(' · ')
        : null;

      msg.author.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚔️ Sai Kênh PvP — Tu Tiên Bot')
            .setColor(0xE74C3C)
            .setDescription(
              `*Lệnh PvP không hoạt động tại **#${msg.channel.name}** (server **${msg.guild?.name || 'không rõ'}**).*\n\n` +
              (pvpMentions
                ? `🏟️ **Kênh PvP được chỉ định:**\n${pvpMentions}\n\nVào kênh đó để thách đấu nhé!`
                : `🏟️ Vui lòng hỏi Admin server về kênh PvP được chỉ định.\n*(Admin dùng \`-pvp_kenh them #kênh\` để thiết lập)*`) +
              penaltyLine
            )
            .setFooter({ text: 'Tu Tiên Bot • Tin nhắn riêng tự động' }),
        ],
      }).catch(() => {
        msg.channel.send({
          content: `<@${userId}>`,
          embeds: [
            new EmbedBuilder()
              .setTitle('⚔️ Sai Kênh PvP')
              .setColor(0xE74C3C)
              .setDescription(
                (pvpMentions
                  ? `PvP chỉ ở: ${pvpMentions}`
                  : `Hỏi Admin về kênh PvP được chỉ định.`) +
                penaltyLine
              )
              .setFooter({ text: 'Tự xóa sau 5 giây' }),
          ],
        }).then(r => setTimeout(() => r.delete().catch(() => {}), 5_000)).catch(() => {});
      });
      return;
    }

    // ── TTL channel whitelist ─────────────────────────────────────────────
    // Lệnh Tháp Thị Luyện bị giới hạn kênh riêng — độc lập với allowed_channels và pvp_channels.
    // Bao gồm TẤT CẢ alias — cập nhật nếu thêm lệnh TTL mới
    const TTL_CMDS = new Set([
      'thap_thi_luyen', 'ttl', 'thi_luyen', 'tower', // Tháp Thị Luyện
    ]);
    const TTL_MGMT_CMDS = new Set(['ttl_kenh', 'ttl_channel']);
    const bypassTtlWhitelist = userId === ADMIN_ID || (TTL_MGMT_CMDS.has(cmd) && isServerAdmin);
    if (!bypassTtlWhitelist && TTL_CMDS.has(cmd) && !ttlChannels.isAllowed(msg.guildId, msg.channel.id)) {
      msg.delete().catch(() => {});

      const penalty = userId !== ADMIN_ID ? channelPenalty.recordOffense(userId) : null;
      const penaltyLine = penalty
        ? `\n\n${CE('lock_icon', '🔒')} **Hình phạt:** Bot bị khóa **${penalty.label}**` +
          (penalty.count > 1 ? ` (vi phạm lần thứ ${penalty.count})` : '') + `.`
        : '';

      const allowedTtlIds = ttlChannels.list(msg.guildId);
      const ttlMentions   = allowedTtlIds.length > 0
        ? allowedTtlIds.map(id => `<#${id}>`).join(' · ')
        : null;

      msg.author.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🏯 Sai Kênh Tháp Thị Luyện — Tu Tiên Bot')
            .setColor(0x9B59B6)
            .setDescription(
              `*Lệnh Tháp Thị Luyện không hoạt động tại **#${msg.channel.name}** (server **${msg.guild?.name || 'không rõ'}**).*\n\n` +
              (ttlMentions
                ? `🏯 **Kênh Tháp Thị Luyện được chỉ định:**\n${ttlMentions}\n\nVào kênh đó để leo tháp nhé!`
                : `🏯 Vui lòng hỏi Admin server về kênh Tháp Thị Luyện được chỉ định.\n*(Admin dùng \`-ttl_kenh them #kênh\` để thiết lập)*`) +
              penaltyLine
            )
            .setFooter({ text: 'Tu Tiên Bot • Tin nhắn riêng tự động' }),
        ],
      }).catch(() => {
        msg.channel.send({
          content: `<@${userId}>`,
          embeds: [
            new EmbedBuilder()
              .setTitle('🏯 Sai Kênh Tháp Thị Luyện')
              .setColor(0x9B59B6)
              .setDescription(
                (ttlMentions
                  ? `TTL chỉ ở: ${ttlMentions}`
                  : `Hỏi Admin về kênh Tháp Thị Luyện được chỉ định.`) +
                penaltyLine
              )
              .setFooter({ text: 'Tự xóa sau 5 giây' }),
          ],
        }).then(r => setTimeout(() => r.delete().catch(() => {}), 5_000)).catch(() => {});
      });
      return;
    }

    // ── Săn channel whitelist ─────────────────────────────────────────────
    // Lệnh Săn Linh Thú bị giới hạn kênh riêng — độc lập với allowed_channels, pvp_channels, ttl_channels.
    // Bao gồm TẤT CẢ alias — cập nhật nếu thêm lệnh Săn mới
    const SAN_CMDS = new Set([
      'san', 'san_linh_thu', 'hunt', // Săn Linh Thú
    ]);
    const SAN_MGMT_CMDS = new Set(['san_kenh', 'san_channel']);
    const bypassSanWhitelist = userId === ADMIN_ID || (SAN_MGMT_CMDS.has(cmd) && isServerAdmin);
    if (!bypassSanWhitelist && SAN_CMDS.has(cmd) && !sanChannels.isAllowed(msg.guildId, msg.channel.id)) {
      msg.delete().catch(() => {});

      const penalty = userId !== ADMIN_ID ? channelPenalty.recordOffense(userId) : null;
      const penaltyLine = penalty
        ? `\n\n${CE('lock_icon', '🔒')} **Hình phạt:** Bot bị khóa **${penalty.label}**` +
          (penalty.count > 1 ? ` (vi phạm lần thứ ${penalty.count})` : '') + `.`
        : '';

      const allowedSanIds = sanChannels.list(msg.guildId);
      const sanMentions   = allowedSanIds.length > 0
        ? allowedSanIds.map(id => `<#${id}>`).join(' · ')
        : null;

      msg.author.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🦌 Sai Kênh Săn Linh Thú — Tu Tiên Bot')
            .setColor(0x27AE60)
            .setDescription(
              `*Lệnh Săn Linh Thú không hoạt động tại **#${msg.channel.name}** (server **${msg.guild?.name || 'không rõ'}**).*\n\n` +
              (sanMentions
                ? `🦌 **Kênh Săn Linh Thú được chỉ định:**\n${sanMentions}\n\nVào kênh đó để đi săn nhé!`
                : `🦌 Vui lòng hỏi Admin server về kênh Săn Linh Thú được chỉ định.\n*(Admin dùng \`-san_kenh them #kênh\` để thiết lập)*`) +
              penaltyLine
            )
            .setFooter({ text: 'Tu Tiên Bot • Tin nhắn riêng tự động' }),
        ],
      }).catch(() => {
        msg.channel.send({
          content: `<@${userId}>`,
          embeds: [
            new EmbedBuilder()
              .setTitle('🦌 Sai Kênh Săn Linh Thú')
              .setColor(0x27AE60)
              .setDescription(
                (sanMentions
                  ? `Săn chỉ ở: ${sanMentions}`
                  : `Hỏi Admin về kênh Săn Linh Thú được chỉ định.`) +
                penaltyLine
              )
              .setFooter({ text: 'Tự xóa sau 5 giây' }),
          ],
        }).then(r => setTimeout(() => r.delete().catch(() => {}), 5_000)).catch(() => {});
      });
      return;
    }

    // ── Đố Vui channel whitelist ─────────────────────────────────────────
    // Bao gồm TẤT CẢ alias — cập nhật nếu thêm lệnh Đố Vui mới
    const DV_CMDS = new Set([
      'do_vui', 'dovui', 'quiz', 'dv', // Đố Vui
    ]);
    const DV_MGMT_CMDS = new Set(['dv_kenh', 'dv_channel']);
    const bypassDvWhitelist = userId === ADMIN_ID || (DV_MGMT_CMDS.has(cmd) && isServerAdmin);
    if (!bypassDvWhitelist && DV_CMDS.has(cmd) && !dvChannels.isAllowed(msg.guildId, msg.channel.id)) {
      msg.delete().catch(() => {});

      const penalty = userId !== ADMIN_ID ? channelPenalty.recordOffense(userId) : null;
      const penaltyLine = penalty
        ? `\n\n${CE('lock_icon', '🔒')} **Hình phạt:** Bot bị khóa **${penalty.label}**` +
          (penalty.count > 1 ? ` (vi phạm lần thứ ${penalty.count})` : '') + `.`
        : '';

      const allowedDvIds = dvChannels.list(msg.guildId);
      const dvMentions   = allowedDvIds.length > 0
        ? allowedDvIds.map(id => `<#${id}>`).join(' · ')
        : null;

      msg.author.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🎯 Sai Kênh Đố Vui — Tu Tiên Bot')
            .setColor(0xF39C12)
            .setDescription(
              `*Lệnh Đố Vui không hoạt động tại **#${msg.channel.name}** (server **${msg.guild?.name || 'không rõ'}**).*\n\n` +
              (dvMentions
                ? `🎯 **Kênh Đố Vui được chỉ định:**\n${dvMentions}\n\nVào kênh đó để tham gia đố vui nhé!`
                : `🎯 Vui lòng hỏi Admin server về kênh Đố Vui được chỉ định.\n*(Admin dùng \`-dv_kenh them #kênh\` để thiết lập)*`) +
              penaltyLine
            )
            .setFooter({ text: 'Tu Tiên Bot • Tin nhắn riêng tự động' }),
        ],
      }).catch(() => {
        msg.channel.send({
          content: `<@${userId}>`,
          embeds: [
            new EmbedBuilder()
              .setTitle('🎯 Sai Kênh Đố Vui')
              .setColor(0xF39C12)
              .setDescription(
                (dvMentions
                  ? `Đố Vui chỉ ở: ${dvMentions}`
                  : `Hỏi Admin về kênh Đố Vui được chỉ định.`) +
                penaltyLine
              )
              .setFooter({ text: 'Tự xóa sau 5 giây' }),
          ],
        }).then(r => setTimeout(() => r.delete().catch(() => {}), 5_000)).catch(() => {});
      });
      return;
    }

    // ── Maintenance mode ─────────────────────────────────────────────────
    if (maintenance.isOn() && userId !== ADMIN_ID) {
      const reason = maintenance.getReason();
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🔧 Bot Đang Bảo Trì')
            .setColor(0xF39C12)
            .setDescription(
              `*Hệ thống Tu Tiên tạm thời đóng cửa để nâng cấp...*\n\n` +
              (reason ? `📋 **Lý do:** ${reason}\n\n` : '') +
              `${CE("cd_timer","⏳")} Vui lòng quay lại sau ít phút!`
            )
            .setFooter({ text: 'Chỉ Admin mới có thể sử dụng bot lúc này' }),
        ],
      }).catch(() => {});
    }

    // ── Anti-raid: burst dồn dập trên toàn server (nhiều tài khoản cùng lúc) ─
    if (userId !== ADMIN_ID && !antiraid.checkGuildBurst(msg.guildId, userId)) {
      return; // im lặng trong lúc khóa để tránh spam thêm tin nhắn reply
    }

    // ── Anti-raid: khóa tạm người dùng cố tình spam vượt cooldown nhiều lần ─
    if (userId !== ADMIN_ID) {
      const lockRemaining = antiraid.getUserLockRemaining(userId);
      if (lockRemaining > 0) {
        const offenseCount = antiraid.getOffenseCount(userId);
        const remMin       = lockRemaining / 60_000;
        const timeLabel    = remMin >= 60
          ? `${Math.ceil(remMin / 60)} giờ`
          : `${Math.ceil(remMin)} phút`;
        const offenseLabel = offenseCount >= 2 ? ` (lần thứ ${offenseCount})` : '';
        return msg
          .reply({ embeds: [errE(`${CE('lock_icon','🔒')} Ngươi bị tạm khóa lệnh do spam${offenseLabel} — còn **${timeLabel}**.`)] })
          .catch(() => {});
      }
    }

    // ── Per-user command lock (chống race condition) ──────────────────────
    // QUAN TRỌNG: kiểm tra trước rate limit để tránh cập nhật timestamp
    // khi lệnh vẫn đang chạy — nếu checkRateLimit chạy trước thì timestamp
    // bị reset dù lệnh không được thực thi, làm hỏng việc tích lũy violation.
    if (userId !== ADMIN_ID && _processingUsers.has(userId)) {
      return msg
        .reply({ embeds: [warnE(`${CE("cd_timer","⏳")} Lệnh trước đang xử lý, vui lòng chờ...`)] })
        .catch(() => {});
    }

    // ── Rate limit ───────────────────────────────────────────────────────
    if (userId !== ADMIN_ID && !checkRateLimit(userId)) {
      antiraid.recordViolation(userId);
      return msg
        .reply({ embeds: [warnE('⏱️ Bình tĩnh! Chờ **3 giây** giữa các lệnh.')] })
        .catch(() => {});
    }

    _processingUsers.add(userId);

    try {
      // ── Ban + Injury check (single query for performance) ────────────────
      try {
        const row = (await db('SELECT ban_until, dao_thuong FROM players WHERE user_id=$1', [userId])).rows[0];
        if (row) {
          const until = Number(row.ban_until || 0);
          if (until > Date.now()) {
            const hours = Math.ceil((until - Date.now()) / 3_600_000);
            return msg
              .reply({ embeds: [errE(`🔨 Tài khoản bị cấm!\nCòn **${hours} giờ** nữa mới được dùng bot.`)] })
              .catch(() => {});
          }
          if (userId !== ADMIN_ID && !NO_PLAYER_REQUIRED.has(cmd) && Number(row.dao_thuong || 0) >= 3) {
            return msg
              .reply({
                embeds: [
                  new EmbedBuilder()
                    .setTitle('🔴 Đạo Thương Nặng — Thần Thể Kiệt Sức!')
                    .setColor(12597547)
                    .setDescription(
                      `*Thương thế quá nặng — thần thức hỗn loạn, không thể vận hành bất kỳ pháp lực nào!*\n\n` +
                      `${CE('lock_icon','🔒')} **Ngươi đang bị Đạo Thương Nặng (Cấp 3)** — bị khóa toàn bộ lệnh!\n\n` +
                      `**Hiệu ứng hiện tại:**\n` +
                      `${CE('tuatk', '⚔️')} Công Lực -50% | ${CE('tudef', '🛡️')} Thủ Lực -20% | ${CE('tutv', '📈')} Tu Vi nhận vào -70%\n\n` +
                      `**Cách chữa trị:**\n` +
                      `💊 \`-chua_thuong\` — Tự chữa (45,000 ${CE('tult', '💠')}, CD 10h)\n` +
                      `💉 Nhờ **Dược Sư** chữa — nhanh hơn, rẻ hơn (28,000 ${CE('tult', '💠')}, CD 45ph)`,
                    )
                    .setFooter({ text: 'Chỉ -chua_thuong / -xdt / -thong_tin được phép dùng lúc này' }),
                ],
              })
              .catch(() => {});
          }
        }
      } catch (_) {}

      // ── Dispatch ───────────────────────────────────────────────────────
      await handler(msg, args, client);
    } catch (err) {
      console.error(`❌ Lỗi [${cmd}]:`, err?.message || err);
      msg.reply('❌ Có lỗi xảy ra! Hãy thử lại sau.').catch(() => {});
    } finally {
      _processingUsers.delete(userId);
    }
  });
}

module.exports = setupMessageHandler;
