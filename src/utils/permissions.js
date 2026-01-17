const { PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');

function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

function isSupport(member, guildId) {
  if (isAdmin(member)) return true;

  const guild = db.getGuild(guildId);
  if (!guild || !guild.support_roles) return false;

  const supportRoles = JSON.parse(guild.support_roles);
  return member.roles.cache.some(role => supportRoles.includes(role.id));
}

function canManageTicket(member, ticket) {
  if (isAdmin(member)) return true;
  if (isSupport(member, ticket.guild_id)) return true;
  return ticket.user_id === member.id;
}

function canClaimTicket(member, ticket) {
  if (!isSupport(member, ticket.guild_id)) return false;
  return !ticket.claimed_by || ticket.claimed_by === member.id || isAdmin(member);
}

function canUnclaimTicket(member, ticket) {
  if (isAdmin(member)) return true;
  return ticket.claimed_by === member.id;
}

function canReviewApplication(member, appType) {
  if (isAdmin(member)) return true;

  const reviewRoles = JSON.parse(appType.review_roles || '[]');
  return member.roles.cache.some(role => reviewRoles.includes(role.id));
}

function getTicketPermissions(guildId, userId, supportRoles) {
  const perms = [
    {
      id: userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  supportRoles.forEach(roleId => {
    perms.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageMessages
      ]
    });
  });

  return perms;
}

module.exports = {
  isAdmin,
  isSupport,
  canManageTicket,
  canClaimTicket,
  canUnclaimTicket,
  canReviewApplication,
  getTicketPermissions
};
