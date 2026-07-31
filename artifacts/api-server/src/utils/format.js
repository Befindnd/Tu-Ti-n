'use strict';
/**
 * utils/format.js
 * Formatting helpers. Uses a lazy require of emoji.js (no circular dep —
 * emoji.js never imports format.js) so fmtLT can return custom emoji after
 * initCustomEmoji has run. Safe to call before init; falls back to Unicode.
 */
const { CANH_GIOI } = require('../data');

/** Shorten large numbers: 1_500 → "1.5k", 2_000_000 → "2.00triệu" */
const fmt = (n) => {
  n = Number(n);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'triệu';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return n.toString();
};

/** Resolve a Canh Gioi record by index (clamps to last entry). */
const getCG = (n) => CANH_GIOI[n] || CANH_GIOI[CANH_GIOI.length - 1];

/** 10-block ASCII progress bar for 0–100 percentage. */
const pBar = (pct) => {
  const filled = Math.min(10, Math.max(0, Math.floor(pct / 10)));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
};

/** Format seconds → "1h 30p", "45p 10s", or "10s". */
const fTime = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}h ${m}p` : m > 0 ? `${m}p ${s}s` : `${s}s`;
};

/** Remaining seconds on an hour-based cooldown. Returns 0 when expired. */
const cdRem = (startTs, hours) => {
  const remaining = 3600 * hours - (Date.now() - Number(startTs || 0)) / 1e3;
  return remaining > 0 ? Math.ceil(remaining) : 0;
};

/** Remaining seconds on a minute-based cooldown. Returns 0 when expired. */
const cdRemMin = (startTs, minutes) => {
  const remaining = 60 * minutes - (Date.now() - Number(startTs || 0)) / 1e3;
  return remaining > 0 ? Math.ceil(remaining) : 0;
};

/** Discord embed accent colour keyed by Canh Gioi index. */
const embedClr = (canhGioi) => {
  if (canhGioi >= 38) return 16766720; // gold
  if (canhGioi >= 30) return 10181046; // purple
  if (canhGioi >= 22) return 15158332; // red
  if (canhGioi >= 14) return 3447003;  // blue
  if (canhGioi >= 10) return 3066993;  // green
  return 9807270;                       // grey
};

// ── Decorative separators ─────────────────────────────────────────────────
const SEP  = '─────────────────────────────';
const SEP2 = '✦ ══════════════════════════ ✦';
const SEP3 = '· · · · · · · · · · · · · · ·';

/**
 * Format a Linh Thạch price showing each denomination separately.
 *   💠 Thường  — giá gốc
 *   🔮 Trung   — ceil(gia / 5_000)
 *   💚 Cao     — ceil(gia / 50_000)
 *
 * e.g. 300_000 → "300k💠 | 60🔮 | 6💚"
 *        8_000 → "8k💠 | 2🔮 | 1💚"
 *       20_000 → "20k💠 | 4🔮 | 1💚"
 *          500 → "500💠"
 *       0/null → "Miễn phí"
 */
const RATE_TRUNG_FULL = 5_000;   // 5,000 thường = 1 Trung
const RATE_CAO_FULL   = 50_000;  // 10 Trung × 5,000 = 1 Cao

// Phải khớp với MIXED_SPEND_THRESHOLD trong utils/linh_thach_spend.js:
// giá < ngưỡng này chỉ bị trừ Linh Thạch Thường (trừ khi forceMixed),
// nên không hiển thị quy đổi Trung/Cao gây hiểu nhầm là sẽ bị trừ.
const { MIXED_SPEND_THRESHOLD } = require('./linh_thach_spend');

/**
 * @param {number} gia
 * @param {boolean} [forceMixed] - true nếu món đồ này thực sự có thể bị trừ
 *   Trung/Cao dù giá < ngưỡng (VD: 2 túi Huyền Không/Thiên Địa Kiền Khôn).
 */
const fmtLT = (gia, forceMixed = false) => {
  gia = Number(gia);
  if (!gia || gia <= 0) return 'Miễn phí';
  const { CE } = require('../systems/emoji');
  const e1 = CE('tult', '💠'), e2 = CE('tult_trung', '🔮'), e3 = CE('tult_cao', '💚');
  const base  = fmt(gia) + e1;
  if (gia < RATE_TRUNG_FULL) return base;
  if (gia < MIXED_SPEND_THRESHOLD && !forceMixed) return base;
  const trung = Math.ceil(gia / RATE_TRUNG_FULL);
  const cao   = Math.ceil(gia / RATE_CAO_FULL);
  return `${base} và ${trung}${e2} và ${cao}${e3}`;
};

/** Compact variant for Discord select-menu descriptions (100-char limit).
 *  Always uses plain Unicode emoji (NOT custom CE strings) to stay well
 *  under 100 chars — custom emoji like <:tult:1522555610489421854> are
 *  ~28 chars each and would push descriptions over Discord's limit.
 */
const fmtLTShort = (gia, forceMixed = false) => {
  gia = Number(gia);
  if (!gia || gia <= 0) return 'Miễn phí';
  const base  = fmt(gia) + '💠';
  if (gia < RATE_TRUNG_FULL) return base;
  if (gia < MIXED_SPEND_THRESHOLD && !forceMixed) return base;
  const trung = Math.ceil(gia / RATE_TRUNG_FULL);
  const cao   = Math.ceil(gia / RATE_CAO_FULL);
  return `${base}+${trung}🔮+${cao}💚`;
};

/**
 * Returns a Discord relative timestamp string <t:UNIX:R> that auto-counts down
 * in the Discord client — no static text needed.
 * @param {number|string} startTs  Millisecond timestamp when the CD started
 * @param {number}        hours    CD duration in hours
 */
const cdTs = (startTs, hours) => {
  const expiryUnix = Math.floor((Number(startTs || 0) + hours * 3_600_000) / 1000);
  return `<t:${expiryUnix}:R> (lúc <t:${expiryUnix}:t>)`;
};

/**
 * Like cdTs but duration is in minutes.
 * @param {number|string} startTs   Millisecond timestamp when the CD started
 * @param {number}        minutes   CD duration in minutes
 */
const cdTsMin = (startTs, minutes) => {
  const expiryUnix = Math.floor((Number(startTs || 0) + minutes * 60_000) / 1000);
  return `<t:${expiryUnix}:R> (lúc <t:${expiryUnix}:t>)`;
};

module.exports = { fmt, fmtLT, fmtLTShort, getCG, pBar, fTime, cdRem, cdRemMin, cdTs, cdTsMin, embedClr, SEP, SEP2, SEP3 };
