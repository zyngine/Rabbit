const db = require('../database/db');

class Ticket {
  constructor(data) {
    this.id = data.id;
    this.guildId = data.guild_id;
    this.channelId = data.channel_id;
    this.userId = data.user_id;
    this.panelType = data.panel_type;
    this.ticketNumber = data.ticket_number;
    this.status = data.status;
    this.priority = data.priority;
    this.claimedBy = data.claimed_by;
    this.closeReason = data.close_reason;
    this.transcriptUrl = data.transcript_url;
    this.rating = data.rating;
    this.feedback = data.feedback;
    this.createdAt = data.created_at;
    this.closedAt = data.closed_at;
  }

  static async create(data) {
    const id = await db.createTicket(data);
    return Ticket.getById(id);
  }

  static async get(channelId) {
    const data = await db.getTicket(channelId);
    return data ? new Ticket(data) : null;
  }

  static async getById(id) {
    const data = await db.getTicketById(id);
    return data ? new Ticket(data) : null;
  }

  static async getOpenByUser(guildId, userId) {
    const tickets = await db.getOpenTicketsByUser(guildId, userId);
    return tickets.map(d => new Ticket(d));
  }

  static async getOpen(guildId) {
    const tickets = await db.getOpenTickets(guildId);
    return tickets.map(d => new Ticket(d));
  }

  async save() {
    await db.updateTicket(this.channelId, {
      status: this.status,
      priority: this.priority,
      claimed_by: this.claimedBy,
      close_reason: this.closeReason,
      transcript_url: this.transcriptUrl,
      rating: this.rating,
      feedback: this.feedback
    });
  }

  async claim(userId) {
    this.claimedBy = userId;
    await this.save();
  }

  async unclaim() {
    this.claimedBy = null;
    await this.save();
  }

  async setPriority(priority) {
    this.priority = priority;
    await this.save();
  }

  async close(reason = null) {
    await db.closeTicket(this.channelId, reason);
    this.status = 'closed';
    this.closeReason = reason;
  }

  async setRating(rating, feedback = null) {
    this.rating = rating;
    this.feedback = feedback;
    await this.save();
  }

  async setTranscript(url) {
    this.transcriptUrl = url;
    await this.save();
  }
}

module.exports = Ticket;
