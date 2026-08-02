const { ipcMain } = require("electron");

const streamManager = require("../audio/streamManager");
const radioService = require("../services/RadioBrowserService");

function registerRadioHandlers(windowManager) {

  streamManager.setMainWindow(
    windowManager.getMainWindow()
  );

  ipcMain.handle("radio:start", async (_, url, station) => {
    await streamManager.start(url, station);
  });

  ipcMain.handle("radio:stop", async () => {
    streamManager.stop();
  });

  ipcMain.handle("radio:getCountries", async () => {
    return await radioService.getCountries();
  });

  ipcMain.handle("radio:getTags", async () => {
    return await radioService.getTags();
  });

  ipcMain.handle("radio:search", async (_, params) => {
    return await radioService.search(params);
  });
}

module.exports = registerRadioHandlers;