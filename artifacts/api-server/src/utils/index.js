'use strict';
/**
 * utils/index.js
 * Central utility barrel — re-exports every util sub-module.
 *
 * Command files can do a single destructured import:
 *   const { fmt, errE, tinhCS, COMMANDS, reg } = require('../utils');
 *
 * Sub-modules and their canonical locations:
 *   format  → utils/format.js   (pure formatting, no Discord dep)
 *   embeds  → utils/embeds.js   (Discord EmbedBuilder helpers)
 *   random  → utils/random.js   (random outcomes, skill names)
 *   player  → game/player.js    (stat calc — no Discord dep)
 *   registry→ core/registry.js  (command map + rate limit)
 *   bag     → utils/bag.js      (inventory weight helpers)
 *   donate  → utils/donate.js   (donate data + UI builders)
 */
module.exports = {
  ...require('./format'),       // fmt, getCG, pBar, fTime, cdRem, cdRemMin, cdTs, cdTsMin, embedClr, SEP, SEP2, SEP3
  ...require('./embeds'),       // errE, warnE, okE
  ...require('./random'),       // randomLC, randomHM, getTamMa, CHIEU_THUC, getChieu
  ...require('../game/player'), // tinhCS, calcEXP_active, DT_TEN, DT_HIEU, PHI_TU_CHUA, …
  ...require('../core/registry'),  // COMMANDS, reg, RATE_LIMIT, checkRateLimit, getDailyMissionState
  ...require('./bag'),          // BAG_WEIGHTS, getDanKg, getBagCapacity, calcBagWeight, canAddToBag, calcMaxLinhThach, calcMaxLinhThachTrung, calcMaxLinhThachCao
  ...require('./donate'),       // DONATE_DATA, makeDonateEmbed, etc.
  ...require('./linh_thach_spend'), // totalLT, calcSpend, RATE_TRUNG, RATE_CAO
  // ── New modular utils (new structure) ───────────────────────────────────
  cooldown:    require('./cooldown'),      // isOnCooldown, cdRemH, cdRemM, fmtCD
  logger:      require('./logger'),       // logger.info, logger.error, logger.child
  danhVong:    require('./danh_vong'),    // awardDanhVong, DV_POINTS
};
