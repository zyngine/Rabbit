const { SlashCommandBuilder } = require('discord.js');
const Ticket = require('../../models/Ticket');
const { isSupport } = require('../../utils/permissions');
const { logTicketAction } = require('../../handlers/ticketHandler');
const embeds = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('priority')
    .setDescription('Set the priority of the current ticket')
    .addStringOption(option =>
      option.setName('level')
        .setDescription('Priority level')
        .setRequired(true)
        .addChoices(
          { name: '🟢 Low', value: 'low' },
          { name: '🔵 Normal', value: 'normal' },
          { name: '🟡 High', value: 'high' },
          { name: '🔴 Urgent', value: 'urgent' }
        )),

  async execute(interaction) {
    const ticket = Ticket.get(interaction.channel.id);

    if (!ticket) {
      return interaction.reply({
        embeds: [embeds.error('This command can only be used in a ticket channel.')],
        ephemeral: true
      });
    }

    if (!isSupport(interaction.member, interaction.guild.id)) {
      return interaction.reply({
        embeds: [embeds.error('You do not have permission to set ticket priority.')],
        ephemeral: true
      });
    }

    const level = interaction.options.getString('level');
    const oldPriority = ticket.priority;
    ticket.setPriority(level);

    const priorityInfo = config.priorities[level];

    await interaction.reply({
      embeds: [embeds.success(`Ticket priority changed from **${oldPriority}** to **${priorityInfo.emoji} ${level}**.`)]
    });

    await logTicketAction(interaction.guild, 'Priority Changed', ticket, interaction.user, interaction.channel, {
      reason: `${oldPriority} → ${level}`
    });
  }
};
