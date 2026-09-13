const { BrowserWindow } = require("electron");
const path = require("path");
const { getWindowIcon } = require("../icons");

function createMainWindow(isDev) {
  // Icon aus zentraler Icon-Verwaltung beziehen
  const iconPath = getWindowIcon();

  const window = new BrowserWindow({
    width: 1100,
    height: 700,
    frame: false,
    titleBarStyle: "hidden",
    ...(iconPath ? { icon: iconPath } : {}),

    webPreferences: {
      preload: path.join(__dirname, "../../preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      autoplayPolicy: "no-user-gesture-required"
    }
  });

  window.loadFile(
    path.join(__dirname, "../../../renderer/index.html")
  );

  return window;
}

module.exports = {
  createMainWindow
};