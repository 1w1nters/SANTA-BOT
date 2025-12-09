import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} from 'discord.js';
import reportService from './services/reportService.js';
import uiService from './services/uiService.js';
import { keepAlive } from './keep_alive.js';
import 'dotenv/config';

// Инициализация клиента
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const REPORT_CHANNEL_ID = process.env.REPORT_CHANNEL_ID;

// Регистрация команд
const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Установить панель подачи заявок (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('report')
    .setDescription('Сдать отчет вручную (Файл)')
    .addStringOption((o) => o.setName('nickname').setDescription('Твой ник').setRequired(true))
    .addIntegerOption((o) => o.setName('quest').setDescription('ID Квеста').setRequired(true))
    .addAttachmentOption((o) => o.setName('proof').setDescription('Скриншот').setRequired(true)),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    console.log('Refreshing application (/) commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
});

client.on('interactionCreate', async (interaction) => {
  // 1. Обработка команды /setup
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
    // Проверка прав еще раз на всякий
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'У тебя нет прав, бро.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Вызываем сервис для отрисовки панели
      await uiService.sendDashboard(interaction.channel);
      await interaction.editReply('Панель успешно создана.');
    } catch (error) {
      console.error(error);
      await interaction.editReply('Ошибка при создании панели: ' + error.message);
    }
  }

  // 2. Обработка команды /report (Ручная сдача файлом)
  if (interaction.isChatInputCommand() && interaction.commandName === 'report') {
    await interaction.deferReply({ ephemeral: true });

    try {
      const nickname = interaction.options.getString('nickname');
      const questId = interaction.options.getInteger('quest');
      const proof = interaction.options.getAttachment('proof');

      const embed = await reportService.createReportEmbed({
        nickname,
        questId,
        proofUrl: proof.url,
        author: interaction.user,
      });

      const channel = await client.channels.fetch(REPORT_CHANNEL_ID);
      if (channel) {
        await channel.send({ embeds: [embed] });
        await interaction.editReply('✅ Отчет отправлен администраторам.');
      } else {
        throw new Error('Не найден канал для отчетов (Check REPORT_CHANNEL_ID).');
      }
    } catch (error) {
      console.error(error);
      await interaction.editReply(`Ошибка: ${error.message}`);
    }
  }

  // 3. Обработка нажатия кнопки "Оставить отчет"
  if (interaction.isButton() && interaction.customId === 'start_report') {
    const modal = new ModalBuilder()
      .setCustomId('report_modal')
      .setTitle('Сдача отчета');

    const nickInput = new TextInputBuilder()
      .setCustomId('nick')
      .setLabel('Твой Никнейм')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const questInput = new TextInputBuilder()
      .setCustomId('quest_id')
      .setLabel('Номер квеста (цифра 1-10)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const proofInput = new TextInputBuilder()
      .setCustomId('proof_link')
      .setLabel('Ссылка на док-ва (Imgur/Lightshot)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://imgur.com/...')
      .setRequired(true);

    const firstRow = new ActionRowBuilder().addComponents(nickInput);
    const secondRow = new ActionRowBuilder().addComponents(questInput);
    const thirdRow = new ActionRowBuilder().addComponents(proofInput);

    modal.addComponents(firstRow, secondRow, thirdRow);

    await interaction.showModal(modal);
  }

  // 4. Обработка отправки формы (Modal Submit)
  if (interaction.isModalSubmit() && interaction.customId === 'report_modal') {
    await interaction.deferReply({ ephemeral: true });

    try {
      const nickname = interaction.fields.getTextInputValue('nick');
      const questId = interaction.fields.getTextInputValue('quest_id');
      const proofUrl = interaction.fields.getTextInputValue('proof_link');

      const embed = await reportService.createReportEmbed({
        nickname,
        questId,
        proofUrl,
        author: interaction.user,
      });

      const channel = await client.channels.fetch(REPORT_CHANNEL_ID);
      if (channel) {
        await channel.send({ embeds: [embed] });
        await interaction.editReply('✅ Отчет успешно сдан через форму.');
      } else {
        throw new Error('Канал логов не найден.');
      }
    } catch (error) {
      console.error(error);
      await interaction.editReply(`Кринж, ошибка: ${error.message}`);
    }
  }
});

// Запуск веб-сервера для UptimeRobot
keepAlive();

// Логин бота
client.login(process.env.DISCORD_TOKEN);
