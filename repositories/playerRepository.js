import mongoose from 'mongoose';

// Схема данных игрока в базе
const playerSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  nickname: { type: String, required: true },
  statsUrl: { type: String, required: true },
  completedQuests: { type: [Number], default: [] }, // Массив ID квестов
  joinedAt: { type: Date, default: Date.now }
});

const PlayerModel = mongoose.model('Player', playerSchema);

class PlayerRepository {
  // Получить игрока (теперь это асинхронно!)
  async getById(discordId) {
    try {
      return await PlayerModel.findOne({ discordId });
    } catch (e) {
      console.error('Ошибка поиска игрока:', e);
      return null;
    }
  }

  // Создать игрока
  async create(discordId, nickname, statsUrl) {
    try {
      const newPlayer = await PlayerModel.create({
        discordId,
        nickname,
        statsUrl
      });
      return newPlayer;
    } catch (e) {
      console.error('Ошибка создания игрока:', e);
      return null;
    }
  }

  // Добавить выполненный квест
  async addCompletedQuest(discordId, questId) {
    try {
      const player = await this.getById(discordId);
      if (player && !player.completedQuests.includes(questId)) {
        player.completedQuests.push(questId);
        await player.save();
      }
    } catch (e) {
      console.error('Ошибка обновления квестов:', e);
    }
  }

  // Удалить игрока
  async delete(discordId) {
    try {
      const result = await PlayerModel.deleteOne({ discordId });
      return result.deletedCount > 0;
    } catch (e) {
      console.error('Ошибка удаления:', e);
      return false;
    }
  }
}

export default new PlayerRepository();
