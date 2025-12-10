import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  nickname: { type: String, required: true },
  statsUrl: { type: String, required: true },
  completedQuests: { type: [Number], default: [] },
  joinedAt: { type: Date, default: Date.now }
});

const PlayerModel = mongoose.model('Player', playerSchema);

class PlayerRepository {
  async getById(discordId) {
    // Здесь try-catch оставляем, чтобы просто вернуть null если не найден
    try {
      return await PlayerModel.findOne({ discordId });
    } catch (e) {
      console.error('Ошибка поиска:', e);
      return null;
    }
  }

  // В создании убираем try-catch, чтобы ошибка летела в index.js
  async create(discordId, nickname, statsUrl) {
    return await PlayerModel.create({
      discordId,
      nickname,
      statsUrl
    });
  }

  async addCompletedQuest(discordId, questId) {
    const player = await this.getById(discordId);
    if (player && !player.completedQuests.includes(questId)) {
      player.completedQuests.push(questId);
      await player.save();
    }
  }

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
