import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} from 'discord.js';
import reportService from './services/reportService.js';
import questRepository from './repositories/questRepository.js';
import { keepAlive } from './keep_alive.js';
import 'dotenv/config';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const REPORT_CHANNEL_ID = process.env.REPORT_CHANNEL_ID;

// Команды
const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Установить панель подачи заявок (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('report')
    .setDescription('Сдать отчет (Файл)')
    .addStringOption(o => o.setName('nickname').setDescription('Ник').setRequired(true))
    .addIntegerOption(o => o.setName('quest').setDescription('ID Квеста').setRequired(true))
    .addAttachmentOption(o => o.setName('proof').setDescription('Скрин').setRequired(true)),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  console.log('System online.');
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

client.on('interactionCreate', async (interaction) => {
  // 1. Slash Command: /setup
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
    const embed = new EmbedBuilder()
      .setTitle('🎅 Операция: Спасти Санту')
      .setDescription('Для сдачи отчета нажми кнопку ниже.\n\n⚠️ **Важно:** В кнопке принимаются только ссылки. Если у тебя файл — юзай команду `/report`.')
      .setColor(0xff0000)
      .setImage('https://media.discordapp.net/attachments/100000000000000000/118000000000000000/santa_banner.png?ex=657..._placeholder'); // Замени на свой баннер

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('start_report')
        .setLabel('Оставить отчет')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📝')
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Панель создана.', ephemeral: true });
  }

  // 2. Slash Command: /report (Файлом)
  if (interaction.isChatInputCommand() && interaction.commandName === 'report') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const nickname = interaction.options.getString('nickname');
      const questId = interaction.options.getInteger('quest');
      const proof = interaction.options.getAttachment('proof');

      const embed = await reportService.createReportEmbed({
        nickname, questId, proofUrl: proof.url, author: interaction.user
      });

      const channel = await client.channels.fetch(REPORT_CHANNEL_ID);
      await channel.send({ embeds: [embed] });
      await interaction.editReply('✅ Отчет улетел админам.');
    } catch (e) {
      await interaction.editReply(`Ошибка: ${e.message}`);
    }
  }

  // 3. Button Click -> Open Modal
  if (interaction.isButton() && interaction.customId === 'start_report') {
    const modal = new ModalBuilder().setCustomId('report_modal').setTitle('Отчет по квесту');

    const nickInput = new TextInputBuilder().setCustomId('nick').setLabel('Твой Ник').setStyle(TextInputStyle.Short).setRequired(true);
    const questInput = new TextInputBuilder().setCustomId('quest_id').setLabel('Номер квеста (1-10)').setStyle(TextInputStyle.Short).setRequired(true);
    const proofInput = new TextInputBuilder().setCustomId('proof_link').setLabel('Ссылка на скриншот').setStyle(TextInputStyle.Short).setPlaceholder('https://imgur.com/...').setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nickInput),
      new ActionRowBuilder().addComponents(questInput),
      new ActionRowBuilder().addComponents(proofInput)
    );

    await interaction.showModal(modal);
  }

  // 4. Modal Submit
  if (interaction.isModalSubmit() && interaction.customId === 'report_modal') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const nickname = interaction.fields.getTextInputValue('nick');
      const questId = interaction.fields.getTextInputValue('quest_id');
      const proofUrl = interaction.fields.getTextInputValue('proof_link');

      const embed = await reportService.createReportEmbed({
        nickname, questId, proofUrl, author: interaction.user
      });

      const channel = await client.channels.fetch(REPORT_CHANNEL_ID);
      await channel.send({ embeds: [embed] });
      await interaction.editReply('✅ Отчет принят.');
    } catch (e) {
      await interaction.editReply(`Кринж, ошибка: ${e.message}`);
    }
  }
});

keepAlive(); // Запуск сервера
client.login(process.env.DISCORD_TOKEN);