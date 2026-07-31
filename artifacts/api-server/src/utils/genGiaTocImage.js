'use strict';

let createCanvas;
try { ({ createCanvas } = require('@napi-rs/canvas')); } catch (_) {}

const { GIA_TOC } = require('../data');

const DO_QUY_ORDER = ['huyen_thoai', 'su_thi', 'quy', 'thuong', 'pham'];

const DO_QUY_CLR = {
  huyen_thoai: '#FFD700',
  su_thi:      '#CE93D8',
  quy:         '#64B5F6',
  thuong:      '#81C784',
  pham:        '#9E9E9E',
};

const DO_QUY_LABEL = {
  huyen_thoai: 'HUYEN THOAI TOC',
  su_thi:      'SU THI TOC',
  quy:         'QUY TOC',
  thuong:      'THUONG TOC',
  pham:        'PHAM TOC',
};

const DO_QUY_LABEL_VN = {
  huyen_thoai: 'Huyen Thoai',
  su_thi:      'Su Thi',
  quy:         'Quy',
  thuong:      'Thuong',
  pham:        'Pham',
};

// Strip emoji / non-BMP chars so canvas text does not render boxes
function safe(str) {
  if (!str) return '';
  return str
    .replace(/[\u{1F000}-\u{10FFFF}]/gu, '')  // all supplementary (emoji, etc.)
    .replace(/[\u2600-\u27BF]/g, '')           // misc symbols
    .replace(/[\uFE00-\uFE0F]/g, '')           // variation selectors
    .trim();
}

const TOTAL_WEIGHT = GIA_TOC.reduce((s, g) => s + g.weight, 0);

function bonusSummary(gt) {
  const parts = [];
  if (gt.atk_bonus   > 0) parts.push(`ATK +${Math.round(gt.atk_bonus   * 100)}%`);
  if (gt.def_bonus   > 0) parts.push(`DEF +${Math.round(gt.def_bonus   * 100)}%`);
  if (gt.hp_bonus    > 0) parts.push(`HP  +${Math.round(gt.hp_bonus    * 100)}%`);
  if (gt.crit_bonus  > 0) parts.push(`Crit+${Math.round(gt.crit_bonus  * 100)}%`);
  if (gt.tu_vi_bonus > 0) parts.push(`TV  +${Math.round(gt.tu_vi_bonus * 100)}%`);
  return parts.join('   ') || '--';
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Draw a rarity diamond icon instead of emoji
function drawRarityIcon(ctx, cx, cy, clr, size) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = clr;
  ctx.shadowColor = clr;
  ctx.shadowBlur = 8;
  const h = size * 0.7;
  ctx.fillRect(-h / 2, -h / 2, h, h);
  ctx.restore();
}

// Draw a small stat pip row (dots)
function drawStatPips(ctx, x, y, val, max, clr) {
  const pips = 5;
  const r    = 4;
  const gap  = 12;
  for (let i = 0; i < pips; i++) {
    ctx.beginPath();
    ctx.arc(x + i * gap, y, r, 0, Math.PI * 2);
    if (i < Math.round((val / Math.max(max, 1)) * pips)) {
      ctx.fillStyle = clr;
      ctx.shadowColor = clr;
      ctx.shadowBlur = 6;
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.shadowBlur = 0;
    }
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

async function genGiaTocImage(countMap, totalPlayers) {
  if (!createCanvas) return null;

  const W = 1100;
  const HEADER_H  = 115;
  const DIST_H    = 80;
  const SECTION_H = 46;
  const ROW_H     = 72;
  const FOOTER_H  = 50;
  const GAP       = 10;

  let H = HEADER_H + DIST_H;
  for (const dq of DO_QUY_ORDER) {
    const list = GIA_TOC.filter(g => g.do_quy === dq);
    H += SECTION_H + list.length * ROW_H + GAP;
  }
  H += FOOTER_H + 10;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── Background ──────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0,   '#08081c');
  bgGrad.addColorStop(0.5, '#0d0a22');
  bgGrad.addColorStop(1,   '#07071a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Dot grid
  ctx.fillStyle = 'rgba(255,215,0,0.022)';
  for (let gx = 0; gx < W; gx += 40) {
    for (let gy = 0; gy < H; gy += 40) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Gold line gradient (reusable)
  function goldLine() {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0,    'transparent');
    g.addColorStop(0.2,  '#FFD700');
    g.addColorStop(0.8,  '#FFD700');
    g.addColorStop(1,    'transparent');
    return g;
  }

  // ── Header ──────────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,215,0,0.055)';
  ctx.fillRect(0, 0, W, HEADER_H);

  ctx.fillStyle = goldLine();
  ctx.fillRect(0, 0, W, 3);

  // Decorative diamonds in header corners
  drawRarityIcon(ctx, 28,  28, '#FFD700', 18);
  drawRarityIcon(ctx, W - 28, 28, '#FFD700', 18);

  // Title (ASCII-safe)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD700';
  ctx.shadowColor = '#FFD70066';
  ctx.shadowBlur  = 18;
  ctx.font = 'bold 38px "Segoe UI", Arial, sans-serif';
  ctx.fillText('THONG KE GIA TOC TU TIEN', W / 2, 54);
  ctx.shadowBlur = 0;

  const now = new Date().toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  ctx.font      = '16px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(`${totalPlayers} tu si co gia toc  |  ${GIA_TOC.length} gia toc  |  ${now}`, W / 2, 82);

  ctx.fillStyle = goldLine();
  ctx.fillRect(0, HEADER_H - 2, W, 2);

  // ── Distribution Bar ────────────────────────────────────────────────────
  let curY = HEADER_H + 14;
  const barX = 40, barW = W - 80, barH = 24;

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, barX, curY, barW, barH, 12); ctx.fill();

  let bx = barX;
  for (const dq of DO_QUY_ORDER) {
    const list = GIA_TOC.filter(g => g.do_quy === dq);
    const cnt  = list.reduce((s, g) => s + (countMap[g.id] || 0), 0);
    const segW = totalPlayers > 0 ? Math.max((cnt / totalPlayers) * barW, cnt > 0 ? 5 : 0) : 0;
    if (segW > 0) {
      ctx.fillStyle = DO_QUY_CLR[dq];
      ctx.fillRect(bx, curY, segW, barH);
    }
    bx += segW;
  }
  // Rounded overlay to clip corners
  ctx.globalCompositeOperation = 'destination-in';
  roundRect(ctx, barX, curY, barW, barH, 12); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth   = 1;
  roundRect(ctx, barX, curY, barW, barH, 12);
  ctx.stroke();

  curY += barH + 10;

  // Distribution labels
  ctx.font     = '12px "Segoe UI", Arial, sans-serif';
  const lblW   = barW / DO_QUY_ORDER.length;
  for (let i = 0; i < DO_QUY_ORDER.length; i++) {
    const dq   = DO_QUY_ORDER[i];
    const list = GIA_TOC.filter(g => g.do_quy === dq);
    const cnt  = list.reduce((s, g) => s + (countMap[g.id] || 0), 0);
    const pct  = totalPlayers > 0 ? ((cnt / totalPlayers) * 100).toFixed(1) : '0.0';
    const lx   = barX + lblW * (i + 0.5);
    // Small colored dot
    ctx.fillStyle = DO_QUY_CLR[dq];
    ctx.beginPath(); ctx.arc(lx - 28, curY + 8, 5, 0, Math.PI * 2); ctx.fill();
    // Label
    ctx.fillStyle  = DO_QUY_CLR[dq];
    ctx.textAlign  = 'left';
    ctx.fillText(`${DO_QUY_LABEL_VN[dq]}: ${cnt} (${pct}%)`, lx - 20, curY + 13);
  }

  curY += 28;

  // ── Clan Sections ────────────────────────────────────────────────────────
  const maxCount = Math.max(...GIA_TOC.map(g => countMap[g.id] || 0), 1);
  const maxBonus = 0.15; // max possible bonus for pip scale

  for (const dq of DO_QUY_ORDER) {
    const list    = GIA_TOC.filter(g => g.do_quy === dq);
    const clr     = DO_QUY_CLR[dq];
    const dqCnt   = list.reduce((s, g) => s + (countMap[g.id] || 0), 0);
    const dqWt    = list.reduce((s, g) => s + g.weight, 0);
    const dqDrop  = ((dqWt / TOTAL_WEIGHT) * 100).toFixed(1);

    // Section header bg
    ctx.fillStyle = clr + '18';
    ctx.fillRect(0, curY, W, SECTION_H);

    // Left accent bar with gradient
    const accentGrad = ctx.createLinearGradient(0, curY, 0, curY + SECTION_H);
    accentGrad.addColorStop(0, clr);
    accentGrad.addColorStop(1, clr + '44');
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, curY, 5, SECTION_H);

    // Rarity diamond icon
    drawRarityIcon(ctx, 22, curY + SECTION_H / 2, clr, 16);

    // Section title
    ctx.font      = 'bold 15px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = clr;
    ctx.textAlign = 'left';
    ctx.fillText(DO_QUY_LABEL[dq], 36, curY + 18);

    ctx.font      = '12px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(`${list.length} gia toc  |  ${dqCnt} nguoi  |  Drop rate ${dqDrop}%`, 36, curY + 35);

    // Right badge
    ctx.font      = 'bold 13px "Segoe UI", Arial, sans-serif';
    const badge   = ` ${dqCnt} nguoi `;
    const bw      = ctx.measureText(badge).width + 20;
    roundRect(ctx, W - bw - 16, curY + 11, bw, 24, 12);
    ctx.fillStyle = clr + '22'; ctx.fill();
    ctx.strokeStyle = clr + '66'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = clr; ctx.textAlign = 'center';
    ctx.fillText(badge, W - bw / 2 - 16, curY + 27);

    curY += SECTION_H;

    for (let ri = 0; ri < list.length; ri++) {
      const gt    = list[ri];
      const cnt   = countMap[gt.id] || 0;
      const pct   = totalPlayers > 0 ? ((cnt / totalPlayers) * 100).toFixed(1) : '0.0';
      const drop  = ((gt.weight / TOTAL_WEIGHT) * 100).toFixed(1);
      const bonus = bonusSummary(gt);

      // Row bg
      ctx.fillStyle = ri % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, curY, W, ROW_H);

      // Thin left stripe
      ctx.fillStyle = clr + '40';
      ctx.fillRect(0, curY, 3, ROW_H);

      // ── Left: clan number badge + name ──
      // Circle number badge
      const bRadius = 16;
      const bCx = 22, bCy = curY + ROW_H / 2 - 12;
      ctx.fillStyle = clr + '22';
      ctx.beginPath(); ctx.arc(bCx, bCy, bRadius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = clr + '88'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(bCx, bCy, bRadius, 0, Math.PI * 2); ctx.stroke();
      ctx.font      = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = clr;
      ctx.textAlign = 'center';
      ctx.fillText(`${ri + 1}`, bCx, bCy + 5);

      // Clan name (safe, no emoji)
      ctx.font      = 'bold 17px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      const tenSafe = safe(gt.ten);
      ctx.fillText(tenSafe, 48, curY + 24);

      // Rarity badge pill
      ctx.font      = '10px "Segoe UI", Arial, sans-serif';
      const rl      = ` ${safe(gt.do_quy_ten)} `;
      const rlW     = ctx.measureText(rl).width + 6;
      roundRect(ctx, 48, curY + 30, rlW, 16, 8);
      ctx.fillStyle = clr + '22'; ctx.fill();
      ctx.strokeStyle = clr + '55'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = clr; ctx.textAlign = 'center';
      ctx.fillText(rl, 48 + rlW / 2, curY + 42);

      // Bonus text
      ctx.font      = '11px "Courier New", monospace';
      ctx.fillStyle = '#6FE880';
      ctx.textAlign = 'left';
      ctx.fillText(bonus, 48, curY + 62);

      // ── Center: progress bar ──
      const BAR_X = 340, BAR_W = 370, BAR_H_R = 16;
      const barY  = curY + 20;

      // Track
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      roundRect(ctx, BAR_X, barY, BAR_W, BAR_H_R, 8); ctx.fill();

      // Fill with glow
      const filled = cnt > 0 ? Math.max((cnt / maxCount) * BAR_W, 10) : 0;
      if (filled > 0) {
        const fg = ctx.createLinearGradient(BAR_X, 0, BAR_X + filled, 0);
        fg.addColorStop(0, clr + '66');
        fg.addColorStop(1, clr + 'dd');
        ctx.fillStyle = fg;
        ctx.shadowColor = clr; ctx.shadowBlur = 10;
        roundRect(ctx, BAR_X, barY, filled, BAR_H_R, 8); ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Count inside bar (right-align within fill)
      if (cnt > 0 && filled > 30) {
        ctx.font      = 'bold 11px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.textAlign = 'right';
        ctx.fillText(`${cnt}`, BAR_X + filled - 6, barY + 12);
      }

      // Count + pct right of bar
      ctx.font      = 'bold 22px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText(`${cnt}`, BAR_X + BAR_W + 14, barY + 16);
      ctx.font      = '12px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(`${pct}%`, BAR_X + BAR_W + 14, barY + 30);

      // ── Right: drop + bi_phap ──
      const RX = W - 18;
      ctx.textAlign = 'right';

      ctx.font      = 'bold 13px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`Drop: ${drop}%`, RX, curY + 20);

      ctx.font      = '12px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(200,150,255,0.9)';
      const bpSafe  = safe(gt.bi_phap_ten || '--').slice(0, 26);
      ctx.fillText(bpSafe, RX, curY + 38);

      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.font      = '11px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`Yeu cau CG: ${gt.bi_phap_yc}`, RX, curY + 54);

      // Row separator
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(20, curY + ROW_H);
      ctx.lineTo(W - 20, curY + ROW_H);
      ctx.stroke();

      curY += ROW_H;
    }

    curY += GAP;
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,215,0,0.05)';
  ctx.fillRect(0, curY, W, FOOTER_H);
  ctx.fillStyle = goldLine();
  ctx.fillRect(0, curY, W, 2);

  // Decorative diamonds in footer
  drawRarityIcon(ctx, 22, curY + FOOTER_H / 2, '#FFD70088', 12);
  drawRarityIcon(ctx, W - 22, curY + FOOTER_H / 2, '#FFD70088', 12);

  ctx.font      = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.textAlign = 'center';
  ctx.fillText(
    'Tu Tien Bot  |  -thong_ke_gia_toc  |  -gia_toc de xem gia toc cua ban',
    W / 2, curY + 32,
  );

  return canvas.toBuffer('image/png');
}

module.exports = { genGiaTocImage };
