'use strict';
/**
 * utils/embeds.js
 * Lightweight Discord EmbedBuilder factories for common reply states.
 * These are the ONLY utils that require discord.js.
 */
const { EmbedBuilder } = require('discord.js');

const errE  = (desc) => new EmbedBuilder().setColor(0xED4245).setDescription(desc);
const warnE = (desc) => new EmbedBuilder().setColor(0xFEE75C).setDescription(desc);
const okE   = (desc) => new EmbedBuilder().setColor(0x57F287).setDescription(desc);

module.exports = { errE, warnE, okE };
