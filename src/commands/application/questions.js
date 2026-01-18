const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const { ApplicationType } = require('../../models/Application');
const db = require('../../database/db');
const embeds = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('appquestions')
    .setDescription('Manage application questions')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a question to an application')
        .addStringOption(option =>
          option.setName('application')
            .setDescription('Application type name')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('question')
            .setDescription('The question to ask')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Question type')
            .setRequired(true)
            .addChoices(
              { name: 'Short Text', value: 'short' },
              { name: 'Paragraph', value: 'paragraph' }
            ))
        .addBooleanOption(option =>
          option.setName('required')
            .setDescription('Is this question required?')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a question from an application')
        .addStringOption(option =>
          option.setName('application')
            .setDescription('Application type name')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('number')
            .setDescription('Question number to remove')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all questions for an application')
        .addStringOption(option =>
          option.setName('application')
            .setDescription('Application type name')
            .setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const appName = interaction.options.getString('application');

    const appType = await ApplicationType.getByName(interaction.guild.id, appName);
    if (!appType) {
      return interaction.reply({
        embeds: [embeds.error(`Application type "${appName}" not found.`)],
        ephemeral: true
      });
    }

    switch (subcommand) {
      case 'add': {
        const questions = await appType.getQuestions();
        if (questions.length >= 5) {
          return interaction.reply({
            embeds: [embeds.error('Applications can have a maximum of 5 questions (Discord modal limit).')],
            ephemeral: true
          });
        }

        const question = interaction.options.getString('question');
        const type = interaction.options.getString('type');
        const required = interaction.options.getBoolean('required') ?? true;

        await appType.addQuestion({
          question,
          question_type: type,
          required,
          order_num: questions.length + 1
        });

        return interaction.reply({
          embeds: [embeds.success(`Question added to "${appName}"!\n\n**Q${questions.length + 1}:** ${question}`)]
        });
      }

      case 'remove': {
        const questions = await appType.getQuestions();
        const number = interaction.options.getInteger('number');

        if (number < 1 || number > questions.length) {
          return interaction.reply({
            embeds: [embeds.error(`Invalid question number. This application has ${questions.length} question(s).`)],
            ephemeral: true
          });
        }

        const questionToRemove = questions[number - 1];
        await db.deleteQuestion(questionToRemove.id);

        for (const q of questions.slice(number)) {
          await db.updateQuestion(q.id, { order_num: number + questions.slice(number).indexOf(q) });
        }

        return interaction.reply({
          embeds: [embeds.success(`Question ${number} has been removed from "${appName}".`)]
        });
      }

      case 'list': {
        const questions = await appType.getQuestions();

        if (questions.length === 0) {
          return interaction.reply({
            embeds: [embeds.info(`No questions configured for "${appName}".\n\nUse \`/appquestions add\` to add questions.`)],
            ephemeral: true
          });
        }

        const embed = new EmbedBuilder()
          .setColor(config.colors.primary)
          .setTitle(`Questions: ${appName}`)
          .setDescription(questions.map((q, i) =>
            `**${i + 1}.** ${q.question}\n` +
            `   Type: ${q.question_type} | Required: ${q.required ? 'Yes' : 'No'}`
          ).join('\n\n'));

        return interaction.reply({ embeds: [embed] });
      }
    }
  }
};
