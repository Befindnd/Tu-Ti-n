'use strict';
  const { handleDoVuiButton } = require('../commands/do_vui');

  module.exports = function setupDoVuiHandler(client) {
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;
      if (!interaction.customId.startsWith('dovui_')) return;
      await handleDoVuiButton(interaction).catch(console.error);
    });
  };
  