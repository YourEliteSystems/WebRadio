const storage = require("../storage");

class SettingsManager {

  get() {
    return storage.getSettings();
  }

  update(data) {
    return storage.updateSettings(data);
  }

}

module.exports = new SettingsManager();