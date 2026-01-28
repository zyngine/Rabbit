const { Events } = require('discord.js');
const logger = require('../utils/logger');
const embeds = require('../utils/embeds');
const {
  handleTicketCreate,
  handleTicketClose,
  handleTicketClaim,
  handleFeedback,
  handleTicketDelete
} = require('../handlers/ticketHandler');
const {
  handleApplicationStart,
  handleApplicationModal,
  handleApplicationSubmit,
  handleApplicationAccept,
  handleApplicationDeny
} = require('../handlers/applicationHandler');

module.exports = {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction);
      } else if (interaction.isButton()) {
        await handleButton(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModal(interaction);
      }
    } catch (error) {
      logger.error('Interaction error', error);
      const reply = {
        embeds: [embeds.error('An error occurred while processing your request.')],
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  }
};

async function handleCommand(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    logger.warn(`Unknown command: ${interaction.commandName}`);
    return;
  }

  logger.info(`Command: ${interaction.commandName} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`);

  await command.execute(interaction);
}

async function handleButton(interaction) {
  const customId = interaction.customId;

  logger.info(`Button: ${customId} by ${interaction.user.tag}`);

  if (customId === 'ticket_create') {
    await handleTicketCreate(interaction);
  } else if (customId.startsWith('create_ticket:')) {
    const panelType = customId.replace('create_ticket:', '');
    await handleTicketCreate(interaction, panelType);
  } else if (customId === 'ticket_close') {
    await handleTicketClose(interaction);
  } else if (customId === 'ticket_claim') {
    await handleTicketClaim(interaction);
  } else if (customId === 'ticket_delete') {
    await handleTicketDelete(interaction);
  } else if (customId.startsWith('feedback_')) {
    const rating = parseInt(customId.split('_')[1]);
    await handleFeedback(interaction, rating);
  } else if (customId.startsWith('application_start_')) {
    const appTypeId = parseInt(customId.replace('application_start_', ''));
    await handleApplicationStart(interaction, appTypeId);
  } else if (customId.startsWith('app_open_modal_')) {
    // Format: app_open_modal_{appTypeId}_{page}
    const parts = customId.replace('app_open_modal_', '').split('_');
    const appTypeId = parseInt(parts[0]);
    const page = parseInt(parts[1]) || 1;
    await handleApplicationModal(interaction, appTypeId, page);
  } else if (customId.startsWith('app_accept_')) {
    const appTypeId = parseInt(customId.replace('app_accept_', ''));
    await handleApplicationAccept(interaction, appTypeId, null, null);
  } else if (customId.startsWith('app_deny_')) {
    const appTypeId = parseInt(customId.replace('app_deny_', ''));
    await handleApplicationDeny(interaction, appTypeId, null, null);
  }
}

async function handleModal(interaction) {
  const customId = interaction.customId;

  logger.info(`Modal: ${customId} by ${interaction.user.tag}`);

  if (customId.startsWith('application_submit_')) {
    // Format: application_submit_{appTypeId}_{page}
    const parts = customId.replace('application_submit_', '').split('_');
    const appTypeId = parseInt(parts[0]);
    const page = parseInt(parts[1]) || 1;
    await handleApplicationSubmit(interaction, appTypeId, page);
  }
}

async function handleSelectMenu(interaction) {
  const customId = interaction.customId;
  const value = interaction.values[0];

  logger.info(`SelectMenu: ${customId} value: ${value} by ${interaction.user.tag}`);

  if (customId === 'ticket_select') {
    // Value format: create_ticket:type
    if (value.startsWith('create_ticket:')) {
      const panelType = value.replace('create_ticket:', '');
      await handleTicketCreate(interaction, panelType);
    }
  }
}
