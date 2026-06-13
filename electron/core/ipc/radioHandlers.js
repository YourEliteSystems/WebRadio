const { ipcMain } = require("electron");

const streamManager = require("../audio/streamManager");

function registerRadioHandlers(mainWindow) {
  streamManager.setMainWindow(mainWindow);

  ipcMain.handle("radio:start", async (_, url) => {
    await streamManager.start(url);
  });

  ipcMain.handle("radio:stop", async () => {
    streamManager.stop();
  });
}

module.exports = registerRadioHandlers;