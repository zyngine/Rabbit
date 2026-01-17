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
  try {
    logger.info('Starting Rabbit Bot...');

    initializeDatabase();

    const commands = await loadCommands(client);
    loadEvents(client);

    await registerCommands(commands);

    await client.login(config.token);

    setDiscordClient(client);
    startServer();
  } catch (error) {
    logger.error('Failed to start bot', error);
    process.exit(1);
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
