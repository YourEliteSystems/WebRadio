const { ipcMain, BrowserWindow } = require("electron");
const PluginManager = require("../plugins/PluginManager");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("PluginHandlers");

function registerPluginHandlers(mainWindow) {
  ipcMain.handle("plugins:get", () => {
    return PluginManager.getPlugins();
  });

  ipcMain.handle("plugins:toggle", (_, id, enabled) => {
    PluginManager.togglePlugin(id, enabled);
  });

  ipcMain.handle("plugins:getRendererScripts", () => {
    return PluginManager.getRendererScripts();
  });

  /**
   * Globaler Plugin-Rescan.
   *
   * Request:  plugins:reload
   * Broadcast: plugins:changed
   *
   * Liefert ein strukturiertes Ergebnis mit added/removed/changed/
   * unchanged/disabled/errors-Listen, sodass Renderer und Diagnose-
   * Tools den Rescan nachvollziehen können.
   */
  ipcMain.handle("plugins:reload", () => {
    let result;
    try {
      result = PluginManager.reloadPlugins();
    } catch (err) {
      logger.error(`Globaler Plugin-Rescan fehlgeschlagen: ${err.message}`);
      result = {
        success: false,
        added: [],
        removed: [],
        changed: [],
        unchanged: [],
        disabled: [],
        errors: [{ id: "*", error: err.message }]
      };
    }

    // Broadcast an alle Renderer-Fenster
    try {
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send("plugins:changed", result);
        }
      });
    } catch (broadcastErr) {
      logger.warn(`Konnte plugins:changed nicht broadcasten: ${broadcastErr.message}`);
    }

    return result;
  });
}

module.exports = registerPluginHandlers;