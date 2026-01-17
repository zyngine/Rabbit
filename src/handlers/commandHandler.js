const fs = require('fs');
const path = require('path');
const { Collection, REST, Routes } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');

async function loadCommands(client) {
  client.commands = new Collection();
  const commands = [];

  const commandsPath = path.join(__dirname, '../commands');
  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const stat = fs.statSync(folderPath);

    if (stat.isDirectory()) {
      const commandFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));

      for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
          commands.push(command.data.toJSON());
          logger.info(`Loaded command: ${command.data.name}`);
        } else {
          logger.warn(`Command at ${filePath} is missing required properties`);
        }
      }
    }
  }

  return commands;
}

async function registerCommands(commands) {
  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    logger.info(`Registering ${commands.length} application commands...`);

    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );

    logger.success('Successfully registered application commands');
  } catch (error) {
    logger.error('Failed to register commands', error);
  }
}

module.exports = { loadCommands, registerCommands };
