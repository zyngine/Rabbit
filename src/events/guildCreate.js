const { Events } = require('discord.js');
const Guild = require('../models/Guild');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildCreate,
  once: false,

  async execute(guild) {
    logger.info(`Joined new guild: ${guild.name} (${guild.id})`);

    Guild.getOrCreate(guild.id);

    logger.success(`Initialized settings for ${guild.name}`);
  }
};
