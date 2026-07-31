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
  _on     = true;
  _reason = reason;
  await db(
    `INSERT INTO bot_settings(key,value) VALUES($1,$2::jsonb)
     ON CONFLICT(key) DO UPDATE SET value=$2::jsonb`,
    ['maintenance', JSON.stringify({ on: true, reason })],
  ).catch(() => {});
}

async function disable() {
  _on     = false;
  _reason = '';
  await db(
    `INSERT INTO bot_settings(key,value) VALUES($1,$2::jsonb)
     ON CONFLICT(key) DO UPDATE SET value=$2::jsonb`,
    ['maintenance', JSON.stringify({ on: false, reason: '' })],
  ).catch(() => {});
}

module.exports = {
  isOn:      () => _on,
  getReason: () => _reason,
  load,
  enable,
  disable,
};
