const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Ticket = require('../../models/Ticket');
const { canManageTicket } = require('../../utils/permissions');
const { logTicketAction } = require('../../handlers/ticketHandler');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a user to the current ticket')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to add')
        .setRequired(true)),

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
        embeds: [embeds.error('You do not have permission to manage this ticket.')],
        ephemeral: true
      });
    }

    const user = interaction.options.getUser('user');

    await interaction.channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true
    });

    await interaction.reply({
      embeds: [embeds.success(`${user} has been added to this ticket.`)]
    });

    await logTicketAction(interaction.guild, 'User Added', ticket, interaction.user, interaction.channel, {
      reason: `Added ${user.tag}`
    });
  }
};
