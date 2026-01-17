const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { ApplicationType } = require('../../models/Application');
const embeds = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('appsettings')
    .setDescription('Manage application settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all application types'))
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View settings for an application')
        .addStringOption(option =>
          option.setName('application')
            .setDescription('Application type name')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('panel')
        .setDescription('Deploy an application panel')
        .addStringOption(option =>
          option.setName('application')
            .setDescription('Application type name')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('addrole')
        .setDescription('Add a review role')
        .addStringOption(option =>
          option.setName('application')
            .setDescription('Application type name')
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role that can review applications')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('removerole')
        .setDescription('Remove a review role')
        .addStringOption(option =>
          option.setName('application')
            .setDescription('Application type name')
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to remove')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('toggle')
        .setDescription('Enable or disable an application')
        .addStringOption(option =>
          option.setName('application')
            .setDescription('Application type name')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete an application type')
        .addStringOption(option =>
          option.setName('application')
            .setDescription('Application type name')
            .setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'list': {
        const appTypes = ApplicationType.getAll(interaction.guild.id);

        if (appTypes.length === 0) {
          return interaction.reply({
            embeds: [embeds.info('No application types configured.\n\nUse `/appsetup` to create one.')],
            ephemeral: true
          });
        }

        const embed = new EmbedBuilder()
          .setColor(config.colors.primary)
          .setTitle('Application Types')
          .setDescription(appTypes.map(a =>
            `**${a.name}** ${a.active ? '✅' : '❌'}\n` +
            `Questions: ${a.getQuestions().length} | Cooldown: ${a.cooldownHours}h`
          ).join('\n\n'));

        return interaction.reply({ embeds: [embed] });
      }

      case 'view': {
        const appName = interaction.options.getString('application');
        const appType = ApplicationType.getByName(interaction.guild.id, appName);

        if (!appType) {
          return interaction.reply({
            embeds: [embeds.error(`Application type "${appName}" not found.`)],
            ephemeral: true
          });
        }

        const questions = appType.getQuestions();
        const embed = new EmbedBuilder()
          .setColor(config.colors.primary)
          .setTitle(`Application: ${appType.name}`)
          .addFields(
            { name: 'Status', value: appType.active ? '✅ Active' : '❌ Inactive', inline: true },
            { name: 'Questions', value: `${questions.length}/5`, inline: true },
            { name: 'Cooldown', value: `${appType.cooldownHours} hours`, inline: true },
            { name: 'Create Ticket', value: appType.createTicket ? 'Yes' : 'No', inline: true },
            { name: 'Log Channel', value: appType.logChannel ? `<#${appType.logChannel}>` : 'Not set', inline: true },
            { name: 'Review Roles', value: appType.reviewRoles.length > 0 ? appType.reviewRoles.map(r => `<@&${r}>`).join(', ') : 'None', inline: false }
          )
          .setDescription(appType.description);

        return interaction.reply({ embeds: [embed] });
      }

      case 'panel': {
        const appName = interaction.options.getString('application');
        const appType = ApplicationType.getByName(interaction.guild.id, appName);

        if (!appType) {
          return interaction.reply({
            embeds: [embeds.error(`Application type "${appName}" not found.`)],
            ephemeral: true
          });
        }

        const questions = appType.getQuestions();
        if (questions.length === 0) {
          return interaction.reply({
            embeds: [embeds.error('This application has no questions. Add questions first with `/appquestions add`.')],
            ephemeral: true
          });
        }

        const button = new ButtonBuilder()
          .setCustomId(`application_start_${appType.id}`)
          .setLabel('Apply')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📝');

        const row = new ActionRowBuilder().addComponents(button);

        const message = await interaction.channel.send({
          embeds: [embeds.applicationPanel(appType)],
          components: [row]
        });

        appType.channelId = interaction.channel.id;
        appType.messageId = message.id;
        appType.save();

        await interaction.reply({
          embeds: [embeds.success('Application panel deployed!')],
          ephemeral: true
        });
        break;
      }

      case 'addrole': {
        const appName = interaction.options.getString('application');
        const role = interaction.options.getRole('role');
        const appType = ApplicationType.getByName(interaction.guild.id, appName);

        if (!appType) {
          return interaction.reply({
            embeds: [embeds.error(`Application type "${appName}" not found.`)],
            ephemeral: true
          });
        }

        if (appType.reviewRoles.includes(role.id)) {
          return interaction.reply({
            embeds: [embeds.error('This role is already a review role.')],
            ephemeral: true
          });
        }

        appType.reviewRoles.push(role.id);
        appType.save();

        return interaction.reply({
          embeds: [embeds.success(`${role} can now review "${appName}" applications.`)]
        });
      }

      case 'removerole': {
        const appName = interaction.options.getString('application');
        const role = interaction.options.getRole('role');
        const appType = ApplicationType.getByName(interaction.guild.id, appName);

        if (!appType) {
          return interaction.reply({
            embeds: [embeds.error(`Application type "${appName}" not found.`)],
            ephemeral: true
          });
        }

        if (!appType.reviewRoles.includes(role.id)) {
          return interaction.reply({
            embeds: [embeds.error('This role is not a review role.')],
            ephemeral: true
          });
        }

        appType.reviewRoles = appType.reviewRoles.filter(id => id !== role.id);
        appType.save();

        return interaction.reply({
          embeds: [embeds.success(`${role} has been removed from review roles.`)]
        });
      }

      case 'toggle': {
        const appName = interaction.options.getString('application');
        const appType = ApplicationType.getByName(interaction.guild.id, appName);

        if (!appType) {
          return interaction.reply({
            embeds: [embeds.error(`Application type "${appName}" not found.`)],
            ephemeral: true
          });
        }

        appType.active = !appType.active;
        appType.save();

        return interaction.reply({
          embeds: [embeds.success(`"${appName}" has been ${appType.active ? 'enabled' : 'disabled'}.`)]
        });
      }

      case 'delete': {
        const appName = interaction.options.getString('application');
        const appType = ApplicationType.getByName(interaction.guild.id, appName);

        if (!appType) {
          return interaction.reply({
            embeds: [embeds.error(`Application type "${appName}" not found.`)],
            ephemeral: true
          });
        }

        appType.delete();

        return interaction.reply({
          embeds: [embeds.success(`Application type "${appName}" has been deleted.`)]
        });
      }
    }
  }
};
