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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const REPORT_CHANNEL_ID = process.env.REPORT_CHANNEL_ID;

// Оставляем только setup
const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Установить панель подачи заявок (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    console.log('Refreshing application (/) commands...');
    // Перезаписываем команды (старая /report удалится сама)
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
});

client.on('interactionCreate', async (interaction) => {
  // 1. Команда /setup
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'У тебя нет прав, бро.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      await uiService.sendDashboard(interaction.channel);
      await interaction.editReply('Панель создана.');
    } catch (error) {
      console.error(error);
      await interaction.editReply('Ошибка: ' + error.message);
    }
  }

  // 2. Нажатие кнопки
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
      .setLabel('Ссылка на док-ва (Imgur/Yapx)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://imgur.com/...')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nickInput),
      new ActionRowBuilder().addComponents(questInput),
      new ActionRowBuilder().addComponents(proofInput)
    );

    await interaction.showModal(modal);
  }

  // 3. Отправка формы
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
        await interaction.editReply('✅ Отчет успешно сдан.');
      } else {
        throw new Error('Канал логов не найден.');
      }
    } catch (error) {
      console.error(error);
      await interaction.editReply(`Ошибка: ${error.message}`);
    }
  }
});

keepAlive();
client.login(process.env.DISCORD_TOKEN);
