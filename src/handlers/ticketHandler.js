const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const db = require('../database/db');
const Ticket = require('../models/Ticket');
const Guild = require('../models/Guild');
const embeds = require('../utils/embeds');
const { getTicketPermissions, isSupport } = require('../utils/permissions');
const { generateTranscript } = require('../utils/transcript');
const config = require('../config');
const logger = require('../utils/logger');

async function handleTicketCreate(interaction) {
  const { guild, user, message } = interaction;

  await interaction.deferReply({ ephemeral: true });

  const guildSettings = Guild.getOrCreate(guild.id);
  const panel = db.getPanel(message.id);

  if (!panel) {
    return interaction.editReply({
      embeds: [embeds.error('This ticket panel no longer exists.')]
    });
  }

  const blacklisted = db.isBlacklisted(guild.id, user.id);
  if (blacklisted) {
    return interaction.editReply({
      embeds: [embeds.error(`You are blacklisted from creating tickets. Reason: ${blacklisted.reason || 'No reason provided'}`)]
    });
  }

  const openTickets = Ticket.getOpenByUser(guild.id, user.id);
  if (openTickets.length >= guildSettings.ticketLimit) {
    return interaction.editReply({
      embeds: [embeds.error(`You can only have ${guildSettings.ticketLimit} open ticket(s) at a time.`)]
    });
  }

  const ticketNumber = guildSettings.incrementTicketCounter();
  const channelName = `ticket-${ticketNumber}`;

  const supportRoles = guildSettings.supportRoles;
  const permissionOverwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  for (const roleId of supportRoles) {
    permissionOverwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  try {
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: panel.category_id || guildSettings.ticketCategory,
      permissionOverwrites
    });

    const ticket = Ticket.create({
      guild_id: guild.id,
      channel_id: channel.id,
      user_id: user.id,
      panel_type: panel.panel_type,
      ticket_number: ticketNumber
    });

    const ticketButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Close')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒'),
      new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel('Claim')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🙋')
    );

    await channel.send({
      content: `${user} Welcome to your ticket!`,
      embeds: [embeds.ticketWelcome(ticket, user, panel.panel_type)],
      components: [ticketButtons]
    });

    const supportMentions = supportRoles.map(r => `<@&${r}>`).join(' ');
    if (supportMentions) {
      const mentionMsg = await channel.send(supportMentions);
      await mentionMsg.delete().catch(() => {});
    }

    await interaction.editReply({
      embeds: [embeds.success(`Your ticket has been created: ${channel}`)]
    });

    await logTicketAction(guild, 'Created', ticket, user, channel);
  } catch (error) {
    logger.error('Failed to create ticket', error);
    await interaction.editReply({
      embeds: [embeds.error('Failed to create ticket. Please contact an administrator.')]
    });
  }
}

async function handleTicketClose(interaction, reason = null) {
  const { channel, user, guild } = interaction;

  const ticket = Ticket.get(channel.id);
  if (!ticket) {
    return interaction.reply({
      embeds: [embeds.error('This is not a ticket channel.')],
      ephemeral: true
    });
  }

  if (ticket.status === 'closed') {
    return interaction.reply({
      embeds: [embeds.error('This ticket is already closed.')],
      ephemeral: true
    });
  }

  await interaction.deferReply();

  const guildSettings = Guild.get(guild.id);

  try {
    const { filepath, filename } = await generateTranscript(channel, ticket);

    ticket.close(reason);

    if (guildSettings?.ticketTranscriptChannel) {
      const transcriptChannel = guild.channels.cache.get(guildSettings.ticketTranscriptChannel);
      if (transcriptChannel) {
        await transcriptChannel.send({
          embeds: [embeds.ticketLog('Closed', ticket, user, { reason })],
          files: [{ attachment: filepath, name: filename }]
        });
      }
    }

    const ticketUser = await guild.members.fetch(ticket.userId).catch(() => null);
    if (ticketUser) {
      try {
        await ticketUser.send({
          embeds: [embeds.ticketClosed(ticket, user, reason)],
          files: [{ attachment: filepath, name: filename }]
        });
      } catch (e) {
        logger.warn(`Could not DM user ${ticket.userId}`);
      }
    }

    const feedbackButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('feedback_1')
        .setLabel('1')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⭐'),
      new ButtonBuilder()
        .setCustomId('feedback_2')
        .setLabel('2')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⭐'),
      new ButtonBuilder()
        .setCustomId('feedback_3')
        .setLabel('3')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⭐'),
      new ButtonBuilder()
        .setCustomId('feedback_4')
        .setLabel('4')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⭐'),
      new ButtonBuilder()
        .setCustomId('feedback_5')
        .setLabel('5')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⭐')
    );

    const deleteButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_delete')
        .setLabel('Delete Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
    );

    await interaction.editReply({
      embeds: [embeds.ticketClosed(ticket, user, reason), embeds.feedbackPrompt(ticket.ticketNumber)],
      components: [feedbackButtons, deleteButton]
    });

    await channel.permissionOverwrites.edit(ticket.userId, {
      SendMessages: false
    });

    await logTicketAction(guild, 'Closed', ticket, user, channel, { reason });
  } catch (error) {
    logger.error('Failed to close ticket', error);
    await interaction.editReply({
      embeds: [embeds.error('Failed to close ticket properly.')]
    });
  }
}

async function handleTicketClaim(interaction) {
  const { channel, user, guild, member } = interaction;

  const ticket = Ticket.get(channel.id);
  if (!ticket) {
    return interaction.reply({
      embeds: [embeds.error('This is not a ticket channel.')],
      ephemeral: true
    });
  }

  if (!isSupport(member, guild.id)) {
    return interaction.reply({
      embeds: [embeds.error('You do not have permission to claim tickets.')],
      ephemeral: true
    });
  }

  if (ticket.claimedBy) {
    return interaction.reply({
      embeds: [embeds.error(`This ticket is already claimed by <@${ticket.claimedBy}>.`)],
      ephemeral: true
    });
  }

  ticket.claim(user.id);

  const newName = `claimed-${ticket.ticketNumber}`;
  await channel.setName(newName).catch(() => {});

  await interaction.reply({
    embeds: [embeds.success(`${user} has claimed this ticket.`)]
  });

  await logTicketAction(guild, 'Claimed', ticket, user, channel);
}

async function handleFeedback(interaction, rating) {
  const ticket = Ticket.get(interaction.channel.id);
  if (!ticket) return;

  ticket.setRating(rating);

  await interaction.update({
    embeds: [embeds.ticketClosed(ticket, interaction.user, ticket.closeReason), embeds.success(`Thank you for your feedback! You rated this ticket ${rating}/5 stars.`)],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_delete')
          .setLabel('Delete Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️')
      )
    ]
  });
}

async function handleTicketDelete(interaction) {
  const { channel, member, guild } = interaction;

  if (!isSupport(member, guild.id)) {
    return interaction.reply({
      embeds: [embeds.error('You do not have permission to delete tickets.')],
      ephemeral: true
    });
  }

  await interaction.reply({
    embeds: [embeds.info('Deleting ticket in 5 seconds...')]
  });

  setTimeout(async () => {
    await channel.delete().catch(() => {});
  }, 5000);
}

async function logTicketAction(guild, action, ticket, user, channel, extra = {}) {
  const guildSettings = Guild.get(guild.id);
  if (!guildSettings?.ticketLogChannel) return;

  const logChannel = guild.channels.cache.get(guildSettings.ticketLogChannel);
  if (!logChannel) return;

  try {
    await logChannel.send({
      embeds: [embeds.ticketLog(action, ticket, user, { ...extra, channel: channel?.toString() })]
    });
  } catch (error) {
    logger.error('Failed to log ticket action', error);
  }
}

module.exports = {
  handleTicketCreate,
  handleTicketClose,
  handleTicketClaim,
  handleFeedback,
  handleTicketDelete,
  logTicketAction
};
