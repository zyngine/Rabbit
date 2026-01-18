const { Events } = require('discord.js');
const Ticket = require('../models/Ticket');
const Guild = require('../models/Guild');
const { isSupport } = require('../utils/permissions');
const { generateTranscript } = require('../utils/transcript');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

const PREFIX = '$';

module.exports = {
  name: Events.MessageCreate,
  once: false,

  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const ticket = Ticket.get(message.channel.id);

    switch (command) {
      case 'rename':
        await handleRename(message, args, ticket);
        break;
      case 'close':
        await handleClose(message, args, ticket);
        break;
      case 'delete':
        await handleDelete(message, ticket);
        break;
    }
  }
};

async function handleRename(message, args, ticket) {
  // Delete the command message immediately
  await message.delete().catch(() => {});

  if (!ticket) {
    const reply = await message.channel.send({
      embeds: [embeds.error('This command can only be used in ticket channels.')]
    });
    setTimeout(() => reply.delete().catch(() => {}), 5000);
    return;
  }

  if (!isSupport(message.member, message.guild.id) && ticket.userId !== message.author.id) {
    const reply = await message.channel.send({
      embeds: [embeds.error('You do not have permission to rename this ticket.')]
    });
    setTimeout(() => reply.delete().catch(() => {}), 5000);
    return;
  }

  const newName = args.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');

  if (!newName) {
    const reply = await message.channel.send({
      embeds: [embeds.error('Please provide a new name. Usage: `$rename <name>`')]
    });
    setTimeout(() => reply.delete().catch(() => {}), 5000);
    return;
  }

  if (newName.length > 90) {
    const reply = await message.channel.send({
      embeds: [embeds.error('Channel name must be 90 characters or less.')]
    });
    setTimeout(() => reply.delete().catch(() => {}), 5000);
    return;
  }

  try {
    await message.channel.setName(newName);
    const reply = await message.channel.send({
      embeds: [embeds.success(`Ticket renamed to **${newName}**`)]
    });
    setTimeout(() => reply.delete().catch(() => {}), 5000);
  } catch (error) {
    logger.error('Failed to rename ticket', error);
    const reply = await message.channel.send({
      embeds: [embeds.error('Failed to rename the ticket.')]
    });
    setTimeout(() => reply.delete().catch(() => {}), 5000);
  }
}

async function handleClose(message, args, ticket) {
  await message.delete().catch(() => {});

  if (!ticket) {
    const reply = await message.channel.send({
      embeds: [embeds.error('This command can only be used in ticket channels.')]
    });
    setTimeout(() => reply.delete().catch(() => {}), 5000);
    return;
  }

  if (ticket.status === 'closed') {
    const reply = await message.channel.send({
      embeds: [embeds.error('This ticket is already closed.')]
    });
    setTimeout(() => reply.delete().catch(() => {}), 5000);
    return;
  }

  if (!isSupport(message.member, message.guild.id) && ticket.userId !== message.author.id) {
    const reply = await message.channel.send({
      embeds: [embeds.error('You do not have permission to close this ticket.')]
    });
    setTimeout(() => reply.delete().catch(() => {}), 5000);
    return;
  }

  const reason = args.join(' ') || 'No reason provided';

  try {
    const statusMsg = await message.channel.send({
      embeds: [embeds.info('Closing ticket and generating transcript...')]
    });

    // Generate transcript
    const { filepath, filename } = await generateTranscript(message.channel, ticket);

    // Close the ticket in database
    ticket.close(reason);

    const guildSettings = Guild.get(message.guild.id);

    // Send transcript to transcript channel
    if (guildSettings?.ticketTranscriptChannel) {
      const transcriptChannel = message.guild.channels.cache.get(guildSettings.ticketTranscriptChannel);
      if (transcriptChannel) {
        await transcriptChannel.send({
          embeds: [embeds.ticketLog('Closed', ticket, message.author, { reason })],
          files: [{ attachment: filepath, name: filename }]
        });
      }
    }

    // Send transcript to ticket creator via DM
    const ticketUser = await message.guild.members.fetch(ticket.userId).catch(() => null);
    if (ticketUser) {
      try {
        await ticketUser.send({
          embeds: [embeds.ticketClosed(ticket, message.author, reason)],
          files: [{ attachment: filepath, name: filename }]
        });
      } catch (e) {
        logger.warn(`Could not DM transcript to user ${ticket.userId}`);
      }
    }

    // Log the action
    if (guildSettings?.ticketLogChannel) {
      const logChannel = message.guild.channels.cache.get(guildSettings.ticketLogChannel);
      if (logChannel) {
        await logChannel.send({
          embeds: [embeds.ticketLog('Closed', ticket, message.author, { reason })]
        });
      }
    }

    // Remove send permissions from ticket creator
    await message.channel.permissionOverwrites.edit(ticket.userId, {
      SendMessages: false
    }).catch(() => {});

    // Update status message with close confirmation and delete button
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const deleteButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_delete')
        .setLabel('Delete Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
    );

    await statusMsg.edit({
      embeds: [embeds.success(`Ticket closed by ${message.author}.\n**Reason:** ${reason}`)],
      components: [deleteButton]
    });

  } catch (error) {
    logger.error('Failed to close ticket', error);
    await message.channel.send({
      embeds: [embeds.error('Failed to close the ticket.')]
    });
  }
}

async function handleDelete(message, ticket) {
  if (!ticket) {
    await message.delete().catch(() => {});
    const reply = await message.channel.send({
      embeds: [embeds.error('This command can only be used in ticket channels.')]
    });
    setTimeout(() => reply.delete().catch(() => {}), 5000);
    return;
  }

  if (!isSupport(message.member, message.guild.id)) {
    await message.delete().catch(() => {});
    const reply = await message.channel.send({
      embeds: [embeds.error('You do not have permission to delete tickets.')]
    });
    setTimeout(() => reply.delete().catch(() => {}), 5000);
    return;
  }

  try {
    await message.channel.send({
      embeds: [embeds.info('Generating transcript and deleting ticket...')]
    });

    // Generate transcript
    const { filepath, filename } = await generateTranscript(message.channel, ticket);

    // Close the ticket in database
    ticket.close('Deleted via $delete command');

    // Send transcript to ticket creator
    const ticketUser = await message.guild.members.fetch(ticket.userId).catch(() => null);
    if (ticketUser) {
      try {
        await ticketUser.send({
          embeds: [embeds.ticketClosed(ticket, message.author, 'Ticket deleted')],
          files: [{ attachment: filepath, name: filename }]
        });
      } catch (e) {
        logger.warn(`Could not DM transcript to user ${ticket.userId}`);
      }
    }

    // Send to transcript channel if configured
    const guildSettings = Guild.get(message.guild.id);
    if (guildSettings?.ticketTranscriptChannel) {
      const transcriptChannel = message.guild.channels.cache.get(guildSettings.ticketTranscriptChannel);
      if (transcriptChannel) {
        await transcriptChannel.send({
          embeds: [embeds.ticketLog('Deleted', ticket, message.author, { reason: 'Deleted via $delete command' })],
          files: [{ attachment: filepath, name: filename }]
        });
      }
    }

    // Log the action
    if (guildSettings?.ticketLogChannel) {
      const logChannel = message.guild.channels.cache.get(guildSettings.ticketLogChannel);
      if (logChannel) {
        await logChannel.send({
          embeds: [embeds.ticketLog('Deleted', ticket, message.author, { reason: 'Deleted via $delete command' })]
        });
      }
    }

    // Delete the channel
    setTimeout(async () => {
      await message.channel.delete().catch(() => {});
    }, 2000);

  } catch (error) {
    logger.error('Failed to delete ticket', error);
    await message.channel.send({
      embeds: [embeds.error('Failed to delete the ticket.')]
    });
  }
}
