const path = require("path");

const storage = require("../storage");
const eventBus = require("../eventBus");

const ThemeLoader = require("./ThemeLoader");

class ThemeManager {

  constructor(themesPath) {

    this.loader = new ThemeLoader(
      themesPath
    );

  }

  getThemes() {
    return this.loader.getThemes();
  }

  getActiveTheme() {
    return storage.getSettings()?.theme || "";
  }

  setActiveTheme(themeId) {

    storage.updateSettings({
      theme: themeId
    });

    eventBus.emit("theme:changed", {
      theme: themeId
    });

  }

}

module.exports = ThemeManager;