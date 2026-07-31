'use strict';
/**
 * db/pool.js
 * PostgreSQL connection pool singleton.
 *
 * All other db/ modules and any code that needs raw DB access should
 * import { pool, db, dbTx } from here rather than creating their own Pool.
 */
require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ THIẾU DATABASE_URL! Thêm vào Environment Variables.');
  process.exit(1);
}

/** Shared pg Pool instance. */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Bắt lỗi idle client để tránh crash khi DB connection ngắt tạm thời
pool.on('error', (err) => {
  console.error('[pool] Idle client error (non-fatal):', err.message);
});

/**
 * Execute a single SQL query and release the connection automatically.
 * @param {string}   sql      Parameterised SQL string
 * @param {any[]}    [params] Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function db(sql, params) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries atomically inside a transaction.
 * If the callback throws, the transaction is rolled back automatically.
 *
 * @param {(client: import('pg').PoolClient) => Promise<any>} callback
 * @returns {Promise<any>} Return value of the callback
 *
 * @example
 * await dbTx(async (tx) => {
 *   await tx.query('UPDATE players SET linh_thach=linh_thach-$1 WHERE user_id=$2', [cost, userId]);
 *   await tx.query('UPDATE players SET item=item+$1 WHERE user_id=$2', [1, userId]);
 * });
 */
async function dbTx(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, db, dbTx };
