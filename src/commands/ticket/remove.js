const { SlashCommandBuilder } = require('discord.js');
const Ticket = require('../../models/Ticket');
const { canManageTicket } = require('../../utils/permissions');
const { logTicketAction } = require('../../handlers/ticketHandler');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a user from the current ticket')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to remove')
        .setRequired(true)),

  async execute(interaction) {
    const ticket = await Ticket.get(interaction.channel.id);

    if (!ticket) {
      return interaction.reply({
        embeds: [embeds.error('This command can only be used in a ticket channel.')],
        ephemeral: true
      });
    }

    if (!(await canManageTicket(interaction.member, ticket))) {
      return interaction.reply({
        embeds: [embeds.error('You do not have permission to manage this ticket.')],
        ephemeral: true
      });
    }

    const user = interaction.options.getUser('user');

    if (user.id === ticket.userId) {
      return interaction.reply({
        embeds: [embeds.error('You cannot remove the ticket creator from their own ticket.')],
        ephemeral: true
      });
    }

    await interaction.channel.permissionOverwrites.delete(user.id);

    await interaction.reply({
      embeds: [embeds.success(`${user} has been removed from this ticket.`)]
    });

    await logTicketAction(interaction.guild, 'User Removed', ticket, interaction.user, interaction.channel, {
      reason: `Removed ${user.tag}`
    });
  }
};
