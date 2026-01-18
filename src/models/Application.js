const db = require('../database/db');

class ApplicationType {
  constructor(data) {
    this.id = data.id;
    this.guildId = data.guild_id;
    this.name = data.name;
    this.description = data.description;
    this.channelId = data.channel_id;
    this.messageId = data.message_id;
    this.reviewRoles = JSON.parse(data.review_roles || '[]');
    this.logChannel = data.log_channel;
    this.cooldownHours = data.cooldown_hours || 24;
    this.createTicket = Boolean(data.create_ticket);
    this.active = Boolean(data.active);
    this.pendingRole = data.pending_role;
    this.acceptedRole = data.accepted_role;
    this.deniedRole = data.denied_role;
    this.createdAt = data.created_at;
  }

  static async create(data) {
    const id = await db.createApplicationType({
      ...data,
      review_roles: JSON.stringify(data.reviewRoles || [])
    });
    return ApplicationType.get(id);
  }

  static async get(id) {
    const data = await db.getApplicationType(id);
    return data ? new ApplicationType(data) : null;
  }

  static async getByName(guildId, name) {
    const data = await db.getApplicationTypeByName(guildId, name);
    return data ? new ApplicationType(data) : null;
  }

  static async getAll(guildId) {
    const types = await db.getApplicationTypes(guildId);
    return types.map(d => new ApplicationType(d));
  }

  async save() {
    await db.updateApplicationType(this.id, {
      name: this.name,
      description: this.description,
      channel_id: this.channelId,
      message_id: this.messageId,
      review_roles: JSON.stringify(this.reviewRoles),
      log_channel: this.logChannel,
      cooldown_hours: this.cooldownHours,
      create_ticket: this.createTicket,
      active: this.active,
      pending_role: this.pendingRole,
      accepted_role: this.acceptedRole,
      denied_role: this.deniedRole
    });
  }

  async delete() {
    await db.deleteApplicationType(this.id);
  }

  async getQuestions() {
    return db.getQuestions(this.id);
  }

  async addQuestion(data) {
    return db.addQuestion({
      application_type_id: this.id,
      ...data
    });
  }
}

class Application {
  constructor(data) {
    this.id = data.id;
    this.guildId = data.guild_id;
    this.applicationTypeId = data.application_type_id;
    this.userId = data.user_id;
    this.answers = JSON.parse(data.answers || '{}');
    this.status = data.status;
    this.reviewedBy = data.reviewed_by;
    this.reviewReason = data.review_reason;
    this.ticketChannelId = data.ticket_channel_id;
    this.createdAt = data.created_at;
    this.reviewedAt = data.reviewed_at;
  }

  static async create(data) {
    const id = await db.createApplication(data);
    return Application.get(id);
  }

  static async get(id) {
    const data = await db.getApplication(id);
    return data ? new Application(data) : null;
  }

  static async getByUser(guildId, userId, applicationTypeId) {
    const apps = await db.getApplicationsByUser(guildId, userId, applicationTypeId);
    return apps.map(d => new Application(d));
  }

  static async getPending(guildId, applicationTypeId) {
    const apps = await db.getPendingApplications(guildId, applicationTypeId);
    return apps.map(d => new Application(d));
  }

  async save() {
    await db.updateApplication(this.id, {
      answers: JSON.stringify(this.answers),
      status: this.status,
      reviewed_by: this.reviewedBy,
      review_reason: this.reviewReason,
      ticket_channel_id: this.ticketChannelId
    });
  }

  async accept(reviewerId, reason = null) {
    await db.reviewApplication(this.id, reviewerId, 'accepted', reason);
    this.status = 'accepted';
    this.reviewedBy = reviewerId;
    this.reviewReason = reason;
  }

  async deny(reviewerId, reason = null) {
    await db.reviewApplication(this.id, reviewerId, 'denied', reason);
    this.status = 'denied';
    this.reviewedBy = reviewerId;
    this.reviewReason = reason;
  }

  async canApply(cooldownHours) {
    const apps = await Application.getByUser(this.guildId, this.userId, this.applicationTypeId);
    const lastApp = apps[0];
    if (!lastApp) return true;

    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    const timeSince = Date.now() - new Date(lastApp.createdAt).getTime();
    return timeSince >= cooldownMs;
  }
}

module.exports = { ApplicationType, Application };
