const { ipcMain, BrowserWindow, app } = require("electron");
const path = require("path");
const fs = require("fs");

const SettingsManager = require("../storage/SettingsManager");
const ThemeManager = require("../themes/ThemeManager");
const eventBus = require("../eventBus");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("ThemeHandlers");

function registerThemeHandlers(windowManager) {
  const isDev = typeof windowManager === "boolean"
    ? windowManager
    : (windowManager?.isDev ?? !app.isPackaged);

  const getThemesPath = () => {
    return isDev
      ? path.join(__dirname, "../../../themes")
      : path.join(process.resourcesPath, "themes");
  };

  ipcMain.handle("theme:get", async () => {
    // ThemeManager verwenden für zentrale Theme-Verwaltung
    if (ThemeManager.isInitialized()) {
      const themes = ThemeManager.getThemes();
      return themes.map(t => ({
        id: t.id,
        name: t.name,
        css: t.css
      }));
    }

    // Fallback: Direkt aus Dateisystem laden (für Abwärtskompatibilität)
    const themesPath = getThemesPath();
    if (!fs.existsSync(themesPath)) {
      return [];
    }

    const folders = fs.readdirSync(themesPath, {
      withFileTypes: true
    });

    const themes = [];

    for (const folder of folders) {
      if (!folder.isDirectory()) continue;

      const themeJsonPath = path.join(themesPath, folder.name, "theme.json");
      if (!fs.existsSync(themeJsonPath)) continue;

      try {
        const data = JSON.parse(fs.readFileSync(themeJsonPath, "utf8"));
        const cssAbsPath = path.join(themesPath, folder.name, data.css);

        themes.push({
          id: folder.name,
          name: data.name,
          css: cssAbsPath
        });
      } catch (err) {
        logger.error(`Theme konnte nicht geladen werden: ${folder.name}`, err);
      }
    }

    return themes;
  });

  ipcMain.handle("theme:getActive", () => {
    return SettingsManager.get()?.theme || "";
  });

  ipcMain.handle("theme:setActive", (_, themeId) => {
    // Theme in Settings speichern
    SettingsManager.update({ theme: themeId });

    // EventBus Event für Core-Systeme
    eventBus.emit("themechange", {
      theme: themeId
    });

    // CSS-Pfad ermitteln
    const themesPath = getThemesPath();
    let cssPath = "";

    if (fs.existsSync(themesPath)) {
      const themeJsonPath = path.join(themesPath, themeId, "theme.json");
      if (fs.existsSync(themeJsonPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(themeJsonPath, "utf8"));
          cssPath = path.join(themesPath, themeId, data.css);
        } catch (err) {
          logger.error(`Theme CSS konnte nicht aufgelöst werden: ${themeId}`, err);
        }
      }
    }

    // Broadcast an alle Renderer-Fenster
    const payload = {
      themeId,
      css: cssPath
    };

    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send("theme:changed", payload);
      }
    });

    return true;
  });

}

module.exports = registerThemeHandlers;