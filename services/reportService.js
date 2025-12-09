import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import questRepository from '../repositories/questRepository.js';
class ReportService {
async createReportPayload(payload) {
const { nickname, questId, proofUrl, author } = payload;
const quest = questRepository.getById(parseInt(questId));
  if (!quest) throw new Error('Квест не найден (ID 1-10).');

const adminCommand = `/givemydonateoff ${nickname} ${quest.reward}`;

const embed = new EmbedBuilder()
  .setColor(0x00ff00)
  .setTitle(`📁 Новый отчет: ${quest.title}`)
  .addFields(
    { name: '👤 Никнейм', value: nickname, inline: true },
    { name: '🆔 Discord', value: `<@${author.id}>`, inline: true },
    { name: '📜 Квест', value: `**${quest.id}.** ${quest.title} (${quest.reward} AZ)` },
    { name: '🔗 Доказательство', value: proofUrl },
    { name: '💸 Команда выдачи', value: `\`\`\`${adminCommand}\`\`\`` }
  )
  .setTimestamp()
  .setFooter({ text: 'Santa Ops | Admin Panel', iconURL: author.displayAvatarURL() });

if (proofUrl.match(/\.(jpeg|jpg|gif|png)$/) != null) {
  embed.setImage(proofUrl);
}

const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('issue_reward')
    .setLabel('Выдать форму')
    .setStyle(ButtonStyle.Primary)
);

return { embeds: [embed], components: [row] };
  }
}
export default new ReportService();
