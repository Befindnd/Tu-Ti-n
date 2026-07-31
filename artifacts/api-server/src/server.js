'use strict';
/**
 * server.js — MBBank auto-pay polling + HTTP health/admin server
 */
require('dotenv').config();
const express = require('express');
const { db } = require('./db/pool');
const { getPlayer } = require('./db/players');
const { findDonateGoi } = require('./utils');
const { logger } = require('./utils/logger');
const log = logger.child('pay');

// ── Circular log buffer (captures last 300 lines for admin panel) ──────────
const LOG_BUFFER = [];
const LOG_BUFFER_MAX = 300;
const _origLog   = console.log.bind(console);
const _origWarn  = console.warn.bind(console);
const _origError = console.error.bind(console);
function _capture(level, args) {
  const line = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  LOG_BUFFER.push({ ts: Date.now(), level, line });
  if (LOG_BUFFER.length > LOG_BUFFER_MAX) LOG_BUFFER.shift();
}
console.log   = (...a) => { _capture('info',  a); _origLog(...a); };
console.warn  = (...a) => { _capture('warn',  a); _origWarn(...a); };
console.error = (...a) => { _capture('error', a); _origError(...a); };

// ── State ─────────────────────────────────────────────────────────────────
let _client = null;
let _applyRewards = null;
let _mbBank = null;
let _botReady = false;
let _lastPollAt = null;
let _lastPollCount = 0;
let _startedAt = Date.now();

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const POLL_MS = 30_000;

let _errorCount       = 0;
let _backoffUntil     = 0;
let _reloginAttempts  = 0;
const MAX_RELOGIN_ATTEMPTS = 3;
const BACKOFF_BASE_MS      = 60_000;
const BACKOFF_MAX_MS       = 10 * 60_000;

function calcBackoff(errors) {
  const ms = BACKOFF_BASE_MS * Math.pow(2, Math.min(errors - 1, 4));
  return Math.min(ms, BACKOFF_MAX_MS) + Math.random() * 15_000;
}

function genPayCode() {
  let s = 'PAY';
  for (let i = 0; i < 6; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

async function createPendingPayment({ userId, username, guildId, channelId, goiId, amount }) {
  await db(
    "UPDATE pending_payments SET status='expired' WHERE user_id=$1 AND goi_id=$2 AND status='pending'",
    [userId, goiId],
  ).catch(() => {});
  for (let i = 0; i < 10; i++) {
    const payCode = genPayCode();
    try {
      await db(
        `INSERT INTO pending_payments (pay_code, user_id, username, guild_id, channel_id, goi_id, amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [payCode, userId, username, guildId || null, channelId || null, goiId, amount],
      );
      return payCode;
    } catch (e) {
      if (e.code !== '23505') throw e;
    }
  }
  throw new Error('Không tạo được mã thanh toán, thử lại sau.');
}

function padDate(n) { return String(n).padStart(2, '0'); }
function vnDateStr(offsetDays = 0) {
  const ms = Date.now() + 7 * 3600 * 1000 + offsetDays * 86400 * 1000;
  const d  = new Date(ms);
  return `${padDate(d.getUTCDate())}/${padDate(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
function isCloudflareOrAuthError(msg) {
  return (
    msg.includes('login') || msg.includes('token') || msg.includes('auth') ||
    msg.includes('Unexpected token') || msg.includes('is not valid JSON') ||
    msg.includes('<HTML') || msg.includes('<!DOCTYPE') ||
    msg.includes('cloudflare') || msg.includes('challenge') || msg.includes('Just a moment')
  );
}

async function tryRelogin() {
  if (_reloginAttempts >= MAX_RELOGIN_ATTEMPTS) {
    log.warn(`Đã thử re-login ${_reloginAttempts} lần thất bại — tạm dừng.`);
    _reloginAttempts = 0;
    return false;
  }
  _reloginAttempts++;
  try {
    log.info(`Re-login MBBank (lần ${_reloginAttempts}/${MAX_RELOGIN_ATTEMPTS})...`);
    await _mbBank.login();
    log.info('Re-login thành công!');
    _reloginAttempts = 0;
    return true;
  } catch (loginErr) {
    const msg = loginErr.message || '';
    log.error(isCloudflareOrAuthError(msg) ? 'Re-login bị Cloudflare chặn:' : 'Re-login thất bại:', msg.slice(0, 120));
    return false;
  }
}

async function getMBTransactions() {
  if (!_mbBank) return [];
  if (Date.now() < _backoffUntil) {
    const remSec = Math.ceil((_backoffUntil - Date.now()) / 1000);
    log.info(`Đang backoff — còn ${remSec}s trước khi thử lại.`);
    return [];
  }
  try {
    const fromDate = vnDateStr(-1);
    const toDate   = vnDateStr(0);
    log.info(`Poll MB: ${fromDate} → ${toDate}`);
    const result = await _mbBank.getTransactionsHistory({ accountNumber: process.env.MB_ACCOUNT_NO, fromDate, toDate });
    const list = Array.isArray(result) ? result : (result?.transactionHistoryList || []);
    log.info(`Tìm thấy ${list.length} giao dịch`);
    _lastPollAt = Date.now();
    _lastPollCount = list.length;
    _errorCount = 0; _reloginAttempts = 0; _backoffUntil = 0;
    return list;
  } catch (e) {
    const msg = e.message || '';
    _errorCount++;
    const isCF = isCloudflareOrAuthError(msg);
    log.error(`${isCF ? 'Cloudflare/Auth' : 'Lỗi MB'} (lần ${_errorCount}):`, msg.slice(0, 120));
    if (isCF) {
      if (!await tryRelogin()) {
        const backoffMs = calcBackoff(_errorCount);
        _backoffUntil = Date.now() + backoffMs;
        log.warn(`Tạm dừng polling ${Math.round(backoffMs / 1000)}s.`);
      }
    } else if (_errorCount >= 3) {
      const backoffMs = calcBackoff(_errorCount);
      _backoffUntil = Date.now() + backoffMs;
      log.warn(`Backoff ${Math.round(backoffMs / 1000)}s sau ${_errorCount} lỗi.`);
    }
    return [];
  }
}

async function processTransaction(tx) {
  const content = (tx.description || tx.addDescription || tx.remark || tx.transactionDesc || tx.content || '').toUpperCase();
  const txAmount = Number(String(tx.creditAmount || tx.credit_amount || tx.amount || '0').replace(/[^0-9]/g, ''));
  if (txAmount > 0) log.info(`Giao dịch vào: ${txAmount}đ — "${content.slice(0, 80)}"`);

  const m = content.match(/PAY([A-Z0-9]{6})/);
  if (!m) return;
  const payCode = 'PAY' + m[1];
  log.info(`Tìm thấy mã: ${payCode}`);

  const res = await db("SELECT * FROM pending_payments WHERE pay_code=$1 AND status='pending'", [payCode]);
  if (!res.rows?.length) { log.info(`Mã ${payCode} không tìm thấy hoặc đã xử lý`); return; }

  const pay = res.rows[0];
  log.info(`Xác nhận ${payCode} — gói: ${pay.goi_id} | user: ${pay.username} | cần: ${pay.amount}đ | nhận: ${txAmount}đ`);
  if (txAmount < Number(pay.amount)) { log.warn(`Số tiền không đủ: ${txAmount} < ${pay.amount}`); return; }

  const upd = await db("UPDATE pending_payments SET status='paid', paid_at=NOW() WHERE pay_code=$1 AND status='pending' RETURNING id", [payCode]);
  if (!upd.rows?.length) { log.info(`Mã ${payCode} đã xử lý bởi tiến trình khác`); return; }

  const found = findDonateGoi(pay.goi_id);
  if (!found) { log.error(`Không tìm thấy gói donate: ${pay.goi_id}`); return; }
  if (!_applyRewards || !_client) { log.error('_applyRewards hoặc _client chưa sẵn sàng'); return; }

  const { goi } = found;
  const player = await getPlayer(pay.user_id, pay.username);
  if (!player) { log.error(`Không tìm thấy player: ${pay.user_id}`); return; }

  log.info(`Trao hộp donate cho ${pay.username}...`);
  const boxId = `donbox_${pay.goi_id}`;
  await db(
    `UPDATE players SET vat_pham = jsonb_set(COALESCE(vat_pham,'{}'), '{${boxId}}', to_jsonb(COALESCE((vat_pham->>'${boxId}')::int,0)+1)) WHERE user_id=$1`,
    [pay.user_id],
  );
  const results = [`📦 **Hộp ${goi.emoji} ${goi.ten}** đã vào túi vật phẩm!`];
  if (found.cat.lan_dau) {
    try { await db('UPDATE players SET lan_dau_mua=array_append(lan_dau_mua,$1) WHERE user_id=$2', [pay.goi_id, pay.user_id]); } catch {}
  }
  log.info(`✅ ${payCode} → ${pay.username} | ${goi.ten}`);

  const { EmbedBuilder } = require('discord.js');
  try {
    const user = await _client.users.fetch(pay.user_id);
    await user.send({
      embeds: [new EmbedBuilder().setTitle('✅ Thanh Toán Thành Công!').setColor(0x57f287)
        .setDescription([`**Gói:** ${goi.emoji} ${goi.ten}`, `**Mã:** \`${payCode}\``, '', '**Vật phẩm:**', ...results.map(r => `▸ ${r}`), '', '💙 Cảm ơn bạn đã ủng hộ server!'].join('\n')).setTimestamp()],
    });
  } catch {}
  if (pay.channel_id) {
    try {
      const ch = await _client.channels.fetch(pay.channel_id);
      await ch.send({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`✅ <@${pay.user_id}> đã ủng hộ gói **${goi.emoji} ${goi.ten}**! 🎉`)] });
    } catch {}
  }
}

const _seen = new Set();
async function poll() {
  const txList = await getMBTransactions();
  for (const tx of txList) {
    const id = String(tx.refNo || tx.transactionDate + tx.creditAmount);
    if (_seen.has(id)) continue;
    _seen.add(id);
    if (_seen.size > 500) _seen.delete(_seen.values().next().value);
    await processTransaction(tx).catch(e => log.error('Lỗi xử lý tx:', e.message));
  }
}

// ── Admin HTML ─────────────────────────────────────────────────────────────
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tu-Ti-n Admin</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0d0f14;color:#e2e8f0;font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh}
  header{background:#151921;border-bottom:1px solid #2d3748;padding:16px 24px;display:flex;align-items:center;gap:12px}
  header h1{font-size:18px;font-weight:600;color:#e9d5ff}
  header span{font-size:13px;color:#718096}
  .badge{padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600}
  .badge.ok{background:#1a3a2a;color:#68d391}
  .badge.warn{background:#3a2e1a;color:#f6ad55}
  .badge.err{background:#3a1a1a;color:#fc8181}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;padding:20px 24px}
  .card{background:#151921;border:1px solid #2d3748;border-radius:10px;padding:16px}
  .card .label{font-size:11px;color:#718096;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
  .card .value{font-size:22px;font-weight:700;color:#e2e8f0}
  .card .sub{font-size:11px;color:#4a5568;margin-top:4px}
  .card.green{border-color:#276749}
  .card.red{border-color:#742a2a}
  .card.yellow{border-color:#744210}
  .section{padding:0 24px 20px}
  .section h2{font-size:13px;font-weight:600;color:#a0aec0;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}
  .log-box{background:#0a0c10;border:1px solid #2d3748;border-radius:8px;height:460px;overflow-y:auto;padding:10px 12px;font-family:'Cascadia Code','Fira Mono',monospace;font-size:12px;line-height:1.7}
  .log-box .l-info{color:#90cdf4}
  .log-box .l-warn{color:#f6ad55}
  .log-box .l-error{color:#fc8181}
  .log-box .ts{color:#4a5568;margin-right:8px}
  .toolbar{display:flex;gap:8px;margin-bottom:10px;align-items:center}
  button{background:#2d3748;border:none;color:#e2e8f0;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer}
  button:hover{background:#4a5568}
  input[type=text]{background:#1a1f2e;border:1px solid #2d3748;color:#e2e8f0;padding:5px 10px;border-radius:6px;font-size:12px;width:200px}
  .dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}
  .dot.green{background:#68d391}
  .dot.red{background:#fc8181}
  .dot.yellow{background:#f6ad55;animation:pulse 1.5s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  #refresh-bar{height:3px;background:#553c9a;position:fixed;top:0;left:0;transition:width .1s linear}
</style>
</head>
<body>
<div id="refresh-bar" style="width:0%"></div>
<header>
  <span>🐉</span>
  <h1>Tu-Ti-n Admin</h1>
  <span id="last-update">–</span>
  <span id="conn-badge" class="badge warn" style="margin-left:auto">Đang tải...</span>
</header>

<div class="cards" id="cards">
  <div class="card"><div class="label">Bot</div><div class="value" id="bot-status">–</div><div class="sub" id="bot-sub">–</div></div>
  <div class="card"><div class="label">Uptime</div><div class="value" id="uptime">–</div><div class="sub">kể từ khởi động</div></div>
  <div class="card"><div class="label">MBBank</div><div class="value" id="mb-status">–</div><div class="sub" id="mb-sub">–</div></div>
  <div class="card"><div class="label">Poll gần nhất</div><div class="value" id="last-poll">–</div><div class="sub" id="poll-count">–</div></div>
  <div class="card"><div class="label">Backoff</div><div class="value" id="backoff">–</div><div class="sub" id="backoff-sub">–</div></div>
  <div class="card"><div class="label">Logs</div><div class="value" id="log-count">–</div><div class="sub">trong bộ nhớ</div></div>
</div>

<div class="section">
  <h2>Logs</h2>
  <div class="toolbar">
    <input type="text" id="filter" placeholder="Lọc theo từ khóa..." oninput="renderLogs()">
    <button onclick="clearFilter()">Xoá lọc</button>
    <button onclick="togglePause()" id="pause-btn">⏸ Tạm dừng</button>
    <button onclick="scrollToBottom()">⬇ Xuống dưới</button>
    <label style="font-size:12px;color:#718096;margin-left:8px">
      <input type="checkbox" id="auto-scroll" checked style="margin-right:4px">Auto-scroll
    </label>
  </div>
  <div class="log-box" id="log-box"></div>
</div>

<script>
let allLogs = [];
let paused = false;
let progress = 0;
const REFRESH_MS = 5000;

function fmt(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
function fmtUptime(sec) {
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  if (h > 0) return h+'g '+m+'p';
  if (m > 0) return m+'p '+s+'s';
  return s+'s';
}
function clearFilter() { document.getElementById('filter').value=''; renderLogs(); }
function togglePause() {
  paused = !paused;
  document.getElementById('pause-btn').textContent = paused ? '▶ Tiếp tục' : '⏸ Tạm dừng';
}
function scrollToBottom() {
  const b = document.getElementById('log-box');
  b.scrollTop = b.scrollHeight;
}
function renderLogs() {
  const kw = (document.getElementById('filter').value||'').toLowerCase();
  const box = document.getElementById('log-box');
  const wasBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  const lines = allLogs
    .filter(l => !kw || l.line.toLowerCase().includes(kw))
    .map(l => {
      const cls = l.level==='error'?'l-error':l.level==='warn'?'l-warn':'l-info';
      const escaped = l.line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return '<div class="'+cls+'"><span class="ts">'+fmt(l.ts)+'</span>'+escaped+'</div>';
    }).join('');
  box.innerHTML = lines || '<div style="color:#4a5568;padding:8px">Chưa có log.</div>';
  if (wasBottom && document.getElementById('auto-scroll').checked) scrollToBottom();
}

async function fetchStatus() {
  try {
    const r = await fetch('?api=1');
    const d = await r.json();
    document.getElementById('conn-badge').textContent = '● Kết nối';
    document.getElementById('conn-badge').className = 'badge ok';
    document.getElementById('last-update').textContent = 'Cập nhật: '+fmt(Date.now());

    const botEl = document.getElementById('bot-status');
    botEl.textContent = d.bot_ready ? '🟢 Online' : '🔴 Offline';
    document.getElementById('bot-sub').textContent = d.bot_ready ? 'Discord connected' : 'Chưa kết nối';
    document.getElementById('cards').children[0].className = 'card '+(d.bot_ready?'green':'red');

    document.getElementById('uptime').textContent = fmtUptime(d.uptime);
    document.getElementById('mb-status').textContent = d.mb_active ? '🟢 Hoạt động' : '⚪ Tắt';
    document.getElementById('mb-sub').textContent = d.mb_active ? 'Polling MB' : 'Chưa cấu hình';
    document.getElementById('last-poll').textContent = d.last_poll_at ? fmt(d.last_poll_at) : 'Chưa poll';
    document.getElementById('poll-count').textContent = 'Giao dịch: '+d.last_poll_count;
    const bo = d.backoff_until && d.backoff_until > Date.now();
    document.getElementById('backoff').textContent = bo ? '⚠️ Backoff' : '✅ Bình thường';
    document.getElementById('backoff-sub').textContent = bo ? 'Còn '+(Math.ceil((d.backoff_until-Date.now())/1000))+'s' : 'Không có lỗi';
    document.getElementById('cards').children[4].className = 'card '+(bo?'yellow':'green');
    document.getElementById('log-count').textContent = d.log_count;

    if (!paused) {
      allLogs = d.logs || [];
      renderLogs();
    }
  } catch(e) {
    document.getElementById('conn-badge').textContent = '● Mất kết nối';
    document.getElementById('conn-badge').className = 'badge err';
  }
}

function startProgressBar() {
  const bar = document.getElementById('refresh-bar');
  progress = 0;
  clearInterval(window._pbTimer);
  window._pbTimer = setInterval(() => {
    progress += 100 / (REFRESH_MS / 100);
    if (progress >= 100) progress = 100;
    bar.style.width = progress + '%';
  }, 100);
}

fetchStatus();
startProgressBar();
setInterval(() => { fetchStatus(); startProgressBar(); }, REFRESH_MS);
</script>
</body>
</html>`;

// ── Express app ────────────────────────────────────────────────────────────
function startHealthServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Basic auth middleware for /admin routes
  function requireAuth(req, res, next) {
    const adminPwd = process.env.ADMIN_PASSWORD;
    if (!adminPwd) return next(); // no password set → open access (for dev)
    const auth = req.headers['authorization'] || '';
    if (auth.startsWith('Basic ')) {
      const decoded = Buffer.from(auth.slice(6), 'base64').toString();
      const [, pwd] = decoded.split(':');
      if (pwd === adminPwd) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="Tu-Ti-n Admin"');
    res.status(401).send('Unauthorized');
  }

  // Health check (public)
  app.get('/api/healthz', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      bot_ready: _botReady,
      mb_active: !!_mbBank,
    });
  });
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      bot_ready: _botReady,
      mb_active: !!_mbBank,
    });
  });

  // Admin dashboard + API
  app.get('/api/admin', requireAuth, (req, res) => {
    if (req.query.api === '1') {
      return res.json({
        uptime:          Math.floor((Date.now() - _startedAt) / 1000),
        bot_ready:       _botReady,
        mb_active:       !!_mbBank,
        last_poll_at:    _lastPollAt,
        last_poll_count: _lastPollCount,
        backoff_until:   _backoffUntil > Date.now() ? _backoffUntil : null,
        error_count:     _errorCount,
        log_count:       LOG_BUFFER.length,
        logs:            LOG_BUFFER.slice(-200),
      });
    }
    res.send(ADMIN_HTML);
  });

  app.get('/api', (_req, res) => res.send('Tu-Ti-n Bot — <a href="/api/admin">Admin</a>'));
  app.get('/', (_req, res) => res.send('Tu-Ti-n Bot — <a href="/api/admin">Admin</a>'));

  app.listen(PORT, () => {
    log.info(`Health + Admin server on port ${PORT} — /api/health, /api/admin`);
  });
}

// ── Khởi động ─────────────────────────────────────────────────────────────
async function startWebhookServer(client, applyRewardsFn) {
  _client = client;
  _applyRewards = applyRewardsFn;
  _botReady = true;

  const user = process.env.MB_USERNAME;
  const pass = process.env.MB_PASSWORD;
  const acct = process.env.MB_ACCOUNT_NO;

  if (!user || !pass || !acct) {
    log.warn('MB_USERNAME / MB_PASSWORD / MB_ACCOUNT_NO chưa set — auto-pay tắt.');
    return;
  }

  try {
    const { MB } = require('mbbank');
    _mbBank = new MB({ username: user, password: pass });
    await _mbBank.login();
    log.info('MBBank đăng nhập thành công!');
    log.info(`Polling mỗi ${POLL_MS / 1000}s...`);
    poll();
    setInterval(poll, POLL_MS);
  } catch (e) {
    const msg = e.message || '';
    log.error(isCloudflareOrAuthError(msg) ? 'MBBank login bị Cloudflare chặn:' : 'MBBank login thất bại:', msg.slice(0, 120));
  }
}

startHealthServer();

module.exports = { startWebhookServer, createPendingPayment };
