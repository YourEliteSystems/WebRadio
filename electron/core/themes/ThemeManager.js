class ThemeManager {

  async getThemes() {
    // komplette Theme-Logik
  }

  getActiveTheme() {
    return SettingsManager.get().theme || "";
  }

  setActiveTheme(themeId) {

    SettingsManager.update({
      theme: themeId
    });

    eventBus.emit("themechange", {
      theme: themeId
    });

  }

}

module.exports = new ThemeManager();