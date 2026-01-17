const { EmbedBuilder } = require('discord.js');
const config = require('../config');

function ticketWelcome(ticket, user, panelType) {
  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`Ticket #${ticket.ticket_number}`)
    .setDescription(`Welcome ${user}!\n\nPlease describe your issue and our support team will assist you shortly.`)
    .addFields(
      { name: 'Type', value: panelType || 'Support', inline: true },
      { name: 'Priority', value: `${config.priorities.normal.emoji} Normal`, inline: true },
      { name: 'Status', value: 'Open', inline: true }
    )
    .setFooter({ text: 'Use the buttons below to manage this ticket' })
    .setTimestamp();
}

function ticketClosed(ticket, closedBy, reason) {
  return new EmbedBuilder()
    .setColor(config.colors.danger)
    .setTitle('Ticket Closed')
    .setDescription(`This ticket has been closed.`)
    .addFields(
      { name: 'Closed By', value: closedBy.toString(), inline: true },
      { name: 'Reason', value: reason || 'No reason provided', inline: true }
    )
    .setTimestamp();
}

function ticketLog(action, ticket, user, extra = {}) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle(`Ticket ${action}`)
    .addFields(
      { name: 'Ticket', value: `#${ticket.ticket_number}`, inline: true },
      { name: 'User', value: `<@${ticket.user_id}>`, inline: true },
      { name: 'Action By', value: user.toString(), inline: true }
    )
    .setTimestamp();

  if (extra.reason) {
    embed.addFields({ name: 'Reason', value: extra.reason, inline: false });
  }
  if (extra.channel) {
    embed.addFields({ name: 'Channel', value: extra.channel, inline: true });
  }

  return embed;
}

function ticketPanel(title, description, buttonLabel) {
  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'Click the button below to create a ticket' });
}

function applicationPanel(appType) {
  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(appType.name)
    .setDescription(appType.description || 'Click the button below to apply.')
    .setFooter({ text: 'Click the button to start your application' });
}

function applicationSubmission(appType, user, answers, questions) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`Application: ${appType.name}`)
    .setDescription(`Submitted by ${user}`)
    .setTimestamp();

  questions.forEach((q, index) => {
    const answer = answers[q.id] || answers[index] || 'No answer provided';
    embed.addFields({
      name: q.question.substring(0, 256),
      value: answer.substring(0, 1024) || 'No answer',
      inline: false
    });
  });

  return embed;
}

function applicationResult(status, appType, reason, reviewedBy) {
  const isAccepted = status === 'accepted';
  return new EmbedBuilder()
    .setColor(isAccepted ? config.colors.success : config.colors.danger)
    .setTitle(`Application ${isAccepted ? 'Accepted' : 'Denied'}`)
    .setDescription(`Your application for **${appType.name}** has been ${status}.`)
    .addFields(
      { name: 'Reviewed By', value: reviewedBy.toString(), inline: true },
      { name: 'Reason', value: reason || 'No reason provided', inline: false }
    )
    .setTimestamp();
}

function success(message) {
  return new EmbedBuilder()
    .setColor(config.colors.success)
    .setDescription(`✅ ${message}`);
}

function error(message) {
  return new EmbedBuilder()
    .setColor(config.colors.danger)
    .setDescription(`❌ ${message}`);
}

function warning(message) {
  return new EmbedBuilder()
    .setColor(config.colors.warning)
    .setDescription(`⚠️ ${message}`);
}

function info(message) {
  return new EmbedBuilder()
    .setColor(config.colors.info)
    .setDescription(`ℹ️ ${message}`);
}

function feedbackPrompt(ticketNumber) {
  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('Rate Your Experience')
    .setDescription(`How would you rate the support you received for ticket #${ticketNumber}?`)
    .setFooter({ text: 'Click a button below to rate' });
}

module.exports = {
  ticketWelcome,
  ticketClosed,
  ticketLog,
  ticketPanel,
  applicationPanel,
  applicationSubmission,
  applicationResult,
  success,
  error,
  warning,
  info,
  feedbackPrompt
};
