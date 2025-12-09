import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('./data/players.json');

class PlayerRepository {
  constructor() {
    this.players = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        this.players = JSON.parse(data);
      }
    } catch (e) {
      console.error('Ошибка БД:', e);
      this.players = [];
    }
  }

  save() {
    fs.writeFileSync(DB_PATH, JSON.stringify(this.players, null, 2));
  }

  getById(discordId) {
    return this.players.find((p) => p.discordId === discordId);
  }

  create(discordId, nickname, statsUrl) {
    const player = {
      discordId,
      nickname,
      statsUrl,
      completedQuests: [],
      joinedAt: new Date().toISOString()
    };
    this.players.push(player);
    this.save();
    return player;
  }

  addCompletedQuest(discordId, questId) {
    const player = this.getById(discordId);
    if (player && !player.completedQuests.includes(questId)) {
      player.completedQuests.push(questId);
      this.save();
    }
  }

  // Новый метод: Удаление
  delete(discordId) {
    const index = this.players.findIndex((p) => p.discordId === discordId);
    if (index !== -1) {
      this.players.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }
}

export default new PlayerRepository();
