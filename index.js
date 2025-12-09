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
EmbedBuilder,
ButtonBuilder,
ButtonStyle
} from 'discord.js';
import reportService from './services/reportService.js';
import uiService from './services/uiService.js';
import playerRepository from './repositories/playerRepository.js';
import questRepository from './repositories/questRepository.js';
import { keepAlive } from './keep_alive.js';
import 'dotenv/config';
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const REPORT_CHANNEL_ID = process.env.REPORT_CHANNEL_ID;
const LOG_CHANNEL_ID = '1447931982087454892'; // ID канала логов
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
console.log(System online: ${client.user.tag});
await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});
client.on('interactionCreate', async (interaction) => {
// --- КОМАНДЫ ---
if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return;
await interaction.deferReply({ ephemeral: true });
await uiService.sendDashboard(interaction.channel);
await interaction.editReply('Панель обновлена.');
}
if (interaction.isChatInputCommand() && interaction.commandName === 'myinfo') {
const player = playerRepository.getById(interaction.user.id);
if (!player) return interaction.reply({ content: '❌ Нет регистрации.', ephemeral: true });
  let totalReward = 0;
const questNames = [];
player.completedQuests.forEach(qId => {
  const q = questRepository.getById(qId);
  if (q) {
    totalReward += q.reward;
    questNames.push(`${q.id} (${q.reward} AZ)`);
  }
});

const embed = new EmbedBuilder()
  .setTitle(`📁 Досье агента: ${player.nickname}`)
  .setColor(0x0099ff)
  .addFields(
    { name: '📊 Выполнено', value: `${player.completedQuests.length}/10`, inline: true },
    { name: '💰 Заработано AZ', value: `${totalReward}`, inline: true },
    { name: '✅ Этапы', value: questNames.join('\n') || 'Нет' }
  )
  .setThumbnail(interaction.user.displayAvatarURL());

await interaction.reply({ embeds: [embed], ephemeral: true });
  }
// --- КНОПКИ ---
if (interaction.isButton() && interaction.customId === 'start_register') {
const existing = playerRepository.getById(interaction.user.id);
if (existing) return interaction.reply({ content: ✅ Ты уже в базе: **${existing.nickname}**., ephemeral: true });
const modal = new ModalBuilder().setCustomId('register_modal').setTitle('Регистрация');
const nickInput = new TextInputBuilder().setCustomId('reg_nick').setLabel('Твой Никнейм').setStyle(TextInputStyle.Short).setRequired(true);
const statsInput = new TextInputBuilder().setCustomId('reg_stats').setLabel('Скрин /stats + /time').setStyle(TextInputStyle.Short).setPlaceholder('https://imgur.com/...').setRequired(true);

modal.addComponents(new ActionRowBuilder().addComponents(nickInput), new ActionRowBuilder().addComponents(statsInput));
await interaction.showModal(modal);
}
if (interaction.isButton() && interaction.customId === 'start_report') {
const player = playerRepository.getById(interaction.user.id);
if (!player) return interaction.reply({ content: '⛔ Сначала пройди регистрацию!', ephemeral: true });
  const modal = new ModalBuilder().setCustomId('report_modal').setTitle('Сдача отчета');
const questInput = new TextInputBuilder().setCustomId('quest_id').setLabel('Номер квеста (1-10)').setStyle(TextInputStyle.Short).setRequired(true);
const proofInput = new TextInputBuilder().setCustomId('proof_link').setLabel('Доказательства').setStyle(TextInputStyle.Short).setRequired(true);

modal.addComponents(new ActionRowBuilder().addComponents(questInput), new ActionRowBuilder().addComponents(proofInput));
await interaction.showModal(modal);
}
// Кнопка удаления (Admin Log)
if (interaction.isButton() && interaction.customId.startsWith('delete_user_')) {
if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
return interaction.reply({ content: 'Нет прав на удаление.', ephemeral: true });
}
  const targetId = interaction.customId.split('_')[2];
const deleted = playerRepository.delete(targetId);

if (deleted) {
  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(0x000000)
    .setTitle('❌ РЕГИСТРАЦИЯ ОТМЕНЕНА')
    .setDescription(`Администратор <@${interaction.user.id}> удалил этого пользователя из базы.`);
  
  await interaction.update({ embeds: [embed], components: [] });
} else {
  await interaction.reply({ content: 'Пользователь уже удален или не найден.', ephemeral: true });
}
}
// Кнопка выдачи формы (Admin Report)
if (interaction.isButton() && interaction.customId === 'issue_reward') {
// Делаем кнопку серой и меняем текст
const disabledRow = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId('issue_reward_done')
.setLabel(Форма выдана: ${interaction.user.username})
.setStyle(ButtonStyle.Secondary)
.setDisabled(true)
);
  await interaction.update({ components: [disabledRow] });
}
// --- МОДАЛКИ ---
if (interaction.isModalSubmit() && interaction.customId === 'register_modal') {
const nick = interaction.fields.getTextInputValue('reg_nick');
const stats = interaction.fields.getTextInputValue('reg_stats');
  const newPlayer = playerRepository.create(interaction.user.id, nick, stats);
await interaction.reply({ content: '✅ Регистрация успешна.', ephemeral: true });

try {
  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
  const logEmbed = new EmbedBuilder()
    .setTitle('🆕 Новая регистрация')
    .setColor(0x2ecc71)
    .addFields(
      { name: '👤 Ник', value: nick, inline: true },
      { name: '🆔 Discord', value: `<@${interaction.user.id}>`, inline: true },
      { name: '🔗 Статистика', value: stats }
    )
    .setTimestamp();
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`delete_user_${interaction.user.id}`)
      .setLabel('❌ Удалить / Отменить')
      .setStyle(ButtonStyle.Danger)
  );

  await logChannel.send({ embeds: [logEmbed], components: [row] });
} catch (e) {
  console.error('Ошибка логов регистрации:', e);
}
}
if (interaction.isModalSubmit() && interaction.customId === 'report_modal') {
await interaction.deferReply({ ephemeral: true });
try {
const player = playerRepository.getById(interaction.user.id);
const questIdRaw = interaction.fields.getTextInputValue('quest_id');
const proofUrl = interaction.fields.getTextInputValue('proof_link');
const questId = parseInt(questIdRaw);
  // FIX: Вызываем createReportPayload, так как метод переименован
  const payload = await reportService.createReportPayload({
    nickname: player.nickname,
    questId: questIdRaw,
    proofUrl,
    author: interaction.user,
  });

  playerRepository.addCompletedQuest(interaction.user.id, questId);
  const channel = await client.channels.fetch(REPORT_CHANNEL_ID);
  
  // Отправляем payload (там внутри embeds и components)
  await channel.send(payload);
  await interaction.editReply('✅ Отчет отправлен.');
} catch (e) {
  console.error(e);
  await interaction.editReply(`Ошибка: ${e.message}`);
}
}
});
keepAlive();
client.login(process.env.DISCORD_TOKEN);
