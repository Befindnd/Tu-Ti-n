'use strict';
/**
 * game/linh_thu_engine.js  v2
 * Pure logic cho Săn Linh Thú — không phụ thuộc Discord.js.
 *
 * v2: Độ khó tăng mạnh · Passive nội tại mỗi thú · Loot drops
 */
const { CE } = require('../systems/emoji');

const { tinhCS }          = require('./player');
const { getTT }           = require('../data');
const {
  LINH_THU_TIERS, LINH_THU_LIST, LINH_THU_REWARDS, LINH_THU_LOOT,
} = require('../data/linh_thu_data');

// ── Helpers ───────────────────────────────────────────────────────────────────
function rng(min, max) { return min + Math.random() * (max - min); }
function rngInt(min, max) { return Math.floor(rng(min, max + 1)); }
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function fmt(n) { return n.toLocaleString('vi-VN'); }

// ── Sinh linh thú ─────────────────────────────────────────────────────────────
function generateBeast(tier, playerRows) {
  const tierDef = LINH_THU_TIERS[tier];
  if (!tierDef) throw new Error(`Unknown tier: ${tier}`);

  const pool = LINH_THU_LIST[tier];
  if (!pool || pool.length === 0) throw new Error(`No beasts for tier: ${tier}`);

  const beastDef = pickRandom(pool);

  const csArr = playerRows.map(p => tinhCS(p));
  const avgAtk = csArr.reduce((s, c) => s + c.atk, 0) / csArr.length;
  const avgDef = csArr.reduce((s, c) => s + c.def, 0) / csArr.length;
  const avgHp  = csArr.reduce((s, c) => s + c.hp_max, 0) / csArr.length;

  const atkMult = rng(...tierDef.atkM);
  const defMult = rng(...tierDef.defM);
  const hpMult  = rng(...tierDef.hpM_base) + tierDef.hpM_per_member * (playerRows.length - 1);

  const atk    = Math.max(10,  Math.floor(avgAtk * atkMult));
  const def    = Math.max(5,   Math.floor(avgDef * defMult));
  const hp_max = Math.max(500, Math.floor(avgHp  * hpMult));

  return {
    id:         beastDef.id,
    ten:        beastDef.ten,
    mu:         beastDef.mu,
    element:    beastDef.element,
    skill:      beastDef.skill,
    skill_cd:   beastDef.skill_cd,
    skill_desc: beastDef.skill_desc,
    passive:        beastDef.passive,
    passive_desc:   beastDef.passive_desc,
    hp:         hp_max,
    hp_max,
    atk,
    def,
    tier,
    // trạng thái chiến đấu
    skill_cd_rem:     0,
    skill2_cd_rem:    0,
    phase2:           false,
    atk_boost:        0,    // turns còn tăng ATK 40/50%
    def_boost:        0,    // turns còn tăng DEF
    invincible:       0,
    counter_rate:     0,
    passive_stacks:   0,    // dùng cho dia_nguc_khi (stack debuff)
    passive_triggered: false,  // cho lua_hoi_sinh (hồi sinh 1 lần)
  };
}

// ── AI linh thú ───────────────────────────────────────────────────────────────
function pickBeastAction(session) {
  const beast   = session.beast;
  const hpPct   = beast.hp / beast.hp_max;
  const tier    = beast.tier;
  const r       = Math.random();

  // Skill chance — chia pool giữa skill1 và skill2
    const skillChance = tier === 'than_thu'    ? 0.42
      : tier === 'huyen_thoai' ? 0.35
      : tier === 'su_thi'      ? 0.38
      : tier === 'hiem'        ? 0.30
      : 0.22;

    const s1Ready = beast.skill  && beast.skill_cd_rem  <= 0;
    const s2Ready = beast.skill2 && beast.skill2_cd_rem <= 0;

    if ((s1Ready || s2Ready) && Math.random() < skillChance) {
      if (s1Ready && s2Ready) return Math.random() < 0.50 ? 'skill' : 'skill2';
      if (s1Ready) return 'skill';
      return 'skill2';
    }

  // Hồi phục khi máu thấp — giảm heal chance để khó hơn
  if (hpPct < 0.18 && r < 0.12) return 'heal';

  if (hpPct < 0.50) {
    beast.phase2 = true;
    if (r < 0.45) return 'power';
    if (r < 0.75) return 'aoe';
    return 'normal';
  }

  if (r < 0.28) return 'power';
  if (r < 0.52) return 'normal';
  if (r < 0.72) return 'aoe';
  return 'normal';
}

// ── Giải quyết một lượt săn ──────────────────────────────────────────────────
function resolveSanTurn(session) {
  const { beast, members } = session;
  const log = [];
  const alive = members.filter(m => m.alive);

  // ── 1. Passive đầu lượt ───────────────────────────────────────────────
  _beastPassiveStartOfTurn(beast, alive, log);

  // ── 2. Tick cooldowns & trạng thái ───────────────────────────────────
  if (beast.skill_cd_rem  > 0) beast.skill_cd_rem--;
  if (beast.skill2_cd_rem > 0) beast.skill2_cd_rem--;
  if (beast.atk_boost     > 0) beast.atk_boost--;
  if (beast.def_boost     > 0) beast.def_boost--;
  if (beast.invincible    > 0) beast.invincible--;

  for (const m of alive) {
    if (m.action_cd.the    > 0) m.action_cd.the--;
    if (m.action_cd.hoikhi > 0) m.action_cd.hoikhi--;
    for (const k of Object.keys(m.bp_cd)) {
      if (m.bp_cd[k] > 0) m.bp_cd[k]--;
    }
    if (m.frozen > 0) m.frozen--;
    if (m.stun   > 0) m.stun--;
    if (m.burn   > 0) {
      const burnDmg = Math.floor(m.hp_max * 0.10);
      m.hp -= burnDmg;
      if (m.hp < 0) m.hp = 0;
      log.push(`🔥 **${m.name}** bỏng rát — mất **${fmt(burnDmg)}** HP vì lửa!`);
      m.burn--;
    }
    if (m.atk_reduced > 0) m.atk_reduced--;
    if (m.def_reduced > 0) m.def_reduced--;
  }

  // ── 3. Thành viên tấn công linh thú ──────────────────────────────────
  let totalDmgToBeast = 0;
  const beastDef = Math.max(0, beast.def);

  for (const m of alive) {
    const action = m.action || { type: 'danh' };

    if (m.stun > 0 || m.frozen > 0) {
      const why = m.stun > 0 ? 'choáng' : 'đóng băng';
      log.push(`💫 **${m.name}** đang bị **${why}** — không thể hành động!`);
      m.action = null;
      continue;
    }

    // Passive Tiên Linh: vô hiệu hành động
    if (m._voihoa) {
      log.push(`✨ Tiên Phép vô hiệu hóa hành động của **${m.name}** lượt này!`);
      m._voihoa = false;
      m.action  = null;
      continue;
    }

    let atkMult  = 1;
    let skipAtk  = false;
    let healSelf = 0;

    if (action.type === 'the') {
      skipAtk  = true;
      healSelf = Math.floor(m.hp_max * 0.10);
      m.defending = true;
      m.action_cd.the = 2;
      log.push(`🛡️ **${m.name}** khai Hộ Thể Công — tăng phòng thủ & hồi **${fmt(healSelf)}** HP! *(CD: 2 lượt)*`);

    } else if (action.type === 'hoikhi') {
      skipAtk  = true;
      healSelf = Math.floor(m.hp_max * 0.18);
      m.action_cd.hoikhi = 3;
      log.push(`💫 **${m.name}** thu công tụ linh — hồi +**${fmt(healSelf)}** HP! *(CD: 3 lượt)*`);

    } else if (action.type === 'bi_phap' && action.bp_id) {
      const bp = session.BP_COMBAT_DATA?.[action.bp_id];
      if (bp) {
        if (bp.type === 'atk') {
          atkMult = bp.mult;
          if (bp.cost_hp > 0) {
            const cost = Math.floor(m.hp_max * bp.cost_hp);
            m.hp -= cost;
            if (m.hp < 1) m.hp = 1;
            log.push(`☠️ **${m.name}** trả **${fmt(cost)}** HP → tung bí pháp!`);
          } else {
            log.push(`✨ **${m.name}** tung bí pháp cường lực!`);
          }
          // Passive than_hoa: giảm 25% sát thương bí pháp
          if (beast.passive === 'than_hoa') {
            atkMult *= 0.75;
            log.push(`🔥 **Thân Hỏa** — ${beast.ten} hấp thụ bí pháp, giảm 25% sát thương!`);
          }
        } else if (bp.type === 'shield') {
          skipAtk = true;
          m.defending  = true;
          m.shield_mult = bp.mult;
          log.push(`🛡️ **${m.name}** khai Kim Thân bí pháp — nhận chỉ ${Math.round(bp.mult * 100)}% sát thương!`);
        } else if (bp.type === 'heal') {
          skipAtk  = true;
          healSelf = Math.floor(m.hp_max * bp.mult);
          log.push(`💚 **${m.name}** tung bí pháp hồi phục — hồi +**${fmt(healSelf)}** HP!`);
        }
        m.bp_cd[action.bp_id] = bp.cd;
      } else {
        atkMult = 1;
      }
    }

    if (healSelf > 0) {
      m.hp = Math.min(m.hp_max, m.hp + healSelf);
    }

    if (!skipAtk) {
      let atkStat = m.atk;
      if (m.atk_reduced > 0) atkStat = Math.floor(atkStat * 0.80);

      // Passive am_hinh: 20% né đòn
      if (beast.passive === 'am_hinh' && Math.random() < 0.20) {
        log.push(`🌑 **${beast.mu} ${beast.ten}** *(Ám Hình)* né tránh đòn của **${m.name}**!`);
        m.action = null;
        m.defending = false;
        m.shield_mult = null;
        continue;
      }

      const defPen  = beastDef * (action.type === 'bi_phap' ? 0.50 : 0.60);
      const baseDmg = Math.max(1, atkStat * atkMult - defPen);

      // long_van: crit rate +15%, crit x2.5
      const isLongVan = beast.passive === 'long_van';
      const critR   = 0.15
        + (m.data?.cong_phap === 'diet_tien' ? 0.20 : 0)
        + (isLongVan ? 0.15 : 0)
        + getTT(m.data || {}, 'crit')
        + (m.data?.huyet_mach === 'tu_la'     && m.data?.noi_tai_an_unlocked ? 0.15 : 0)
        + (m.data?.huyet_mach === 'thien_long' && m.data?.noi_tai_an_unlocked ? 0.20 : 0)
        + (m.data?.huyet_mach === 'hon_don_the' && m.data?.noi_tai_an_unlocked ? 0.30 : 0);
      const isCrit  = Math.random() < critR;
      const critMult = isLongVan ? 2.5 : 2.0;
      const dmg     = Math.floor(baseDmg * (isCrit ? critMult : 1.0) * (0.88 + Math.random() * 0.24));

      // Passive huyen_giap: hấp thụ 20%, phản 5%
      let actualDmg = dmg;
      if (beast.passive === 'huyen_giap') {
        actualDmg = Math.floor(dmg * 0.80);
        const reflect = Math.floor(dmg * 0.05);
        m.hp = Math.max(0, m.hp - reflect);
        if (reflect > 0) log.push(`🐢 **Huyền Giáp** — hấp thụ 20%, phản lại **${fmt(reflect)}** cho **${m.name}**!`);
      }

      if (action.type === 'bi_phap' && action.bp_id) {
        log.push(`${isCrit ? '💥 CHÍ MẠNG! ' : '⚔️ '}**${m.name}** thi triển bí pháp — gây **${fmt(actualDmg)}** sát thương!`);
      } else {
        log.push(`${isCrit ? '💥 CHÍ MẠNG! ' : '⚔️ '}**${m.name}** tấn công — gây **${fmt(actualDmg)}** sát thương!`);
      }

      totalDmgToBeast += actualDmg;

      // Passive kim_than: hấp thụ 12% → hồi HP
      if (beast.passive === 'kim_than') {
        const absorbed = Math.floor(actualDmg * 0.12);
        beast.hp = Math.min(beast.hp_max, beast.hp + absorbed);
      }

      // Passive khat_mau: hồi 8% sát thương
      if (beast.passive === 'khat_mau') {
        const lifesteal = Math.floor(actualDmg * 0.08);
        beast.hp = Math.min(beast.hp_max, beast.hp + lifesteal);
      }
    }

    m.action    = null;
    m.defending = false;
    m.shield_mult = null;
  }

  // Trừ HP linh thú
  let actualBeastDmg = totalDmgToBeast;
  if (beast.invincible > 0) {
    log.push(`✨ **${beast.mu} ${beast.ten}** bất tử — toàn bộ sát thương bị vô hiệu!`);
    actualBeastDmg = 0;
    if (beast.counter_rate > 0) {
      const counterDmg = Math.floor(totalDmgToBeast * beast.counter_rate);
      const target = pickRandom(alive);
      target.hp = Math.max(0, target.hp - counterDmg);
      log.push(`🌀 **${beast.mu} ${beast.ten}** phản đòn **${target.name}** — **${fmt(counterDmg)}** sát thương!`);
    }
  }
  if (actualBeastDmg > 0) beast.hp = Math.max(0, beast.hp - actualBeastDmg);

  // Passive lua_hoi_sinh: hồi sinh 1 lần khi HP về 0
  if (beast.hp <= 0 && beast.passive === 'lua_hoi_sinh' && !beast.passive_triggered) {
    beast.passive_triggered = true;
    beast.hp = Math.floor(beast.hp_max * 0.20);
    log.push(`♻️ **${beast.mu} ${beast.ten}** *(Lửa Hồi Sinh)* — hồi sinh với **${fmt(beast.hp)}** HP!`);
  }

  // Kiểm tra thú chết
  if (beast.hp <= 0) {
    session.turn++;
    return { done: true, win: true, log };
  }

  // Vào phase 2
  if (!beast.phase2 && beast.hp / beast.hp_max < 0.50) {
    beast.phase2 = true;
    log.push(`${CE('warn_icon','⚠️')} **${beast.mu} ${beast.ten}** bị thương nặng — **bước vào Phase 2**, hung hãn hơn hẳn!`);
  }

  // ── 4. Linh thú hành động ────────────────────────────────────────────
  const aliveAfter = members.filter(m => m.alive && m.hp > 0);
  if (aliveAfter.length > 0) {
    _beastAct(beast, aliveAfter, log, session);
  }

  // ── 4b. Thần thông Hồi Xuân — hồi phục cuối lượt ─────────────────────
  for (const m of members.filter(mv => mv.alive && mv.hp > 0)) {
    const regenPct = getTT(m.data || {}, 'regen_pct');
    if (regenPct > 0) {
      const regenAmt = Math.floor(m.hp_max * regenPct);
      if (regenAmt > 0) {
        m.hp = Math.min(m.hp_max, m.hp + regenAmt);
        log.push(`🌸 *Hồi Xuân* **${m.name}** — hồi +**${fmt(regenAmt)}** HP!`);
      }
    }

    // Nội Tại Ẩn — HP regen per turn
    const d = m.data || {};
    if (d.noi_tai_an_unlocked) {
      let ntaRegen = 0, ntaLabel = '';
      if (d.huyet_mach === 'thien_long')   { ntaRegen = 0.10; ntaLabel = '👑Thiên Long Uy Linh'; }
      else if (d.huyet_mach === 'hon_don_the') { ntaRegen = 0.15; ntaLabel = '🌀Hỗn Độn Khai Thiên'; }
      if (ntaRegen > 0) {
        const regenAmt = Math.floor(m.hp_max * ntaRegen);
        m.hp = Math.min(m.hp_max, m.hp + regenAmt);
        log.push(`✨ [${ntaLabel}] **${m.name}** hồi +**${fmt(regenAmt)}** HP!`);
      }
    }
  }

  // ── 5. Cập nhật alive ────────────────────────────────────────────────
  for (const m of members) {
    if (m.hp <= 0 && m.alive) {
      m.alive = false;
      m.hp    = 0;
      log.push(`💀 **${m.name}** đã ngã xuống trong trận chiến!`);
    }
  }

  session.turn++;
  const stillAlive = members.filter(m => m.alive);
  if (stillAlive.length === 0) {
    return { done: true, win: false, log };
  }
  if (session.turn > session.max_turns) {
    log.push(`⏰ Hết thời gian! **${beast.mu} ${beast.ten}** đã thoát khỏi cuộc săn!`);
    return { done: true, win: false, log };
  }

  return { done: false, win: false, log };
}

// ── Passive đầu lượt ─────────────────────────────────────────────────────────
function _beastPassiveStartOfTurn(beast, alive, log) {
  if (!beast.passive || alive.length === 0) return;

  switch (beast.passive) {

    // Hỏa Hồ: đốt toàn đội 3% HP
    case 'than_hoa': {
      for (const m of alive) {
        const dmg = Math.floor(m.hp_max * 0.03);
        m.hp = Math.max(0, m.hp - dmg);
      }
      log.push(`🔥 **Thân Hỏa** — ${beast.ten} tản nhiệt, toàn đội mất 3% HP!`);
      break;
    }

    // Băng Hùng: hồi 2% HP
    case 'bang_giap': {
      const h = Math.floor(beast.hp_max * 0.02);
      beast.hp = Math.min(beast.hp_max, beast.hp + h);
      log.push(`❄️ **Băng Giáp** — ${beast.ten} hồi +${fmt(h)} HP!`);
      break;
    }

    // Địa Long: hồi 4% HP
    case 'tai_sinh_dia': {
      const h = Math.floor(beast.hp_max * 0.04);
      beast.hp = Math.min(beast.hp_max, beast.hp + h);
      log.push(`🌱 **Tái Sinh Địa** — ${beast.ten} hồi +${fmt(h)} HP từ đất!`);
      break;
    }

    // Băng Phượng: 50% đóng băng 1 người ngẫu nhiên
    case 'vinh_han': {
      if (Math.random() < 0.50) {
        const t = pickRandom(alive);
        if (t.frozen === 0) {
          t.frozen = 1;
          log.push(`🧊 **Vĩnh Hàn** — ${beast.ten} đóng băng **${t.name}** 1 lượt!`);
        }
      }
      break;
    }

    // Địa Ngục Quỷ: giảm ATK toàn đội 8% (stack đến 2 lần = 16%)
    case 'dia_nguc_khi': {
      if (beast.passive_stacks < 2) {
        beast.passive_stacks++;
        for (const m of alive) {
          m.atk_reduced = Math.max(m.atk_reduced || 0, beast.passive_stacks);
        }
        log.push(`💀 **Địa Ngục Khí** — giảm ATK toàn đội 8% (stack ${beast.passive_stacks}/2)!`);
      }
      break;
    }

    // Cửu Vĩ Hồ: hồi 6% HP khi HP < 40%
    case 'cuu_linh': {
      if (beast.hp / beast.hp_max < 0.40) {
        const h = Math.floor(beast.hp_max * 0.06);
        beast.hp = Math.min(beast.hp_max, beast.hp + h);
        log.push(`🌀 **Cửu Linh** — ${beast.ten} hồi +${fmt(h)} HP (HP thấp)!`);
      }
      break;
    }

    // Hỗn Độn Thú: buff ngẫu nhiên (giảm từ 40/50/10 → 25/30/6)
    case 'hon_loan': {
      const roll = Math.random();
      if (roll < 0.33) {
        beast.atk_boost = Math.max(beast.atk_boost, 1);
        log.push(`🌀 **Hỗn Loạn** — ${beast.ten} bùng phát ATK +25% lượt này!`);
      } else if (roll < 0.66) {
        beast.def_boost = Math.max(beast.def_boost, 1);
        log.push(`🌀 **Hỗn Loạn** — ${beast.ten} tăng cường DEF +30% lượt này!`);
      } else {
        const h = Math.floor(beast.hp_max * 0.06);
        beast.hp = Math.min(beast.hp_max, beast.hp + h);
        log.push(`🌀 **Hỗn Loạn** — ${beast.ten} hồi +${fmt(h)} HP!`);
      }
      break;
    }

    // Tiên Linh: 12% vô hiệu hóa 1 hành động
    case 'tien_phep': {
      if (Math.random() < 0.12) {
        const t = pickRandom(alive);
        t._voihoa = true;
        log.push(`✨ **Tiên Phép** — ${beast.ten} vô hiệu hành động của **${t.name}** lượt này!`);
      }
      break;
    }

    // Thái Cổ Long: khi HP < 40% miễn hiệu ứng
    case 'thai_co_bat_diet': {
      if (beast.hp / beast.hp_max < 0.40) {
        beast.def_boost = Math.max(beast.def_boost, 1);
        // Xóa hiệu ứng trạng thái (nếu có logic bên ngoài)
        log.push(`♾️ **Thái Cổ Bất Diệt** — ${beast.ten} DEF nhân đôi, miễn hiệu ứng trạng thái!`);
      }
      break;
    }
  }
}

// ── Xử lý hành động của linh thú ────────────────────────────────────────────
function _beastAct(beast, alive, log, session) {
  const action = pickBeastAction(session);

  // Passive atk_boost nhân 1.25 (hon_loan/bach_ho)
  const atkBoostMult = beast.atk_boost > 0 ? 1.25 : 1;
  // Passive def_boost nhân 1.30 (kim_cuong_the/thai_co)
  const defBoostMult = beast.def_boost > 0 ? 1.30 : 1;

  if (action === 'skill') {
    _beastSkill(beast, alive, log);
    beast.skill_cd_rem = beast.skill_cd;
    return;
  }

  if (action === 'skill2') {
    _beastSkill2(beast, alive, log);
    beast.skill2_cd_rem = beast.skill2_cd;
    return;
  }

  if (action === 'heal') {
    const healAmt = Math.floor(beast.hp_max * 0.10);
    beast.hp = Math.min(beast.hp_max, beast.hp + healAmt);
    log.push(`💚 **${beast.mu} ${beast.ten}** hấp thu linh khí — hồi +**${fmt(healAmt)}** HP!`);
    return;
  }

  if (action === 'power') {
    const target  = pickRandom(alive);
    const defMul  = target.defending ? (target.shield_mult || 0.35) : 1;
    const defStat = Math.floor(target.def * (target.def_reduced > 0 ? 0.65 : 1) / defBoostMult);

    // Passive thien_sat: one-shot nếu HP < 25%
    if (beast.passive === 'thien_sat' && target.hp / target.hp_max < 0.25 && Math.random() < 0.20) {
      target.hp = 0;
      log.push(`🐯 **${beast.mu} ${beast.ten}** *(Thiên Sát)* THIÊN SÁT — **${target.name}** bị hủy diệt tức thì!`);
      return;
    }

    const rawDmg = Math.floor(beast.atk * atkBoostMult * 1.50 * (0.88 + Math.random() * 0.24));
    const dmg    = Math.max(1, Math.floor((rawDmg - defStat * 0.35) * defMul));

    // Passive doc_tich_luy: 30% gây độc
    if (beast.passive === 'doc_tich_luy' && Math.random() < 0.30) {
      target.burn = Math.max(target.burn || 0, 2);
      log.push(`🐺 **${beast.mu} ${beast.ten}** bùng phát sức mạnh — **${fmt(dmg)}** + nhiễm độc **${target.name}**!`);
    } else {
      log.push(`💥 **${beast.mu} ${beast.ten}** bùng phát sức mạnh — giáng **${fmt(dmg)}** lên **${target.name}**!`);
    }

    // Passive phong_dien: 25% choáng
    if (beast.passive === 'phong_dien' && Math.random() < 0.25) {
      target.stun = 1;
      log.push(`${CE("tia_set","⚡")} **Phóng Điện** — **${target.name}** bị choáng 1 lượt!`);
    }

    const dodgePwr = getTT(target.data || {}, 'dodge') > 0 && Math.random() < getTT(target.data || {}, 'dodge');
    if (dodgePwr) {
      log.push(`🌊 **${target.name}** khinh công né tránh đòn bùng phát! *(Thần Thông)*`);
    } else {
      const dmgRedPwr = getTT(target.data || {}, 'dmg_reduce');
      const finalDmgPwr = dmgRedPwr > 0 ? Math.max(1, Math.floor(dmg * (1 - dmgRedPwr))) : dmg;
      target.hp = Math.max(0, target.hp - finalDmgPwr);
    }
    return;
  }

  if (action === 'aoe') {
    log.push(`🌊 **${beast.mu} ${beast.ten}** tung đòn diện — tấn công toàn đội!`);
    for (const m of alive) {
      const defMul  = m.defending ? (m.shield_mult || 0.35) : 1;
      const defStat = Math.floor(m.def * (m.def_reduced > 0 ? 0.65 : 1) / defBoostMult);
      const rawDmg  = Math.floor(beast.atk * atkBoostMult * 0.85 * (0.82 + Math.random() * 0.36));
      const dmg     = Math.max(1, Math.floor((rawDmg - defStat * 0.25) * defMul));
      const dmgRedAoe = getTT(m.data || {}, 'dmg_reduce');
      const finalDmgAoe = dmgRedAoe > 0 ? Math.max(1, Math.floor(dmg * (1 - dmgRedAoe))) : dmg;
      m.hp          = Math.max(0, m.hp - finalDmgAoe);
      log.push(`  ↳ **${m.name}** nhận **${fmt(finalDmgAoe)}** sát thương${dmgRedAoe > 0 ? ' *(giảm TT)*' : ''}`);
    }
    return;
  }

  // Tấn công thường
  const target  = pickRandom(alive);
  const defMul  = target.defending ? (target.shield_mult || 0.35) : 1;
  const defStat = Math.floor(target.def * (target.def_reduced > 0 ? 0.65 : 1) / defBoostMult);
  const rawDmg  = Math.floor(beast.atk * atkBoostMult * (0.95 + Math.random() * 0.22));
  let dmg       = Math.max(1, Math.floor((rawDmg - defStat * 0.38) * defMul));

  const dodgeNorm = getTT(target.data || {}, 'dodge') > 0 && Math.random() < getTT(target.data || {}, 'dodge');
  if (dodgeNorm) {
    log.push(`🌊 **${target.name}** khinh công né tránh đòn! *(Thần Thông)*`);
    return;
  }
  const dmgRedNorm = getTT(target.data || {}, 'dmg_reduce');
  if (dmgRedNorm > 0) dmg = Math.max(1, Math.floor(dmg * (1 - dmgRedNorm)));

  // Passive lien_kich (Phong Ưng): đánh 2 lần
  if (beast.passive === 'lien_kich') {
    const dmg2 = Math.floor(dmg * 0.80);
    target.hp  = Math.max(0, target.hp - dmg - dmg2);
    log.push(`🦅 **${beast.mu} ${beast.ten}** liên kích **${target.name}** — **${fmt(dmg)}** + **${fmt(dmg2)}**!`);
  } else {
    target.hp = Math.max(0, target.hp - dmg);

    // Passive doc_tich_luy: 30% gây độc khi tấn công thường
    if (beast.passive === 'doc_tich_luy' && Math.random() < 0.30) {
      target.burn = Math.max(target.burn || 0, 1);
      log.push(`${CE("tia_set","⚡")} **${beast.mu} ${beast.ten}** tấn công **${target.name}** — **${fmt(dmg)}** + nhiễm độc!`);
    } else if (beast.passive === 'phong_dien' && Math.random() < 0.25) {
      target.stun = 1;
      log.push(`${CE("tia_set","⚡")} **${beast.mu} ${beast.ten}** tấn công **${target.name}** — **${fmt(dmg)}** + choáng!`);
    } else {
      log.push(`${CE("tia_set","⚡")} **${beast.mu} ${beast.ten}** tấn công **${target.name}** — gây **${fmt(dmg)}** sát thương!`);
    }
  }
}

// ── Kỹ năng đặc biệt của linh thú ──────────────────────────────────────────
function _beastSkill(beast, alive, log) {
  const s     = beast.skill;
  const atkB  = beast.atk_boost > 0 ? 1.40 : 1;

  const skillName = beast.skill_desc.split(' — ')[0];
  log.push(`🌟 **${beast.mu} ${beast.ten}** thi triển **${skillName}**!`);

  // ── Phổ thông ──────────────────────────────────────────────────────────
  if (s === 'doc_nha') {
    const t   = pickRandom(alive);
    t.burn    = Math.max(t.burn || 0, 3);
    const dmg = Math.floor(beast.atk * atkB * 1.4);
    t.hp = Math.max(0, t.hp - dmg);
    log.push(`🐺 **${t.name}** bị cắn độc — **${fmt(dmg)}** sát thương + nhiễm độc 3 lượt!`);

  } else if (s === 'hoa_thiet') {
    for (const m of alive) m.def_reduced = Math.max(m.def_reduced || 0, 3);
    for (const m of alive) {
      const dmg = Math.floor(beast.atk * atkB * 0.70);
      m.hp = Math.max(0, m.hp - dmg);
      log.push(`  ↳ **${m.name}** nhận **${fmt(dmg)}** + giảm DEF 25% trong 3 lượt!`);
    }

  } else if (s === 'bang_chua') {
    for (const m of alive) m.frozen = 1;
    const dmg = Math.floor(beast.atk * atkB * 0.80);
    for (const m of alive) m.hp = Math.max(0, m.hp - dmg);
    log.push(`🐻 Toàn đội bị đóng băng — mỗi người nhận **${fmt(dmg)}** + bỏ lượt tiếp theo!`);

  } else if (s === 'dia_chan') {
    for (const m of alive) {
      const defStat = Math.floor(m.def * (m.def_reduced > 0 ? 0.65 : 1));
      const dmg     = Math.max(1, Math.floor(beast.atk * atkB * 1.0 - defStat * 0.25));
      m.hp = Math.max(0, m.hp - dmg);
      log.push(`  ↳ **${m.name}** nhận **${fmt(dmg)}** sát thương (xuyên phá 40% giáp)`);
    }

  // ── Hiếm ──────────────────────────────────────────────────────────────
  } else if (s === 'loi_dien') {
    for (const m of alive) {
      m.stun = 1;
      const dmg = Math.floor(beast.atk * atkB * 1.6);
      m.hp = Math.max(0, m.hp - dmg);
      log.push(`${CE("tia_set","⚡")} **${m.name}** bị choáng điện — **${fmt(dmg)}** + bỏ 1 lượt!`);
    }

  } else if (s === 'dia_truong') {
    for (const m of alive) {
      const dmg = Math.max(1, Math.floor(beast.atk * atkB * 1.2));
      m.hp = Math.max(0, m.hp - dmg);
      log.push(`  ↳ **${m.name}** nhận **${fmt(dmg)}** sát thương (xuyên phá 50% giáp)`);
    }

  } else if (s === 'vu_phong') {
    const t = pickRandom(alive);
    const d1 = Math.floor(beast.atk * atkB * 0.90);
    const d2 = Math.floor(beast.atk * atkB * 0.90);
    const d3 = Math.floor(beast.atk * atkB * 0.90);
    t.hp = Math.max(0, t.hp - d1 - d2 - d3);
    log.push(`🦅 **${t.name}** bị tam liên kích — **${fmt(d1)}** + **${fmt(d2)}** + **${fmt(d3)}**!`);

  } else if (s === 'am_nguyen') {
    for (const m of alive) m.atk_reduced = Math.max(m.atk_reduced || 0, 4);
    log.push(`🦜 Ám Nguyền phủ xuống — toàn đội giảm ATK 20% trong 4 lượt!`);

  // ── Sử thi ────────────────────────────────────────────────────────────
  } else if (s === 'huyet_ho') {
    const healAmt = Math.floor(beast.hp_max * 0.25);
    beast.hp = Math.min(beast.hp_max, beast.hp + healAmt);
    log.push(`🦁 Huyết Hống — hồi **${fmt(healAmt)}** HP!`);
    for (const m of alive) {
      const dmg = Math.max(1, Math.floor(beast.atk * atkB * 0.90 - m.def * 0.25));
      m.hp = Math.max(0, m.hp - dmg);
      log.push(`  ↳ **${m.name}** nhận **${fmt(dmg)}** sát thương`);
    }

  } else if (s === 'bang_pha') {
    for (const m of alive) {
      m.frozen  = 1;
      const dmg = Math.max(1, Math.floor(beast.atk * atkB * 1.0));
      m.hp = Math.max(0, m.hp - dmg);
      log.push(`🦚 **${m.name}** bị Băng Phá — **${fmt(dmg)}** + đóng băng 1 lượt!`);
    }

  } else if (s === 'hon_don_kham') {
    for (const m of alive) m.def_reduced = Math.max(m.def_reduced || 0, 3);
    for (const m of alive) {
      const dmg = Math.floor(beast.atk * atkB * 1.2);
      m.hp = Math.max(0, m.hp - dmg);
      log.push(`  ↳ **${m.name}** nhận **${fmt(dmg)}** + DEF giảm 35% trong 3 lượt!`);
    }

  } else if (s === 'kim_cuong_the') {
    beast.def_boost = 3;
    beast.counter_rate = 0.15;
    log.push(`🐦 Kim Cương Thể — DEF tăng 80% trong 3 lượt + phản 15% sát thương!`);

  // ── Huyền thoại ───────────────────────────────────────────────────────
  } else if (s === 'cuu_vi_lua') {
    for (const m of alive) m.burn = Math.max(m.burn || 0, 4);
    for (const m of alive) {
      const dmg = Math.floor(beast.atk * atkB * 0.60);
      m.hp = Math.max(0, m.hp - dmg);
    }
    log.push(`🦊 Cửu Vĩ Nghiệt Hỏa — toàn đội bốc cháy 10% HP mỗi lượt trong 4 lượt + gây thêm sát thương!`);

  } else if (s === 'thanh_long_ao') {
    for (const m of alive) {
      const dmg = Math.max(1, Math.floor(beast.atk * atkB * 1.5 - m.def * 0.20));
      m.hp = Math.max(0, m.hp - dmg);
      log.push(`  ↳ **${m.name}** nhận **${fmt(dmg)}** sát thương (xuyên phá 60% DEF, crit x3)`);
    }

  } else if (s === 'bach_ho_ao') {
    beast.atk_boost = 3;
    const t   = pickRandom(alive);
    const dmg = Math.floor(beast.atk * atkB * 2.0);
    t.hp = Math.max(0, t.hp - dmg);
    log.push(`🐯 Bạch Hổ Bạo Hống — **${t.name}** nhận **${fmt(dmg)}** + ATK thú tăng 100% trong 3 lượt!`);

  } else if (s === 'huyen_vu_tram') {
    beast.invincible   = 2;
    beast.counter_rate = 0.40;
    log.push(`🐢 Huyền Vũ Trấn — bất tử 2 lượt, phản lại 40% sát thương!`);

  } else if (s === 'chu_tuoc_liem') {
    const t   = pickRandom(alive);
    t.burn    = Math.max(t.burn || 0, 3);
    const dmg = Math.floor(beast.atk * atkB * 2.5);
    t.hp = Math.max(0, t.hp - dmg);
    log.push(`🦚 Chu Tước Liệt Hỏa — **${t.name}** bị thiêu đốt **${fmt(dmg)}** + cháy 3 lượt!`);

  // ── Thần thú ──────────────────────────────────────────────────────────
  } else if (s === 'hon_don_manh') {
    const hits = rngInt(3, 5);
    const tgts = Array.from({ length: hits }, () => pickRandom(alive));
    let total  = 0;
    for (const t of tgts) {
      const dmg = Math.floor(beast.atk * atkB * 0.90);
      t.hp   = Math.max(0, t.hp - dmg);
      total += dmg;
    }
    log.push(`👾 Hỗn Độn Mãnh Kích — **${hits}** đòn liên kích, tổng **${fmt(total)}** sát thương!`);

  } else if (s === 'thai_co_ao') {
    const t       = pickRandom(alive);
    const healAmt = Math.floor(beast.hp_max * 0.35);
    beast.hp = Math.min(beast.hp_max, beast.hp + healAmt);
    const dmg = Math.floor(beast.atk * atkB * 2.5);
    t.hp = Math.max(0, t.hp - dmg);
    log.push(`🐲 Thái Cổ Ngao — **${t.name}** nhận **${fmt(dmg)}** + thú hồi **${fmt(healAmt)}** HP!`);

  } else if (s === 'thien_vu_tinh') {
    log.push(`✨ Thiên Vũ Tịnh Hóa — hút cạn 30% linh lực hiện tại của toàn đội!`);
    for (const m of alive) {
      const dmg = Math.floor(m.hp * 0.30);
      m.hp = Math.max(1, m.hp - dmg);
      log.push(`  ↳ **${m.name}** mất **${fmt(dmg)}** HP — còn **${fmt(m.hp)}**`);
    }
  }
}

// ── Kỹ năng thứ hai của linh thú ───────────────────────────────────────────────
  function _beastSkill2(beast, alive, log) {
    if (!beast.skill2 || alive.length === 0) return;
    const s    = beast.skill2;
    const atkB = beast.atk_boost > 0 ? 1.40 : 1;

    const skillName = beast.skill2_desc.split(' — ')[0];
    log.push(`${CE("tia_set","⚡")} **${beast.mu} ${beast.ten}** tung ra **${skillName}**!`);

    // ── Phổ thông ──────────────────────────────────────────────────────────
    if (s === 'bao_thu') {
      // Độc Lang: tăng ATK 60% 2 lượt + 2 đòn liên tiếp
      beast.atk_boost = Math.max(beast.atk_boost, 2);
      const t  = pickRandom(alive);
      const d1 = Math.floor(beast.atk * atkB * 1.4);
      const d2 = Math.floor(beast.atk * atkB * 1.0);
      t.hp = Math.max(0, t.hp - d1 - d2);
      log.push(`🐺 **${t.name}** hứng hai đòn bạo — **${fmt(d1)}** + **${fmt(d2)}** + ATK thú tăng 60% trong 2 lượt!`);

    } else if (s === 'hoa_cuong') {
      // Hỏa Hồ: ATK +50% 3 lượt + đốt toàn đội 2 lượt
      beast.atk_boost = Math.max(beast.atk_boost, 3);
      for (const m of alive) {
        m.burn = Math.max(m.burn || 0, 2);
        const dmg = Math.floor(beast.atk * atkB * 0.60);
        m.hp = Math.max(0, m.hp - dmg);
      }
      log.push(`🦊 Hỏa Cuồng bùng phát — ATK tăng 50% trong 3 lượt + toàn đội bốc cháy 2 lượt!`);

    } else if (s === 'bang_than') {
      // Băng Hùng: DEF tăng 80% 2 lượt + hồi 12% HP
      beast.def_boost = Math.max(beast.def_boost, 2);
      const healAmt = Math.floor(beast.hp_max * 0.12);
      beast.hp = Math.min(beast.hp_max, beast.hp + healAmt);
      log.push(`🐻 Băng Thân Kiên Cố — DEF tăng 80% trong 2 lượt + hồi **${fmt(healAmt)}** HP!`);

    } else if (s === 'dia_sut') {
      // Địa Nha: 120% ATK + giảm ATK mục tiêu 3 lượt
      const t   = pickRandom(alive);
      t.atk_reduced = Math.max(t.atk_reduced || 0, 3);
      const dmg = Math.floor(beast.atk * atkB * 1.2);
      t.hp = Math.max(0, t.hp - dmg);
      log.push(`🦎 **${t.name}** bị Đất Sụt — **${fmt(dmg)}** + ATK giảm 20% trong 3 lượt!`);

    // ── Hiếm ──────────────────────────────────────────────────────────────
    } else if (s === 'bao_song_loi') {
      // Lôi Báo: AOE 130% ATK + 40% choáng mỗi người
      for (const m of alive) {
        const dmg = Math.floor(beast.atk * atkB * 1.3);
        m.hp = Math.max(0, m.hp - dmg);
        if (Math.random() < 0.40) {
          m.stun = Math.max(m.stun || 0, 1);
          log.push(`  ↳ **${m.name}** nhận **${fmt(dmg)}** + choáng điện 1 lượt!`);
        } else {
          log.push(`  ↳ **${m.name}** nhận **${fmt(dmg)}** sát thương!`);
        }
      }

    } else if (s === 'dia_mach_hoi') {
      // Địa Long: hồi 25% HP + DEF +40% 2 lượt
      const healAmt = Math.floor(beast.hp_max * 0.25);
      beast.hp = Math.min(beast.hp_max, beast.hp + healAmt);
      beast.def_boost = Math.max(beast.def_boost, 2);
      log.push(`🐉 Địa Mạch Linh Hồi — hồi **${fmt(healAmt)}** HP + DEF tăng 40% trong 2 lượt!`);

    } else if (s === 'xuyen_nguc') {
      // Phong Ưng: đòn đơn 220% ATK xuyên 80% DEF
      const t = pickRandom(alive);
      const defMul = t.defending ? (t.shield_mult || 0.35) : 1;
      const rawDmg = Math.floor(beast.atk * atkB * 2.2);
      const defStat = Math.floor(t.def * (t.def_reduced > 0 ? 0.65 : 1) * 0.20); // chỉ 20% DEF
      const dmg = Math.max(1, Math.floor((rawDmg - defStat) * defMul));
      t.hp = Math.max(0, t.hp - dmg);
      log.push(`🦅 Xuyên Ngực — **${t.name}** nhận **${fmt(dmg)}** (xuyên phá 80% giáp)!`);

    } else if (s === 'am_pha') {
      // Ám Thước: 120% ATK + khóa Hộ Thể & Hồi Khí 2 lượt
      const t = pickRandom(alive);
      t.action_cd.the    = Math.max(t.action_cd.the    || 0, 2);
      t.action_cd.hoikhi = Math.max(t.action_cd.hoikhi || 0, 2);
      const dmg = Math.floor(beast.atk * atkB * 1.2);
      t.hp = Math.max(0, t.hp - dmg);
      log.push(`🦜 Ám Phá — **${t.name}** nhận **${fmt(dmg)}** + không thể Hộ Thể/Hồi Khí trong 2 lượt!`);

    // ── Sử thi ────────────────────────────────────────────────────────────
    } else if (s === 'hung_phan') {
      // Huyết Sư: ATK +80% 2 lượt + 150% ATK + choáng mục tiêu
      beast.atk_boost = Math.max(beast.atk_boost, 2);
      const t   = pickRandom(alive);
      t.stun    = Math.max(t.stun || 0, 1);
      const dmg = Math.floor(beast.atk * atkB * 1.5);
      t.hp = Math.max(0, t.hp - dmg);
      log.push(`🦁 Hùng Phẫn Bạo Kích — **${t.name}** nhận **${fmt(dmg)}** + choáng 1 lượt + ATK thú tăng 80%!`);

    } else if (s === 'tuyet_bao') {
      // Băng Phượng: đóng băng toàn đội 2 lượt + 80% ATK
      for (const m of alive) {
        m.frozen = Math.max(m.frozen || 0, 2);
        const dmg = Math.floor(beast.atk * atkB * 0.80);
        m.hp = Math.max(0, m.hp - dmg);
        log.push(`  ↳ **${m.name}** nhận **${fmt(dmg)}** + bị đóng băng 2 lượt!`);
      }

    } else if (s === 'am_quy_hut') {
      // Địa Ngục Quỷ: 200% ATK + hút máu 50%
      const t       = pickRandom(alive);
      const dmg     = Math.floor(beast.atk * atkB * 2.0);
      t.hp = Math.max(0, t.hp - dmg);
      const healAmt = Math.floor(dmg * 0.50);
      beast.hp = Math.min(beast.hp_max, beast.hp + healAmt);
      log.push(`${CE("tam_ac","👿")} Địa Ngục Quỷ Kịch — **${t.name}** nhận **${fmt(dmg)}** + thú hút máu hồi **${fmt(healAmt)}** HP!`);

    } else if (s === 'kim_nen_kiep') {
      // Kim Tước: 5 nhát 70% ATK
      const t = pickRandom(alive);
      let total = 0;
      for (let i = 0; i < 5; i++) {
        const dmg = Math.floor(beast.atk * atkB * 0.70);
        t.hp = Math.max(0, t.hp - dmg);
        total += dmg;
      }
      log.push(`🐦 Kim Nghiêm Liên Kiếm — 5 nhát vào **${t.name}**, tổng **${fmt(total)}** sát thương!`);

    // ── Huyền thoại ───────────────────────────────────────────────────────
    } else if (s === 'cuu_vi_tan') {
      // Cửu Vĩ Hồ: nhân đôi burn stacks + AOE 100% ATK
      for (const m of alive) {
        if (m.burn > 0) m.burn = Math.min(m.burn * 2, 8);
        const dmg = Math.floor(beast.atk * atkB * 1.0);
        m.hp = Math.max(0, m.hp - dmg);
        log.push(`  ↳ **${m.name}** nhận **${fmt(dmg)}** + cháy nhân đôi (${m.burn} lượt còn lại)!`);
      }

    } else if (s === 'long_ao_thien') {
      // Thanh Long: đòn đơn 280% ATK xuyên 100% DEF
      const t   = pickRandom(alive);
      const dmg = Math.floor(beast.atk * atkB * 2.8);
      t.hp = Math.max(0, t.hp - dmg);
      log.push(`🐉 Long Ngạo Thiên Hạ — **${t.name}** bị hủy diệt **${fmt(dmg)}** (xuyên phá 100% DEF)!`);

    } else if (s === 'ba_vuong_linh') {
      // Bạch Hổ: choáng toàn đội (1 người 2 lượt, còn lại 1 lượt)
      const t = pickRandom(alive);
      for (const m of alive) {
        const dur = (m === t) ? 2 : 1;
        m.stun = Math.max(m.stun || 0, dur);
        const dmg = Math.floor(beast.atk * atkB * 0.80);
        m.hp = Math.max(0, m.hp - dmg);
        log.push(`  ↳ **${m.name}** nhận **${fmt(dmg)}** + choáng ${dur} lượt!`);
      }

    } else if (s === 'hoan_vu_phuc_giap') {
      // Huyền Vũ: hồi 30% HP + bất tử 1 lượt + phản 50%
      const healAmt = Math.floor(beast.hp_max * 0.30);
      beast.hp = Math.min(beast.hp_max, beast.hp + healAmt);
      beast.invincible   = Math.max(beast.invincible || 0, 1);
      beast.counter_rate = Math.max(beast.counter_rate || 0, 0.50);
      log.push(`🐢 Hoàn Vũ Phục Giáp — hồi **${fmt(healAmt)}** HP + bất tử 1 lượt + phản 50% sát thương!`);

    } else if (s === 'phuong_hoa_thien') {
      // Chu Tước: đốt toàn đội 5 lượt + AOE 80% ATK
      for (const m of alive) {
        m.burn = Math.max(m.burn || 0, 5);
        const dmg = Math.floor(beast.atk * atkB * 0.80);
        m.hp = Math.max(0, m.hp - dmg);
        log.push(`  ↳ **${m.name}** nhận **${fmt(dmg)}** + cháy 5 lượt (10% HP/lượt)!`);
      }

    // ── Thần thú ──────────────────────────────────────────────────────────
    } else if (s === 'hon_don_hu_vo') {
      // Hỗn Độn Thú: hút 18% HP hiện tại toàn đội + bất tử 1 lượt
      beast.invincible = Math.max(beast.invincible || 0, 1);
      for (const m of alive) {
        const dmg = Math.floor(m.hp * 0.18);
        m.hp = Math.max(1, m.hp - dmg);
        log.push(`  ↳ **${m.name}** mất 18% HP hiện tại — còn **${fmt(m.hp)}**!`);
      }

    } else if (s === 'thai_co_tru_thien') {
      // Thái Cổ Long: 20% HP max cố định toàn đội, bỏ qua DEF
      for (const m of alive) {
        const dmg = Math.floor(m.hp_max * 0.20);
        m.hp = Math.max(0, m.hp - dmg);
        log.push(`  ↳ **${m.name}** nhận **${fmt(dmg)}** sát thương cố định (20% HP max, bỏ qua giáp)!`);
      }

    } else if (s === 'tien_phap_trao_doi') {
      // Tiên Linh: hoán đổi HP với thành viên HP cao nhất
      const richest = alive.reduce((a, b) => (b.hp > a.hp ? b : a), alive[0]);
      if (richest) {
        const bHp = beast.hp;
        const mHp = richest.hp;
        beast.hp    = Math.min(beast.hp_max,    mHp);
        richest.hp  = Math.min(richest.hp_max,  bHp);
        log.push(`✨ Tiên Pháp Trao Đổi — HP **${richest.name}** (${fmt(mHp)}) và thú (${fmt(bHp)}) hoán đổi!`);
      }
    }
  }

  // ── Tính phần thưởng ─────────────────────────────────────────────────────────
function calcSanRewards(tier, memberCount, playerRow) {
  const r = LINH_THU_REWARDS[tier];
  if (!r) return { exp_add: 0 };

  const { CANH_GIOI } = require('../data/canh_gioi');
  const cg = CANH_GIOI[playerRow.canh_gioi] || CANH_GIOI[0];
  const expNeeded = cg?.exp_next || 10000;

  const teamBonus = memberCount === 3 ? 1.30 : memberCount === 2 ? 1.15 : 1.0;
  const expAdd    = Math.floor(expNeeded * rng(r.exp_pct[0], r.exp_pct[1]) * teamBonus);

  return { exp_add: expAdd };
}

// ── Tính loot drops ──────────────────────────────────────────────────────────
/**
 * Tính các món đồ rơi sau khi giết linh thú.
 * @param {string} tier
 * @param {number} memberCount
 * @returns {string[]} mảng item_id đã rơi
 */
function calcSanLoot(tier, memberCount) {
  const pool = LINH_THU_LOOT[tier];
  if (!pool) return [];

  const teamBonus = memberCount === 3 ? 1.25 : memberCount === 2 ? 1.10 : 1.0;
  const drops = [];
  for (const [itemId, rate] of pool) {
    if (Math.random() < rate * teamBonus) {
      drops.push(itemId);
    }
  }
  return drops;
}

module.exports = { generateBeast, resolveSanTurn, calcSanRewards, calcSanLoot, pickBeastAction };
