const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const Guild = require('../../models/Guild');
const db = require('../../database/db');
const embeds = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketsettings')
    .setDescription('Configure ticket system settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current settings'))
    .addSubcommand(sub =>
      sub.setName('logs')
        .setDescription('Set the ticket log channel')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Log channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('transcripts')
        .setDescription('Set the transcript channel')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Transcript channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('category')
        .setDescription('Set the default ticket category')
        .addChannelOption(option =>
          option.setName('category')
            .setDescription('Category for tickets')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('limit')
        .setDescription('Set max tickets per user')
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Maximum open tickets')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('autoclose')
        .setDescription('Set auto-close time for inactive tickets')
        .addIntegerOption(option =>
          option.setName('hours')
            .setDescription('Hours of inactivity (0 to disable)')
            .setMinValue(0)
            .setMaxValue(720)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('addrole')
        .setDescription('Add a support role')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Support role')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('removerole')
        .setDescription('Remove a support role')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Support role to remove')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('blacklist')
        .setDescription('Blacklist a user from creating tickets')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to blacklist')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for blacklist')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('unblacklist')
        .setDescription('Remove a user from the blacklist')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to unblacklist')
            .setRequired(true))),

  async execute(interaction) {
    const guild = Guild.getOrCreate(interaction.guild.id);
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'view': {
        const embed = new EmbedBuilder()
          .setColor(config.colors.primary)
          .setTitle('Ticket Settings')
          .addFields(
            { name: 'Log Channel', value: guild.ticketLogChannel ? `<#${guild.ticketLogChannel}>` : 'Not set', inline: true },
            { name: 'Transcript Channel', value: guild.ticketTranscriptChannel ? `<#${guild.ticketTranscriptChannel}>` : 'Not set', inline: true },
            { name: 'Default Category', value: guild.ticketCategory ? `<#${guild.ticketCategory}>` : 'Not set', inline: true },
            { name: 'Ticket Limit', value: `${guild.ticketLimit} per user`, inline: true },
            { name: 'Auto-Close', value: guild.autoCloseHours > 0 ? `${guild.autoCloseHours} hours` : 'Disabled', inline: true },
            { name: 'Total Tickets', value: `${guild.ticketCounter}`, inline: true },
            { name: 'Support Roles', value: guild.supportRoles.length > 0 ? guild.supportRoles.map(r => `<@&${r}>`).join(', ') : 'None', inline: false }
          );

        return interaction.reply({ embeds: [embed] });
      }

      case 'logs': {
        const channel = interaction.options.getChannel('channel');
        guild.ticketLogChannel = channel.id;
        guild.save();
        return interaction.reply({
          embeds: [embeds.success(`Log channel set to ${channel}.`)]
        });
      }

      case 'transcripts': {
        const channel = interaction.options.getChannel('channel');
        guild.ticketTranscriptChannel = channel.id;
        guild.save();
        return interaction.reply({
          embeds: [embeds.success(`Transcript channel set to ${channel}.`)]
        });
      }

      case 'category': {
        const category = interaction.options.getChannel('category');
        guild.ticketCategory = category.id;
        guild.save();
        return interaction.reply({
          embeds: [embeds.success(`Default ticket category set to ${category}.`)]
        });
      }

      case 'limit': {
        const limit = interaction.options.getInteger('limit');
        guild.ticketLimit = limit;
        guild.save();
        return interaction.reply({
          embeds: [embeds.success(`Ticket limit set to ${limit} per user.`)]
        });
      }

      case 'autoclose': {
        const hours = interaction.options.getInteger('hours');
        guild.autoCloseHours = hours;
        guild.save();
        return interaction.reply({
          embeds: [embeds.success(hours > 0 ? `Auto-close set to ${hours} hours of inactivity.` : 'Auto-close has been disabled.')]
        });
      }

      case 'addrole': {
        const role = interaction.options.getRole('role');
        if (guild.supportRoles.includes(role.id)) {
          return interaction.reply({
            embeds: [embeds.error('This role is already a support role.')],
            ephemeral: true
          });
        }
        guild.addSupportRole(role.id);
        return interaction.reply({
          embeds: [embeds.success(`${role} has been added as a support role.`)]
        });
      }

      case 'removerole': {
        const role = interaction.options.getRole('role');
        if (!guild.supportRoles.includes(role.id)) {
          return interaction.reply({
            embeds: [embeds.error('This role is not a support role.')],
            ephemeral: true
          });
        }
        guild.removeSupportRole(role.id);
        return interaction.reply({
          embeds: [embeds.success(`${role} has been removed from support roles.`)]
        });
      }

      case 'blacklist': {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        db.addToBlacklist(interaction.guild.id, user.id, reason);
        return interaction.reply({
          embeds: [embeds.success(`${user} has been blacklisted from creating tickets.`)]
        });
      }

      case 'unblacklist': {
        const user = interaction.options.getUser('user');
        db.removeFromBlacklist(interaction.guild.id, user.id);
        return interaction.reply({
          embeds: [embeds.success(`${user} has been removed from the blacklist.`)]
        });
      }
    }
  }
};
