const { Events, ActivityType } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    logger.success(`Logged in as ${client.user.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s)`);

    client.user.setActivity('tickets', { type: ActivityType.Watching });
  }
};
