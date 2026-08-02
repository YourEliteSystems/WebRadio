const { BrowserWindow } = require("electron");
const path = require("path");

function createSettingsWindow(isDev) {
  const window = new BrowserWindow({
    width: 600,
    height: 500,
    frame: false,
    resizable: false,

    icon: path.join(__dirname, "../../../assets/icons/tray.ico"),

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