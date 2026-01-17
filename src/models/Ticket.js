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

  static create(data) {
    const id = db.createTicket(data);
    return Ticket.getById(id);
  }

  static get(channelId) {
    const data = db.getTicket(channelId);
    return data ? new Ticket(data) : null;
  }

  static getById(id) {
    const data = db.getTicketById(id);
    return data ? new Ticket(data) : null;
  }

  static getOpenByUser(guildId, userId) {
    return db.getOpenTicketsByUser(guildId, userId).map(d => new Ticket(d));
  }

  static getOpen(guildId) {
    return db.getOpenTickets(guildId).map(d => new Ticket(d));
  }

  save() {
    db.updateTicket(this.channelId, {
      status: this.status,
      priority: this.priority,
      claimed_by: this.claimedBy,
      close_reason: this.closeReason,
      transcript_url: this.transcriptUrl,
      rating: this.rating,
      feedback: this.feedback
    });
  }

  claim(userId) {
    this.claimedBy = userId;
    this.save();
  }

  unclaim() {
    this.claimedBy = null;
    this.save();
  }

  setPriority(priority) {
    this.priority = priority;
    this.save();
  }

  close(reason = null) {
    db.closeTicket(this.channelId, reason);
    this.status = 'closed';
    this.closeReason = reason;
  }

  setRating(rating, feedback = null) {
    this.rating = rating;
    this.feedback = feedback;
    this.save();
  }

  setTranscript(url) {
    this.transcriptUrl = url;
    this.save();
  }
}

module.exports = Ticket;
