const { BrowserWindow } = require("electron");
const path = require("path");

function createMainWindow(isDev) {
  const window = new BrowserWindow({
    width: 1100,
    height: 700,
    frame: false,
    titleBarStyle: "hidden",
    icon: path.join(__dirname, "../../../assets/icons/tray.ico"),

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