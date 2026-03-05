const { globalShortcut, BrowserWindow } = require("electron");

function registerMediaKeys(mainWindow) {
  globalShortcut.register("MediaPlayPause", () => {
    mainWindow.webContents.send("media-play-pause");
  });

  globalShortcut.register("MediaStop", () => {
    mainWindow.webContents.send("media-stop");
  });

  globalShortcut.register("MediaNextTrack", () => {
    mainWindow.webContents.send("media-next");
  });
}

function unregisterMediaKeys() {
  globalShortcut.unregisterAll();
}

module.exports = {
  registerMediaKeys,
  unregisterMediaKeys
};
