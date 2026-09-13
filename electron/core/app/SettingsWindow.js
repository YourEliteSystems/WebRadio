const { BrowserWindow } = require("electron");
const path = require("path");
const { getWindowIcon } = require("../icons");

function createSettingsWindow(isDev) {
  // Icon aus zentraler Icon-Verwaltung beziehen
  const iconPath = getWindowIcon();

  const window = new BrowserWindow({
    width: 600,
    height: 500,
    frame: false,
    resizable: false,
    
    // Icon nur setzen, wenn der Pfad gültig ist
    ...(iconPath ? { icon: iconPath } : {}),

    webPreferences: {
      preload: path.join(__dirname, "../../preload.js"),
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