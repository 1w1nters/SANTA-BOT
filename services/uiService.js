import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import questRepository from '../repositories/questRepository.js';

class UiService {
  async sendDashboard(channel) {
    const quests = questRepository.getAll();
    const questList = quests.map((q) => `**${q.id}.** ${q.title}`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🚨 CODE RED: ОПЕРАЦИЯ «СПАСТИ САНТУ»')
      .setDescription(
        `🎄 **Внимание, жители штата!**\n\nСанта Клаус исчез с радаров во время облета Лос-Сантоса. Праздник под угрозой срыва. Мы объявляем всеобщую мобилизацию!\n\nТвоя миссия: пройти по следам похитителей, собрать улики и вернуть Рождество. За выполнение каждого этапа полагается награда.`
      )
      .addFields(
        {
          name: '🚀 КАК СДАТЬ ОТЧЕТ',
          value: '> **Нажми зеленую кнопку ниже.**\n> Заполни форму: выбери номер квеста и вставь ссылку на доказательства (Imgur / Yapx / Lightshot).',
        },
        {
          name: '📜 ТЕКУЩИЕ ЗАДАЧИ',
          value: questList,
        }
      )
      .setColor(0xff0000) // Red Alert
      .setImage('https://media.discordapp.net/attachments/100000000000000000/118000000000000000/santa_banner.png?ex=657..._placeholder') // Твой баннер
      .setFooter({ text: 'Santa Ops | Global Event System' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('start_report')
        .setLabel('ОТПРАВИТЬ ОТЧЕТ')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎁')
    );

    await channel.send({ embeds: [embed], components: [row] });
  }
}

export default new UiService();
