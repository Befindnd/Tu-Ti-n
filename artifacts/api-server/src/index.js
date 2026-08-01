'use strict';
require('dotenv').config();
const { createClient } = require('./core/client');
const { EmbedBuilder } = require('discord.js');

// ── Register all command modules (side-effects: calls reg() on each) ──────
require('./commands/profile');
require('./commands/tu_luyen');
require('./commands/dot_pha');
require('./commands/vuot_kiep');
require('./commands/linh_ngo');
require('./commands/pvp');
require('./commands/nghe');
require('./commands/tong_mon');
require('./commands/dao_tam');
require('./commands/huyet_mach');
require('./commands/linh_can');
require('./commands/kham_pha');
require('./commands/dao_tu_path');
require('./commands/linh_thao');
require('./commands/luyen_dan');
require('./commands/dung_dan');
require('./commands/ban_dan');
require('./commands/bi_phap');
require('./commands/cong_phap');
require('./commands/trang_bi');
require('./commands/dong_phu');
require('./commands/am_sat');
require('./commands/am_ve_chung');
require('./commands/phu_phep');
require('./commands/khai_quang');
require('./commands/bao_linh');
require('./commands/co_duyen');
require('./commands/bi_canh');
require('./commands/hap_thu');
require('./commands/healing');
require('./commands/kham_benh');
require('./commands/luyen_thuoc');
require('./commands/xem_dao_thuong');
require('./commands/daily');
require('./commands/tui');
require('./commands/vut');
require('./commands/missions');
require('./commands/social');
require('./commands/giftcode');
require('./commands/bxh');
require('./commands/than_thong');
require('./commands/donate');
require('./commands/system');
require('./commands/tower');
require('./commands/bxh_thap');
require('./commands/san_linh_thu');
require('./commands/vat_pham');
require('./commands/dau_gia');
require('./commands/nghe_dac_ky_moi'); // loads tất cả nghe_dac_ky/*.js
require('./commands/gia_toc');
require('./commands/thu_hoi');
require('./commands/thong_ke_gia_toc');
require('./commands/do_vui');
require('./commands/thong_ke_server');
require('./commands/auto_notify_cmd');
require('./commands/emoji_debug');
require('./commands/xem_emoji');
require('./commands/gacha');
require('./commands/emoji_status');
require('./commands/cuop_tui');
require('./commands/thien_dao_bang');

// ── Event and interaction handlers ───────────────────────────────────────
const setupReady              = require('./events/ready');
const setupMessage            = require('./core/middleware');
const { setupInteractionGuard } = require('./core/interaction_guard');
const setupDonate   = require('./handlers/donateHandler');
const setupPVP      = require('./handlers/pvpHandler');
const setupGiftcode = require('./handlers/giftcodeHandler');
const setupTuicho   = require('./handlers/tuichoHandler');
const setupShop     = require('./handlers/shopHandler');
const setupSan      = require('./handlers/sanHandler');
const setupDoVui    = require('./handlers/doVuiHandler');

// ── Bootstrap ─────────────────────────────────────────────────────────────
const maintenance   = require('./core/maintenance');
const channels      = require('./core/channels');
const pvpChannels   = require('./core/pvp_channels');
const ttlChannels   = require('./core/ttl_channels');
const sanChannels   = require('./core/san_channels');
const dvChannels    = require('./core/dv_channels');
const antiraid      = require('./core/antiraid');
const antiraidLog   = require('./core/antiraid_log');

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ Thiếu DISCORD_TOKEN! Thêm vào Secrets.');
  process.exit(1);
}
if (!process.env.ADMIN_ID) {
  console.warn('⚠️  [antiraid] ADMIN_ID chưa được set — cảnh báo raid sẽ không gửi được tới Admin qua DM.');
  console.warn('   Thêm biến môi trường ADMIN_ID = <Discord user ID của bạn> để bật tính năng này.');
}

const client = createClient();

setupReady(client);
setupMessage(client);
setupDonate(client);
setupPVP(client);
setupGiftcode(client);
setupTuicho(client);
setupShop(client);
setupSan(client);
setupDoVui(client);

// ── Interaction rate-limit guard ──────────────────────────────────────────
// PHẢI gọi SAU tất cả setupX(client) — prependListener sẽ chèn guard vào
// đầu danh sách listener, đảm bảo nó chạy trước mọi interactionCreate handler.
setupInteractionGuard(client);

// ── Auto-pay MBBank ────────────────────────────────────────────────────────
const { startWebhookServer } = require('./server');
const { applyGiftcodeRewards } = require('./commands/donate');

maintenance.load().catch((e) => console.error('[init] Loi tai maintenance:', e.message));
channels.load().catch((e) => console.error('[init] Loi tai channels:', e.message));
pvpChannels.load().catch((e) => console.error('[init] Loi tai pvp_channels:', e.message));
ttlChannels.load().catch((e) => console.error('[init] Loi tai ttl_channels:', e.message));
sanChannels.load().catch((e) => console.error('[init] Loi tai san_channels:', e.message));
dvChannels.load().catch((e) => console.error('[init] Loi tai dv_channels:', e.message));
antiraidLog.load().catch((e) => console.error('[init] Loi tai antiraid_log:', e.message));

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error('❌ Đăng nhập thất bại:', err.message);
  process.exit(1);
});

client.once('ready', () => {
  startWebhookServer(client, applyGiftcodeRewards).catch((e) =>
    console.error('[pay] Khởi động thất bại:', e.message),
  );

  // ── Anti-raid: cảnh báo khi phát hiện command flood từ nhiều acc ─────────
  antiraid.onRaidDetected((guildId, distinctUsers) => {
    const guild = client.guilds.cache.get(guildId);
    const name  = guild ? `**${guild.name}**` : `\`${guildId}\``;
    const cfg   = antiraid.getConfig();

    console.warn(
      `🚨 [antiraid] Command burst tại ${guild?.name ?? guildId} — ${distinctUsers} tài khoản. Đã khóa ${cfg.guildLockMs / 1000}s.`,
    );

    // Gửi embed tới kênh log của server
    const embed = new EmbedBuilder()
      .setTitle('🚨 Cảnh Báo Anti-Raid — Lệnh Dồn Dập')
      .setColor(0xFF4444)
      .addFields(
        { name: '🏯 Server',      value: `${name} (\`${guildId}\`)`,                        inline: false },
        { name: '👥 Phát hiện',   value: `\`${distinctUsers}\` tài khoản gửi lệnh ồ ạt cùng lúc`, inline: false },
        { name: '🔒 Hành động',   value: `Đã tự động **khóa lệnh ${cfg.guildLockMs / 1000} giây** trên server này`, inline: false },
        { name: '💡 Lưu ý',       value: 'Nếu không phải raid thật, dùng `-antiraid mokhoa <guild_id>` để mở sớm.', inline: false },
      )
      .setTimestamp()
      .setFooter({ text: 'Anti-Raid System • Tu Tiên Bot' });

    // Gửi tới kênh log đã cài; nếu chưa cài → fallback gửi tới systemChannel
    if (antiraidLog.getLogChannel(guildId)) {
      antiraidLog.alertGuild(client, guildId, embed);
    } else if (guild?.systemChannel) {
      guild.systemChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // DM cho chủ bot
    antiraid.alertAdmin(
      client,
      `🚨 **Anti-Raid** | Command burst\nServer: ${name} (\`${guildId}\`)\n${distinctUsers} acc dồn dập → đã khóa ${cfg.guildLockMs / 1000}s.`,
    );
  });

  // ── Anti-raid: join hàng loạt (mass-join raid + young-account botfarm) ────
  antiraid.onJoinRaidDetected(async (guildId, memberIds, meta = {}) => {
    const guild = client.guilds.cache.get(guildId);
    const name  = guild ? `**${guild.name}**` : `\`${guildId}\``;
    const cfg   = antiraid.getConfig();

    const burstType = meta.isYoungBurst
      ? `${meta.youngCount} acc mới tạo (< ${cfg.youngAccountAgeDays} ngày) join dồn dập — botfarm detection`
      : `${memberIds.length} tài khoản join ồ ạt trong ${cfg.joinWindowMs / 1000}s`;

    console.warn(`🚨 [antiraid] Join burst tại ${guild?.name ?? guildId} — ${burstType}.`);

    // Thực hiện auto-timeout/kick nếu có guild
    const result = guild
      ? await antiraid.autoTimeoutMembers(guild, memberIds)
      : { attempted: memberIds.length, timedOut: 0, kicked: 0, skipped: memberIds.length };

    // Dòng tóm tắt hành động
    let actionLine;
    if (result.timedOut > 0 || result.kicked > 0) {
      const parts = [];
      if (result.timedOut > 0) parts.push(`🔇 Timeout **${result.timedOut}** tài khoản (${cfg.joinTimeoutMs / 60_000} phút)`);
      if (result.kicked   > 0) parts.push(`👢 Kick **${result.kicked}** tài khoản (bot thiếu quyền Timeout)`);
      if (result.skipped  > 0) parts.push(`⚠️ Bỏ qua **${result.skipped}** (role cao hơn bot / đã rời server)`);
      actionLine = parts.join('\n');
    } else {
      actionLine =
        `⚠️ Không thể xử lý tự động — bot thiếu quyền **Timeout Members** hoặc **Kick Members**.\n` +
        `Vào *Server Settings → Roles* để cấp quyền cho bot, sau đó xử lý thủ công.`;
    }

    // Danh sách IDs để admin copy (tối đa 10)
    const idList = memberIds.slice(0, 10).map((id) => `\`${id}\``).join(', ') +
      (memberIds.length > 10 ? ` … (+${memberIds.length - 10} nữa)` : '');

    const embed = new EmbedBuilder()
      .setTitle(meta.isYoungBurst ? '🚨 Anti-Raid — Botfarm Detected (Acc Mới)' : '🚨 Anti-Raid — Join Hàng Loạt')
      .setColor(0xFF4444)
      .addFields(
        { name: '🏯 Server',      value: `${name} (\`${guildId}\`)`,     inline: false },
        { name: '⚡ Phát hiện',   value: burstType,                       inline: false },
        { name: '🛡️ Hành động',  value: actionLine,                      inline: false },
        { name: '🆔 IDs',         value: idList,                          inline: false },
      )
      .setTimestamp()
      .setFooter({ text: 'Anti-Raid System • Tu Tiên Bot' });

    // Gửi tới kênh log đã cài; nếu chưa cài → fallback gửi tới systemChannel
    if (antiraidLog.getLogChannel(guildId)) {
      antiraidLog.alertGuild(client, guildId, embed);
    } else if (guild?.systemChannel) {
      guild.systemChannel.send({ embeds: [embed] }).catch(() => {});
    }

    antiraid.alertAdmin(
      client,
      `🚨 **Anti-Raid** | Join burst\nServer: ${name} (\`${guildId}\`)\n${burstType}\n${actionLine}`,
    );
  });

  client.on('guildMemberAdd', (member) => {
    antiraid.checkJoinBurst(member.guild.id, member.id);
  });
});

// ── Graceful shutdown ──────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[${signal}] Đang tắt bot — ngắt kết nối Discord...`);
  try {
    await client.destroy();
    console.log('✅ Bot đã ngắt kết nối Discord thành công.');
  } catch (e) {
    console.error('⚠️ Lỗi khi ngắt kết nối:', e.message);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── Global error safety net ────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[crash] Unhandled promise rejection:', reason?.message || reason, reason?.stack || '');
});
process.on('uncaughtException', (err) => {
  console.error('[crash] Uncaught exception:', err.message, err.stack);
  process.exit(1);
});
