import { EmbedBuilder } from 'discord.js';
import questRepository from '../repositories/questRepository.js';

class ReportService {
  async createReportEmbed(payload) {
    const { nickname, questId, proofUrl, author } = payload;
    const quest = questRepository.getById(parseInt(questId));

    if (!quest) throw new Error('Квест не найден (ID 1-10).');

    // Формируем команду для админа
    const adminCommand = `/givemydonateoff ${nickname} ${quest.reward}`;

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`📁 Новый отчет: ${quest.title}`)
      .addFields(
        { name: '👤 Никнейм', value: nickname, inline: true },
        { name: '🆔 Discord', value: `<@${author.id}>`, inline: true },
        { name: '📜 Квест', value: `**${quest.id}.** ${quest.title} (${quest.reward} AZ)` },
        { name: '🔗 Доказательство', value: proofUrl },
        { name: '💸 Команда выдачи', value: `\`\`\`${adminCommand}\`\`\`` } // Копипаст для админа
      )
      .setTimestamp()
      .setFooter({ text: 'Santa Ops | Admin Panel', iconURL: author.displayAvatarURL() });

    if (proofUrl.match(/\.(jpeg|jpg|gif|png)$/) != null) {
      embed.setImage(proofUrl);
    }

    return embed;
  }
}

export default new ReportService();
