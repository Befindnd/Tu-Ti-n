'use strict';

/**
 * Tông Môn domain service.
 *
 * The legacy bot stored membership directly on players.tong_mon.  New code
 * should use sect_members as the source of truth and only mirror the legacy
 * columns while older commands are still being phased out.
 */
const { db } = require('../db/pool');

const ROLE_POWER = Object.freeze({
  member: 0,
  elder: 1,
  deputy: 2,
  leader: 3,
});

const ROLE_LABELS = Object.freeze({
  member: 'Đệ Tử',
  elder: 'Trưởng Lão',
  deputy: 'Phó Tông Chủ',
  leader: 'Tông Chủ',
});

function rolePower(role) {
  return ROLE_POWER[role] ?? ROLE_POWER.member;
}

function roleLabel(role) {
  return ROLE_LABELS[role] || ROLE_LABELS.member;
}

function canManage(role) {
  return rolePower(role) >= ROLE_POWER.deputy;
}

function canManageMembers(role) {
  return rolePower(role) >= ROLE_POWER.elder;
}

function normalizeSectName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function normalizeUserId(value) {
  return String(value || '').replace(/[<@!>]/g, '').trim();
}

async function getMembership(userId) {
  const result = await db(
    `SELECT
       sm.id AS membership_id,
       sm.sect_id,
       sm.user_id,
       sm.username,
       sm.role,
       sm.contribution,
       sm.joined_at,
       s.name,
       s.leader_name,
       s.slogan,
       s.level,
       s.level_xp,
       s.spirit_treasury,
       s.total_contribution,
       s.max_members,
       s.join_policy,
       s.formation_level,
       s.formation_durability,
       s.max_formation_durability,
       s.pk_points,
       s.wars_won,
       s.wars_lost,
       s.leader_id
     FROM sect_members sm
     JOIN sects s ON s.id = sm.sect_id
     WHERE sm.user_id = $1 AND sm.status = 'active'
     LIMIT 1`,
    [userId],
  );
  return result.rows[0] || null;
}

async function getSectByName(name) {
  const normalized = normalizeSectName(name);
  if (!normalized) return null;
  const result = await db(
    'SELECT * FROM sects WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [normalized],
  );
  return result.rows[0] || null;
}

async function getPendingRequest(userId) {
  const result = await db(
    `SELECT r.*, s.name AS sect_name
     FROM sect_join_requests r
     JOIN sects s ON s.id = r.sect_id
     WHERE r.user_id = $1 AND r.status = 'pending'
     ORDER BY r.created_at DESC
     LIMIT 1`,
    [userId],
  );
  return result.rows[0] || null;
}

async function recordTreasuryLog(client, {
  sectId,
  userId = null,
  type,
  amount,
  balanceAfter,
  reason,
}) {
  await client.query(
    `INSERT INTO sect_treasury_logs
      (sect_id, user_id, type, amount, balance_after, reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sectId, userId, type, amount, balanceAfter, reason],
  );
}

module.exports = {
  ROLE_POWER,
  ROLE_LABELS,
  rolePower,
  roleLabel,
  canManage,
  canManageMembers,
  normalizeSectName,
  normalizeUserId,
  getMembership,
  getSectByName,
  getPendingRequest,
  recordTreasuryLog,
};