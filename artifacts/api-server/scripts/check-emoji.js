#!/usr/bin/env node
/**
 * scripts/check-emoji.js
 * Quét toàn bộ src/ để tìm chỗ dùng unicode emoji "cứng" (vd 💠) thay vì gọi
 * CE('key', '💠') cho những emoji đã có ảnh custom thật (đăng ký trong các
 * mảng *_IMG_DEFS ở systems/emoji.js). Nếu không gọi CE(), emoji đó sẽ luôn
 * hiện icon Unicode chung thay vì ảnh custom đã upload lên Discord.
 *
 * Tự động đọc danh sách emoji từ systems/emoji.js — không cần sửa script
 * này khi thêm emoji/ảnh mới, chỉ cần thêm đúng vào *_IMG_DEFS.
 *
 * Chạy: node scripts/check-emoji.js  (hoặc `npm run check-emoji`)
 * Thoát mã 1 nếu tìm thấy vi phạm — dùng trước khi commit/push.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EMOJI_FILE = path.join(ROOT, 'src/systems/emoji.js');
const SCAN_DIR = path.join(ROOT, 'src');
const SKIP_DIRS = new Set(['node_modules', '.git']);

// ── 1. Trích xuất CUSTOM_EMOJI map (key -> fallback unicode) ────────────────
function extractCustomEmojiMap(src) {
  const m = src.match(/const CUSTOM_EMOJI = \{([\s\S]*?)\n\};/);
  if (!m) throw new Error('Không tìm thấy CUSTOM_EMOJI map trong emoji.js');
  const body = m[1];
  const map = {};
  const re = /([a-zA-Z0-9_]+)\s*:\s*'((?:[^'\\]|\\.)*)'/g;
  let mm;
  while ((mm = re.exec(body))) map[mm[1]] = mm[2];
  return map;
}

// ── 2. Trích xuất tên key nào thực sự có ảnh upload (trong *_IMG_DEFS) ──────
function extractImageBackedKeys(src) {
  const keys = new Set();
  const re = /\{\s*name:\s*["']([a-zA-Z0-9_]+)["']\s*,\s*file:\s*["'][^"']+["']\s*\}/g;
  let mm;
  while ((mm = re.exec(src))) keys.add(mm[1]);
  return keys;
}

const emojiSrc = fs.readFileSync(EMOJI_FILE, 'utf8');
const customEmojiMap = extractCustomEmojiMap(emojiSrc);
const imageBackedKeys = extractImageBackedKeys(emojiSrc);

// PHẠM VI: chỉ theo dõi 3 loại tiền tệ Linh Thạch (Thường/Trung/Cao) —
// đây là bug đã xảy ra thực tế (💠 bị hardcode ở hàng chục chỗ). Cố tình
// KHÔNG mở rộng ra toàn bộ 100+ emoji trong CUSTOM_EMOJI (vũ khí, linh thú,
// tông môn, tâm trạng...) vì phần lớn trong số đó chỉ là icon trang trí cho
// dữ liệu tĩnh (data/*.js) chứ không phải bug — quét hết sẽ ra hàng nghìn
// "vi phạm" giả, khiến script vô dụng làm cổng kiểm tra trước khi commit.
// Muốn theo dõi thêm loại tiền tệ mới thì thêm key vào đây.
const CURRENCY_KEYS = ['tult', 'tult_trung', 'tult_cao'];

const unicodeToKeys = {};
for (const key of CURRENCY_KEYS) {
  if (!customEmojiMap[key]) continue;
  if (!imageBackedKeys.has(key)) continue; // chưa có ảnh upload thì chưa thể "thiếu" ảnh
  const unicode = customEmojiMap[key];
  (unicodeToKeys[unicode] ||= []).push(key);
}
const watchedUnicodes = Object.keys(unicodeToKeys);

if (watchedUnicodes.length === 0) {
  console.log('⚠️  Không tìm thấy emoji nào có ảnh upload trong *_IMG_DEFS — bỏ qua kiểm tra.');
  process.exit(0);
}

// ── 3. Các ngữ cảnh AN TOÀN được phép dùng unicode thô ──────────────────────
// Discord KHÔNG render custom emoji tag <:name:id> trong các vị trí này,
// nên unicode thô là lựa chọn ĐÚNG, không phải bug.
const SAFE_CONTEXT_PATTERNS = [
  /\.setFooter\s*\(/,
  /\.setLabel\s*\(/,
  /\.setPlaceholder\s*\(/,
  /description\s*:/,      // select-menu option description
  /footer\s*=/,           // biến footer chỉ dùng cho .setFooter()
  /footer\s*\|\|/,
  /CEu\s*\(/,             // đã cố ý dùng bản Unicode-only hợp lệ
];

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

function isSafeContext(line) {
  if (isCommentLine(line)) return true;
  return SAFE_CONTEXT_PATTERNS.some((re) => re.test(line));
}

// Nếu dòng đã gọi CE('key', 'emoji') với đúng emoji đó thì literal xuất hiện
// lại bên trong lời gọi là hợp lệ (chính là tham số fallback), không phải bug.
function hasMatchingCECall(line, unicode) {
  const re = new RegExp(`CE\\(\\s*["'][a-zA-Z0-9_]+["']\\s*,\\s*["']${escapeRegex(unicode)}["']\\s*\\)`);
  return re.test(line);
}
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── 4. Quét file ─────────────────────────────────────────────────────────────
let violations = 0;
let scanned = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.name.endsWith('.js')) continue;
    if (full === EMOJI_FILE) continue; // định nghĩa gốc, không tự kiểm tra chính nó
    scanFile(full);
  }
}

function scanFile(filePath) {
  scanned++;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const unicode of watchedUnicodes) {
      if (!line.includes(unicode)) continue;
      if (isSafeContext(line)) continue;
      if (hasMatchingCECall(line, unicode)) continue;
      violations++;
      const keys = unicodeToKeys[unicode].join(' | ');
      console.error(`⚠️  ${path.relative(ROOT, filePath)}:${i + 1} — dùng "${unicode}" trực tiếp thay vì CE('${unicodeToKeys[unicode][0]}', '${unicode}') (key khả dụng: ${keys})`);
      console.error(`    ${line.trim().slice(0, 140)}`);
    }
  });
}

walk(SCAN_DIR);

console.log(`\n🔍 Đã quét ${scanned} file, theo dõi ${watchedUnicodes.length} emoji có ảnh custom.`);
if (violations > 0) {
  console.error(`❌ Phát hiện ${violations} chỗ dùng emoji unicode cứng thay vì CE() — sẽ không hiện ảnh custom trên Discord.`);
  console.error(`   Sửa bằng cách bọc: CE('key', '${watchedUnicodes[0]}') thay vì viết thẳng '${watchedUnicodes[0]}'.`);
  console.error(`   (Bỏ qua nếu là .setFooter()/.setLabel()/.setPlaceholder()/select description — Discord không render custom emoji ở đó.)`);
  process.exit(1);
} else {
  console.log('✅ Không phát hiện emoji custom nào bị hardcode sai chỗ.');
}
