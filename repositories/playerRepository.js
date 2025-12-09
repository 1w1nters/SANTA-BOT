import fs from 'fs';
import path from 'path';

// Используем простой путь в корне, если папка data не создана вручную
// Это предотвратит ошибку "no such file or directory"
const DB_PATH = path.resolve('./players.json');

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
      } else {
        // Если файла нет, создаем пустой
        this.save();
      }
    } catch (e) {
      console.error('Ошибка чтения БД (создаю новую):', e);
      this.players = [];
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.players, null, 2));
    } catch (e) {
      console.error('Ошибка записи БД:', e);
    }
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
