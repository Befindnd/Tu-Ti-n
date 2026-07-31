'use strict';
/**
 * core/antiraid.js
 * Anti-raid protections — thiết kế cho bot hoạt động trên nhiều server.
 *
 *  1. Per-guild burst detector    — bắt flood lệnh từ nhiều acc cùng lúc.
 *  2. Escalating per-user lockout — bắt script/macro spam vượt cooldown.
 *  3. New-account guard           — chặn acc mới tạo dùng giftcode/đấu giá.
 *  4. Join-burst detector         — bắt mass-join raids, tự timeout/kick kẻ tấn công.
 *  5. Young-account burst         — bắt nhóm acc mới tạo join dồn dập (botfarm)
 *                                   ngay cả khi số lượng chưa đạt ngưỡng join-burst.
 *  6. Mention spam detector       — bắt spam @everyone / mass-ping trong tin nhắn.
 *
 * Toàn bộ state là in-memory, tự prune mỗi 60 giây — không cần DB.
 * Mỗi giá trị cấu hình có biến môi trường ANTIRAID_* tương ứng.
 */
const ADMIN_ID = process.env.ADMIN_ID || '';

function envNum(key, def) {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

/** Mutable runtime config — tunable qua setConfig() hoặc env vars. */
const config = {
  // ── 1. Guild command-burst ────────────────────────────────────────────
  guildWindowMs:      envNum('ANTIRAID_GUILD_WINDOW_MS',      5_000),
  guildBurstCommands: envNum('ANTIRAID_GUILD_BURST_COMMANDS', 30),
  guildBurstUsers:    envNum('ANTIRAID_GUILD_BURST_USERS',    6),
  guildLockMs:        envNum('ANTIRAID_GUILD_LOCK_MS',        20_000),

  // ── 2. Per-user escalating lockout ───────────────────────────────────
  violationWindowMs:  envNum('ANTIRAID_VIOLATION_WINDOW_MS',  30_000),
  violationThreshold: envNum('ANTIRAID_VIOLATION_THRESHOLD',  5),
  lockoutMs:          envNum('ANTIRAID_LOCKOUT_MS',           5 * 60_000),

  // ── 3. New-account guard ─────────────────────────────────────────────
  minAccountAgeDays:  envNum('ANTIRAID_MIN_ACCOUNT_AGE_DAYS', 3),

  // ── 4. Join-burst detector ───────────────────────────────────────────
  joinWindowMs:       envNum('ANTIRAID_JOIN_WINDOW_MS',       10_000),
  joinBurstCount:     envNum('ANTIRAID_JOIN_BURST_COUNT',     5),
  joinLockMs:         envNum('ANTIRAID_JOIN_LOCK_MS',         60_000),
  joinTimeoutMs:      envNum('ANTIRAID_JOIN_TIMEOUT_MS',      10 * 60_000),
  autoTimeoutOnJoinRaid: (process.env.ANTIRAID_AUTO_TIMEOUT ?? 'true') !== 'false',
  kickFallbackOnJoinRaid: (process.env.ANTIRAID_KICK_FALLBACK ?? 'true') !== 'false',

  // ── 5. Young-account burst ───────────────────────────────────────────
  // Trigger khi X+ acc có tuổi < youngAccountAgeDays join trong joinWindowMs,
  // kể cả khi tổng số join chưa đạt joinBurstCount (bắt botfarm sớm hơn).
  youngAccountAgeDays:   envNum('ANTIRAID_YOUNG_ACCOUNT_AGE_DAYS',   7),
  youngAccountBurstCount: envNum('ANTIRAID_YOUNG_ACCOUNT_BURST_COUNT', 3),

  // ── 6. Mention spam ──────────────────────────────────────────────────
  // Trigger khi user gửi mentionSpamTriggerCount+ tin nhắn mỗi cái có
  // ≥mentionSpamPerMsg mention trong mentionSpamWindowMs ms.
  // @everyone / @here tính là 10 mention để tăng trọng số.
  mentionSpamPerMsg:      envNum('ANTIRAID_MENTION_SPAM_PER_MSG',     4),
  mentionSpamWindowMs:    envNum('ANTIRAID_MENTION_SPAM_WINDOW_MS',   12_000),
  mentionSpamTriggerCount: envNum('ANTIRAID_MENTION_SPAM_TRIGGER',    2),
  mentionSpamLockoutMs:   envNum('ANTIRAID_MENTION_SPAM_LOCKOUT_MS',  10 * 60_000),
};

function getConfig() { return { ...config }; }

/** Merge partial overrides vào live config (từ admin command). */
function setConfig(partial) {
  for (const [k, v] of Object.entries(partial || {})) {
    if (k in config && v !== undefined && v !== null && !Number.isNaN(v)) config[k] = v;
  }
  return getConfig();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Per-guild command-burst detector
// ─────────────────────────────────────────────────────────────────────────────
/** @type {Map<string, {ts:number, userId:string}[]>} */
const _guildEvents = new Map();
/** @type {Map<string, number>} guildId → lock-until ts */
const _guildLocks = new Map();
let _onRaidDetected = null;

/** Đăng ký callback khi phát hiện command-burst. fn(guildId, distinctUsers). */
function onRaidDetected(fn) { _onRaidDetected = fn; }

/**
 * Ghi lệnh từ (guildId, userId). Trả về true = được phép, false = đang bị khóa.
 * @returns {boolean}
 */
function checkGuildBurst(guildId, userId) {
  if (!guildId) return true;
  const now = Date.now();

  const lockUntil = _guildLocks.get(guildId) || 0;
  if (lockUntil > now) return false;
  if (lockUntil) _guildLocks.delete(guildId);

  let events = _guildEvents.get(guildId);
  if (!events) { events = []; _guildEvents.set(guildId, events); }
  events.push({ ts: now, userId });

  const cutoff = now - config.guildWindowMs;
  while (events.length && events[0].ts < cutoff) events.shift();

  if (events.length > config.guildBurstCommands) {
    const distinctUsers = new Set(events.map((e) => e.userId)).size;
    if (distinctUsers > config.guildBurstUsers) {
      _guildLocks.set(guildId, now + config.guildLockMs);
      events.length = 0;
      if (_onRaidDetected) {
        try { _onRaidDetected(guildId, distinctUsers); } catch (_) {}
      }
      return false;
    }
  }
  return true;
}

/** Mở khoá thủ công một server (admin override). */
function unlockGuild(guildId) { return _guildLocks.delete(guildId); }

// ─────────────────────────────────────────────────────────────────────────────
// 2. Escalating per-user lockout
// ─────────────────────────────────────────────────────────────────────────────
/** @type {Map<string, number[]>} userId → timestamps vi phạm cooldown */
const _violations = new Map();
/** @type {Map<string, number>} userId → lockout-until ts */
const _userLocks = new Map();

/**
 * Lịch sử vi phạm — dùng để leo thang thời gian khóa.
 * @type {Map<string, {count:number, lastOffense:number}>}
 */
const _offenseHistory = new Map();

/**
 * Thời gian khóa leo thang theo số lần vi phạm:
 *   Lần 1: 5 phút  → Lần 2: 30 phút → Lần 3: 2 giờ → Lần 4+: 24 giờ
 * Nếu không bị khóa trong 24h liên tiếp → offense count reset về 0.
 */
const LOCKOUT_STEPS = [
  5  * 60_000,       // lần 1: 5 phút
  30 * 60_000,       // lần 2: 30 phút
  2  * 3_600_000,    // lần 3: 2 giờ
  24 * 3_600_000,    // lần 4+: 24 giờ
];
const OFFENSE_DECAY_MS = 24 * 3_600_000; // 24h không vi phạm → reset offense count

/**
 * Ghi nhận một lần bị kích hoạt lockout cho userId.
 * Trả về thời gian khóa phù hợp với lịch sử vi phạm.
 */
function _recordOffense(userId) {
  const now = Date.now();
  let rec = _offenseHistory.get(userId);
  if (!rec || (now - rec.lastOffense) > OFFENSE_DECAY_MS) {
    rec = { count: 0, lastOffense: now };
  }
  rec.count++;
  rec.lastOffense = now;
  _offenseHistory.set(userId, rec);
  const idx = Math.min(rec.count - 1, LOCKOUT_STEPS.length - 1);
  return { ms: LOCKOUT_STEPS[idx], offenseCount: rec.count };
}

/** Gọi khi user vừa vượt rate limit. Tích lũy đủ → khóa với thời gian leo thang. */
function recordViolation(userId) {
  const now = Date.now();
  let hits = _violations.get(userId);
  if (!hits) { hits = []; _violations.set(userId, hits); }
  hits.push(now);
  const cutoff = now - config.violationWindowMs;
  while (hits.length && hits[0] < cutoff) hits.shift();

  if (hits.length >= config.violationThreshold) {
    const { ms } = _recordOffense(userId); // ← thời gian leo thang
    _userLocks.set(userId, now + ms);
    hits.length = 0;
  }
}

/**
 * @returns {number} ms còn lại trong lockout (0 = không bị khóa).
 */
function getUserLockRemaining(userId) {
  const until = _userLocks.get(userId) || 0;
  const rem = until - Date.now();
  if (rem <= 0) {
    if (until) _userLocks.delete(userId);
    return 0;
  }
  return rem;
}

/**
 * Số lần vi phạm tích lũy của user (trong vòng 24h).
 * Dùng để hiển thị trong thông báo khóa.
 * @returns {number}
 */
function getOffenseCount(userId) {
  const rec = _offenseHistory.get(userId);
  if (!rec || (Date.now() - rec.lastOffense) > OFFENSE_DECAY_MS) return 0;
  return rec.count;
}

/** Mở khoá thủ công một user (admin override). Tùy chọn xoá offense history. */
function unlockUser(userId, { resetOffenses = false } = {}) {
  _userLocks.delete(userId);
  if (resetOffenses) _offenseHistory.delete(userId);
  return true;
}

/**
 * Khoá ngay một user trong ms milli-giây mà không cần tích lũy violations.
 * Dùng bởi mention spam handler và interaction guard.
 * KHÔNG tính vào escalating offense history (đây là lockout tức thời, khác loại).
 * @param {string} userId
 * @param {number} [ms] Mặc định = config.lockoutMs
 */
function forceLockUser(userId, ms) {
  _userLocks.set(userId, Date.now() + (ms || config.lockoutMs));
  _violations.delete(userId); // xoá violations pending để tránh double-escalation
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. New-account guard
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {import('discord.js').User} user
 * @param {number} [minDays]
 * @returns {{ suspicious: boolean, ageDays: number }}
 */
function checkAccountAge(user, minDays = config.minAccountAgeDays) {
  const ageMs = Date.now() - (user.createdTimestamp || 0);
  const ageDays = ageMs / 86_400_000;
  return { suspicious: ageDays < minDays, ageDays };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 & 5. Join-burst detector + Young-account burst
// ─────────────────────────────────────────────────────────────────────────────
/** @type {Map<string, {ts:number, userId:string, createdAt:number}[]>} */
const _joinEvents = new Map();
/** @type {Map<string, number>} guildId → lock-until ts */
const _joinLocks = new Map();
let _onJoinRaidDetected = null;

/** Đăng ký callback khi phát hiện join-burst/young-account-burst.
 *  fn(guildId, memberIds[], meta)
 *  meta = { isYoungBurst: boolean, youngCount: number, totalJoins: number }
 */
function onJoinRaidDetected(fn) { _onJoinRaidDetected = fn; }

/**
 * Lấy thời điểm tạo acc từ Discord snowflake (không cần API call).
 * Discord epoch = 1 Jan 2015 = 1420070400000 ms
 */
function _snowflakeCreatedAt(userId) {
  try { return Number(BigInt(userId) >> 22n) + 1_420_070_400_000; }
  catch (_) { return 0; }
}

/**
 * Ghi một sự kiện join. Trigger khi:
 *  (a) Đủ joinBurstCount joins trong joinWindowMs  — HOẶC
 *  (b) Đủ youngAccountBurstCount acc mới tạo trong joinWindowMs (botfarm).
 */
function checkJoinBurst(guildId, userId) {
  if (!guildId) return;
  const now = Date.now();

  // Kiểm tra lock TRƯỚC khi push (nhất quán; tránh event tích luỹ lúc lock).
  const lockUntil = _joinLocks.get(guildId) || 0;
  if (lockUntil > now) return;
  if (lockUntil) _joinLocks.delete(guildId);

  let events = _joinEvents.get(guildId);
  if (!events) { events = []; _joinEvents.set(guildId, events); }
  events.push({ ts: now, userId, createdAt: _snowflakeCreatedAt(userId) });

  const cutoff = now - config.joinWindowMs;
  while (events.length && events[0].ts < cutoff) events.shift();

  const memberIds     = [...new Set(events.map((e) => e.userId))];
  const youngCutoff   = now - config.youngAccountAgeDays * 86_400_000;
  const youngMemberIds = [...new Set(
    events.filter((e) => e.createdAt > youngCutoff).map((e) => e.userId),
  )];

  const isGeneralBurst = memberIds.length     >= config.joinBurstCount;
  const isYoungBurst   = youngMemberIds.length >= config.youngAccountBurstCount;

  if (isGeneralBurst || isYoungBurst) {
    _joinLocks.set(guildId, now + config.joinLockMs);
    events.length = 0;
    if (_onJoinRaidDetected) {
      const affectedIds = isGeneralBurst ? memberIds : youngMemberIds;
      try {
        _onJoinRaidDetected(guildId, affectedIds, {
          isYoungBurst: isYoungBurst && !isGeneralBurst,
          youngCount: youngMemberIds.length,
          totalJoins: memberIds.length,
        });
      } catch (_) {}
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Mention spam detector
// ─────────────────────────────────────────────────────────────────────────────
/** @type {Map<string, {ts:number, weight:number}[]>} userId → recent mention events */
const _mentionEvents = new Map();

/**
 * Gọi mỗi khi một user gửi tin nhắn có mention.
 * mentionWeight = users.size + (everyone/here ? 10 : 0) + roles.size
 *
 * @param {string} userId
 * @param {number} mentionWeight
 * @returns {{ spam: boolean }}
 */
function checkMentionSpam(userId, mentionWeight) {
  if (mentionWeight < config.mentionSpamPerMsg) return { spam: false };
  const now = Date.now();
  let events = _mentionEvents.get(userId);
  if (!events) { events = []; _mentionEvents.set(userId, events); }
  events.push({ ts: now, weight: mentionWeight });
  const cutoff = now - config.mentionSpamWindowMs;
  while (events.length && events[0].ts < cutoff) events.shift();
  return { spam: events.length >= config.mentionSpamTriggerCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Periodic prune — giữ memory bounded dù có hàng trăm servers.
// ─────────────────────────────────────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [id, until] of _guildLocks)   if (until < now) _guildLocks.delete(id);
  for (const [id, until] of _userLocks)    if (until < now) _userLocks.delete(id);
  for (const [id, until] of _joinLocks)    if (until < now) _joinLocks.delete(id);

  for (const [id, evs] of _guildEvents) {
    const cutoff = now - config.guildWindowMs;
    while (evs.length && evs[0].ts < cutoff) evs.shift();
    if (!evs.length) _guildEvents.delete(id);
  }
  for (const [id, evs] of _joinEvents) {
    const cutoff = now - config.joinWindowMs;
    while (evs.length && evs[0].ts < cutoff) evs.shift();
    if (!evs.length) _joinEvents.delete(id);
  }
  for (const [id, hits] of _violations) {
    const cutoff = now - config.violationWindowMs;
    while (hits.length && hits[0] < cutoff) hits.shift();
    if (!hits.length) _violations.delete(id);
  }
  for (const [id, rec] of _offenseHistory) {
    if ((now - rec.lastOffense) > OFFENSE_DECAY_MS) _offenseHistory.delete(id);
  }
  for (const [id, evs] of _mentionEvents) {
    const cutoff = now - config.mentionSpamWindowMs;
    while (evs.length && evs[0].ts < cutoff) evs.shift();
    if (!evs.length) _mentionEvents.delete(id);
  }
}, 60_000);

// ─────────────────────────────────────────────────────────────────────────────
// Admin helpers
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Gửi DM cảnh báo tới ADMIN_ID (chủ bot). Best-effort.
 */
async function alertAdmin(client, text) {
  if (!ADMIN_ID || !client) return;
  try {
    const admin = await client.users.fetch(ADMIN_ID);
    await admin.send(text).catch(() => {});
  } catch (_) {}
}

/**
 * Auto-timeout danh sách members sau khi phát hiện join raid.
 * Nếu bot không có quyền Timeout → thử Kick (fallback).
 * Bỏ qua thành viên không moderatable (role cao hơn bot, owner...).
 *
 * @param {import('discord.js').Guild} guild
 * @param {string[]} memberIds
 * @param {number} [ms] Thời gian timeout, mặc định = config.joinTimeoutMs
 * @returns {Promise<{ attempted:number, timedOut:number, kicked:number, skipped:number }>}
 */
async function autoTimeoutMembers(guild, memberIds, ms = config.joinTimeoutMs) {
  const result = { attempted: memberIds.length, timedOut: 0, kicked: 0, skipped: 0 };
  if (!guild || !config.autoTimeoutOnJoinRaid) {
    result.skipped = memberIds.length;
    return result;
  }

  // guild.members.me có thể null nếu cache chưa load — fallback fetch API.
  let me = guild.members.me;
  if (!me) {
    try { me = await guild.members.fetchMe(); } catch (_) {}
  }
  if (!me) { result.skipped = memberIds.length; return result; }

  const canTimeout = me.permissions.has('ModerateMembers');
  const canKick    = config.kickFallbackOnJoinRaid && me.permissions.has('KickMembers');

  if (!canTimeout && !canKick) { result.skipped = memberIds.length; return result; }

  for (const id of memberIds) {
    try {
      const member = await guild.members.fetch(id).catch(() => null);
      if (!member) { result.skipped++; continue; }

      if (canTimeout && member.moderatable) {
        await member.timeout(ms, 'Anti-raid: mass-join burst detected');
        result.timedOut++;
      } else if (canKick && member.kickable) {
        // Kick fallback: dùng khi bot thiếu quyền Timeout nhưng có Kick
        await member.kick('Anti-raid: mass-join burst (kick fallback — bot cần quyền Timeout Members)');
        result.kicked++;
      } else {
        result.skipped++;
      }
    } catch (_) {
      result.skipped++;
    }
  }
  return result;
}

module.exports = {
  // Guard checks
  checkGuildBurst,
  checkAccountAge,
  checkJoinBurst,
  checkMentionSpam,
  // Callbacks
  onRaidDetected,
  onJoinRaidDetected,
  // User locks
  recordViolation,
  getUserLockRemaining,
  getOffenseCount,
  forceLockUser,
  unlockUser,
  // Guild locks
  unlockGuild,
  // Actions
  autoTimeoutMembers,
  alertAdmin,
  // Config
  getConfig,
  setConfig,
  get DEFAULT_MIN_ACCOUNT_AGE_DAYS() { return config.minAccountAgeDays; },
};
