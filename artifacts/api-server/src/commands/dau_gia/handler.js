'use strict';
const { db }                              = require('../../db/pool');
const { getPlayer }                       = require('../../db/players');
const { CANH_GIOI }                       = require('../../data');
const { fmt, errE, reg }                  = require('../../utils');
const { TRUC_CO, PHI_PCT, THUE_PCT, MIN_BID, MAX_SLOTS, MAX_GIA, PAGE_SZ, CD_DANG_H } = require('./constants');
const { itemName, getBagItems, deductItem, awardItem } = require('./items');
const { _dm, processExpired }             = require('./expired');
const antiraid                            = require('../../core/antiraid');
const {
  embedMarket, embedMine, embedListing,
  rowsMarket, rowsMine, rowsListing,
  bidModal, listModal,
} = require('./ui');
const { CE, CEu } = require('../../systems/emoji');

reg('dau_gia', ['dg', 'daugia'], async (msg) => {
  const userId = msg.author.id;
  let player   = await getPlayer(userId);
  if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });

  if (player.canh_gioi < TRUC_CO)
    return msg.reply({ embeds: [errE(
      `❌ Cần **Trúc Cơ Sơ Kỳ** *(Tầng 10)* để dùng Nhà Đấu Giá!\n` +
      `Hiện tại: **${CANH_GIOI[player.canh_gioi]?.ten || 'Phàm Nhân'}** *(Tầng ${player.canh_gioi})*`,
    )] });

  processExpired(msg.client).catch(() => {});

  // ── State ─────────────────────────────────────────────────────────────────
  let tab       = 'market';
  let page      = 1;
  let totalPgs  = 1;
  let mktRows   = [];
  let myRows    = [];
  let selAucId  = null;
  let selMineId = null;
  let selType   = null;
  let selItemId = null;
  let footer    = '';

  async function loadMarket() {
    const cnt   = await db(`SELECT COUNT(*) FROM auctions WHERE status='active' AND expires_at>NOW()`);
    const total = parseInt(cnt.rows[0]?.count || 0);
    totalPgs = Math.max(1, Math.ceil(total / PAGE_SZ));
    page     = Math.min(page, totalPgs);
    const res = await db(
      `SELECT * FROM auctions WHERE status='active' AND expires_at>NOW() ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [PAGE_SZ, (page - 1) * PAGE_SZ],
    );
    mktRows = res.rows;
  }

  async function loadMine() {
    const res = await db(
      `SELECT * FROM auctions WHERE seller_id=$1 AND status='active' ORDER BY id DESC`, [userId],
    );
    myRows = res.rows;
  }

  function getEmbed() {
    if (tab === 'market') return embedMarket(mktRows, page, totalPgs, selAucId, footer);
    if (tab === 'mine')   return embedMine(myRows, selMineId, footer);
    return embedListing(player, selType, selItemId, footer);
  }

  function getRows() {
    if (tab === 'market') return rowsMarket(mktRows, page, totalPgs, selAucId);
    if (tab === 'mine')   return rowsMine(myRows, selMineId);
    return rowsListing(player, selType, selItemId);
  }

  await loadMarket();

  const sentMsg = await msg.reply({ embeds: [getEmbed()], components: getRows() });
  const coll    = sentMsg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 120_000 });

  coll.on('collect', async (i) => {
    const cid = i.customId;
    footer = '';

    // ── Refresh ──────────────────────────────────────────────────────────────
    if (cid === 'dg_refresh') {
      await i.deferUpdate();
      player = await getPlayer(userId);
      if (tab === 'market') await loadMarket();
      if (tab === 'mine')   await loadMine();
      return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
    }

    // ── Tab: Thị Trường ──────────────────────────────────────────────────────
    if (cid === 'dg_tab_market') {
      await i.deferUpdate();
      tab = 'market'; page = 1; selAucId = null;
      await loadMarket();
      return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
    }

    // ── Tab: Của Tôi ─────────────────────────────────────────────────────────
    if (cid === 'dg_tab_mine') {
      await i.deferUpdate();
      tab = 'mine'; selMineId = null;
      await loadMine();
      return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
    }

    // ── Tab: Đăng Bán ────────────────────────────────────────────────────────
    if (cid === 'dg_tab_list') {
      await i.deferUpdate();
      tab = 'list'; selType = null; selItemId = null;
      player = await getPlayer(userId);
      return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
    }

    // ── Phân trang ───────────────────────────────────────────────────────────
    if (cid === 'dg_prev') {
      await i.deferUpdate();
      page = Math.max(1, page - 1); selAucId = null;
      await loadMarket();
      return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
    }
    if (cid === 'dg_next') {
      await i.deferUpdate();
      page = Math.min(totalPgs, page + 1); selAucId = null;
      await loadMarket();
      return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
    }

    // ── Chọn phiên (thị trường) ──────────────────────────────────────────────
    if (cid === 'dg_sel_auction') {
      await i.deferUpdate();
      selAucId = parseInt(i.values[0]);
      return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
    }

    // ── Đặt giá ──────────────────────────────────────────────────────────────
    if (cid === 'dg_bid') {
      const auc = mktRows.find(r => r.id === selAucId);
      if (!auc) { await i.deferUpdate(); return; }

      await i.showModal(bidModal(auc));
      const sub = await i.awaitModalSubmit({ time: 60_000 }).catch(() => null);
      if (!sub) return;
      await sub.deferUpdate();

      const gia   = Math.floor(parseInt(sub.fields.getTextInputValue('bid_amount')) || 0);
      player      = await getPlayer(userId);
      const fresh = (await db('SELECT * FROM auctions WHERE id=$1 AND status=$2', [auc.id, 'active'])).rows[0];
      const minB  = fresh ? Math.ceil(Number(fresh.gia_hien) * (1 + MIN_BID)) : 0;

      const acctCheck = antiraid.checkAccountAge(msg.author);

      if (!fresh || new Date(fresh.expires_at) <= new Date()) {
        footer = `${CE('warn_icon','⚠️')} Phiên này đã hết hạn hoặc không còn hoạt động!`;
      } else if (acctCheck.suspicious) {
        footer = `❌ Tài khoản Discord quá mới (${acctCheck.ageDays.toFixed(1)} ngày) — cần đủ **${antiraid.DEFAULT_MIN_ACCOUNT_AGE_DAYS} ngày** tuổi mới được đặt giá (chống thao túng đấu giá bằng acc rác).`;
      } else if (fresh.seller_id === userId) {
        footer = '❌ Không thể đặt giá phiên của chính mình!';
      } else if (fresh.bidder_id === userId) {
        footer = `${CE('warn_icon','⚠️')} Bạn đang là người trả giá cao nhất rồi!`;
      } else if (gia < minB) {
        footer = `❌ Giá tối thiểu: **${fmt(minB)} ${CEu("tult","💠")}** (+5% so với ${fmt(fresh.gia_hien)} ${CEu("tult","💠")})`;
      } else if (gia > MAX_GIA) {
        footer = `❌ Giá đặt tối đa là **${fmt(MAX_GIA)} ${CEu("tult","💠")}**!`;
      } else if (Number(player.linh_thach) < gia) {
        footer = `❌ Không đủ LT! Có **${fmt(player.linh_thach)} ${CEu("tult","💠")}** · Cần **${fmt(gia)} ${CEu("tult","💠")}**`;
      } else {
        if (fresh.bidder_id) {
          await db('UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2', [fresh.gia_hien, fresh.bidder_id]);
          _dm(msg.client, fresh.bidder_id,
            `🏦 **Phiên #${fresh.id}** có người trả giá cao hơn! **${fmt(fresh.gia_hien)} ${CE('tult','💠')}** hoàn trả.`);
        }
        await db('UPDATE players SET linh_thach=linh_thach-$1 WHERE user_id=$2', [gia, userId]);
        await db('UPDATE auctions SET gia_hien=$1,bidder_id=$2,bidder_name=$3 WHERE id=$4',
          [gia, userId, player.username, fresh.id]);
        _dm(msg.client, fresh.seller_id,
          `🏦 **Phiên #${fresh.id}** — **${player.username}** đặt **${fmt(gia)} ${CE('tult','💠')}**!`);
        footer   = `✅ Đặt giá **${fmt(gia)} ${CEu("tult","💠")}** thành công! Linh Thạch tạm giữ, hoàn trả nếu có người trả cao hơn.`;
        selAucId = null;
      }
      await loadMarket();
      return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
    }

    // ── Mua ngay ─────────────────────────────────────────────────────────────
    if (cid === 'dg_buynow') {
      await i.deferUpdate();
      const auc = mktRows.find(r => r.id === selAucId);
      if (!auc?.gia_mua_ngay) return;

      const fresh = (await db('SELECT * FROM auctions WHERE id=$1 AND status=$2', [auc.id, 'active'])).rows[0];
      player = await getPlayer(userId);
      const acctCheckBuy = antiraid.checkAccountAge(msg.author);

      if (!fresh || !fresh.gia_mua_ngay) {
        footer = `${CE('warn_icon','⚠️')} Phiên không còn hoạt động!`;
      } else if (acctCheckBuy.suspicious) {
        footer = `❌ Tài khoản Discord quá mới (${acctCheckBuy.ageDays.toFixed(1)} ngày) — cần đủ **${antiraid.DEFAULT_MIN_ACCOUNT_AGE_DAYS} ngày** tuổi mới được mua ngay (chống thao túng đấu giá bằng acc rác).`;
      } else if (fresh.seller_id === userId) {
        footer = '❌ Không thể mua phiên của chính mình!';
      } else if (Number(player.linh_thach) < Number(fresh.gia_mua_ngay)) {
        footer = `❌ Không đủ LT! Có **${fmt(player.linh_thach)} ${CEu("tult","💠")}** · Cần **${fmt(fresh.gia_mua_ngay)} ${CEu("tult","💠")}**`;
      } else {
        if (fresh.bidder_id) {
          await db('UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2', [fresh.gia_hien, fresh.bidder_id]);
          _dm(msg.client, fresh.bidder_id,
            `🏦 Phiên #${fresh.id} có người mua ngay. **${fmt(fresh.gia_hien)} ${CE('tult','💠')}** hoàn trả.`);
        }
        const price = Number(fresh.gia_mua_ngay);
        const tax   = Math.floor(price * THUE_PCT);
        const gets  = price - tax;
        await db('UPDATE players SET linh_thach=linh_thach-$1 WHERE user_id=$2', [price, userId]);
        await db('UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2', [gets, fresh.seller_id]);
        await awardItem(userId, fresh.item_type, fresh.item_id, fresh.item_qty);
        await db('UPDATE auctions SET status=$1,bidder_id=$2,bidder_name=$3,gia_hien=$4 WHERE id=$5',
          ['sold', userId, player.username, price, fresh.id]);
        const nm = itemName(fresh.item_type, fresh.item_id);
        _dm(msg.client, fresh.seller_id,
          `🏦 **${nm} ×${fresh.item_qty}** bán cho **${player.username}**! +${fmt(gets)} ${CE('tult','💠')} (sau thuế 5%).`);
        footer   = `🎉 Mua **${nm} ×${fresh.item_qty}** thành công! Giá: **${fmt(price)} ${CEu("tult","💠")}** · Thuế: **${fmt(tax)} ${CEu("tult","💠")}**`;
        selAucId = null;
      }
      await loadMarket();
      return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
    }

    // ── Chọn phiên (của tôi) ─────────────────────────────────────────────────
    if (cid === 'dg_sel_mine') {
      await i.deferUpdate();
      selMineId = parseInt(i.values[0]);
      return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
    }

    // ── Thu hồi ──────────────────────────────────────────────────────────────
    if (cid === 'dg_thu_hoi') {
      await i.deferUpdate();
      const a = myRows.find(r => r.id === selMineId);
      if (!a) return;
      if (a.bidder_id) {
        footer = '❌ Không thể thu hồi — đã có người đặt giá! Chờ phiên hết hạn tự động.';
      } else {
        await awardItem(userId, a.item_type, a.item_id, a.item_qty);
        await db(`UPDATE auctions SET status='cancelled' WHERE id=$1`, [a.id]);
        const phi = Math.max(100, Math.floor(Number(a.gia_khoi) * PHI_PCT));
        footer    = `✅ Thu hồi **${itemName(a.item_type, a.item_id)} ×${a.item_qty}** thành công! *(Phí ${fmt(phi)} ${CEu("tult","💠")} không hoàn)*`;
        selMineId = null;
      }
      await loadMine();
      return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
    }

    // ── Chọn loại vật phẩm (đăng bán) ───────────────────────────────────────
    if (cid === 'dg_sel_type') {
      await i.deferUpdate();
      selType = i.values[0]; selItemId = null;
      player  = await getPlayer(userId);
      return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
    }

    // ── Chọn vật phẩm cụ thể (đăng bán) ────────────────────────────────────
    if (cid === 'dg_sel_item') {
      await i.deferUpdate();
      selItemId = i.values[0];
      return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
    }

    // ── Mở modal điền thông tin (đăng bán) ──────────────────────────────────
    if (cid === 'dg_open_modal') {
      player    = await getPlayer(userId);
      const it  = getBagItems(player, selType).find(x => x.id === selItemId);
      if (!it) {
        await i.deferUpdate();
        footer = `${CE('warn_icon','⚠️')} Vật phẩm không còn trong túi!`;
        return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
      }

      await i.showModal(listModal(it));
      const sub = await i.awaitModalSubmit({ time: 60_000 }).catch(() => null);
      if (!sub) return;
      await sub.deferUpdate();

      player          = await getPlayer(userId);
      const qty       = Math.max(1, Math.floor(parseInt(sub.fields.getTextInputValue('l_qty'))  || 1));
      const giaKhoi   = Math.floor(parseInt(sub.fields.getTextInputValue('l_gia')) || 0);
      const gio       = Math.min(72, Math.max(1, parseInt(sub.fields.getTextInputValue('l_gio')) || 24));
      const muaRaw    = sub.fields.getTextInputValue('l_mua').trim();
      const giaMua    = muaRaw ? Math.floor(parseInt(muaRaw)) : null;
      const freshIt   = getBagItems(player, selType).find(x => x.id === selItemId);

      const lastDang   = await db(
        `SELECT created_at FROM auctions WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 1`, [userId],
      ).catch(() => ({ rows: [] }));
      const lastDangAt = lastDang.rows[0]?.created_at ? new Date(lastDang.rows[0].created_at) : null;
      const cdRem      = lastDangAt ? CD_DANG_H * 3_600_000 - (Date.now() - lastDangAt.getTime()) : 0;

      if (!freshIt || freshIt.qty < qty) {
        footer = `❌ Không đủ trong túi! Có **${freshIt?.qty || 0}** · Cần **${qty}**`;
      } else if (giaKhoi < 100) {
        footer = `❌ Giá khởi điểm tối thiểu **100 ${CEu("tult","💠")}**!`;
      } else if (giaKhoi > MAX_GIA) {
        footer = `❌ Giá khởi điểm tối đa **${fmt(MAX_GIA)} ${CEu("tult","💠")}**!`;
      } else if (giaMua !== null && (isNaN(giaMua) || giaMua <= giaKhoi)) {
        footer = '❌ Giá mua ngay phải **lớn hơn** giá khởi điểm và là số hợp lệ!';
      } else if (giaMua !== null && giaMua > MAX_GIA) {
        footer = `❌ Giá mua ngay tối đa **${fmt(MAX_GIA)} ${CEu("tult","💠")}**!`;
      } else if (cdRem > 0) {
        const h = Math.floor(cdRem / 3_600_000);
        const m = Math.floor((cdRem % 3_600_000) / 60_000);
        footer  = `${CEu("cd_timer","⏳")} Cần chờ **${h}h ${m}m** nữa mới được đăng bán! *(Cooldown ${CD_DANG_H}h giữa các lần đăng)*`;
      } else {
        const slotRes = await db(`SELECT COUNT(*) FROM auctions WHERE seller_id=$1 AND status='active'`, [userId]);
        if (parseInt(slotRes.rows[0].count) >= MAX_SLOTS) {
          footer = `❌ Tối đa **${MAX_SLOTS} phiên** cùng lúc! Hãy thu hồi hoặc chờ phiên hết hạn.`;
        } else {
          const phi = Math.max(100, Math.floor(giaKhoi * PHI_PCT));
          if (Number(player.linh_thach) < phi) {
            footer = `❌ Cần **${fmt(phi)} ${CEu("tult","💠")}** phí đăng *(5%)*! Có **${fmt(player.linh_thach)} ${CEu("tult","💠")}**`;
          } else {
            await db('UPDATE players SET linh_thach=linh_thach-$1 WHERE user_id=$2', [phi, userId]);
            await deductItem(userId, selType, selItemId, qty);
            const exp = new Date(Date.now() + gio * 3_600_000);
            const ins = await db(
              `INSERT INTO auctions (seller_id,seller_name,item_type,item_id,item_qty,gia_khoi,gia_hien,gia_mua_ngay,expires_at)
               VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8) RETURNING id`,
              [userId, player.username, selType, selItemId, qty, giaKhoi, giaMua, exp],
            );
            const newId = ins.rows[0]?.id;
            footer      = `✅ **Phiên #${newId}** đăng thành công! -${fmt(phi)} ${CEu("tult","💠")} phí đăng. Đã chuyển sang tab Của Tôi.`;
            selType     = null; selItemId = null;
            tab         = 'mine'; selMineId = null;
            await loadMine();
          }
        }
      }
      player = await getPlayer(userId);
      return sentMsg.edit({ embeds: [getEmbed()], components: getRows() });
    }
  });

  coll.on('end', () => {
    sentMsg.edit({ components: [] }).catch(() => {});
  });
});
