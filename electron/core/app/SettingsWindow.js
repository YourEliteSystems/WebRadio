const { BrowserWindow } = require("electron");
const path = require("path");
const { getWindowIcon } = require("../icons");

function createSettingsWindow(isDev) {
  // Icon aus zentraler Icon-Verwaltung beziehen
  const iconPath = getWindowIcon();

  const preloadPath = path.join(__dirname, "../../preload.js");
  
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    resizable: true,
    minHeight: 500,
    minWidth: 600,

    // Icon nur setzen, wenn der Pfad gültig ist
    ...(iconPath ? { icon: iconPath } : {}),

    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.loadFile(
    path.join(__dirname, "../../../renderer/settings.html")
  );

  return window;
}

module.exports = {
  createSettingsWindow
};