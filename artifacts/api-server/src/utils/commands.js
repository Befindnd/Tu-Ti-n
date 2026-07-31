'use strict';
/**
 * utils/commands.js
 * Backwards-compatibility shim.
 *
 * The implementation has moved to core/registry.js.
 * This file re-exports everything so existing code that does
 *   const { COMMANDS, reg } = require('../utils/commands')
 * continues to work without changes.
 */
module.exports = require('../core/registry');
