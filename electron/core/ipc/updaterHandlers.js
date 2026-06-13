const { ipcMain } = require("electron");
const updater = require("../updater");

function registerUpdaterHandlers(mainWindow) {
  ipcMain.handle("updater:check", async () => {
    const result = await updater.checkForUpdates();

    if (result.available) {
      mainWindow?.webContents.send("updater:available", result);
    }

    return result;
  });

  ipcMain.handle("updater:install", async () => {
    return updater.openDownloadPage();
  });

  ipcMain.handle("app:version", () => {
    return require("electron").app.getVersion();
  });
}

module.exports = registerUpdaterHandlers;