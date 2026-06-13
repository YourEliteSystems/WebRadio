const { ipcMain } = require("electron");
const pluginManager = require("../../plugins/pluginManager");

function registerPluginHandlers(mainWindow) {
  ipcMain.handle("plugins:get", () => {
    return pluginManager.getPlugins();
  });

  ipcMain.handle("plugins:toggle", (_, id, enabled) => {
    pluginManager.togglePlugin(id, enabled);
  });

  ipcMain.handle("plugins:getRendererScripts", () => {
    return pluginManager.getRendererScripts();
  });
}

module.exports = registerPluginHandlers;