const storage = require("../storage");

class HistoryManager {

  getAll() {
    return storage.getHistory();
  }

  add(entry) {
    return storage.addHistory(entry);
  }

}

module.exports = new HistoryManager();