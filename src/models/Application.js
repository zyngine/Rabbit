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
    this.createdAt = data.created_at;
  }

  static create(data) {
    const id = db.createApplicationType({
      ...data,
      review_roles: JSON.stringify(data.reviewRoles || [])
    });
    return ApplicationType.get(id);
  }

  static get(id) {
    const data = db.getApplicationType(id);
    return data ? new ApplicationType(data) : null;
  }

  static getByName(guildId, name) {
    const data = db.getApplicationTypeByName(guildId, name);
    return data ? new ApplicationType(data) : null;
  }

  static getAll(guildId) {
    return db.getApplicationTypes(guildId).map(d => new ApplicationType(d));
  }

  save() {
    db.updateApplicationType(this.id, {
      name: this.name,
      description: this.description,
      channel_id: this.channelId,
      message_id: this.messageId,
      review_roles: JSON.stringify(this.reviewRoles),
      log_channel: this.logChannel,
      cooldown_hours: this.cooldownHours,
      create_ticket: this.createTicket ? 1 : 0,
      active: this.active ? 1 : 0
    });
  }

  delete() {
    db.deleteApplicationType(this.id);
  }

  getQuestions() {
    return db.getQuestions(this.id);
  }

  addQuestion(data) {
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

  static create(data) {
    const id = db.createApplication(data);
    return Application.get(id);
  }

  static get(id) {
    const data = db.getApplication(id);
    return data ? new Application(data) : null;
  }

  static getByUser(guildId, userId, applicationTypeId) {
    return db.getApplicationsByUser(guildId, userId, applicationTypeId)
      .map(d => new Application(d));
  }

  static getPending(guildId, applicationTypeId) {
    return db.getPendingApplications(guildId, applicationTypeId)
      .map(d => new Application(d));
  }

  save() {
    db.updateApplication(this.id, {
      answers: JSON.stringify(this.answers),
      status: this.status,
      reviewed_by: this.reviewedBy,
      review_reason: this.reviewReason,
      ticket_channel_id: this.ticketChannelId
    });
  }

  accept(reviewerId, reason = null) {
    db.reviewApplication(this.id, reviewerId, 'accepted', reason);
    this.status = 'accepted';
    this.reviewedBy = reviewerId;
    this.reviewReason = reason;
  }

  deny(reviewerId, reason = null) {
    db.reviewApplication(this.id, reviewerId, 'denied', reason);
    this.status = 'denied';
    this.reviewedBy = reviewerId;
    this.reviewReason = reason;
  }

  canApply(cooldownHours) {
    const lastApp = Application.getByUser(this.guildId, this.userId, this.applicationTypeId)[0];
    if (!lastApp) return true;

    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    const timeSince = Date.now() - new Date(lastApp.createdAt).getTime();
    return timeSince >= cooldownMs;
  }
}

module.exports = { ApplicationType, Application };
