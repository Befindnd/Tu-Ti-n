'use strict';
const { initDB } = require('../db/init');
const { CE, initCustomEmoji } = require('../systems/emoji');
const { COMMANDS } = require('../utils');
const { processExpired } = require('../commands/dau_gia');
const { db } = require('../db/pool');
const { randomGiaToc } = require('../data');
const autoNotify = require('../core/auto_notify');

module.exports = function setupReady(client) {
  client.once('ready', async () => {
    console.log('\n🌌 Tu Tiên Bot đã sẵn sàng!');
    console.log(`📡 Đăng nhập: ${client.user.tag}`);
    console.log(`🏯 Phục vụ ${client.guilds.cache.size} server(s)`);
    console.log(`🔑 Prefix: "-" | Handlers: ${[...new Set(COMMANDS.values())].length}`);

    try {
      await initDB();
    } catch (err) {
      console.error('❌ Lỗi DB:', err);
    }

    // Gán gia tộc ngẫu nhiên cho người chơi cũ chưa có
    try {
      const res = await db('SELECT user_id FROM players WHERE gia_toc IS NULL');
      if (res.rows.length > 0) {
        console.log(`🏯 [Gia Tộc] Đang gán gia tộc cho ${res.rows.length} người chơi cũ...`);
        for (const row of res.rows) {
          const gt = randomGiaToc();
          await db('UPDATE players SET gia_toc=$1 WHERE user_id=$2', [gt.id, row.user_id]);
        }
        console.log(`✅ [Gia Tộc] Đã gán xong gia tộc cho ${res.rows.length} người chơi.`);
      }
    } catch (err) {
      console.warn('⚠️ [Gia Tộc] Migration gia tộc lỗi:', err.message);
    }

    // Reset stale pvp_cd timestamps from sessions lost during bot restart.
    db('UPDATE players SET pvp_cd = 0 WHERE pvp_cd > 0')
      .then(r => { if (r.rowCount > 0) console.log(`[ready] Đã reset ${r.rowCount} pvp_cd cũ từ session bị mất.`); })
      .catch(e => console.warn('[ready] pvp_cd reset lỗi:', e.message));

    await initCustomEmoji(client).catch(err => console.warn('⚠️ Emoji init:', err.message));
    client.user.setActivity(`⚔️ Tu Tiên | -help`, { type: 0 });

    // Xử lý phiên đấu giá hết hạn mỗi 5 phút
    processExpired(client).catch(() => {});
    setInterval(() => processExpired(client).catch(() => {}), 5 * 60 * 1000);

    // Khởi động hệ thống thông báo tự động
    autoNotify.start(client).catch(e => console.warn('⚠️ [auto_notify] Khởi động lỗi:', e.message));
  });
};
