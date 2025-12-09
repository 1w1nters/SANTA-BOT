import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import questRepository from '../repositories/questRepository.js';

class UiService {
  async sendDashboard(channel) {
    const quests = questRepository.getAll();
    const questList = quests.map((q) => `**${q.id}.** ${q.title}`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🎅 OPERATION: SAVE CHRISTMAS')
      .setDescription(
        `**Статус:** 🔴 КРИТИЧЕСКИЙ\n**Локация:** Лос-Сантос\n\nЧтобы начать участие в операции, ты обязан пройти регистрацию. Без досье отчеты не принимаются.`
      )
      .addFields(
        {
          name: '🛠 АЛГОРИТМ ДЕЙСТВИЙ',
          value: '1. Жми **«Регистрация»** -> Вводи ник и скрин статистики.\n2. Выполняй квесты из списка.\n3. Жми **«Сдать отчет»** для отправки доказательств.\n4. Чекай прогресс через команду `/myinfo`.',
        },
        {
          name: '💀 СПИСОК УГРОЗ (КВЕСТЫ)',
          value: questList,
        }
      )
      .setColor(0xff0000)
      .setImage('https://media.discordapp.net/attachments/100000000000000000/118000000000000000/santa_banner.png?ex=657..._placeholder') // Твой баннер
      .setFooter({ text: 'Santa Ops | Classified' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('start_register') // Новая кнопка
        .setLabel('РЕГИСТРАЦИЯ')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📝'),
      new ButtonBuilder()
        .setCustomId('start_report')
        .setLabel('СДАТЬ ОТЧЕТ')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📤')
    );

    await channel.send({ embeds: [embed], components: [row] });
  }
}

export default new UiService();
