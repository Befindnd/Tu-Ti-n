'use strict';
const { CE } = require('../../systems/emoji');
const { db }                   = require('../../db/pool');
const { THUE_PCT }             = require('./constants');
const { itemName, awardItem }  = require('./items');
const { fmt }                  = require('../../utils');

function _dm(client, uid, text) {
  client.users.fetch(uid).then(u => u.send(text)).catch(() => {});
}

async function processExpired(client) {
  const res = await db(
    `SELECT * FROM auctions WHERE status = 'active' AND expires_at <= NOW() ORDER BY id`,
  ).catch(() => ({ rows: [] }));

  for (const row of res.rows) {
    try {
      if (row.bidder_id) {
        const tax  = Math.floor(Number(row.gia_hien) * THUE_PCT);
        const gets = Number(row.gia_hien) - tax;
        await db('UPDATE players SET linh_thach = linh_thach + $1 WHERE user_id = $2', [gets, row.seller_id]);
        await awardItem(row.bidder_id, row.item_type, row.item_id, row.item_qty);
        await db(`UPDATE auctions SET status = 'sold' WHERE id = $1`, [row.id]);
        if (client) {
          const nm = itemName(row.item_type, row.item_id);
          _dm(client, row.seller_id,
            `🏦 **Đấu Giá Kết Thúc** — **${nm} ×${row.item_qty}** đã bán!\nNhận **${fmt(gets)} ${CE('tult','💠')}** (sau thuế 5%).`);
          _dm(client, row.bidder_id,
            `🏦 **Đấu Giá Kết Thúc** — Bạn thắng **${nm} ×${row.item_qty}**! Vật phẩm đã vào túi.`);
        }
      } else {
        await awardItem(row.seller_id, row.item_type, row.item_id, row.item_qty);
        await db(`UPDATE auctions SET status = 'expired' WHERE id = $1`, [row.id]);
        if (client) {
          _dm(client, row.seller_id,
            `🏦 **Đấu Giá Hết Hạn** — **${itemName(row.item_type, row.item_id)} ×${row.item_qty}** không ai mua. Vật phẩm hoàn trả.`);
        }
      }
    } catch (e) {
      console.error(`[Auction] processExpired #${row.id}:`, e.message);
    }
  }
}

module.exports = { _dm, processExpired };
