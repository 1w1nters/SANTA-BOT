import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

class UiService {
  async sendDashboard(channel) {
    const embed = new EmbedBuilder()
      .setTitle('🎄 Операция: Спасти Санту | Панель Игрока')
      .setDescription(
        `
**Как сдать отчет?**
1. Выбери квест из списка.
2. Жми кнопку **"Оставить отчет"** ниже.
3. Вставь ссылку на скрин (Imgur/Lightshot).
Если у тебя файл — пиши команду \`/report\`.

**Список квестов:**
1. Исчезновение Санты
2. Телепорт в беде
3. Потерянный список хороших детей
4. Переговоры с Гринчем
5. Лаборатория холодных следов
6. Охота за Ледяным Грабителем
7. Взлом морозной камеры
8. Побег из ледяной катакомбы
9. Ремонт саней и подготовка к вылету
10. Финальная битва: Спасти праздник
`
      )
      .setColor(0xe74c3c)
      .setFooter({ text: 'Santa Corp Systems' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('start_report')
        .setLabel('📂 Оставить отчет')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎅')
    );

    await channel.send({ embeds: [embed], components: [row] });
  }
}

export default new UiService();
