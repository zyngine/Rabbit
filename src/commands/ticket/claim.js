const { SlashCommandBuilder } = require('discord.js');
const Ticket = require('../../models/Ticket');
const { isSupport, isAdmin } = require('../../utils/permissions');
const { logTicketAction } = require('../../handlers/ticketHandler');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim the current ticket'),

  async execute(interaction) {
    const ticket = await Ticket.get(interaction.channel.id);

    if (!ticket) {
      return interaction.reply({
        embeds: [embeds.error('This command can only be used in a ticket channel.')],
        ephemeral: true
      });
    }

    if (!(await isSupport(interaction.member, interaction.guild.id))) {
      return interaction.reply({
        embeds: [embeds.error('You do not have permission to claim tickets.')],
        ephemeral: true
      });
    }

    if (ticket.claimedBy) {
      if (ticket.claimedBy === interaction.user.id) {
        return interaction.reply({
          embeds: [embeds.error('You have already claimed this ticket.')],
          ephemeral: true
        });
      }
      return interaction.reply({
        embeds: [embeds.error(`This ticket is already claimed by <@${ticket.claimedBy}>.`)],
        ephemeral: true
      });
    }

    await ticket.claim(interaction.user.id);

    const newName = `claimed-${ticket.ticketNumber}`;
    await interaction.channel.setName(newName).catch(() => {});

    await interaction.reply({
      embeds: [embeds.success(`${interaction.user} has claimed this ticket.`)]
    });

    await logTicketAction(interaction.guild, 'Claimed', ticket, interaction.user, interaction.channel);
  }
};
