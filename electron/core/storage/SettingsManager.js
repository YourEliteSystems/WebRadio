const StorageManager = require("./StorageManager");

class SettingsManager {

    get() {
        return StorageManager.getSettings();
    }

    update(data) {
        return StorageManager.updateSettings(data);
    }

}

module.exports = new SettingsManager();