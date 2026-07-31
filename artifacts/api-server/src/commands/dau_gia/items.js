'use strict';
const { db } = require('../../db/pool');
const { DAN_DUOC, DAN_PHAM, LINH_THAO, BAO_BOI } = require('../../data');
const { LINH_THU_LOOT_ITEMS } = require('../../data/linh_thu_data');
const { LOAI_EMO } = require('./constants');

function safeId(id) { return /^[a-z0-9_]+$/.test(id); }

function isLimited(type, id) {
  if (type === 'dan_duoc') {
    let base = id;
    for (const g of ['cuc', 'thuong', 'trung', 'ha'])
      if (id.endsWith('_' + g)) { base = id.slice(0, -(g.length + 1)); break; }
    return !!(DAN_DUOC.find(d => d.id === base)?.limited);
  }
  if (type === 'bao_boi') return !!(BAO_BOI.find(b => b.id === id)?.donate_only);
  return false;
}

function itemName(type, id) {
  if (type === 'dan_duoc') {
    for (const g of ['cuc', 'thuong', 'trung', 'ha']) {
      if (id.endsWith('_' + g)) {
        const base = id.slice(0, -(g.length + 1));
        const d    = DAN_DUOC.find(x => x.id === base);
        return d ? `${DAN_PHAM[g]?.ten || g} ${d.ten}` : id;
      }
    }
    return DAN_DUOC.find(d => d.id === id)?.ten || id;
  }
  if (type === 'linh_thao') return LINH_THAO.find(h => h.id === id)?.ten || id;
  if (type === 'bao_boi')   return BAO_BOI.find(b => b.id === id)?.ten   || id;
  if (type === 'vat_pham')  return LINH_THU_LOOT_ITEMS[id]?.ten          || id;
  return id;
}

function getBagItems(player, type) {
  if (type === 'dan_duoc') {
    return Object.entries(player.dan_duoc || {})
      .filter(([id, qty]) => Number(qty) > 0 && !isLimited('dan_duoc', id))
      .map(([id, qty]) => ({ id, qty: Number(qty), name: itemName('dan_duoc', id) }));
  }
  if (type === 'linh_thao') {
    return Object.entries(player.linh_thao || {})
      .filter(([id, qty]) => Number(qty) > 0)
      .map(([id, qty]) => ({ id, qty: Number(qty), name: itemName('linh_thao', id) }));
  }
  if (type === 'bao_boi') {
    const counts = {};
    for (const id of player.bao_boi || []) counts[id] = (counts[id] || 0) + 1;
    return Object.entries(counts)
      .filter(([id]) => !isLimited('bao_boi', id))
      .map(([id, qty]) => ({ id, qty, name: itemName('bao_boi', id) }));
  }
  if (type === 'vat_pham') {
    return Object.entries(player.vat_pham || {})
      .filter(([id, qty]) => Number(qty) > 0)
      .map(([id, qty]) => ({ id, qty: Number(qty), name: itemName('vat_pham', id) }));
  }
  return [];
}

async function deductItem(uid, type, id, qty) {
  if (!safeId(id)) throw new Error('Unsafe item id: ' + id);
  if (type === 'bao_boi') {
    await db(
      `UPDATE players SET bao_boi = (
        SELECT COALESCE(array_agg(elem ORDER BY rn), '{}')
        FROM (
          SELECT elem, row_number() OVER () AS rn,
                 row_number() OVER (PARTITION BY elem ORDER BY row_number() OVER ()) AS dup_rn
          FROM unnest(bao_boi) elem
        ) t
        WHERE NOT (elem = $1 AND dup_rn = 1)
      ) WHERE user_id = $2`,
      [id, uid],
    );
    return;
  }
  await db(
    `UPDATE players SET ${type} = CASE
      WHEN COALESCE((${type}->>'${id}')::int, 0) - $1 <= 0
        THEN ${type} - '${id}'
      ELSE ${type} || jsonb_build_object('${id}', (${type}->>'${id}')::int - $1)
    END WHERE user_id = $2`,
    [qty, uid],
  );
}

async function awardItem(uid, type, id, qty) {
  if (!safeId(id)) throw new Error('Unsafe item id: ' + id);
  if (type === 'bao_boi') {
    const n   = Math.max(1, Number(qty) || 1);
    const arr = Array(n).fill(id);
    await db(
      `UPDATE players SET bao_boi = bao_boi || $1::text[] WHERE user_id = $2`,
      [arr, uid],
    );
    return;
  }
  await db(
    `UPDATE players SET ${type} = ${type} || jsonb_build_object(
      '${id}', COALESCE((${type}->>'${id}')::int, 0) + $1
    ) WHERE user_id = $2`,
    [qty, uid],
  );
}

module.exports = { safeId, isLimited, itemName, getBagItems, deductItem, awardItem };
