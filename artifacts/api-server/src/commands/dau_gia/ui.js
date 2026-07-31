'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { PAGE_SZ, MAX_SLOTS, MIN_BID, LOAI_EMO } = require('./constants');
const { itemName, getBagItems }                  = require('./items');
const { fmt, SEP }                               = require('../../utils');
const { CE, CEu } = require('../../systems/emoji');

// ── Helpers ───────────────────────────────────────────────────────────────────

function hLeft(row) {
  return Math.max(0, Math.ceil((new Date(row.expires_at) - Date.now()) / 3_600_000));
}

function auctionLine(row, highlight = false) {
  const nm  = itemName(row.item_type, row.item_id);
  const em  = LOAI_EMO[row.item_type] || '📦';
  const bid = row.bidder_name
    ? `🔥 **${fmt(row.gia_hien)} ${CE('tult','💠')}** — *${row.bidder_name}*`
    : `🏁 **${fmt(row.gia_hien)} ${CE('tult','💠')}** *(chưa có bid)*`;
  const bn  = row.gia_mua_ngay ? `\n> 💨 Mua ngay: **${fmt(row.gia_mua_ngay)} ${CE('tult','💠')}**` : '';
  return (
    `${highlight ? '▶️' : '>'} **[#${row.id}]** ${em} **${nm}** ×${row.item_qty}\n` +
    `> ${bid}${bn}\n> ${CE("cd_timer","⏳")}${hLeft(row)}h · 👤*${row.seller_name}*`
  );
}

// ── Embeds ────────────────────────────────────────────────────────────────────

function embedMarket(rows, page, totalPgs, selId, footer) {
  const desc = rows.length
    ? rows.map(r => auctionLine(r, r.id === selId)).join('\n\n')
    : '😶 Không có phiên đấu giá nào.\nDùng tab **➕ Đăng Bán** để bắt đầu!';
  return new EmbedBuilder()
    .setTitle('🏦 Nhà Đấu Giá — 🏪 Thị Trường')
    .setColor(0xf39c12)
    .setDescription(desc)
    .setFooter({ text: footer || `Trang ${page}/${totalPgs || 1} · Chọn phiên từ menu ↓ rồi nhấn Đặt Giá / Mua Ngay` });
}

function embedMine(rows, selId, footer) {
  const desc = rows.length
    ? rows.map(r => auctionLine(r, r.id === selId)).join('\n\n')
    : '😶 Bạn chưa có phiên nào.\nDùng tab **➕ Đăng Bán** để đăng vật phẩm!';
  return new EmbedBuilder()
    .setTitle('🏦 Nhà Đấu Giá — 📦 Của Tôi')
    .setColor(0xe67e22)
    .setDescription(desc)
    .setFooter({ text: footer || `Tối đa ${MAX_SLOTS} phiên · Chọn phiên rồi nhấn Thu Hồi` });
}

function embedListing(player, selType, selItemId, footer) {
  const lt = Number(player.linh_thach || 0);
  const LOAI_TEN = { dan_duoc: 'Đan Dược', linh_thao: 'Linh Thảo', bao_boi: 'Bảo Bối', vat_pham: 'Vật Phẩm' };
  let desc = `💰 Linh Thạch: **${fmt(lt)} ${CE('tult','💠')}**\n\n`;
  if (!selType) {
    desc += '**Bước 1:** Chọn loại vật phẩm từ menu bên dưới.';
  } else if (!selItemId) {
    const items = getBagItems(player, selType);
    desc += items.length
      ? `${LOAI_EMO[selType]} **${LOAI_TEN[selType]}** — có **${items.length}** loại trong túi.\n**Bước 2:** Chọn vật phẩm muốn bán.`
      : `${LOAI_EMO[selType]} Không có **${LOAI_TEN[selType]}** nào trong túi có thể đăng bán!`;
  } else {
    const it = getBagItems(player, selType).find(x => x.id === selItemId);
    desc += it
      ? `${LOAI_EMO[selType]} **${it.name}** — Trong túi: **${it.qty}**\n\n**Bước 3:** Nhấn **📝 Điền Thông Tin** để nhập số lượng, giá và thời gian.`
      : `${CE('warn_icon','⚠️')} Vật phẩm không còn trong túi!`;
  }
  desc += `\n\n${SEP}\n💸 Phí: **5% giá khởi** *(thu trước)* · **5% thuế** khi bán thành công\n🚫 Không bán vật phẩm Limited/Donate`;
  return new EmbedBuilder()
    .setTitle('🏦 Nhà Đấu Giá — ➕ Đăng Bán')
    .setColor(0x2ecc71)
    .setDescription(desc)
    .setFooter({ text: footer || `Tối đa ${MAX_SLOTS} phiên đồng thời · Thời gian: 1–72 giờ` });
}

// ── Component rows ────────────────────────────────────────────────────────────

function tabRow(tab) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dg_tab_market').setLabel('🏪 Thị Trường')
      .setStyle(tab === 'market' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dg_tab_mine').setLabel('📦 Của Tôi')
      .setStyle(tab === 'mine' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dg_tab_list').setLabel('➕ Đăng Bán')
      .setStyle(tab === 'list' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dg_refresh').setLabel('🔄').setStyle(ButtonStyle.Secondary),
  );
}

function rowsMarket(rows, page, totalPgs, selId) {
  const comps = [tabRow('market')];

  if (totalPgs > 1) {
    comps.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('dg_prev').setLabel('◀ Trước').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
      new ButtonBuilder().setCustomId('dg_next').setLabel('Sau ▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPgs),
    ));
  }

  if (rows.length) {
    comps.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('dg_sel_auction')
        .setPlaceholder('📋 Chọn phiên để đặt giá...')
        .addOptions(rows.slice(0, 25).map(r => ({
          label: `#${r.id} · ${itemName(r.item_type, r.item_id)} ×${r.item_qty}`.slice(0, 100),
          value: String(r.id),
          description: `${fmt(r.gia_hien)} ${CEu("tult","💠")} · ${r.bidder_name || 'Chưa bid'} · ${hLeft(r)}h còn`.slice(0, 100),
          emoji: LOAI_EMO[r.item_type] || '📦',
          default: r.id === selId,
        })))
    ));
  }

  if (selId) {
    const sel  = rows.find(r => r.id === selId);
    const btns = [
      new ButtonBuilder().setCustomId('dg_bid').setLabel(`${CEu("tia_set","⚡")} Đặt Giá`).setStyle(ButtonStyle.Primary),
    ];
    if (sel?.gia_mua_ngay)
      btns.push(new ButtonBuilder().setCustomId('dg_buynow').setLabel('💨 Mua Ngay').setStyle(ButtonStyle.Success));
    comps.push(new ActionRowBuilder().addComponents(btns));
  }

  return comps;
}

function rowsMine(rows, selId) {
  const comps = [tabRow('mine')];
  if (rows.length) {
    comps.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('dg_sel_mine')
        .setPlaceholder('📦 Chọn phiên của bạn...')
        .addOptions(rows.slice(0, 25).map(r => ({
          label: `#${r.id} · ${itemName(r.item_type, r.item_id)} ×${r.item_qty}`.slice(0, 100),
          value: String(r.id),
          description: `${fmt(r.gia_hien)} ${CEu("tult","💠")} · ${r.bidder_name ? '🔥' + r.bidder_name : 'Chưa bid'} · ${hLeft(r)}h`.slice(0, 100),
          emoji: LOAI_EMO[r.item_type] || '📦',
          default: r.id === selId,
        })))
    ));
    const sel = rows.find(r => r.id === selId);
    if (selId && sel && !sel.bidder_id) {
      comps.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('dg_thu_hoi').setLabel('🗑️ Thu Hồi').setStyle(ButtonStyle.Danger),
      ));
    }
  }
  return comps;
}

function rowsListing(player, selType, selItemId) {
  const comps = [tabRow('list')];

  comps.push(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('dg_sel_type')
      .setPlaceholder('📦 Bước 1: Chọn loại vật phẩm...')
      .addOptions([
        { label: '💊 Đan Dược', value: 'dan_duoc', description: 'Đan dược trong túi (trừ Limited)', emoji: '💊', default: selType === 'dan_duoc' },
        { label: '🌿 Linh Thảo', value: 'linh_thao', description: 'Linh thảo hái/mua được', emoji: '🌿', default: selType === 'linh_thao' },
        { label: '💍 Bảo Bối', value: 'bao_boi', description: 'Bảo bối đang trang bị (trừ Donate)', emoji: '💍', default: selType === 'bao_boi' },
        { label: '🦊 Vật Phẩm', value: 'vat_pham', description: 'Loot từ -san linh thú', emoji: '🦊', default: selType === 'vat_pham' },
      ])
  ));

  if (selType) {
    const items = getBagItems(player, selType).slice(0, 25);
    if (items.length) {
      comps.push(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('dg_sel_item')
          .setPlaceholder(`${CEu('tunt','🎯')} Bước 2: Chọn vật phẩm muốn đăng bán...`)
          .addOptions(items.map(it => ({
            label: `${it.name} ×${it.qty}`.slice(0, 100),
            value: it.id,
            description: `Trong túi: ${it.qty}`,
            emoji: LOAI_EMO[selType] || '📦',
            default: it.id === selItemId,
          })))
      ));
    }
  }

  if (selItemId) {
    comps.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('dg_open_modal').setLabel('📝 Điền Thông Tin & Đăng Bán').setStyle(ButtonStyle.Success),
    ));
  }

  return comps;
}

// ── Modals ────────────────────────────────────────────────────────────────────

function bidModal(auction) {
  const min = Math.ceil(Number(auction.gia_hien) * (1 + MIN_BID));
  return new ModalBuilder()
    .setCustomId('dg_modal_bid')
    .setTitle(`${CE("tia_set","⚡")} Đặt Giá — Phiên #${auction.id}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('bid_amount')
          .setLabel(`Số Linh Thạch muốn trả (min: ${fmt(min)} ${CEu("tult","💠")})`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(String(min))
          .setRequired(true),
      ),
    );
}

function listModal(item) {
  return new ModalBuilder()
    .setCustomId('dg_modal_list')
    .setTitle(`➕ Đăng Bán — ${item.name}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('l_qty').setLabel(`Số lượng (đang có: ${item.qty})`).setStyle(TextInputStyle.Short).setPlaceholder('1').setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('l_gia').setLabel(`Giá khởi điểm (${CEu("tult","💠")} Linh Thạch, tối thiểu 100)`).setStyle(TextInputStyle.Short).setPlaceholder('1000').setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('l_gio').setLabel('Thời gian đấu giá (1–72 giờ)').setStyle(TextInputStyle.Short).setPlaceholder('24').setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('l_mua').setLabel('Giá mua ngay (bỏ trống = chỉ đấu giá)').setStyle(TextInputStyle.Short).setPlaceholder('').setRequired(false),
      ),
    );
}

module.exports = {
  hLeft, auctionLine,
  embedMarket, embedMine, embedListing,
  tabRow, rowsMarket, rowsMine, rowsListing,
  bidModal, listModal,
};
