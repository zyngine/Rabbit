const { Events } = require('discord.js');
const Guild = require('../models/Guild');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,

  async execute(member) {
    try {
      // Use getOrCreate to ensure guild settings exist
      const guildSettings = await Guild.getOrCreate(member.guild.id);

      logger.info(`Member joined: ${member.user.tag} in ${member.guild.name} - Auto roles configured: ${guildSettings.autoRoles?.length || 0}`);

      if (!guildSettings.autoRoles || guildSettings.autoRoles.length === 0) {
        return;
      }

      const rolesToAdd = [];
      const skippedRoles = [];

      for (const roleId of guildSettings.autoRoles) {
        const role = member.guild.roles.cache.get(roleId);
        if (!role) {
          skippedRoles.push(`${roleId} (not found)`);
          continue;
        }
        if (role.position >= member.guild.members.me.roles.highest.position) {
          skippedRoles.push(`${role.name} (too high)`);
          continue;
        }
        rolesToAdd.push(role);
      }

      if (skippedRoles.length > 0) {
        logger.warn(`Skipped auto roles for ${member.user.tag}: ${skippedRoles.join(', ')}`);
      }

      if (rolesToAdd.length > 0) {
        await member.roles.add(rolesToAdd);
        logger.info(`Added ${rolesToAdd.length} auto role(s) to ${member.user.tag} in ${member.guild.name}: ${rolesToAdd.map(r => r.name).join(', ')}`);
      }
    } catch (error) {
      logger.error(`Failed to add auto roles to ${member.user.tag}:`, error);
    }
  }
};
