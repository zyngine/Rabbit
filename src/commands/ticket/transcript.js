const { SlashCommandBuilder } = require('discord.js');
const Ticket = require('../../models/Ticket');
const { canManageTicket } = require('../../utils/permissions');
const { generateTranscript } = require('../../utils/transcript');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transcript')
    .setDescription('Generate a transcript of the current ticket'),

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
        embeds: [embeds.error('You do not have permission to generate transcripts.')],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      const { filepath, filename } = await generateTranscript(interaction.channel, ticket);

      await interaction.editReply({
        embeds: [embeds.success('Transcript generated successfully!')],
        files: [{ attachment: filepath, name: filename }]
      });
    } catch (error) {
      console.error('Failed to generate transcript:', error);
      await interaction.editReply({
        embeds: [embeds.error('Failed to generate transcript.')]
      });
    }
  }
};
