const StorageManager = require("./StorageManager");

class HistoryManager {

    getAll() {
        return StorageManager.getHistory();
    }

    add(entry) {
        return StorageManager.addHistory(entry);
    }

}

module.exports = new HistoryManager();