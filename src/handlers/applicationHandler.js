const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { ApplicationType, Application } = require('../models/Application');
const Guild = require('../models/Guild');
const Ticket = require('../models/Ticket');
const db = require('../database/db');
const embeds = require('../utils/embeds');
const { canReviewApplication } = require('../utils/permissions');
const logger = require('../utils/logger');

async function handleApplicationStart(interaction, applicationTypeId) {
  const appType = ApplicationType.get(applicationTypeId);

  if (!appType || !appType.active) {
    return interaction.reply({
      embeds: [embeds.error('This application is no longer available.')],
      ephemeral: true
    });
  }

  const questions = appType.getQuestions();
  if (questions.length === 0) {
    return interaction.reply({
      embeds: [embeds.error('This application has no questions configured.')],
      ephemeral: true
    });
  }

  const recentApps = Application.getByUser(interaction.guild.id, interaction.user.id, applicationTypeId);
  if (recentApps.length > 0) {
    const lastApp = recentApps[0];
    const cooldownMs = appType.cooldownHours * 60 * 60 * 1000;
    const timeSince = Date.now() - new Date(lastApp.createdAt).getTime();

    if (timeSince < cooldownMs) {
      const remainingHours = Math.ceil((cooldownMs - timeSince) / (60 * 60 * 1000));
      return interaction.reply({
        embeds: [embeds.error(`You must wait ${remainingHours} more hour(s) before applying again.`)],
        ephemeral: true
      });
    }
  }

  const modalQuestions = questions.slice(0, 5);
  const modal = new ModalBuilder()
    .setCustomId(`application_submit_${applicationTypeId}`)
    .setTitle(appType.name.substring(0, 45));

  for (const q of modalQuestions) {
    const style = q.question_type === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short;
    const input = new TextInputBuilder()
      .setCustomId(`q_${q.id}`)
      .setLabel(q.question.substring(0, 45))
      .setStyle(style)
      .setRequired(Boolean(q.required))
      .setMaxLength(q.question_type === 'paragraph' ? 1000 : 100);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  await interaction.showModal(modal);
}

async function handleApplicationSubmit(interaction, applicationTypeId) {
  await interaction.deferReply({ ephemeral: true });

  const appType = ApplicationType.get(applicationTypeId);
  if (!appType) {
    return interaction.editReply({
      embeds: [embeds.error('This application type no longer exists.')]
    });
  }

  const questions = appType.getQuestions();
  const answers = {};

  for (const q of questions.slice(0, 5)) {
    const answer = interaction.fields.getTextInputValue(`q_${q.id}`);
    answers[q.id] = answer;
  }

  let ticketChannelId = null;

  if (appType.createTicket) {
    const guildSettings = Guild.getOrCreate(interaction.guild.id);
    const ticketNumber = guildSettings.incrementTicketCounter();
    const channelName = `app-${appType.name.toLowerCase().replace(/\s+/g, '-')}-${ticketNumber}`;

    const supportRoles = guildSettings.supportRoles;
    const reviewRoles = appType.reviewRoles;
    const allRoles = [...new Set([...supportRoles, ...reviewRoles])];

    const permissionOverwrites = [
      {
        id: interaction.guild.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    ];

    for (const roleId of allRoles) {
      permissionOverwrites.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages
        ]
      });
    }

    try {
      const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: guildSettings.ticketCategory,
        permissionOverwrites
      });

      ticketChannelId = channel.id;

      Ticket.create({
        guild_id: interaction.guild.id,
        channel_id: channel.id,
        user_id: interaction.user.id,
        panel_type: `application-${appType.name}`,
        ticket_number: ticketNumber
      });

      const reviewButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`app_accept_${applicationTypeId}`)
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`app_deny_${applicationTypeId}`)
          .setLabel('Deny')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌'),
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Close')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔒')
      );

      await channel.send({
        content: `${interaction.user} submitted an application!`,
        embeds: [embeds.applicationSubmission(appType, interaction.user, answers, questions)],
        components: [reviewButtons]
      });

      const roleMentions = allRoles.map(r => `<@&${r}>`).join(' ');
      if (roleMentions) {
        const mentionMsg = await channel.send(roleMentions);
        await mentionMsg.delete().catch(() => {});
      }
    } catch (error) {
      logger.error('Failed to create application ticket', error);
    }
  }

  const application = Application.create({
    guild_id: interaction.guild.id,
    application_type_id: applicationTypeId,
    user_id: interaction.user.id,
    answers,
    ticket_channel_id: ticketChannelId
  });

  if (appType.logChannel) {
    const logChannel = interaction.guild.channels.cache.get(appType.logChannel);
    if (logChannel) {
      await logChannel.send({
        embeds: [embeds.applicationSubmission(appType, interaction.user, answers, questions)]
      });
    }
  }

  await interaction.editReply({
    embeds: [embeds.success(`Your application has been submitted!${ticketChannelId ? ` A ticket has been created for you.` : ''}`)]
  });
}

async function handleApplicationAccept(interaction, applicationTypeId, userId, reason) {
  const { guild, member, user } = interaction;

  const appType = ApplicationType.get(applicationTypeId);
  if (!appType) {
    return interaction.reply({
      embeds: [embeds.error('Application type not found.')],
      ephemeral: true
    });
  }

  if (!canReviewApplication(member, appType)) {
    return interaction.reply({
      embeds: [embeds.error('You do not have permission to review applications.')],
      ephemeral: true
    });
  }

  const ticket = Ticket.get(interaction.channel.id);
  if (!ticket) {
    return interaction.reply({
      embeds: [embeds.error('Could not find associated application.')],
      ephemeral: true
    });
  }

  const applications = Application.getByUser(guild.id, ticket.userId, applicationTypeId);
  const application = applications.find(a => a.ticketChannelId === interaction.channel.id);

  if (!application) {
    return interaction.reply({
      embeds: [embeds.error('Could not find the application.')],
      ephemeral: true
    });
  }

  if (application.status !== 'pending') {
    return interaction.reply({
      embeds: [embeds.error('This application has already been reviewed.')],
      ephemeral: true
    });
  }

  application.accept(user.id, reason);

  const applicant = await guild.members.fetch(ticket.userId).catch(() => null);
  if (applicant) {
    try {
      await applicant.send({
        embeds: [embeds.applicationResult('accepted', appType, reason, user)]
      });
    } catch (e) {
      logger.warn(`Could not DM applicant ${ticket.userId}`);
    }
  }

  await interaction.reply({
    embeds: [embeds.success(`Application has been accepted.${reason ? ` Reason: ${reason}` : ''}`)]
  });

  if (appType.logChannel) {
    const logChannel = guild.channels.cache.get(appType.logChannel);
    if (logChannel) {
      await logChannel.send({
        embeds: [embeds.applicationResult('accepted', appType, reason, user)]
      });
    }
  }
}

async function handleApplicationDeny(interaction, applicationTypeId, userId, reason) {
  const { guild, member, user } = interaction;

  const appType = ApplicationType.get(applicationTypeId);
  if (!appType) {
    return interaction.reply({
      embeds: [embeds.error('Application type not found.')],
      ephemeral: true
    });
  }

  if (!canReviewApplication(member, appType)) {
    return interaction.reply({
      embeds: [embeds.error('You do not have permission to review applications.')],
      ephemeral: true
    });
  }

  const ticket = Ticket.get(interaction.channel.id);
  if (!ticket) {
    return interaction.reply({
      embeds: [embeds.error('Could not find associated application.')],
      ephemeral: true
    });
  }

  const applications = Application.getByUser(guild.id, ticket.userId, applicationTypeId);
  const application = applications.find(a => a.ticketChannelId === interaction.channel.id);

  if (!application) {
    return interaction.reply({
      embeds: [embeds.error('Could not find the application.')],
      ephemeral: true
    });
  }

  if (application.status !== 'pending') {
    return interaction.reply({
      embeds: [embeds.error('This application has already been reviewed.')],
      ephemeral: true
    });
  }

  application.deny(user.id, reason);

  const applicant = await guild.members.fetch(ticket.userId).catch(() => null);
  if (applicant) {
    try {
      await applicant.send({
        embeds: [embeds.applicationResult('denied', appType, reason, user)]
      });
    } catch (e) {
      logger.warn(`Could not DM applicant ${ticket.userId}`);
    }
  }

  await interaction.reply({
    embeds: [embeds.success(`Application has been denied.${reason ? ` Reason: ${reason}` : ''}`)]
  });

  if (appType.logChannel) {
    const logChannel = guild.channels.cache.get(appType.logChannel);
    if (logChannel) {
      await logChannel.send({
        embeds: [embeds.applicationResult('denied', appType, reason, user)]
      });
    }
  }
}

module.exports = {
  handleApplicationStart,
  handleApplicationSubmit,
  handleApplicationAccept,
  handleApplicationDeny
};
