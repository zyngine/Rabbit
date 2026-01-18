const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
const dbPath = path.join(dataDir, 'rabbit.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  // Run migrations for existing databases
  runMigrations();

  console.log('[Database] Initialized successfully');
}

function runMigrations() {
  // Add style and ticket_types columns to panels table if they don't exist
  const panelColumns = db.prepare("PRAGMA table_info(panels)").all();
  const columnNames = panelColumns.map(c => c.name);

  if (!columnNames.includes('style')) {
    db.exec("ALTER TABLE panels ADD COLUMN style TEXT DEFAULT 'buttons'");
    console.log('[Database] Added style column to panels table');
  }

  if (!columnNames.includes('ticket_types')) {
    db.exec("ALTER TABLE panels ADD COLUMN ticket_types TEXT");
    console.log('[Database] Added ticket_types column to panels table');
  }
}

function getGuild(guildId) {
  const stmt = db.prepare('SELECT * FROM guilds WHERE guild_id = ?');
  return stmt.get(guildId);
}

function createGuild(guildId) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO guilds (guild_id, support_roles)
    VALUES (?, '[]')
  `);
  stmt.run(guildId);
  return getGuild(guildId);
}

function updateGuild(guildId, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = Object.values(data);
  const stmt = db.prepare(`UPDATE guilds SET ${fields} WHERE guild_id = ?`);
  stmt.run(...values, guildId);
}

function incrementTicketCounter(guildId) {
  const stmt = db.prepare(`
    UPDATE guilds SET ticket_counter = ticket_counter + 1
    WHERE guild_id = ?
  `);
  stmt.run(guildId);
  const guild = getGuild(guildId);
  return guild.ticket_counter;
}

function createPanel(data) {
  const stmt = db.prepare(`
    INSERT INTO panels (guild_id, channel_id, message_id, panel_type, title, description, button_label, button_color, category_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.guild_id, data.channel_id, data.message_id, data.panel_type,
    data.title, data.description, data.button_label, data.button_color, data.category_id
  );
  return result.lastInsertRowid;
}

function getPanel(messageId) {
  const stmt = db.prepare('SELECT * FROM panels WHERE message_id = ?');
  return stmt.get(messageId);
}

function getPanelsByGuild(guildId) {
  const stmt = db.prepare('SELECT * FROM panels WHERE guild_id = ?');
  return stmt.all(guildId);
}

function deletePanel(id) {
  const stmt = db.prepare('DELETE FROM panels WHERE id = ?');
  stmt.run(id);
}

function createTicket(data) {
  const stmt = db.prepare(`
    INSERT INTO tickets (guild_id, channel_id, user_id, panel_type, ticket_number, status, priority)
    VALUES (?, ?, ?, ?, ?, 'open', 'normal')
  `);
  const result = stmt.run(
    data.guild_id, data.channel_id, data.user_id, data.panel_type, data.ticket_number
  );
  return result.lastInsertRowid;
}

function getTicket(channelId) {
  const stmt = db.prepare('SELECT * FROM tickets WHERE channel_id = ?');
  return stmt.get(channelId);
}

function getTicketById(id) {
  const stmt = db.prepare('SELECT * FROM tickets WHERE id = ?');
  return stmt.get(id);
}

function getOpenTicketsByUser(guildId, userId) {
  const stmt = db.prepare(`
    SELECT * FROM tickets
    WHERE guild_id = ? AND user_id = ? AND status = 'open'
  `);
  return stmt.all(guildId, userId);
}

function getOpenTickets(guildId) {
  const stmt = db.prepare(`
    SELECT * FROM tickets WHERE guild_id = ? AND status = 'open'
  `);
  return stmt.all(guildId);
}

function updateTicket(channelId, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = Object.values(data);
  const stmt = db.prepare(`UPDATE tickets SET ${fields} WHERE channel_id = ?`);
  stmt.run(...values, channelId);
}

function closeTicket(channelId, reason) {
  const stmt = db.prepare(`
    UPDATE tickets
    SET status = 'closed', close_reason = ?, closed_at = CURRENT_TIMESTAMP
    WHERE channel_id = ?
  `);
  stmt.run(reason, channelId);
}

function addToBlacklist(guildId, userId, reason) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO ticket_blacklist (guild_id, user_id, reason)
    VALUES (?, ?, ?)
  `);
  stmt.run(guildId, userId, reason);
}

function removeFromBlacklist(guildId, userId) {
  const stmt = db.prepare('DELETE FROM ticket_blacklist WHERE guild_id = ? AND user_id = ?');
  stmt.run(guildId, userId);
}

function isBlacklisted(guildId, userId) {
  const stmt = db.prepare('SELECT * FROM ticket_blacklist WHERE guild_id = ? AND user_id = ?');
  return stmt.get(guildId, userId);
}

function createApplicationType(data) {
  const stmt = db.prepare(`
    INSERT INTO application_types (guild_id, name, description, review_roles, log_channel, cooldown_hours, create_ticket)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.guild_id, data.name, data.description, data.review_roles || '[]',
    data.log_channel, data.cooldown_hours || 24, data.create_ticket !== false ? 1 : 0
  );
  return result.lastInsertRowid;
}

function getApplicationType(id) {
  const stmt = db.prepare('SELECT * FROM application_types WHERE id = ?');
  return stmt.get(id);
}

function getApplicationTypeByName(guildId, name) {
  const stmt = db.prepare('SELECT * FROM application_types WHERE guild_id = ? AND name = ?');
  return stmt.get(guildId, name);
}

function getApplicationTypes(guildId) {
  const stmt = db.prepare('SELECT * FROM application_types WHERE guild_id = ?');
  return stmt.all(guildId);
}

function updateApplicationType(id, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = Object.values(data);
  const stmt = db.prepare(`UPDATE application_types SET ${fields} WHERE id = ?`);
  stmt.run(...values, id);
}

function deleteApplicationType(id) {
  const stmt = db.prepare('DELETE FROM application_types WHERE id = ?');
  stmt.run(id);
}

function addQuestion(data) {
  const stmt = db.prepare(`
    INSERT INTO application_questions (application_type_id, question, question_type, choices, required, order_num)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.application_type_id, data.question, data.question_type,
    data.choices || null, data.required !== false ? 1 : 0, data.order_num
  );
  return result.lastInsertRowid;
}

function getQuestions(applicationTypeId) {
  const stmt = db.prepare(`
    SELECT * FROM application_questions
    WHERE application_type_id = ?
    ORDER BY order_num
  `);
  return stmt.all(applicationTypeId);
}

function updateQuestion(id, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = Object.values(data);
  const stmt = db.prepare(`UPDATE application_questions SET ${fields} WHERE id = ?`);
  stmt.run(...values, id);
}

function deleteQuestion(id) {
  const stmt = db.prepare('DELETE FROM application_questions WHERE id = ?');
  stmt.run(id);
}

function createApplication(data) {
  const stmt = db.prepare(`
    INSERT INTO applications (guild_id, application_type_id, user_id, answers, status, ticket_channel_id)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `);
  const result = stmt.run(
    data.guild_id, data.application_type_id, data.user_id,
    JSON.stringify(data.answers), data.ticket_channel_id
  );
  return result.lastInsertRowid;
}

function getApplication(id) {
  const stmt = db.prepare('SELECT * FROM applications WHERE id = ?');
  return stmt.get(id);
}

function getApplicationsByUser(guildId, userId, applicationTypeId) {
  const stmt = db.prepare(`
    SELECT * FROM applications
    WHERE guild_id = ? AND user_id = ? AND application_type_id = ?
    ORDER BY created_at DESC
  `);
  return stmt.all(guildId, userId, applicationTypeId);
}

function getPendingApplications(guildId, applicationTypeId) {
  const stmt = db.prepare(`
    SELECT * FROM applications
    WHERE guild_id = ? AND application_type_id = ? AND status = 'pending'
    ORDER BY created_at
  `);
  return stmt.all(guildId, applicationTypeId);
}

function updateApplication(id, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = Object.values(data);
  const stmt = db.prepare(`UPDATE applications SET ${fields} WHERE id = ?`);
  stmt.run(...values, id);
}

function reviewApplication(id, reviewedBy, status, reason) {
  const stmt = db.prepare(`
    UPDATE applications
    SET status = ?, reviewed_by = ?, review_reason = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(status, reviewedBy, reason, id);
}

module.exports = {
  db,
  initializeDatabase,
  getGuild,
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
