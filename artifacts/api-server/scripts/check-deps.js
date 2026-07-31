#!/usr/bin/env node
/**
 * scripts/check-deps.js
 * Pre-deploy check: scan all .js files under src/ and verify
 * that every local require('./...') resolves to an existing file.
 * Exits 1 if any missing dependency is found.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
let errors = 0;
let checked = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.name.endsWith('.js')) continue;
    checkFile(full);
  }
}

function checkFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const matches = src.matchAll(/require\(['"](\.[^'"]+)['"]\)/g);
  for (const m of matches) {
    const dep = m[1];
    const resolved = resolveLocal(filePath, dep);
    checked++;
    if (!resolved) {
      const rel = path.relative(SRC_DIR, filePath);
      console.error(`❌ MISSING: ${rel} → require('${dep}')`);
      errors++;
    }
  }
}

function resolveLocal(from, dep) {
  const base = path.resolve(path.dirname(from), dep);
  const candidates = [base, base + '.js', path.join(base, 'index.js')];
  return candidates.find(c => {
    try { return fs.statSync(c).isFile(); } catch { return false; }
  }) || null;
}

walk(SRC_DIR);

if (errors > 0) {
  console.error(`\n💥 ${errors} missing local require(s) found — aborting deploy!`);
  console.error('Fix the missing files before deploying.\n');
  process.exit(1);
} else {
  console.log(`✅ check-deps passed: ${checked} local require(s) verified, 0 missing.`);
}
