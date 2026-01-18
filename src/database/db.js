const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Railway provides DATABASE_URL or DATABASE_PUBLIC_URL
const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

if (!databaseUrl) {
  console.error('[Database] ERROR: No DATABASE_URL or DATABASE_PUBLIC_URL environment variable found!');
  console.error('[Database] Available env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('PG')));
}

console.log('[Database] Connecting to PostgreSQL...');
console.log('[Database] URL configured:', databaseUrl ? 'Yes (length: ' + databaseUrl.length + ')' : 'No');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('[Database] Pool error:', err.message);
});

async function initializeDatabase() {
  console.log('[Database] Attempting to initialize...');

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  const client = await pool.connect();
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schema);
    console.log('[Database] PostgreSQL initialized successfully');
  } catch (error) {
    console.error('[Database] Initialization error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Synchronous wrapper cache for frequently accessed data
const cache = {
  guilds: new Map(),
  panels: new Map(),
  tickets: new Map()
};

// Guild functions
async function getGuild(guildId) {
  const result = await pool.query('SELECT * FROM guilds WHERE guild_id = $1', [guildId]);
  return result.rows[0] || null;
}

function getGuildSync(guildId) {
  return cache.guilds.get(guildId) || null;
}

async function createGuild(guildId) {
  await pool.query(
    `INSERT INTO guilds (guild_id, support_roles) VALUES ($1, '[]') ON CONFLICT (guild_id) DO NOTHING`,
    [guildId]
  );
  const guild = await getGuild(guildId);
  cache.guilds.set(guildId, guild);
  return guild;
}

async function updateGuild(guildId, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await pool.query(
    `UPDATE guilds SET ${setClause} WHERE guild_id = $${keys.length + 1}`,
    [...values, guildId]
  );
  // Update cache
  const guild = await getGuild(guildId);
  cache.guilds.set(guildId, guild);
}

async function incrementTicketCounter(guildId) {
  const result = await pool.query(
    `UPDATE guilds SET ticket_counter = ticket_counter + 1 WHERE guild_id = $1 RETURNING ticket_counter`,
    [guildId]
  );
  const guild = await getGuild(guildId);
  cache.guilds.set(guildId, guild);
  return result.rows[0].ticket_counter;
}

// Panel functions
async function createPanel(data) {
  const result = await pool.query(
    `INSERT INTO panels (guild_id, channel_id, message_id, panel_type, title, description, button_label, button_color, category_id, style, ticket_types)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [data.guild_id, data.channel_id, data.message_id, data.panel_type, data.title, data.description, data.button_label, data.button_color, data.category_id, data.style || 'buttons', data.ticket_types]
  );
  return result.rows[0].id;
}

async function getPanel(messageId) {
  const result = await pool.query('SELECT * FROM panels WHERE message_id = $1', [messageId]);
  return result.rows[0] || null;
}

async function getPanelsByGuild(guildId) {
  const result = await pool.query('SELECT * FROM panels WHERE guild_id = $1', [guildId]);
  return result.rows;
}

async function deletePanel(id) {
  await pool.query('DELETE FROM panels WHERE id = $1', [id]);
}

// Ticket functions
async function createTicket(data) {
  const result = await pool.query(
    `INSERT INTO tickets (guild_id, channel_id, user_id, panel_type, ticket_number, status, priority)
     VALUES ($1, $2, $3, $4, $5, 'open', 'normal') RETURNING id`,
    [data.guild_id, data.channel_id, data.user_id, data.panel_type, data.ticket_number]
  );
  return result.rows[0].id;
}

async function getTicket(channelId) {
  const result = await pool.query('SELECT * FROM tickets WHERE channel_id = $1', [channelId]);
  return result.rows[0] || null;
}

async function getTicketById(id) {
  const result = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getOpenTicketsByUser(guildId, userId) {
  const result = await pool.query(
    `SELECT * FROM tickets WHERE guild_id = $1 AND user_id = $2 AND status = 'open'`,
    [guildId, userId]
  );
  return result.rows;
}

async function getOpenTickets(guildId) {
  const result = await pool.query(
    `SELECT * FROM tickets WHERE guild_id = $1 AND status = 'open'`,
    [guildId]
  );
  return result.rows;
}

async function updateTicket(channelId, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await pool.query(
    `UPDATE tickets SET ${setClause} WHERE channel_id = $${keys.length + 1}`,
    [...values, channelId]
  );
}

async function closeTicket(channelId, reason) {
  await pool.query(
    `UPDATE tickets SET status = 'closed', close_reason = $1, closed_at = CURRENT_TIMESTAMP WHERE channel_id = $2`,
    [reason, channelId]
  );
}

// Blacklist functions
async function addToBlacklist(guildId, userId, reason) {
  await pool.query(
    `INSERT INTO ticket_blacklist (guild_id, user_id, reason) VALUES ($1, $2, $3)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET reason = $3`,
    [guildId, userId, reason]
  );
}

async function removeFromBlacklist(guildId, userId) {
  await pool.query('DELETE FROM ticket_blacklist WHERE guild_id = $1 AND user_id = $2', [guildId, userId]);
}

async function isBlacklisted(guildId, userId) {
  const result = await pool.query(
    'SELECT * FROM ticket_blacklist WHERE guild_id = $1 AND user_id = $2',
    [guildId, userId]
  );
  return result.rows[0] || null;
}

async function getBlacklist(guildId) {
  const result = await pool.query('SELECT * FROM ticket_blacklist WHERE guild_id = $1', [guildId]);
  return result.rows;
}

// Application type functions
async function createApplicationType(data) {
  const result = await pool.query(
    `INSERT INTO application_types (guild_id, name, description, review_roles, log_channel, cooldown_hours, create_ticket, pending_role, accepted_role, denied_role)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [data.guild_id, data.name, data.description, data.review_roles || '[]', data.log_channel, data.cooldown_hours || 24, data.create_ticket !== false, data.pending_role || null, data.accepted_role || null, data.denied_role || null]
  );
  return result.rows[0].id;
}

async function getApplicationType(id) {
  const result = await pool.query('SELECT * FROM application_types WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getApplicationTypeByName(guildId, name) {
  const result = await pool.query(
    'SELECT * FROM application_types WHERE guild_id = $1 AND name = $2',
    [guildId, name]
  );
  return result.rows[0] || null;
}

async function getApplicationTypes(guildId) {
  const result = await pool.query('SELECT * FROM application_types WHERE guild_id = $1', [guildId]);
  return result.rows;
}

async function updateApplicationType(id, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await pool.query(
    `UPDATE application_types SET ${setClause} WHERE id = $${keys.length + 1}`,
    [...values, id]
  );
}

async function deleteApplicationType(id) {
  await pool.query('DELETE FROM application_types WHERE id = $1', [id]);
}

// Question functions
async function addQuestion(data) {
  const result = await pool.query(
    `INSERT INTO application_questions (application_type_id, question, question_type, choices, required, order_num)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [data.application_type_id, data.question, data.question_type, data.choices || null, data.required !== false, data.order_num]
  );
  return result.rows[0].id;
}

async function getQuestions(applicationTypeId) {
  const result = await pool.query(
    'SELECT * FROM application_questions WHERE application_type_id = $1 ORDER BY order_num',
    [applicationTypeId]
  );
  return result.rows;
}

async function updateQuestion(id, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await pool.query(
    `UPDATE application_questions SET ${setClause} WHERE id = $${keys.length + 1}`,
    [...values, id]
  );
}

async function deleteQuestion(id) {
  await pool.query('DELETE FROM application_questions WHERE id = $1', [id]);
}

// Application functions
async function createApplication(data) {
  const result = await pool.query(
    `INSERT INTO applications (guild_id, application_type_id, user_id, answers, status, ticket_channel_id)
     VALUES ($1, $2, $3, $4, 'pending', $5) RETURNING id`,
    [data.guild_id, data.application_type_id, data.user_id, JSON.stringify(data.answers), data.ticket_channel_id]
  );
  return result.rows[0].id;
}

async function getApplication(id) {
  const result = await pool.query('SELECT * FROM applications WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getApplicationsByUser(guildId, userId, applicationTypeId) {
  const result = await pool.query(
    `SELECT * FROM applications WHERE guild_id = $1 AND user_id = $2 AND application_type_id = $3 ORDER BY created_at DESC`,
    [guildId, userId, applicationTypeId]
  );
  return result.rows;
}

async function getPendingApplications(guildId, applicationTypeId) {
  const result = await pool.query(
    `SELECT * FROM applications WHERE guild_id = $1 AND application_type_id = $2 AND status = 'pending' ORDER BY created_at`,
    [guildId, applicationTypeId]
  );
  return result.rows;
}

async function updateApplication(id, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await pool.query(
    `UPDATE applications SET ${setClause} WHERE id = $${keys.length + 1}`,
    [...values, id]
  );
}

async function reviewApplication(id, reviewedBy, status, reason) {
  await pool.query(
    `UPDATE applications SET status = $1, reviewed_by = $2, review_reason = $3, reviewed_at = CURRENT_TIMESTAMP WHERE id = $4`,
    [status, reviewedBy, reason, id]
  );
}

// Direct query for complex operations
async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

module.exports = {
  pool,
  query,
  initializeDatabase,
  getGuild,
  getGuildSync,
  createGuild,
  updateGuild,
  incrementTicketCounter,
  createPanel,
  getPanel,
  getPanelsByGuild,
  deletePanel,
  createTicket,
  getTicket,
  getTicketById,
  getOpenTicketsByUser,
  getOpenTickets,
  updateTicket,
  closeTicket,
  addToBlacklist,
  removeFromBlacklist,
  isBlacklisted,
  getBlacklist,
  createApplicationType,
  getApplicationType,
  getApplicationTypeByName,
  getApplicationTypes,
  updateApplicationType,
  deleteApplicationType,
  addQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,
  createApplication,
  getApplication,
  getApplicationsByUser,
  getPendingApplications,
  updateApplication,
  reviewApplication
};
