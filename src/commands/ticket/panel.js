const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');
const db = require('../../database/db');
const Guild = require('../../models/Guild');
const embeds = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Create a ticket panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of tickets (e.g., support, billing)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Panel title')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Panel description')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('button_label')
        .setDescription('Button label')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('button_color')
        .setDescription('Button color')
        .setRequired(false)
        .addChoices(
          { name: 'Blue (Primary)', value: 'primary' },
          { name: 'Gray (Secondary)', value: 'secondary' },
          { name: 'Green (Success)', value: 'success' },
          { name: 'Red (Danger)', value: 'danger' }
        ))
    .addChannelOption(option =>
      option.setName('category')
        .setDescription('Category for new tickets')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const buttonLabel = interaction.options.getString('button_label') || 'Create Ticket';
    const buttonColor = interaction.options.getString('button_color') || 'primary';
    const category = interaction.options.getChannel('category');

    await Guild.getOrCreate(interaction.guild.id);

    const buttonStyles = {
      primary: ButtonStyle.Primary,
      secondary: ButtonStyle.Secondary,
      success: ButtonStyle.Success,
      danger: ButtonStyle.Danger
    };

    const button = new ButtonBuilder()
      .setCustomId('ticket_create')
      .setLabel(buttonLabel)
      .setStyle(buttonStyles[buttonColor])
      .setEmoji('🎫');

    const row = new ActionRowBuilder().addComponents(button);

    const panelEmbed = embeds.ticketPanel(title, description, buttonLabel);

    const message = await interaction.channel.send({
      embeds: [panelEmbed],
      components: [row]
    });

    await db.createPanel({
      guild_id: interaction.guild.id,
      channel_id: interaction.channel.id,
      message_id: message.id,
      panel_type: type,
      title,
      description,
      button_label: buttonLabel,
      button_color: buttonColor,
      category_id: category?.id || null
    });

    await interaction.reply({
      embeds: [embeds.success('Ticket panel created successfully!')],
      ephemeral: true
    });
  }
};
