const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');
const { ApplicationType } = require('../../models/Application');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('appsetup')
    .setDescription('Create a new application type')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the application (e.g., Staff, Moderator)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Description shown on the application panel')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('log_channel')
        .setDescription('Channel for application logs')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('cooldown')
        .setDescription('Hours between applications (default: 24)')
        .setMinValue(0)
        .setMaxValue(720)
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('create_ticket')
        .setDescription('Create a ticket on submission (default: true)')
        .setRequired(false)),

  async execute(interaction) {
    const name = interaction.options.getString('name');
    const description = interaction.options.getString('description');
    const logChannel = interaction.options.getChannel('log_channel');
    const cooldown = interaction.options.getInteger('cooldown') ?? 24;
    const createTicket = interaction.options.getBoolean('create_ticket') ?? true;

    const existing = await ApplicationType.getByName(interaction.guild.id, name);
    if (existing) {
      return interaction.reply({
        embeds: [embeds.error(`An application type named "${name}" already exists.`)],
        ephemeral: true
      });
    }

    const appType = await ApplicationType.create({
      guild_id: interaction.guild.id,
      name,
      description,
      log_channel: logChannel?.id || null,
      cooldown_hours: cooldown,
      create_ticket: createTicket
    });

    await interaction.reply({
      embeds: [embeds.success(`Application type "${name}" created!\n\nNext steps:\n1. Add questions with \`/appquestions add\`\n2. Deploy the panel with \`/apppanel\``)],
      ephemeral: true
    });
  }
};
