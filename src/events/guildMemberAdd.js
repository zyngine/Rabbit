const { Events } = require('discord.js');
const Guild = require('../models/Guild');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,

  async execute(member) {
    try {
      const guildSettings = await Guild.get(member.guild.id);

      if (!guildSettings || !guildSettings.autoRoles || guildSettings.autoRoles.length === 0) {
        return;
      }

      const rolesToAdd = [];

      for (const roleId of guildSettings.autoRoles) {
        const role = member.guild.roles.cache.get(roleId);
        if (role && role.position < member.guild.members.me.roles.highest.position) {
          rolesToAdd.push(role);
        }
      }

      if (rolesToAdd.length > 0) {
        await member.roles.add(rolesToAdd);
        logger.info(`Added ${rolesToAdd.length} auto role(s) to ${member.user.tag} in ${member.guild.name}`);
      }
    } catch (error) {
      logger.error(`Failed to add auto roles to ${member.user.tag}:`, error);
    }
  }
};
