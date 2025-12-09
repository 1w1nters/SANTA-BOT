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
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import reportService from './services/reportService.js';
import uiService from './services/uiService.js';
import playerRepository from './repositories/playerRepository.js'; // Подключили репо
import { keepAlive } from './keep_alive.js';
import 'dotenv/config';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const REPORT_CHANNEL_ID = process.env.REPORT_CHANNEL_ID;

const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Установить панель (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('myinfo')
    .setDescription('Мой прогресс и награды'),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  console.log(`System online: ${client.user.tag}`);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

client.on('interactionCreate', async (interaction) => {
  // --- COMMANDS ---

  // /setup
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return;
    await interaction.deferReply({ ephemeral: true });
    await uiService.sendDashboard(interaction.channel);
    await interaction.editReply('Панель обновлена.');
  }

  // /myinfo
  if (interaction.isChatInputCommand() && interaction.commandName === 'myinfo') {
    const player = playerRepository.getById(interaction.user.id);
    
    if (!player) {
      return interaction.reply({ content: '❌ Ты не зарегистрирован. Жми кнопку на панели.', ephemeral: true });
    }

    const completedCount = player.completedQuests.length;
    // Примерная награда: 50 монет за квест (кастомизируй)
    const potentialReward = completedCount * 50; 

    const embed = new EmbedBuilder()
      .setTitle(`📁 Досье агента: ${player.nickname}`)
      .setColor(0x0099ff)
      .addFields(
        { name: '📊 Прогресс', value: `${completedCount}/10 заданий`, inline: true },
        { name: '💰 Награда к выдаче', value: `${potentialReward} AZ Coins`, inline: true },
        { name: '🆔 Выполненные этапы', value: player.completedQuests.join(', ') || 'Нет' }
      )
      .setThumbnail(interaction.user.displayAvatarURL());

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // --- BUTTONS ---

  // Кнопка: РЕГИСТРАЦИЯ
  if (interaction.isButton() && interaction.customId === 'start_register') {
    const existing = playerRepository.getById(interaction.user.id);
    if (existing) {
      return interaction.reply({ content: `✅ Ты уже в системе под ником **${existing.nickname}**.`, ephemeral: true });
    }

    const modal = new ModalBuilder().setCustomId('register_modal').setTitle('Регистрация Агента');
    const nickInput = new TextInputBuilder().setCustomId('reg_nick').setLabel('Твой Никнейм').setStyle(TextInputStyle.Short).setRequired(true);
    const statsInput = new TextInputBuilder().setCustomId('reg_stats').setLabel('Скриншот статистики (/stats)').setStyle(TextInputStyle.Short).setPlaceholder('https://imgur.com/...').setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nickInput),
      new ActionRowBuilder().addComponents(statsInput)
    );
    await interaction.showModal(modal);
  }

  // Кнопка: СДАТЬ ОТЧЕТ
  if (interaction.isButton() && interaction.customId === 'start_report') {
    const player = playerRepository.getById(interaction.user.id);
    if (!player) {
      return interaction.reply({ content: '⛔ Сначала пройди регистрацию!', ephemeral: true });
    }

    const modal = new ModalBuilder().setCustomId('report_modal').setTitle('Сдача отчета');
    // Поля те же, что и были, но ник можно не спрашивать (берем из базы), 
    // но для надежности лучше оставить или автозаполнять (нельзя в модалках).
    // Оставим ввод квеста и док-в.
    
    const questInput = new TextInputBuilder().setCustomId('quest_id').setLabel('Номер квеста (1-10)').setStyle(TextInputStyle.Short).setRequired(true);
    const proofInput = new TextInputBuilder().setCustomId('proof_link').setLabel('Доказательства').setStyle(TextInputStyle.Short).setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(questInput),
      new ActionRowBuilder().addComponents(proofInput)
    );
    await interaction.showModal(modal);
  }

  // --- MODALS ---

  // Сабмит РЕГИСТРАЦИИ
  if (interaction.isModalSubmit() && interaction.customId === 'register_modal') {
    const nick = interaction.fields.getTextInputValue('reg_nick');
    const stats = interaction.fields.getTextInputValue('reg_stats');

    playerRepository.create(interaction.user.id, nick, stats);
    await interaction.reply({ content: '✅ Регистрация успешна. Теперь можешь сдавать отчеты.', ephemeral: true });
  }

  // Сабмит ОТЧЕТА
  if (interaction.isModalSubmit() && interaction.customId === 'report_modal') {
    await interaction.deferReply({ ephemeral: true });

    try {
      const player = playerRepository.getById(interaction.user.id); // Берем ник из базы
      const questIdRaw = interaction.fields.getTextInputValue('quest_id');
      const proofUrl = interaction.fields.getTextInputValue('proof_link');
      const questId = parseInt(questIdRaw);

      // Формируем отчет
      const embed = await reportService.createReportEmbed({
        nickname: player.nickname, // Ник из регистрации
        questId: questIdRaw,
        proofUrl,
        author: interaction.user,
      });

      // Сохраняем прогресс (пока просто добавляем квест)
      // В идеале: прогресс добавляет админ после проверки, но пока сделаем автоматическое зачисление при подаче (или просто отобразим отчет)
      // Если хочешь чтобы засчитывалось ТОЛЬКО после проверки админом - это сложнее (нужны кнопки админа).
      // Пока засчитаем сразу при подаче для теста /myinfo:
      playerRepository.addCompletedQuest(interaction.user.id, questId);

      const channel = await client.channels.fetch(REPORT_CHANNEL_ID);
      await channel.send({ embeds: [embed] });
      await interaction.editReply('✅ Отчет отправлен и предварительно засчитан.');
    } catch (e) {
      console.error(e);
      await interaction.editReply(`Ошибка: ${e.message}`);
    }
  }
});

keepAlive();
client.login(process.env.DISCORD_TOKEN);
