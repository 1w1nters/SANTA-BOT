import { EmbedBuilder } from 'discord.js';
import questRepository from '../repositories/questRepository.js';

class ReportService {
  async createReportEmbed(payload) {
    const { nickname, questId, proofUrl, author } = payload;
    const quest = questRepository.getById(parseInt(questId));

    if (!quest) throw new Error('Квест не найден. Чекни ID.');

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`📁 Новый отчет: ${quest.title}`)
      .addFields(
        { name: '👤 Никнейм', value: nickname, inline: true },
        { name: '🆔 Discord', value: `<@${author.id}>`, inline: true },
        { name: '📜 Квест', value: `${quest.id}. ${quest.title}` },
        { name: '🔗 Доказательство', value: proofUrl }
      )
      .setTimestamp()
      .setFooter({ text: 'Santa Ops | Admin Panel', iconURL: author.displayAvatarURL() });

    // Если это картинка, пытаемся отобразить
    if (proofUrl.match(/\.(jpeg|jpg|gif|png)$/) != null) {
      embed.setImage(proofUrl);
    }

    return embed;
  }
}

export default new ReportService();