const { ipcMain } = require("electron");
const { registerPlayerHandlers } = require("./handlers/playerHandlers");
const { registerStorageHandlers } = require("./handlers/storageHandlers");
const { registerThemeHandlers } = require("./handlers/themeHandlers");
const { registerPluginHandlers } = require("./handlers/pluginHandlers");
const { registerSystemHandlers } = require("./handlers/systemHandlers");
const eventBus = require("../eventBus");

/**
 * Zentrale IPC-Bridge: registriert alle Handler
 * @param {BrowserWindow} mainWindow - das Hauptfenster
 * @param {BrowserWindow} settingsWindow - das Einstellungs-Fenster
 * @param {Object} streamController - Audio-Stream-Controller
 */
function registerAllHandlers(mainWindow, settingsWindow, streamController) {
  console.log("[IPC] Registriere alle Handler...");

  // Registriere Handler-Gruppen
  registerPlayerHandlers(mainWindow, streamController);
  registerStorageHandlers();
  registerThemeHandlers();
  registerPluginHandlers();
  registerSystemHandlers(mainWindow, settingsWindow);

  // Event-Listener: pluginToggled → an beide Fenster schicken
  eventBus.on("pluginToggled", (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("plugin:toggled", data);
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send("plugin:toggled", data);
    }
  });

  console.log("[IPC] Alle Handler registriert.");
}

module.exports = { registerAllHandlers };
