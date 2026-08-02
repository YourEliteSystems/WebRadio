// DEPRECATED: This file is deprecated and will be removed in a future version.
// Use ShortcutManager instead for all shortcut management.
// Kept for backward compatibility only.

const { globalShortcut, BrowserWindow } = require("electron");
const LogManager = require("./diagnostics/logging/LogManager");

const logger = LogManager.getLogger("MediaKeys");

logger.warn("mediaKeys.js is DEPRECATED. Use ShortcutManager instead.");

function registerMediaKeys(mainWindow) {
  logger.warn("registerMediaKeys is DEPRECATED. Use ShortcutManager.initialize() instead.");
  
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
  logger.warn("unregisterMediaKeys is DEPRECATED. Use ShortcutManager.shutdown() instead.");
  globalShortcut.unregisterAll();
}

module.exports = {
  registerMediaKeys,
  unregisterMediaKeys
};
