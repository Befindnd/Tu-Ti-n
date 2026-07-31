'use strict';
const { BAO_BOI, VU_KHI, PHU_LUC_DATA, LINH_THAO, DAN_PHAM } = require('../data');
const { LINH_THU_LOOT_ITEMS } = require('../data/linh_thu_data');

const STARTING_WEAPON_ID = 'kiem_go';
const BAG_WEIGHTS = { bi_phap: 0.5 };

function getDanKg(pillKey) {
  for (const grade of ['cuc', 'thuong', 'trung', 'ha']) {
    if (pillKey.endsWith('_' + grade)) return DAN_PHAM[grade]?.kg || 0.5;
  }
  return DAN_PHAM.trung.kg;
}

function getBagCapacity(canhGioi, baoBois = [], bonusKg = 0, tuiNangCap = 0) {
  let capacity;
  if      (canhGioi >= 39) capacity = 500;
  else if (canhGioi >= 38) capacity = 320;
  else if (canhGioi >= 34) capacity = 240;
  else if (canhGioi >= 30) capacity = 175;
  else if (canhGioi >= 26) capacity = 125;
  else if (canhGioi >= 22) capacity = 90;
  else if (canhGioi >= 18) capacity = 60;
  else if (canhGioi >= 14) capacity = 38;
  else if (canhGioi >= 10) capacity = 22;
  else if (canhGioi >= 1)  capacity = 12;
  else                      capacity = 8;

  // Bag items — only the best one counts (no stacking)
  const BAG_KG_ITEMS = [
    { id: 'van_bao_tui',           kg: 10 },
    { id: 'tui_da_thu',            kg: 18 },
    { id: 'huyen_khong_linh_nang', kg: 25 },
    { id: 'thien_dia_dai_nang',    kg: 30 },
  ];
  if (Array.isArray(baoBois)) {
    let bestKg = 0;
    for (const b of BAG_KG_ITEMS) {
      if (baoBois.includes(b.id) && b.kg > bestKg) bestKg = b.kg;
    }
    capacity += bestKg;
  }
  capacity += Number(bonusKg) || 0;
  capacity += 2 * (Number(tuiNangCap) || 0);
  return Math.round(100 * capacity) / 100;
}

function calcBagWeight(player) {
  let weight = 0;

  for (const [id, qty] of Object.entries(player.linh_thao || {})) {
    const herb = LINH_THAO.find((h) => h.id === id);
    weight += Math.max(0, Number(qty)) * (herb?.kg || 0.3);
  }

  for (const [pillKey, qty] of Object.entries(player.dan_duoc || {})) {
    if (qty) weight += Math.max(0, Number(qty)) * getDanKg(pillKey);
  }

  weight += (player.bi_phap || []).length * BAG_WEIGHTS.bi_phap;

  for (const baoBoiId of player.bao_boi || []) {
    const item = BAO_BOI.find((b) => b.id === baoBoiId);
    weight += item?.kg || 2;
  }

  for (const [id, qty] of Object.entries(player.phu_luc || {})) {
    const item = PHU_LUC_DATA.find((p) => p.id === id);
    weight += Math.max(0, Number(qty)) * (item?.kg || 0.1);
  }

  if (player.vu_khi && player.vu_khi !== STARTING_WEAPON_ID) {
    const weapon = VU_KHI.find((w) => w.id === player.vu_khi);
    weight += weapon?.kg || 3;
  }

  for (const [id, qty] of Object.entries(player.vat_pham || {})) {
    const item = LINH_THU_LOOT_ITEMS[id];
    weight += Math.max(0, Number(qty)) * (item?.kg || 0.5);
  }

  weight += Math.floor(Number(player.linh_thach || 0) / 1_000);
  weight += Number(player.linh_thach_trung || 0) * 1;   // 1 Linh Thạch Trung = 1 kg
  weight += Number(player.linh_thach_cao   || 0) * 5;   // 1 Linh Thạch Cao   = 5 kg
  return Math.round(10 * weight) / 10;
}

function canAddToBag(player, itemType, qty = 1, itemId = null) {
  const capacity = getBagCapacity(
    player.canh_gioi || 0,
    player.bao_boi || [],
    player.bag_bonus_kg || 0,
    player.tui_nang_cap || 0,
  );
  const currentWeight = calcBagWeight(player);
  let addedWeight = 0;

  if (itemType === 'bi_phap') {
    addedWeight = qty * BAG_WEIGHTS.bi_phap;
  } else if (itemType === 'linh_thao') {
    const herb = itemId ? LINH_THAO.find((h) => h.id === itemId) : null;
    addedWeight = qty * (herb?.kg || 0.6);
  } else if (itemType === 'dan_duoc') {
    addedWeight = qty * (itemId ? getDanKg(itemId) : DAN_PHAM.trung.kg);
  } else if (itemType === 'bao_boi') {
    const item = itemId ? BAO_BOI.find((b) => b.id === itemId) : null;
    addedWeight = item?.kg || 4;
  } else if (itemType === 'vu_khi') {
    const weapon = itemId ? VU_KHI.find((w) => w.id === itemId) : null;
    addedWeight = weapon?.kg || 4;
  } else if (itemType === 'phu_luc') {
    const item = itemId ? PHU_LUC_DATA.find((p) => p.id === itemId) : null;
    addedWeight = qty * (item?.kg || 0.2);
  } else if (itemType === 'vat_pham') {
    const item = itemId ? LINH_THU_LOOT_ITEMS[itemId] : null;
    addedWeight = qty * (item?.kg || 0.5);
  }

  return currentWeight + addedWeight <= capacity;
}

function calcMaxLinhThach(player, amount, extraFreeKg = 0) {
  if (!amount || amount <= 0) return 0;
  const capacity = getBagCapacity(
    player.canh_gioi || 0,
    player.bao_boi   || [],
    player.bag_bonus_kg || 0,
    player.tui_nang_cap || 0,
  );
  const currentWeight = calcBagWeight(player);
  // extraFreeKg: kg được giải phóng khi mở hộp (hộp bị xóa khỏi túi)
  const freeKg = Math.max(0, capacity - currentWeight + extraFreeKg);
  // 1.000 Linh Thạch = 1 kg
  const maxByWeight = Math.floor(freeKg * 1_000);
  return Math.max(0, Math.min(Math.floor(amount), maxByWeight));
}

// 1 Linh Thạch Trung = 1 kg
function calcMaxLinhThachTrung(player, amount) {
  if (!amount || amount <= 0) return 0;
  const capacity = getBagCapacity(
    player.canh_gioi || 0,
    player.bao_boi   || [],
    player.bag_bonus_kg || 0,
    player.tui_nang_cap || 0,
  );
  const freeKg = Math.max(0, capacity - calcBagWeight(player));
  return Math.max(0, Math.min(Math.floor(amount), Math.floor(freeKg)));
}

// 1 Linh Thạch Cao = 5 kg
function calcMaxLinhThachCao(player, amount) {
  if (!amount || amount <= 0) return 0;
  const capacity = getBagCapacity(
    player.canh_gioi || 0,
    player.bao_boi   || [],
    player.bag_bonus_kg || 0,
    player.tui_nang_cap || 0,
  );
  const freeKg = Math.max(0, capacity - calcBagWeight(player));
  return Math.max(0, Math.min(Math.floor(amount), Math.floor(freeKg / 5)));
}

module.exports = { BAG_WEIGHTS, getDanKg, getBagCapacity, calcBagWeight, canAddToBag, calcMaxLinhThach, calcMaxLinhThachTrung, calcMaxLinhThachCao };
