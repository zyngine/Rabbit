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
  const { ticketLimit, autoCloseHours } = req.body;

  if (ticketLimit !== undefined) guild.ticketLimit = ticketLimit;
  if (autoCloseHours !== undefined) guild.autoCloseHours = autoCloseHours;

  guild.save();

  res.json({ success: true });
});

module.exports = router;
