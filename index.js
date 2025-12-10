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
import mongoose from 'mongoose';
import reportService from './services/reportService.js';
import uiService from './services/uiService.js';
import playerRepository from './repositories/playerRepository.js';
import questRepository from './repositories/questRepository.js';
import { keepAlive } from './keep_alive.js';
import 'dotenv/config';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const REPORT_CHANNEL_ID = process.env.REPORT_CHANNEL_ID;
const LOG_CHANNEL_ID = '1447931982087454892'; 

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
  
  if (!process.env.MONGO_URI) {
    console.error('❌ ОШИБКА: Не указан MONGO_URI в Render! База данных не работает.');
  } else {
    try {
      mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log('✅ База данных подключена (MongoDB)'))
        .catch(err => console.error('❌ Ошибка подключения БД:', err));
    } catch (err) {
      console.error('❌ Fatal DB Error:', err);
    }
  }

  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

client.on('interactionCreate', async (interaction) => {
  try {
    // --- КОМАНДЫ ---
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'setup') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        await interaction.deferReply({ ephemeral: true });
        await uiService.sendDashboard(interaction.channel);
        await interaction.editReply('Панель обновлена.');
      }

      if (interaction.commandName === 'myinfo') {
        await interaction.deferReply({ ephemeral: true });
        const player = await playerRepository.getById(interaction.user.id);
        
        if (!player) {
          return interaction.editReply('❌ Нет регистрации. Данные отсутствуют в базе.');
        }

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

        await interaction.editReply({ embeds: [embed] });
      }
    }

    // --- КНОПКИ ---
    if (interaction.isButton()) {
      
      // 1. РЕГИСТРАЦИЯ (Открытие окна)
      if (interaction.customId === 'start_register') {
        const modal = new ModalBuilder().setCustomId('register_modal').setTitle('Регистрация');
        const nickInput = new TextInputBuilder().setCustomId('reg_nick').setLabel('Твой Никнейм').setStyle(TextInputStyle.Short).setRequired(true);
        const statsInput = new TextInputBuilder().setCustomId('reg_stats').setLabel('Скрин /stats + /time').setStyle(TextInputStyle.Short).setPlaceholder('https://imgur.com/...').setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(nickInput), new ActionRowBuilder().addComponents(statsInput));
        await interaction.showModal(modal);
      }

      // 2. СДАЧА ОТЧЕТА (Открытие окна)
      if (interaction.customId === 'start_report') {
        const modal = new ModalBuilder().setCustomId('report_modal').setTitle('Сдача отчета');
        const questInput = new TextInputBuilder().setCustomId('quest_id').setLabel('Номер квеста (1-10)').setStyle(TextInputStyle.Short).setRequired(true);
        const proofInput = new TextInputBuilder().setCustomId('proof_link').setLabel('Доказательства').setStyle(TextInputStyle.Short).setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(questInput), new ActionRowBuilder().addComponents(proofInput));
        await interaction.showModal(modal);
      }

      // 3. УДАЛЕНИЕ (Админка)
      if (interaction.customId.startsWith('delete_user_')) {
        await interaction.deferUpdate();

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.followUp({ content: 'Нет прав на удаление.', ephemeral: true });
        }

        const targetId = interaction.customId.split('_')[2];
        const deleted = await playerRepository.delete(targetId);

        if (deleted) {
          const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0x000000)
            .setTitle('❌ РЕГИСТРАЦИЯ ОТМЕНЕНА')
            .setDescription(`Администратор <@${interaction.user.id}> удалил этого пользователя из базы.`);
          
          await interaction.editReply({ embeds: [embed], components: [] });
        } else {
          await interaction.followUp({ content: 'Пользователь уже удален или не найден.', ephemeral: true });
        }
      }

      // 4. ВЫДАЧА НАГРАДЫ
      if (interaction.customId === 'give_reward') {
        await interaction.deferUpdate();
        
        const oldEmbed = interaction.message.embeds[0];
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('give_reward_done')
            .setLabel(`Форма выдана: ${interaction.user.username}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
        await interaction.editReply({ embeds: [oldEmbed], components: [disabledRow] });
      }
    }

    // --- МОДАЛКИ (ФОРМЫ) ---
    if (interaction.isModalSubmit()) {
      
      // ОБРАБОТКА РЕГИСТРАЦИИ
      if (interaction.customId === 'register_modal') {
        await interaction.deferReply({ ephemeral: true });

        // Проверка на дубликат
        const existing = await playerRepository.getById(interaction.user.id);
        if (existing) {
          return interaction.editReply(`⚠ Ты уже зарегистрирован как **${existing.nickname}**.`);
        }

        const nick = interaction.fields.getTextInputValue('reg_nick');
        const stats = interaction.fields.getTextInputValue('reg_stats');

        // Создаем игрока и проверяем результат!
        const newPlayer = await playerRepository.create(interaction.user.id, nick, stats);

        if (!newPlayer) {
          // Если вернулся null, значит база данных отклонила запись
          return interaction.editReply('❌ **Ошибка базы данных!** Регистрация не сохранена. Проверьте `MONGO_URI` или логи консоли.');
        }

        await interaction.editReply('✅ Регистрация успешна.');

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
          console.error('Ошибка логов:', e);
        }
      }

      // ОБРАБОТКА ОТЧЕТА
      if (interaction.customId === 'report_modal') {
        await interaction.deferReply({ ephemeral: true });

        const player = await playerRepository.getById(interaction.user.id);
        
        if (!player) {
           return interaction.editReply('❌ Ошибка: Ты не зарегистрирован в базе данных. Попробуй пройти регистрацию снова.');
        }

        try {
          const questIdRaw = interaction.fields.getTextInputValue('quest_id');
          const proofUrl = interaction.fields.getTextInputValue('proof_link');
          const questId = parseInt(questIdRaw);

          const embed = await reportService.createReportEmbed({
            nickname: player.nickname,
            questId: questIdRaw,
            proofUrl,
            author: interaction.user,
          });

          await playerRepository.addCompletedQuest(interaction.user.id, questId);
          
          const channel = await client.channels.fetch(REPORT_CHANNEL_ID);
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('give_reward')
              .setLabel('Выдать форму')
              .setStyle(ButtonStyle.Success)
          );

          await channel.send({ embeds: [embed], components: [row] });
          await interaction.editReply('✅ Отчет отправлен.');
        } catch (e) {
          await interaction.editReply(`Ошибка: ${e.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Interaction Error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Произошла критическая ошибка бота.', ephemeral: true }).catch(() => {});
    }
  }
});

// --- ANTI-CRASH SYSTEM ---
process.on('unhandledRejection', (reason, promise) => {
  console.log(' [Anti-Crash] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.log(' [Anti-Crash] Uncaught Exception:', err);
});
process.on('uncaughtExceptionMonitor', (err, origin) => {
  console.log(' [Anti-Crash] Uncaught Exception Monitor:', err, origin);
});

keepAlive();
client.login(process.env.DISCORD_TOKEN);
