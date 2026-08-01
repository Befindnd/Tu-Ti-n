'use strict';
const { db } = require('../db/pool');

let _on = false;
let _reason = '';

async function load() {
  try {
    const res = await db(`SELECT value FROM bot_settings WHERE key=$1`, ['maintenance']);
    if (res.rows.length > 0) {
      const data = res.rows[0].value;
      _on  = data.on     || false;
      _reason = data.reason || '';
    }
  } catch (_) {}
}

async function enable(reason = '') {
  try {
    await db(
      `INSERT INTO bot_settings(key,value) VALUES($1,$2::jsonb)
       ON CONFLICT(key) DO UPDATE SET value=$2::jsonb`,
      ['maintenance', JSON.stringify({ on: true, reason })],
    );
    // Chỉ cập nhật memory sau khi DB thành công
    _on     = true;
    _reason = reason;
  } catch (err) {
    // Memory không thay đổi — tránh trạng thái không đồng bộ
    throw new Error(`Bật maintenance thất bại (DB error): ${err.message}`);
  }
}

async function disable() {
  try {
    await db(
      `INSERT INTO bot_settings(key,value) VALUES($1,$2::jsonb)
       ON CONFLICT(key) DO UPDATE SET value=$2::jsonb`,
      ['maintenance', JSON.stringify({ on: false, reason: '' })],
    );
    // Chỉ cập nhật memory sau khi DB thành công
    _on     = false;
    _reason = '';
  } catch (err) {
    throw new Error(`Tắt maintenance thất bại (DB error): ${err.message}`);
  }
}

module.exports = {
  isOn:      () => _on,
  getReason: () => _reason,
  load,
  enable,
  disable,
};
