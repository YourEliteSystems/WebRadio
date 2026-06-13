const { BrowserWindow } = require("electron");
const path = require("path");

class WindowManager {

  constructor() {
    this.mainWindow = null;
    this.settingsWindow = null;
  }

  createMainWindow(isDev) {

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow;
    }

    this.mainWindow = new BrowserWindow({
      width: 1100,
      height: 700,
      frame: false,
      titleBarStyle: "hidden",
      icon: path.join(__dirname, "../../../assets/icons/tray.ico"),
      webPreferences: {
        autoplayPolicy: "no-user-gesture-required",
        preload: path.join(__dirname, "../../preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    this.mainWindow.loadFile(
      path.join(
        __dirname,
        "../../../renderer/index.html"
      )
    );

    if (isDev) {
      this.mainWindow.webContents.openDevTools();
    }

    return this.mainWindow;
  }

  createSettingsWindow() {

    if (
      this.settingsWindow &&
      !this.settingsWindow.isDestroyed()
    ) {
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    this.settingsWindow = new BrowserWindow({
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

    this.settingsWindow.loadFile(
      path.join(
        __dirname,
        "../../../renderer/settings.html"
      )
    );

    this.settingsWindow.on("closed", () => {
      this.settingsWindow = null;
    });

    return this.settingsWindow;
  }

  getMainWindow() {
    return this.mainWindow;
  }

  getSettingsWindow() {
    return this.settingsWindow;
  }

}

module.exports = new WindowManager();