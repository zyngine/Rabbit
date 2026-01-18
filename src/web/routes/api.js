const express = require('express');
const router = express.Router();
const db = require('../../database/db');
const Ticket = require('../../models/Ticket');
const { ApplicationType, Application } = require('../../models/Application');
const Guild = require('../../models/Guild');

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function hasGuildAccess(req, guildId) {
  if (!req.session.guilds) return false;
  const guild = req.session.guilds.find(g => g.id === guildId);
  if (!guild) return false;
  const permissions = BigInt(guild.permissions);
  const ADMINISTRATOR = BigInt(0x8);
  const MANAGE_GUILD = BigInt(0x20);
  return (permissions & ADMINISTRATOR) === ADMINISTRATOR || (permissions & MANAGE_GUILD) === MANAGE_GUILD;
}

router.get('/user', requireAuth, (req, res) => {
  res.json({
    user: req.session.user,
    guilds: req.session.guilds
  });
});

router.get('/guilds', requireAuth, (req, res) => {
  const discordClient = req.app.get('discordClient');
  if (!discordClient) {
    return res.status(500).json({ error: 'Bot not connected' });
  }

  const botGuilds = discordClient.guilds.cache.map(g => g.id);
  const userGuilds = req.session.guilds
    .filter(g => {
      const permissions = BigInt(g.permissions);
      const ADMINISTRATOR = BigInt(0x8);
      const MANAGE_GUILD = BigInt(0x20);
      return (permissions & ADMINISTRATOR) === ADMINISTRATOR || (permissions & MANAGE_GUILD) === MANAGE_GUILD;
    })
    .map(g => ({
      ...g,
      botInGuild: botGuilds.includes(g.id)
    }));

  res.json(userGuilds);
});

router.get('/guild/:guildId/stats', requireAuth, async (req, res) => {
  const { guildId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const guild = await Guild.getOrCreate(guildId);

    const openTickets = await db.query(
      'SELECT COUNT(*) as count FROM tickets WHERE guild_id = $1 AND status = $2',
      [guildId, 'open']
    );

    const closedTickets = await db.query(
      'SELECT COUNT(*) as count FROM tickets WHERE guild_id = $1 AND status = $2',
      [guildId, 'closed']
    );

    const avgRating = await db.query(
      'SELECT AVG(rating) as avg FROM tickets WHERE guild_id = $1 AND rating IS NOT NULL',
      [guildId]
    );

    const pendingApps = await db.query(
      'SELECT COUNT(*) as count FROM applications WHERE guild_id = $1 AND status = $2',
      [guildId, 'pending']
    );

    const recentTickets = await db.query(
      'SELECT * FROM tickets WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 5',
      [guildId]
    );

    res.json({
      openTickets: parseInt(openTickets.rows[0].count),
      closedTickets: parseInt(closedTickets.rows[0].count),
      totalTickets: guild.ticketCounter,
      avgRating: avgRating.rows[0].avg ? Math.round(parseFloat(avgRating.rows[0].avg) * 10) / 10 : null,
      pendingApplications: parseInt(pendingApps.rows[0].count),
      recentTickets: recentTickets.rows
    });
  } catch (error) {
    console.error('Failed to get stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.get('/guild/:guildId/tickets', requireAuth, async (req, res) => {
  const { guildId } = req.params;
  const { status, page = 1, limit = 20 } = req.query;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    let query = 'SELECT * FROM tickets WHERE guild_id = $1';
    const params = [guildId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const tickets = await db.query(query, params);

    const countQuery = status
      ? 'SELECT COUNT(*) as count FROM tickets WHERE guild_id = $1 AND status = $2'
      : 'SELECT COUNT(*) as count FROM tickets WHERE guild_id = $1';
    const countParams = status ? [guildId, status] : [guildId];
    const total = await db.query(countQuery, countParams);

    res.json({
      tickets: tickets.rows,
      total: parseInt(total.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(parseInt(total.rows[0].count) / parseInt(limit))
    });
  } catch (error) {
    console.error('Failed to get tickets:', error);
    res.status(500).json({ error: 'Failed to get tickets' });
  }
});

router.get('/guild/:guildId/applications', requireAuth, async (req, res) => {
  const { guildId } = req.params;
  const { status, page = 1, limit = 20 } = req.query;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    let query = 'SELECT * FROM applications WHERE guild_id = $1';
    const params = [guildId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const applications = await db.query(query, params);

    const countQuery = status
      ? 'SELECT COUNT(*) as count FROM applications WHERE guild_id = $1 AND status = $2'
      : 'SELECT COUNT(*) as count FROM applications WHERE guild_id = $1';
    const countParams = status ? [guildId, status] : [guildId];
    const total = await db.query(countQuery, countParams);

    res.json({
      applications: applications.rows,
      total: parseInt(total.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(parseInt(total.rows[0].count) / parseInt(limit))
    });
  } catch (error) {
    console.error('Failed to get applications:', error);
    res.status(500).json({ error: 'Failed to get applications' });
  }
});

router.get('/guild/:guildId/application-types', requireAuth, async (req, res) => {
  const { guildId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const types = await ApplicationType.getAll(guildId);
    const result = [];

    for (const t of types) {
      const questions = await t.getQuestions();
      result.push({
        id: t.id,
        name: t.name,
        description: t.description,
        active: t.active,
        cooldownHours: t.cooldownHours,
        createTicket: t.createTicket,
        questionCount: questions.length
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Failed to get application types:', error);
    res.status(500).json({ error: 'Failed to get application types' });
  }
});

router.get('/guild/:guildId/settings', requireAuth, async (req, res) => {
  const { guildId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const guild = await Guild.getOrCreate(guildId);

    res.json({
      ticketLogChannel: guild.ticketLogChannel,
      ticketTranscriptChannel: guild.ticketTranscriptChannel,
      ticketCategory: guild.ticketCategory,
      ticketLimit: guild.ticketLimit,
      autoCloseHours: guild.autoCloseHours,
      supportRoles: guild.supportRoles || [],
      autoRoles: guild.autoRoles || []
    });
  } catch (error) {
    console.error('Failed to get settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

router.post('/guild/:guildId/settings', requireAuth, async (req, res) => {
  const { guildId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const guild = await Guild.getOrCreate(guildId);
    const { ticketLimit, autoCloseHours, ticketLogChannel, ticketTranscriptChannel, ticketCategory } = req.body;

    if (ticketLimit !== undefined) guild.ticketLimit = ticketLimit;
    if (autoCloseHours !== undefined) guild.autoCloseHours = autoCloseHours;
    if (ticketLogChannel !== undefined) guild.ticketLogChannel = ticketLogChannel;
    if (ticketTranscriptChannel !== undefined) guild.ticketTranscriptChannel = ticketTranscriptChannel;
    if (ticketCategory !== undefined) guild.ticketCategory = ticketCategory;

    await guild.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to save settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Get guild channels from Discord
router.get('/guild/:guildId/channels', requireAuth, (req, res) => {
  const { guildId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const discordClient = req.app.get('discordClient');
  if (!discordClient) {
    return res.status(500).json({ error: 'Bot not connected' });
  }

  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) {
    return res.status(404).json({ error: 'Guild not found' });
  }

  const textChannels = guild.channels.cache
    .filter(c => c.type === 0)
    .map(c => ({ id: c.id, name: c.name }));

  const categories = guild.channels.cache
    .filter(c => c.type === 4)
    .map(c => ({ id: c.id, name: c.name }));

  res.json({ textChannels, categories });
});

// Get guild roles from Discord
router.get('/guild/:guildId/roles', requireAuth, (req, res) => {
  const { guildId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const discordClient = req.app.get('discordClient');
  if (!discordClient) {
    return res.status(500).json({ error: 'Bot not connected' });
  }

  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) {
    return res.status(404).json({ error: 'Guild not found' });
  }

  const roles = guild.roles.cache
    .filter(r => r.id !== guildId && !r.managed)
    .sort((a, b) => b.position - a.position)
    .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));

  res.json(roles);
});

// Add support role
router.post('/guild/:guildId/support-roles', requireAuth, async (req, res) => {
  const { guildId } = req.params;
  const { roleId } = req.body;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const guild = await Guild.getOrCreate(guildId);
    await guild.addSupportRole(roleId);

    res.json({ success: true, supportRoles: guild.supportRoles });
  } catch (error) {
    console.error('Failed to add support role:', error);
    res.status(500).json({ error: 'Failed to add support role' });
  }
});

// Remove support role
router.delete('/guild/:guildId/support-roles/:roleId', requireAuth, async (req, res) => {
  const { guildId, roleId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const guild = await Guild.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    await guild.removeSupportRole(roleId);

    res.json({ success: true, supportRoles: guild.supportRoles });
  } catch (error) {
    console.error('Failed to remove support role:', error);
    res.status(500).json({ error: 'Failed to remove support role' });
  }
});

// Add auto role
router.post('/guild/:guildId/auto-roles', requireAuth, async (req, res) => {
  const { guildId } = req.params;
  const { roleId } = req.body;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const guild = await Guild.getOrCreate(guildId);
    await guild.addAutoRole(roleId);

    res.json({ success: true, autoRoles: guild.autoRoles });
  } catch (error) {
    console.error('Failed to add auto role:', error);
    res.status(500).json({ error: 'Failed to add auto role' });
  }
});

// Remove auto role
router.delete('/guild/:guildId/auto-roles/:roleId', requireAuth, async (req, res) => {
  const { guildId, roleId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const guild = await Guild.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    await guild.removeAutoRole(roleId);

    res.json({ success: true, autoRoles: guild.autoRoles });
  } catch (error) {
    console.error('Failed to remove auto role:', error);
    res.status(500).json({ error: 'Failed to remove auto role' });
  }
});

// Get panels
router.get('/guild/:guildId/panels', requireAuth, async (req, res) => {
  const { guildId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const panels = await db.getPanelsByGuild(guildId);
    res.json(panels);
  } catch (error) {
    console.error('Failed to get panels:', error);
    res.status(500).json({ error: 'Failed to get panels' });
  }
});

// Create panel with multiple ticket types
router.post('/guild/:guildId/panels', requireAuth, async (req, res) => {
  const { guildId } = req.params;
  const { title, description, style, channelId, categoryId, ticketTypes } = req.body;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!ticketTypes || ticketTypes.length === 0) {
    return res.status(400).json({ error: 'At least one ticket type is required' });
  }

  const discordClient = req.app.get('discordClient');
  if (!discordClient) {
    return res.status(500).json({ error: 'Bot not connected' });
  }

  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) {
    return res.status(404).json({ error: 'Guild not found' });
  }

  const channel = guild.channels.cache.get(channelId);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  try {
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(title)
      .setDescription(description || 'Select a category below to create a ticket.')
      .setFooter({ text: 'Ticket System' });

    const buttonStyles = {
      'primary': ButtonStyle.Primary,
      'success': ButtonStyle.Success,
      'secondary': ButtonStyle.Secondary,
      'danger': ButtonStyle.Danger
    };

    let components = [];

    if (style === 'select') {
      // Create a select menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select')
        .setPlaceholder('Select a ticket type...')
        .addOptions(ticketTypes.map(type => ({
          label: type.label,
          value: `create_ticket:${type.name}`,
          description: type.description || undefined,
          emoji: type.emoji || undefined
        })));

      components.push(new ActionRowBuilder().addComponents(selectMenu));
    } else {
      // Create buttons (max 5 per row)
      const rows = [];
      for (let i = 0; i < ticketTypes.length; i += 5) {
        const rowTypes = ticketTypes.slice(i, i + 5);
        const row = new ActionRowBuilder();

        rowTypes.forEach(type => {
          const button = new ButtonBuilder()
            .setCustomId(`create_ticket:${type.name}`)
            .setLabel(type.label)
            .setStyle(buttonStyles[type.color] || ButtonStyle.Primary);

          if (type.emoji) {
            button.setEmoji(type.emoji);
          }

          row.addComponents(button);
        });

        rows.push(row);
      }
      components = rows;
    }

    const message = await channel.send({ embeds: [embed], components });

    // Save panel to database with ticket types as JSON
    await db.query(
      `INSERT INTO panels (guild_id, channel_id, message_id, panel_type, title, description, button_label, button_color, category_id, style, ticket_types)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        guildId,
        channelId,
        message.id,
        ticketTypes[0].name, // Primary type for backwards compatibility
        title,
        description,
        ticketTypes[0].label,
        ticketTypes[0].color || 'primary',
        categoryId || null,
        style,
        JSON.stringify(ticketTypes)
      ]
    );

    res.json({ success: true, messageId: message.id });
  } catch (error) {
    console.error('Failed to create panel:', error);
    res.status(500).json({ error: 'Failed to create panel: ' + error.message });
  }
});

// Delete panel
router.delete('/guild/:guildId/panels/:panelId', requireAuth, async (req, res) => {
  const { guildId, panelId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await db.deletePanel(panelId);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete panel:', error);
    res.status(500).json({ error: 'Failed to delete panel' });
  }
});

// Create application type
router.post('/guild/:guildId/application-types', requireAuth, async (req, res) => {
  const { guildId } = req.params;
  const { name, description, cooldownHours, createTicket } = req.body;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const existing = await ApplicationType.getByName(guildId, name);
    if (existing) {
      return res.status(400).json({ error: 'Application type with this name already exists' });
    }

    const appType = await ApplicationType.create({
      guild_id: guildId,
      name: name.trim(),
      description: description || '',
      cooldown_hours: cooldownHours || 24,
      create_ticket: createTicket !== false
    });

    if (!appType) {
      return res.status(500).json({ error: 'Failed to create application type' });
    }

    res.json({ success: true, id: appType.id });
  } catch (error) {
    console.error('Error creating application type:', error);
    res.status(500).json({ error: 'Failed to create application type: ' + error.message });
  }
});

// Update application type
router.put('/guild/:guildId/application-types/:typeId', requireAuth, async (req, res) => {
  const { guildId, typeId } = req.params;
  const { name, description, cooldownHours, createTicket, active } = req.body;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const appType = await ApplicationType.get(typeId);
    if (!appType || appType.guildId !== guildId) {
      return res.status(404).json({ error: 'Application type not found' });
    }

    if (name !== undefined) appType.name = name;
    if (description !== undefined) appType.description = description;
    if (cooldownHours !== undefined) appType.cooldownHours = cooldownHours;
    if (createTicket !== undefined) appType.createTicket = createTicket;
    if (active !== undefined) appType.active = active;

    await appType.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update application type:', error);
    res.status(500).json({ error: 'Failed to update application type' });
  }
});

// Delete application type
router.delete('/guild/:guildId/application-types/:typeId', requireAuth, async (req, res) => {
  const { guildId, typeId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const appType = await ApplicationType.get(typeId);
    if (!appType || appType.guildId !== guildId) {
      return res.status(404).json({ error: 'Application type not found' });
    }

    await appType.delete();

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete application type:', error);
    res.status(500).json({ error: 'Failed to delete application type' });
  }
});

// Deploy application panel to a channel
router.post('/guild/:guildId/application-types/:typeId/deploy', requireAuth, async (req, res) => {
  const { guildId, typeId } = req.params;
  const { title, description, buttonLabel, channelId } = req.body;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const appType = await ApplicationType.get(typeId);
    if (!appType || appType.guildId !== guildId) {
      return res.status(404).json({ error: 'Application type not found' });
    }

    const discordClient = req.app.get('discordClient');
    if (!discordClient) {
      return res.status(500).json({ error: 'Bot not connected' });
    }

    const guild = discordClient.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(title || appType.name)
      .setDescription(description || 'Click the button below to submit your application.')
      .setFooter({ text: 'Application System' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`application_start_${typeId}`)
          .setLabel(buttonLabel || 'Apply Now')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📝')
      );

    const message = await channel.send({ embeds: [embed], components: [row] });

    // Update application type with channel and message info
    appType.channelId = channelId;
    appType.messageId = message.id;
    await appType.save();

    res.json({ success: true, messageId: message.id });
  } catch (error) {
    console.error('Failed to deploy application panel:', error);
    res.status(500).json({ error: 'Failed to deploy application panel: ' + error.message });
  }
});

// Get questions for application type
router.get('/guild/:guildId/application-types/:typeId/questions', requireAuth, async (req, res) => {
  const { guildId, typeId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const appType = await ApplicationType.get(typeId);
    if (!appType || appType.guildId !== guildId) {
      return res.status(404).json({ error: 'Application type not found' });
    }

    const questions = await appType.getQuestions();
    res.json(questions);
  } catch (error) {
    console.error('Failed to get questions:', error);
    res.status(500).json({ error: 'Failed to get questions' });
  }
});

// Add question to application type
router.post('/guild/:guildId/application-types/:typeId/questions', requireAuth, async (req, res) => {
  const { guildId, typeId } = req.params;
  const { question, questionType, required } = req.body;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const appType = await ApplicationType.get(typeId);
    if (!appType || appType.guildId !== guildId) {
      return res.status(404).json({ error: 'Application type not found' });
    }

    const questions = await appType.getQuestions();
    if (questions.length >= 5) {
      return res.status(400).json({ error: 'Maximum 5 questions allowed' });
    }

    const id = await appType.addQuestion({
      question,
      question_type: questionType || 'short',
      required: required !== false,
      order_num: questions.length + 1
    });

    res.json({ success: true, id });
  } catch (error) {
    console.error('Failed to add question:', error);
    res.status(500).json({ error: 'Failed to add question' });
  }
});

// Delete question
router.delete('/guild/:guildId/application-types/:typeId/questions/:questionId', requireAuth, async (req, res) => {
  const { guildId, typeId, questionId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await db.deleteQuestion(questionId);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete question:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Blacklist management
router.get('/guild/:guildId/blacklist', requireAuth, async (req, res) => {
  const { guildId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const result = await db.query('SELECT * FROM ticket_blacklist WHERE guild_id = $1', [guildId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to get blacklist:', error);
    res.status(500).json({ error: 'Failed to get blacklist' });
  }
});

router.post('/guild/:guildId/blacklist', requireAuth, async (req, res) => {
  const { guildId } = req.params;
  const { userId, reason } = req.body;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await db.addToBlacklist(guildId, userId, reason || 'No reason provided');
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to add to blacklist:', error);
    res.status(500).json({ error: 'Failed to add to blacklist' });
  }
});

router.delete('/guild/:guildId/blacklist/:userId', requireAuth, async (req, res) => {
  const { guildId, userId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await db.removeFromBlacklist(guildId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to remove from blacklist:', error);
    res.status(500).json({ error: 'Failed to remove from blacklist' });
  }
});

module.exports = router;
