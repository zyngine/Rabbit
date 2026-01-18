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

  static async get(guildId) {
    const data = await db.getGuild(guildId);
    return data ? new Guild(data) : null;
  }

  static async getOrCreate(guildId) {
    let data = await db.getGuild(guildId);
    if (!data) {
      await db.createGuild(guildId);
      data = await db.getGuild(guildId);
    }
    return new Guild(data);
  }

  async save() {
    await db.updateGuild(this.guildId, {
      ticket_log_channel: this.ticketLogChannel,
      ticket_transcript_channel: this.ticketTranscriptChannel,
      ticket_category: this.ticketCategory,
      ticket_limit: this.ticketLimit,
      auto_close_hours: this.autoCloseHours,
      support_roles: JSON.stringify(this.supportRoles)
    });
  }

  async addSupportRole(roleId) {
    if (!this.supportRoles.includes(roleId)) {
      this.supportRoles.push(roleId);
      await this.save();
    }
  }

  async removeSupportRole(roleId) {
    this.supportRoles = this.supportRoles.filter(id => id !== roleId);
    await this.save();
  }

  async incrementTicketCounter() {
    const counter = await db.incrementTicketCounter(this.guildId);
    this.ticketCounter = counter;
    return counter;
  }
}

module.exports = Guild;
