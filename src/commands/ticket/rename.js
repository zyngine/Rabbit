const { SlashCommandBuilder } = require('discord.js');
const Ticket = require('../../models/Ticket');
const { canManageTicket } = require('../../utils/permissions');
const { logTicketAction } = require('../../handlers/ticketHandler');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Rename the current ticket channel')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('New channel name')
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

    const newName = interaction.options.getString('name');
    const oldName = interaction.channel.name;

    await interaction.channel.setName(newName);

    await interaction.reply({
      embeds: [embeds.success(`Ticket renamed from \`${oldName}\` to \`${newName}\`.`)]
    });

    await logTicketAction(interaction.guild, 'Renamed', ticket, interaction.user, interaction.channel, {
      reason: `${oldName} → ${newName}`
    });
  }
};
