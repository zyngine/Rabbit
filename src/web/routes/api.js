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

router.get('/guild/:guildId/stats', requireAuth, (req, res) => {
  const { guildId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const guild = Guild.get(guildId);
  if (!guild) {
    return res.status(404).json({ error: 'Guild not found' });
  }

  const openTickets = db.db.prepare(`
    SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND status = 'open'
  `).get(guildId);

  const closedTickets = db.db.prepare(`
    SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND status = 'closed'
  `).get(guildId);

  const avgRating = db.db.prepare(`
    SELECT AVG(rating) as avg FROM tickets WHERE guild_id = ? AND rating IS NOT NULL
  `).get(guildId);

  const pendingApps = db.db.prepare(`
    SELECT COUNT(*) as count FROM applications WHERE guild_id = ? AND status = 'pending'
  `).get(guildId);

  const recentTickets = db.db.prepare(`
    SELECT * FROM tickets WHERE guild_id = ? ORDER BY created_at DESC LIMIT 5
  `).all(guildId);

  res.json({
    openTickets: openTickets.count,
    closedTickets: closedTickets.count,
    totalTickets: guild.ticketCounter,
    avgRating: avgRating.avg ? Math.round(avgRating.avg * 10) / 10 : null,
    pendingApplications: pendingApps.count,
    recentTickets
  });
});

router.get('/guild/:guildId/tickets', requireAuth, (req, res) => {
  const { guildId } = req.params;
  const { status, page = 1, limit = 20 } = req.query;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  let query = 'SELECT * FROM tickets WHERE guild_id = ?';
  const params = [guildId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const tickets = db.db.prepare(query).all(...params);

  const countQuery = status
    ? 'SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND status = ?'
    : 'SELECT COUNT(*) as count FROM tickets WHERE guild_id = ?';
  const countParams = status ? [guildId, status] : [guildId];
  const total = db.db.prepare(countQuery).get(...countParams);

  res.json({
    tickets,
    total: total.count,
    page: parseInt(page),
    totalPages: Math.ceil(total.count / parseInt(limit))
  });
});

router.get('/guild/:guildId/applications', requireAuth, (req, res) => {
  const { guildId } = req.params;
  const { status, page = 1, limit = 20 } = req.query;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  let query = 'SELECT * FROM applications WHERE guild_id = ?';
  const params = [guildId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const applications = db.db.prepare(query).all(...params);

  const countQuery = status
    ? 'SELECT COUNT(*) as count FROM applications WHERE guild_id = ? AND status = ?'
    : 'SELECT COUNT(*) as count FROM applications WHERE guild_id = ?';
  const countParams = status ? [guildId, status] : [guildId];
  const total = db.db.prepare(countQuery).get(...countParams);

  res.json({
    applications,
    total: total.count,
    page: parseInt(page),
    totalPages: Math.ceil(total.count / parseInt(limit))
  });
});

router.get('/guild/:guildId/application-types', requireAuth, (req, res) => {
  const { guildId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const types = ApplicationType.getAll(guildId);
  res.json(types.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    active: t.active,
    cooldownHours: t.cooldownHours,
    createTicket: t.createTicket,
    questionCount: t.getQuestions().length
  })));
});

router.get('/guild/:guildId/settings', requireAuth, (req, res) => {
  const { guildId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const guild = Guild.get(guildId);
  if (!guild) {
    return res.status(404).json({ error: 'Guild not found' });
  }

  res.json({
    ticketLogChannel: guild.ticketLogChannel,
    ticketTranscriptChannel: guild.ticketTranscriptChannel,
    ticketCategory: guild.ticketCategory,
    ticketLimit: guild.ticketLimit,
    autoCloseHours: guild.autoCloseHours,
    supportRoles: guild.supportRoles
  });
});

router.post('/guild/:guildId/settings', requireAuth, (req, res) => {
  const { guildId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const guild = Guild.getOrCreate(guildId);
  const { ticketLimit, autoCloseHours, ticketLogChannel, ticketTranscriptChannel, ticketCategory } = req.body;

  if (ticketLimit !== undefined) guild.ticketLimit = ticketLimit;
  if (autoCloseHours !== undefined) guild.autoCloseHours = autoCloseHours;
  if (ticketLogChannel !== undefined) guild.ticketLogChannel = ticketLogChannel;
  if (ticketTranscriptChannel !== undefined) guild.ticketTranscriptChannel = ticketTranscriptChannel;
  if (ticketCategory !== undefined) guild.ticketCategory = ticketCategory;

  guild.save();

  res.json({ success: true });
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
router.post('/guild/:guildId/support-roles', requireAuth, (req, res) => {
  const { guildId } = req.params;
  const { roleId } = req.body;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const guild = Guild.getOrCreate(guildId);
  guild.addSupportRole(roleId);

  res.json({ success: true, supportRoles: guild.supportRoles });
});

// Remove support role
router.delete('/guild/:guildId/support-roles/:roleId', requireAuth, (req, res) => {
  const { guildId, roleId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const guild = Guild.get(guildId);
  if (!guild) {
    return res.status(404).json({ error: 'Guild not found' });
  }

  guild.removeSupportRole(roleId);

  res.json({ success: true, supportRoles: guild.supportRoles });
});

// Get panels
router.get('/guild/:guildId/panels', requireAuth, (req, res) => {
  const { guildId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const panels = db.getPanelsByGuild(guildId);
  res.json(panels);
});

// Delete panel
router.delete('/guild/:guildId/panels/:panelId', requireAuth, (req, res) => {
  const { guildId, panelId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.deletePanel(panelId);
  res.json({ success: true });
});

// Create application type
router.post('/guild/:guildId/application-types', requireAuth, (req, res) => {
  const { guildId } = req.params;
  const { name, description, cooldownHours, createTicket } = req.body;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const existing = ApplicationType.getByName(guildId, name);
  if (existing) {
    return res.status(400).json({ error: 'Application type with this name already exists' });
  }

  const appType = ApplicationType.create({
    guild_id: guildId,
    name,
    description,
    cooldown_hours: cooldownHours || 24,
    create_ticket: createTicket !== false
  });

  res.json({ success: true, id: appType.id });
});

// Update application type
router.put('/guild/:guildId/application-types/:typeId', requireAuth, (req, res) => {
  const { guildId, typeId } = req.params;
  const { name, description, cooldownHours, createTicket, active } = req.body;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const appType = ApplicationType.get(typeId);
  if (!appType || appType.guildId !== guildId) {
    return res.status(404).json({ error: 'Application type not found' });
  }

  if (name !== undefined) appType.name = name;
  if (description !== undefined) appType.description = description;
  if (cooldownHours !== undefined) appType.cooldownHours = cooldownHours;
  if (createTicket !== undefined) appType.createTicket = createTicket;
  if (active !== undefined) appType.active = active;

  appType.save();

  res.json({ success: true });
});

// Delete application type
router.delete('/guild/:guildId/application-types/:typeId', requireAuth, (req, res) => {
  const { guildId, typeId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const appType = ApplicationType.get(typeId);
  if (!appType || appType.guildId !== guildId) {
    return res.status(404).json({ error: 'Application type not found' });
  }

  appType.delete();

  res.json({ success: true });
});

// Get questions for application type
router.get('/guild/:guildId/application-types/:typeId/questions', requireAuth, (req, res) => {
  const { guildId, typeId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const appType = ApplicationType.get(typeId);
  if (!appType || appType.guildId !== guildId) {
    return res.status(404).json({ error: 'Application type not found' });
  }

  const questions = appType.getQuestions();
  res.json(questions);
});

// Add question to application type
router.post('/guild/:guildId/application-types/:typeId/questions', requireAuth, (req, res) => {
  const { guildId, typeId } = req.params;
  const { question, questionType, required } = req.body;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const appType = ApplicationType.get(typeId);
  if (!appType || appType.guildId !== guildId) {
    return res.status(404).json({ error: 'Application type not found' });
  }

  const questions = appType.getQuestions();
  if (questions.length >= 5) {
    return res.status(400).json({ error: 'Maximum 5 questions allowed' });
  }

  const id = appType.addQuestion({
    question,
    question_type: questionType || 'short',
    required: required !== false,
    order_num: questions.length + 1
  });

  res.json({ success: true, id });
});

// Delete question
router.delete('/guild/:guildId/application-types/:typeId/questions/:questionId', requireAuth, (req, res) => {
  const { guildId, typeId, questionId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.deleteQuestion(questionId);

  res.json({ success: true });
});

// Blacklist management
router.get('/guild/:guildId/blacklist', requireAuth, (req, res) => {
  const { guildId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const blacklist = db.db.prepare('SELECT * FROM ticket_blacklist WHERE guild_id = ?').all(guildId);
  res.json(blacklist);
});

router.post('/guild/:guildId/blacklist', requireAuth, (req, res) => {
  const { guildId } = req.params;
  const { userId, reason } = req.body;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.addToBlacklist(guildId, userId, reason || 'No reason provided');

  res.json({ success: true });
});

router.delete('/guild/:guildId/blacklist/:userId', requireAuth, (req, res) => {
  const { guildId, userId } = req.params;

  if (!hasGuildAccess(req, guildId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.removeFromBlacklist(guildId, userId);

  res.json({ success: true });
});

module.exports = router;
