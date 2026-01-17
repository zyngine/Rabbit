const db = require('../database/db');

class Guild {
  constructor(data) {
    this.guildId = data.guild_id;
    this.ticketLogChannel = data.ticket_log_channel;
    this.ticketTranscriptChannel = data.ticket_transcript_channel;
    this.ticketCategory = data.ticket_category;
    this.ticketCounter = data.ticket_counter || 0;
    this.ticketLimit = data.ticket_limit || 3;
    this.autoCloseHours = data.auto_close_hours || 0;
    this.supportRoles = JSON.parse(data.support_roles || '[]');
    this.createdAt = data.created_at;
  }

  static get(guildId) {
    const data = db.getGuild(guildId);
    return data ? new Guild(data) : null;
  }

  static getOrCreate(guildId) {
    let guild = Guild.get(guildId);
    if (!guild) {
      db.createGuild(guildId);
      guild = Guild.get(guildId);
    }
    return guild;
  }

  save() {
    db.updateGuild(this.guildId, {
      ticket_log_channel: this.ticketLogChannel,
      ticket_transcript_channel: this.ticketTranscriptChannel,
      ticket_category: this.ticketCategory,
      ticket_limit: this.ticketLimit,
      auto_close_hours: this.autoCloseHours,
      support_roles: JSON.stringify(this.supportRoles)
    });
  }

  addSupportRole(roleId) {
    if (!this.supportRoles.includes(roleId)) {
      this.supportRoles.push(roleId);
      this.save();
    }
  }

  removeSupportRole(roleId) {
    this.supportRoles = this.supportRoles.filter(id => id !== roleId);
    this.save();
  }

  incrementTicketCounter() {
    return db.incrementTicketCounter(this.guildId);
  }
}

module.exports = Guild;
