import { questsData } from '../data/quests.js';

class QuestRepository {
  getAll() {
    return questsData;
  }

  getById(id) {
    return questsData.find((q) => q.id === id) || null;
  }
}

export default new QuestRepository();