const { ipcMain, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const SettingsManager = require("../storage/SettingsManager");
const ThemeManager = require("../themes/ThemeManager");
const ThemeLoader = require("../themes/ThemeLoader");
const eventBus = require("../eventBus");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("ThemeHandlers");

function registerThemeHandlers(windowManager) {
  const getUserThemesPath = () => {
    return ThemeLoader.getUserThemesPath();
  };

  ipcMain.handle("theme:get", async () => {
    // ThemeManager verwenden für zentrale Theme-Verwaltung
    if (ThemeManager.isInitialized()) {
      const themes = ThemeManager.getThemes();
      return themes.map(t => ({
        id: t.id,
        name: t.name,
        css: t.css,
        source: t.source
      }));
    }

    // Fallback: Direkt aus Dateisystem laden (für Abwärtskompatibilität)
    const themesPath = ThemeLoader.getBuiltinThemesPath();
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
          css: cssAbsPath,
          source: "builtin"
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
    let cssPath = "";
    if (ThemeManager.isInitialized() && ThemeManager.hasTheme(themeId)) {
      cssPath = ThemeManager.getTheme(themeId).css;
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

  /**
   * Globaler Theme-Rescan.
   *
   * Request:  theme:reload
   * Broadcast: themes:changed
   *
   * Analog zu plugins:reload - scannt Built-in und User-Theme-Verzeichnisse
   * und liefert ein strukturiertes Ergebnis mit added/removed/changed/
   * unchanged/errors-Listen.
   */
  ipcMain.handle("theme:reload", () => {
    let result;
    try {
      result = ThemeManager.reloadThemes();
    } catch (err) {
      logger.error(`Globaler Theme-Rescan fehlgeschlagen: ${err.message}`);
      result = {
        success: false,
        added: [],
        removed: [],
        changed: [],
        unchanged: [],
        errors: [{ id: "*", error: err.message }]
      };
    }

    // Broadcast an alle Renderer-Fenster
    try {
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send("themes:changed", result);
        }
      });
    } catch (broadcastErr) {
      logger.warn(`Konnte themes:changed nicht broadcasten: ${broadcastErr.message}`);
    }

    return result;
  });

  /**
   * User-Theme-Ordner öffnen.
   *
   * Analog zu Plugin-Ordner öffnen.
   */
  ipcMain.handle("theme:openFolder", () => {
    const userThemesPath = getUserThemesPath();

    // Ordner erstellen, falls nicht vorhanden
    if (!fs.existsSync(userThemesPath)) {
      try {
        fs.mkdirSync(userThemesPath, { recursive: true });
        logger.info(`User-Theme-Verzeichnis erstellt: ${userThemesPath}`);
      } catch (err) {
        logger.error(`Konnte User-Theme-Verzeichnis nicht erstellen: ${err.message}`);
        return { success: false, error: err.message };
      }
    }

    // Ordner im Explorer öffnen
    try {
      shell.openPath(userThemesPath);
      return { success: true };
    } catch (err) {
      logger.error(`Konnte User-Theme-Verzeichnis nicht öffnen: ${err.message}`);
      return { success: false, error: err.message };
    }
  });

}

module.exports = registerThemeHandlers;