#!/usr/bin/env node
/**
 * scripts/check-secrets.js
 * Quét toàn bộ source code (src/, config gốc) để tìm token/secret bị
 * gõ cứng nhầm vào code (Discord bot token, GitHub PAT, AWS key, v.v).
 * Chạy: node scripts/check-secrets.js  (hoặc `npm run check-secrets`)
 * Thoát mã 1 nếu tìm thấy nghi vấn — dùng trước khi commit/push.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['src'].map((d) => path.join(ROOT, d));
const SKIP_DIRS = new Set(['node_modules', '.git']);

// Các mẫu token phổ biến — không khớp biến process.env.XXX, chỉ khớp giá trị thật bị dán nhầm.
const PATTERNS = [
  { name: 'Discord bot token', re: /[MN][A-Za-z\d]{23,26}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,38}/ },
  { name: 'GitHub token (classic/fine-grained)', re: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Generic long hex/base64 secret assigned to a var named *token/*key/*secret', re: /(token|secret|apikey|api_key)\s*[:=]\s*["'][A-Za-z0-9_\-./+=]{24,}["']/i },
];

let findings = 0;
let scanned = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!/\.(js|json|ts|env)$/.test(entry.name) && entry.name !== '.env') continue;
    scanFile(full);
  }
}

function scanFile(filePath) {
  scanned++;
  const src = fs.readFileSync(filePath, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    for (const { name, re } of PATTERNS) {
      if (re.test(line)) {
        findings++;
        console.error(`⚠️  ${name} nghi ngờ tại ${path.relative(ROOT, filePath)}:${i + 1}`);
        console.error(`    ${line.trim().slice(0, 120)}`);
      }
    }
  });
}

for (const dir of SCAN_DIRS) walk(dir);

// Cảnh báo nếu có file .env thực sự nằm trong thư mục dự án (không nên commit).
const envCandidates = ['.env', '.env.local', '.env.production'].map((f) => path.join(ROOT, f));
for (const f of envCandidates) {
  if (fs.existsSync(f)) {
    findings++;
    console.error(`⚠️  Tìm thấy file ${path.relative(ROOT, f)} trong thư mục dự án — đảm bảo nó có trong .gitignore và KHÔNG được commit lên GitHub!`);
  }
}

console.log(`\n🔍 Đã quét ${scanned} file.`);
if (findings > 0) {
  console.error(`❌ Phát hiện ${findings} nghi vấn lộ secret. Kiểm tra lại trước khi commit/push!`);
  process.exit(1);
} else {
  console.log('✅ Không phát hiện token/secret bị hardcode trong source code.');
}
