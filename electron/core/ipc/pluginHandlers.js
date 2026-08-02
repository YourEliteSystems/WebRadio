const { ipcMain } = require("electron");
const PluginManager = require("../plugins/PluginManager");

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
}

module.exports = registerPluginHandlers;