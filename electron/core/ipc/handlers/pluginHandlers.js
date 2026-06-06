const { ipcMain } = require("electron");
const pluginManager = require("../../plugins/pluginManager");
const eventBus = require("../eventBus");

/**
 * Registriert IPC-Handler für das Plugin-System
 */
function registerPluginHandlers() {
  ipcMain.handle("plugins:get", () => {
    try {
      return pluginManager.getPlugins();
    } catch (err) {
      console.error("Fehler beim Abrufen der Plugins:", err);
      return [];
    }
  });

  ipcMain.handle("plugins:toggle", (_, id, enabled) => {
    try {
      pluginManager.togglePlugin(id, enabled);
      return { success: true };
    } catch (err) {
      console.error("Fehler beim Umschalten des Plugins:", err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("plugins:getRendererScripts", () => {
    try {
      return pluginManager.getRendererScripts();
    } catch (err) {
      console.error("Fehler beim Abrufen der Renderer-Skripte:", err);
      return [];
    }
  });

  // Event-Listener: wenn Plugin aktiviert/deaktiviert wird
  eventBus.on("pluginToggled", (data) => {
    // wird durch IPC-Bridge an Renderer weitergeleitet
  });
}

module.exports = { registerPluginHandlers };
