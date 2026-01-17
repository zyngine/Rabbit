const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const { initializeDatabase } = require('./database/db');
const { loadCommands, registerCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const { startServer, setDiscordClient } = require('./web/server');
const logger = require('./utils/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember
  ]
});

async function main() {
  logger.info('Starting Rabbit Bot...');

  // Start web server IMMEDIATELY for Railway health checks
  startServer();

  try {
    initializeDatabase();

    const commands = await loadCommands(client);
    loadEvents(client);

    await registerCommands(commands);

    await client.login(config.token);

    setDiscordClient(client);
    logger.success('Bot fully initialized');
  } catch (error) {
    logger.error('Failed to start bot', error);
    // Don't exit - keep web server running
  }
}

process.on('unhandledRejection', error => {
  logger.error('Unhandled rejection', error);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

main();
