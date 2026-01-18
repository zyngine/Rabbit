const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Manage roles for users')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('Give a role to a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to give the role to')
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to give')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for giving the role')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a role from a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to remove the role from')
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to remove')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for removing the role')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Get information about a role')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to get info about')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('members')
        .setDescription('List all members with a specific role')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to list members of')
            .setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'give': {
        const user = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
          return interaction.reply({
            embeds: [embeds.error('User not found in this server.')],
            ephemeral: true
          });
        }

        if (role.position >= interaction.guild.members.me.roles.highest.position) {
          return interaction.reply({
            embeds: [embeds.error('I cannot assign this role as it is higher than or equal to my highest role.')],
            ephemeral: true
          });
        }

        if (role.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
          return interaction.reply({
            embeds: [embeds.error('You cannot assign a role higher than or equal to your highest role.')],
            ephemeral: true
          });
        }

        if (member.roles.cache.has(role.id)) {
          return interaction.reply({
            embeds: [embeds.error(`${user} already has the ${role} role.`)],
            ephemeral: true
          });
        }

        try {
          await member.roles.add(role, `${interaction.user.tag}: ${reason}`);
          return interaction.reply({
            embeds: [embeds.success(`Successfully gave ${role} to ${user}.\n**Reason:** ${reason}`)]
          });
        } catch (error) {
          return interaction.reply({
            embeds: [embeds.error('Failed to give the role. Check my permissions.')],
            ephemeral: true
          });
        }
      }

      case 'remove': {
        const user = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
          return interaction.reply({
            embeds: [embeds.error('User not found in this server.')],
            ephemeral: true
          });
        }

        if (role.position >= interaction.guild.members.me.roles.highest.position) {
          return interaction.reply({
            embeds: [embeds.error('I cannot remove this role as it is higher than or equal to my highest role.')],
            ephemeral: true
          });
        }

        if (role.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
          return interaction.reply({
            embeds: [embeds.error('You cannot remove a role higher than or equal to your highest role.')],
            ephemeral: true
          });
        }

        if (!member.roles.cache.has(role.id)) {
          return interaction.reply({
            embeds: [embeds.error(`${user} doesn't have the ${role} role.`)],
            ephemeral: true
          });
        }

        try {
          await member.roles.remove(role, `${interaction.user.tag}: ${reason}`);
          return interaction.reply({
            embeds: [embeds.success(`Successfully removed ${role} from ${user}.\n**Reason:** ${reason}`)]
          });
        } catch (error) {
          return interaction.reply({
            embeds: [embeds.error('Failed to remove the role. Check my permissions.')],
            ephemeral: true
          });
        }
      }

      case 'info': {
        const role = interaction.options.getRole('role');
        const { EmbedBuilder } = require('discord.js');

        const embed = new EmbedBuilder()
          .setColor(role.color || 0x5865F2)
          .setTitle(`Role: ${role.name}`)
          .addFields(
            { name: 'ID', value: role.id, inline: true },
            { name: 'Color', value: role.hexColor, inline: true },
            { name: 'Position', value: `${role.position}`, inline: true },
            { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
            { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
            { name: 'Members', value: `${role.members.size}`, inline: true },
            { name: 'Created', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true }
          );

        return interaction.reply({ embeds: [embed] });
      }

      case 'members': {
        const role = interaction.options.getRole('role');
        const members = role.members.map(m => m.user.tag);

        if (members.length === 0) {
          return interaction.reply({
            embeds: [embeds.info(`No members have the ${role} role.`)],
            ephemeral: true
          });
        }

        const { EmbedBuilder } = require('discord.js');
        const memberList = members.slice(0, 50).join('\n');
        const embed = new EmbedBuilder()
          .setColor(role.color || 0x5865F2)
          .setTitle(`Members with ${role.name}`)
          .setDescription(memberList + (members.length > 50 ? `\n... and ${members.length - 50} more` : ''))
          .setFooter({ text: `Total: ${members.length} members` });

        return interaction.reply({ embeds: [embed] });
      }
    }
  }
};
