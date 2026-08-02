const { ipcMain } = require("electron");
const IntegrationManager = require("../integrations/IntegrationManager");

function registerIntegrationHandlers(mainWindow) {
  ipcMain.handle("integrations:get", () => {
    return IntegrationManager.getIntegrations();
  });

  ipcMain.handle("integrations:toggle", (_, id, enabled) => {
    IntegrationManager.toggleIntegration(id, enabled);
  });

  ipcMain.handle("integrations:getRendererScripts", () => {
    return IntegrationManager.getRendererScripts();
  });
}

module.exports = registerIntegrationHandlers;
