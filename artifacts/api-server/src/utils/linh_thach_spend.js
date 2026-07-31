'use strict';
/**
 * utils/linh_thach_spend.js
 * Helpers thanh toán Linh Thạch — tự động dùng Thường → Trung → Cao.
 *
 * Tỷ lệ:  5,000 Thường = 1 Trung  |  10 Trung = 1 Cao  (= 50,000 Thường)
 */

const RATE_TRUNG = 5_000;   // thường per Trung
const RATE_CAO   = 50_000;  // thường per Cao

// Ngưỡng để bắt buộc chỉ tiêu Linh Thạch Thường.
// Món đồ giá < ngưỡng này sẽ CHỈ được mua bằng Linh Thạch Thường,
// trừ khi gọi calcSpend(..., { forceMixed: true }) — dùng cho các
// vật phẩm được cho phép tiêu cả Trung/Cao dù giá thấp (VD: 2 túi
// Huyền Không Linh Nang +25kg & Thiên Địa Kiền Khôn Đại Nang +30kg).
const MIXED_SPEND_THRESHOLD = 100_000;

/**
 * Tổng Linh Thạch quy về Thường.
 */
function totalLT(player) {
  return (
    Number(player.linh_thach       || 0) +
    Number(player.linh_thach_trung || 0) * RATE_TRUNG +
    Number(player.linh_thach_cao   || 0) * RATE_CAO
  );
}

/**
 * Tính số dư mới sau khi trả `cost` Thường.
 *
 * - Nếu `cost` < 100.000 và không truyền `forceMixed: true`:
 *   CHỈ được trừ vào Linh Thạch Thường (không tự động quy đổi Trung/Cao).
 * - Nếu `cost` >= 100.000 hoặc `forceMixed: true`:
 *   Dùng chung cả Thường/Trung/Cao như trước (giữ loại cao nhất có thể).
 *
 * @returns {{ newThuong, newTrung, newCao }} hoặc null nếu không đủ.
 */
function calcSpend(player, cost, opts = {}) {
  if (typeof cost !== 'number' || !isFinite(cost) || cost < 0) return null;

  const forceMixed = !!(opts && opts.forceMixed);
  const useMixed = forceMixed || cost >= MIXED_SPEND_THRESHOLD;

  if (!useMixed) {
    const thuong = Number(player.linh_thach || 0);
    if (thuong < cost) return null;
    return {
      newThuong: thuong - cost,
      newTrung: Number(player.linh_thach_trung || 0),
      newCao: Number(player.linh_thach_cao || 0),
    };
  }

  const total = totalLT(player);
  if (total < cost) return null;

  const after   = total - cost;
  const newCao   = Math.floor(after / RATE_CAO);
  const newTrung = Math.floor((after % RATE_CAO) / RATE_TRUNG);
  const newThuong = after % RATE_TRUNG;

  return { newThuong, newTrung, newCao };
}

/**
 * Thanh toán bằng CẢ 3 loại đồng thời (dành cho item hiện 3 loại giá).
 * Ví dụ: cost = 150_000 → trừ 150k Thường VÀ 30 Trung VÀ 3 Cao cùng lúc.
 *
 * @returns {{ newThuong, newTrung, newCao }} hoặc null nếu thiếu bất kỳ loại nào.
 */
function calcMultiSpend(player, cost) {
  if (typeof cost !== 'number' || !isFinite(cost) || cost < 0) return null;
  if (cost === 0) return {
    newThuong: Number(player.linh_thach || 0),
    newTrung:  Number(player.linh_thach_trung || 0),
    newCao:    Number(player.linh_thach_cao || 0),
  };

  const thuong = Number(player.linh_thach       || 0);
  const trung  = Number(player.linh_thach_trung  || 0);
  const cao    = Number(player.linh_thach_cao    || 0);

  const needTrung = Math.ceil(cost / RATE_TRUNG);
  const needCao   = Math.ceil(cost / RATE_CAO);

  if (thuong < cost || trung < needTrung || cao < needCao) return null;

  return {
    newThuong: thuong - cost,
    newTrung:  trung  - needTrung,
    newCao:    cao    - needCao,
  };
}

module.exports = { totalLT, calcSpend, calcMultiSpend, RATE_TRUNG, RATE_CAO, MIXED_SPEND_THRESHOLD };
