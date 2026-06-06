const { ipcMain } = require("electron");
const storage = require("../storage");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

/**
 * Registriert IPC-Handler für das Theme-System
 */
function registerThemeHandlers() {
  const isDev = !app.isPackaged;

  ipcMain.handle("theme:get", async () => {
    try {
      const themesPath = isDev
        ? path.join(__dirname, "../../../themes")
        : path.join(process.resourcesPath, "themes");

      if (!fs.existsSync(themesPath)) return [];

      const folders = fs.readdirSync(themesPath, { withFileTypes: true });
      const themes = [];

      for (const folder of folders) {
        if (!folder.isDirectory()) continue;
        const themeJsonPath = path.join(themesPath, folder.name, "theme.json");
        if (!fs.existsSync(themeJsonPath)) continue;

        const data = JSON.parse(fs.readFileSync(themeJsonPath, "utf-8"));
        const cssAbsPath = path.join(themesPath, folder.name, data.css);
        themes.push({
          id: folder.name,
          name: data.name,
          css: cssAbsPath,
        });
      }
      return themes;
    } catch (err) {
      console.error("Fehler beim Laden der Themes:", err);
      return [];
    }
  });

  ipcMain.handle("theme:getActive", () => {
    try {
      return storage.getSettings()?.theme || "";
    } catch (err) {
      console.error("Fehler beim Abrufen des aktiven Themes:", err);
      return "";
    }
  });

  ipcMain.handle("theme:setActive", (_, themeId) => {
    try {
      storage.updateSettings({ theme: themeId });
      return { success: true };
    } catch (err) {
      console.error("Fehler beim Setzen des aktiven Themes:", err);
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerThemeHandlers };
