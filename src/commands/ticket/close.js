const { SlashCommandBuilder } = require('discord.js');
const { handleTicketClose } = require('../../handlers/ticketHandler');
const Ticket = require('../../models/Ticket');
const { canManageTicket } = require('../../utils/permissions');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current ticket')
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for closing')
        .setRequired(false)),

  async execute(interaction) {
    const ticket = Ticket.get(interaction.channel.id);

    if (!ticket) {
      return interaction.reply({
        embeds: [embeds.error('This command can only be used in a ticket channel.')],
        ephemeral: true
      });
    }

    if (!canManageTicket(interaction.member, ticket)) {
      return interaction.reply({
        embeds: [embeds.error('You do not have permission to close this ticket.')],
        ephemeral: true
      });
    }

    const reason = interaction.options.getString('reason');
    await handleTicketClose(interaction, reason);
  }
};
