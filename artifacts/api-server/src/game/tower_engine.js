'use strict';
/**
 * game/tower_engine.js
 * Pure tower combat logic — zero Discord.js dependency.
 *
 * Owns: enemy generation, combat resolution, reward/cooldown helpers.
 * Does NOT own: session state (Map), Discord UI builders, DB writes.
 * Those remain in commands/tower.js.
 */
const { tinhCS } = require('./player');
const { ENEMY_POOLS, getEnemySkill } = require('../data/tower_data');
const { getTT } = require('../data');
const { CE } = require('../systems/emoji');

// ── Floor reward tables ───────────────────────────────────────────────────────
function getFloorReward(floor) {
  const mult = 0.85 * 0.9 * 0.75; // base 0.85, -10%, -25% linh thach
  if (floor <= 15) return Math.floor(floor * 100 * mult);
  if (floor <= 20) return Math.floor(floor * 34  * mult); // -35% (50*0.675)
  if (floor <= 25) return Math.floor(floor * 68  * mult); // -32% (100*0.675)
  return Math.floor(floor * 135 * mult); // -32.5% (200*0.675)
}

function getWrongAnswerPenalty(floor) {
  if (floor <= 10) return 0.12;
  if (floor <= 20) return 0.20;
  return 0.28;
}

function getBetweenFloorRecovery(floor) {
  if (floor <= 10) return 0.35;
  if (floor <= 20) return 0.20;
  return 0.12;
}

// ── Enemy generation ──────────────────────────────────────────────────────────
/**
 * Generate a tower enemy scaled to the player's stats at the given floor.
 * @param {number} floor
 * @param {object} playerData  Full player row from DB
 * @returns {{ name, atk, def, hp, hp_max, floor }}
 */
function getTowerEnemy(floor, playerData) {
  const cs = tinhCS(playerData);
  let pool, atkM, defM, hpM;

  // Scaling gốc cho tất cả
  if (floor <= 3) {
    pool = ENEMY_POOLS.low;   atkM = 0.65 + floor * 0.08;         defM = 0.55 + floor * 0.07;         hpM = 0.85 + floor * 0.12;
  } else if (floor <= 7) {
    pool = ENEMY_POOLS.mid;   atkM = 0.88 + (floor - 3) * 0.11;  defM = 0.72 + (floor - 3) * 0.08;  hpM = 1.20 + (floor - 3) * 0.15;
  } else if (floor <= 12) {
    pool = ENEMY_POOLS.high;  atkM = 1.34 + (floor - 7) * 0.13;  defM = 1.00 + (floor - 7) * 0.10;  hpM = 1.70 + (floor - 7) * 0.18;
  } else if (floor <= 15) {
    pool = ENEMY_POOLS.boss;  atkM = 2.00 + (floor - 12) * 0.22; defM = 1.50 + (floor - 12) * 0.15; hpM = 2.60 + (floor - 12) * 0.28;
  } else if (floor <= 20) {
    pool = ENEMY_POOLS.elite; atkM = 2.70 + (floor - 15) * 0.24; defM = 1.95 + (floor - 15) * 0.15; hpM = 3.65 + (floor - 15) * 0.37;
  } else if (floor <= 25) {
    pool = ENEMY_POOLS.legend;atkM = 3.95 + (floor - 20) * 0.33; defM = 2.75 + (floor - 20) * 0.18; hpM = 5.55 + (floor - 20) * 0.50;
  } else {
    pool = ENEMY_POOLS.myth;  atkM = 5.65 + (floor - 25) * 0.48; defM = 3.65 + (floor - 25) * 0.24; hpM = 8.10 + (floor - 25) * 0.85;
  }

  // Nguyên Anh Trung Kỳ (canh_gioi >= 19) trở lên: tầng 1-20 ATK quái 60% → cam go, phải dùng heal + hộ thể đúng lúc mới sống
  // Không tư duy (bỏ qua CD heal/shield) → vẫn chết; play đúng → chắc chắn lên được tầng 20
  if (floor <= 20 && (playerData.canh_gioi || 0) >= 19) atkM *= 0.60;

  const name   = pool[Math.floor(Math.random() * pool.length)];
  const atk    = Math.max(10,  Math.floor(cs.atk    * atkM * 0.765));
  const def    = Math.max(5,   Math.floor(cs.def    * defM * 0.765));
  const hp_max = Math.max(100, Math.floor(cs.hp_max * hpM  * 0.765));
  return { name, atk, def, hp: hp_max, hp_max, floor };
}

// ── Enemy AI ──────────────────────────────────────────────────────────────────
/**
 * Decide the enemy's action for this turn.
 * @param {object} session  Tower session object
 * @returns {'skill'|'heal'|'power'|'atk'|'def'}
 */
function pickEnemyAction(session) {
  const floor    = session.floor;
  const eHpPct   = session.enemy.hp / session.enemy.hp_max;
  const pHpPct   = session.playerHp / session.playerHpMax;

  // Mỗi nhánh dùng random độc lập để xác suất không bị phụ thuộc nhau
  if (floor >= 7 && (session.enemySkillCd || 0) <= 0) {
    const skillChance = floor >= 26 ? 0.38 : floor >= 20 ? 0.32 : floor >= 12 ? 0.26 : 0.20;
    if (Math.random() < skillChance) return 'skill';
  }

  const powerChance = floor > 25 ? 0.45 : floor > 20 ? 0.35 : floor > 15 ? 0.25 : 0.15;
  const healChance  = floor > 20 ? 0.08 : 0.15;
  const healTrigger = floor > 20 ? 0.15 : 0.25;

  // Heal — ưu tiên khi máu thấp, random riêng
  if (eHpPct < healTrigger && (session.enemyHealCd || 0) <= 0 && Math.random() < healChance) return 'heal';

  // Power — random riêng, thêm cơ hội khi player máu thấp
  if ((session.enemyPowerCd || 0) <= 0) {
    const effectivePower = pHpPct < 0.3 ? powerChance * 1.5 : powerChance;
    if (Math.random() < effectivePower) return 'power';
  }

  // Def — 15% cố định
  if (Math.random() < 0.15) return 'def';

  // Heal bổ sung (không cần máu thấp) — 10% khi cooldown xong
  if ((session.enemyHealCd || 0) <= 0 && Math.random() < 0.10) return 'heal';

  return 'atk';
}

// ── Turn resolution ───────────────────────────────────────────────────────────
/**
 * Resolve one combat turn in the tower.
 * Mutates session (hp, cds, combatLog) in place.
 *
 * @param {object} session      Tower session
 * @param {'atk'|'bp'|'def'|'heal'} playerAction
 * @param {string|null} selectedBpId  Required when playerAction === 'bp'
 * @param {object} BP_COMBAT    Bi Phap combat definitions (from game/combat.js)
 * @param {object[]} BI_PHAP    Bi Phap static data (from data/)
 * @returns {{ win: boolean, lose: boolean, log: string[] }}
 */
function resolveTowerTurn(session, playerAction, selectedBpId, BP_COMBAT, BI_PHAP) {
  const log = [];
  const p   = session.playerData;
  const e   = session.enemy;
  const cs  = tinhCS(p);

  const playerAtk = cs.atk;
  const playerDef = cs.def;
  const floor     = session.floor;

  const eCritChance = floor > 25 ? 0.28 : floor > 20 ? 0.22 : floor > 15 ? 0.17 : 0.12;
  const pCritChance = 0.15
    + (p.huyet_mach === 'tu_la'     && p.noi_tai_an_unlocked ? 0.15 : 0)
    + (p.huyet_mach === 'thien_long' && p.noi_tai_an_unlocked ? 0.20 : 0)
    + (p.huyet_mach === 'hon_don_the' && p.noi_tai_an_unlocked ? 0.30 : 0);
  const eCritMult   = floor > 25 ? 2.8 : floor > 20 ? 2.5 : floor > 15 ? 2.2 : 2.0;

  const pAtkDebuff = (session.playerDebuffTurns || 0) > 0 ? (1 - 0.30) : 1;
  if ((session.playerDebuffTurns || 0) > 0) session.playerDebuffTurns--;

  let pAtkMult = 1, pDefMult = 1;
  let eAtkMult = 1, eDefMult = 1;
  let pHeal = 0, eHeal = 0;
  let playerIgnoreDef = 0;

  const enemyAction = pickEnemyAction(session);

  // ── Player action ──
  if (playerAction === 'def') {
    pAtkMult = 0;
    pDefMult = 0.35;
    pHeal = Math.floor(session.playerHpMax * 0.07);
    session.defCd = 3;
    log.push(`🔰 **Ngươi** khai Hộ Thể — nhận 35% sát thương, hồi +**${pHeal.toLocaleString()}** HP *(CD: 3 lượt)*`);

  } else if (playerAction === 'heal') {
    pAtkMult = 0;
    const healRate = floor > 25 ? 0.10 : floor > 20 ? 0.13 : floor > 15 ? 0.15 : 0.18;
    pHeal = Math.floor(session.playerHpMax * healRate);
    session.healCd = 3;
    log.push(`💫 **Ngươi** thu công tụ linh — Hồi +**${pHeal.toLocaleString()}** HP! *(CD: 3 lượt)*`);

  } else if (playerAction === 'bp' && selectedBpId && BP_COMBAT && BI_PHAP) {
    const bpDef  = BP_COMBAT[selectedBpId];
    const bpData = BI_PHAP.find(b => b.id === selectedBpId);
    if (bpDef && bpData) {
      if (bpDef.type === 'atk') {
        pAtkMult = bpDef.mult;
        if (bpDef.cost_hp > 0) {
          const cost = Math.floor(session.playerHpMax * bpDef.cost_hp);
          session.playerHp -= cost;
          log.push(`☠️ **Ngươi** trả **${cost.toLocaleString()}** HP → tung **${bpData.ten}**! *(×${bpDef.mult})*`);
        } else {
          log.push(`✨ **Ngươi** tung **${bpData.ten}**! *(×${bpDef.mult})*`);
        }
      } else if (bpDef.type === 'shield') {
        pAtkMult = 0;
        pDefMult = bpDef.mult;
        log.push(`🛡️ **Ngươi** khai **${bpData.ten}** — nhận chỉ ${Math.round(100 * bpDef.mult)}% sát thương!`);
      } else if (bpDef.type === 'heal') {
        const healAmt = Math.floor(session.playerHpMax * bpDef.mult);
        pHeal    = healAmt;
        pAtkMult = 0;
        log.push(`💚 **Ngươi** khai **${bpData.ten}** — hồi +**${healAmt.toLocaleString()}** HP!`);
      }
      session.bpCd = bpDef.cd;
    }
  } else {
    // Normal attack (default)
    log.push(`⚔️ **Ngươi** xuất chiêu tấn công!`);
  }

  // ── Enemy action ──
  if (enemyAction === 'skill' && floor >= 7) {
    const skillDef = getEnemySkill(floor);
    session.enemySkillCd = skillDef.cd;
    eAtkMult = skillDef.atkMult;
    if (skillDef.debuffAtkPct) {
      session.playerDebuffTurns = 1;
      log.push(`${skillDef.emoji} **${e.name}** dùng **${skillDef.name}**! *(×${skillDef.atkMult}, ngươi ATK -${Math.round(skillDef.debuffAtkPct * 100)}% lượt sau)*`);
    } else if (skillDef.selfHealPct) {
      eHeal = Math.floor(e.hp_max * skillDef.selfHealPct);
      log.push(`${skillDef.emoji} **${e.name}** dùng **${skillDef.name}**! *(×${skillDef.atkMult}, tự hồi ${Math.round(skillDef.selfHealPct * 100)}% HP)*`);
    } else if (skillDef.ignoreDefPct) {
      playerIgnoreDef = skillDef.ignoreDefPct;
      log.push(`${skillDef.emoji} **${e.name}** dùng **${skillDef.name}**! *(×${skillDef.atkMult}, xuyên thủ ${Math.round(skillDef.ignoreDefPct * 100)}%)*`);
    } else {
      log.push(`${skillDef.emoji} **${e.name}** dùng **${skillDef.name}**! *(×${skillDef.atkMult})*`);
    }
  } else if (enemyAction === 'heal') {
    eAtkMult = 0;
    eHeal = Math.floor(e.hp_max * 0.12);
    session.enemyHealCd = 3;
    log.push(`💚 **${e.name}** vận công hồi nguyên — hồi +**${eHeal.toLocaleString()}** HP! *(CD: 3 lượt)*`);
  } else if (enemyAction === 'power') {
    eAtkMult = 1.35;
    eDefMult = 1.4;
    session.enemyPowerCd = 3;
    log.push(`🌀 **${e.name}** bùng phát — Công Lực ×1.35! *(CD: 3 lượt)*`);
  } else if (enemyAction === 'def') {
    eAtkMult = 0;
    eDefMult = 0.4;
    eHeal = Math.floor(e.hp_max * 0.05);
    log.push(`🔰 **${e.name}** phòng thủ — nhận 40% sát thương.`);
  } else {
    log.push(`⚔️ **${e.name}** tấn công!`);
  }

  // Apply heals
  if (pHeal > 0) session.playerHp = Math.min(session.playerHpMax, session.playerHp + pHeal);
  if (eHeal > 0) e.hp              = Math.min(e.hp_max,            e.hp + eHeal);

  // Thần thông passives
  const ttCrit     = getTT(p, 'crit');
  const ttDodge    = getTT(p, 'dodge');
  const ttDmgRed   = getTT(p, 'dmg_reduce');
  const ttRegen    = getTT(p, 'regen_pct');

  // ── Damage exchange ──
  if (pAtkMult > 0) {
    const rawDmg = Math.floor(playerAtk * pAtkMult * pAtkDebuff);
    const effDef = Math.floor(e.def * eDefMult);
    let dmg      = Math.max(1, rawDmg - effDef);
    const isCrit = Math.random() < (pCritChance + ttCrit);
    if (isCrit) { dmg = Math.floor(dmg * 2); log.push(`${CE("tia_set","⚡")} *Bạo Kích!*`); }
    e.hp -= dmg;
    log.push(`🗡️ **Ngươi** gây **-${dmg.toLocaleString()}** HP${isCrit ? ' *(Bạo Kích)*' : ''}!`);
  }

  if (eAtkMult > 0) {
    const dodged = ttDodge > 0 && Math.random() < ttDodge;
    if (dodged) {
      log.push(`🌊 **Ngươi** khinh công né tránh đòn! *(Thần Thông)*`);
    } else {
      const rawDmg  = Math.floor(e.atk * eAtkMult);
      const effDef  = Math.floor(playerDef * pDefMult * (1 - playerIgnoreDef));
      const minDmg  = Math.max(1, Math.floor(rawDmg * 0.20));
      let dmg       = Math.max(minDmg, rawDmg - effDef);
      if (ttDmgRed > 0) dmg = Math.max(1, Math.floor(dmg * (1 - ttDmgRed)));
      const ntaImmuneCrit = (p.huyet_mach === 'hon_don_the' || p.huyet_mach === 'co_than') && p.noi_tai_an_unlocked;
      const isCrit  = !ntaImmuneCrit && Math.random() < eCritChance;
      if (isCrit) { dmg = Math.floor(dmg * eCritMult); }
      session.playerHp -= dmg;
      log.push(`💢 **${e.name}** gây **-${dmg.toLocaleString()}** HP${isCrit ? ' *(Bạo Kích!)*' : ''}${ntaImmuneCrit ? ' *(Miễn Bạo Kích)*' : ''}${ttDmgRed > 0 ? ' *(giảm TT)*' : ''}!`);
    }
  }

  // Thần thông hồi phục cuối lượt
  if (ttRegen > 0) {
    const regenAmt = Math.floor(session.playerHpMax * ttRegen);
    if (regenAmt > 0 && session.playerHp > 0) {
      session.playerHp = Math.min(session.playerHpMax, session.playerHp + regenAmt);
      log.push(`🌸 *Hồi Xuân* — hồi **+${regenAmt.toLocaleString()}** HP!`);
    }
  }

  // Nội Tại Ẩn — HP regen per turn
  if (p.noi_tai_an_unlocked && session.playerHp > 0) {
    let ntaRegen = 0, ntaLabel = '';
    if (p.huyet_mach === 'thien_long')  { ntaRegen = 0.10; ntaLabel = '👑Thiên Long Uy Linh'; }
    else if (p.huyet_mach === 'hon_don_the') { ntaRegen = 0.15; ntaLabel = '🌀Hỗn Độn Khai Thiên'; }
    if (ntaRegen > 0) {
      const regenAmt = Math.floor(session.playerHpMax * ntaRegen);
      session.playerHp = Math.min(session.playerHpMax, session.playerHp + regenAmt);
      log.push(`✨ [${ntaLabel}] hồi **+${regenAmt.toLocaleString()}** HP!`);
    }
  }

  // Tick down cooldowns
  if (session.bpCd   > 0) session.bpCd--;
  if (session.defCd  > 0) session.defCd--;
  if (session.healCd > 0) session.healCd--;
  if ((session.enemySkillCd  || 0) > 0) session.enemySkillCd--;
  if ((session.enemyHealCd   || 0) > 0) session.enemyHealCd--;
  if ((session.enemyPowerCd  || 0) > 0) session.enemyPowerCd--;

  session.combatLog.push(...log);
  session.turn++;

  const playerDead = session.playerHp <= 0;
  const enemyDead  = e.hp <= 0;

  return {
    win:  enemyDead && !playerDead,
    lose: playerDead && !enemyDead, // cả hai chết cùng lúc → draw, không phải lose
    draw: playerDead && enemyDead,
    log,
  };
}

module.exports = {
  getFloorReward,
  getWrongAnswerPenalty,
  getBetweenFloorRecovery,
  getTowerEnemy,
  pickEnemyAction,
  resolveTowerTurn,
};
