const { createMainWindow } = require("./MainWindow");
const { createSettingsWindow } = require("./SettingsWindow");

class WindowManager {
  constructor(isDev) {
    this.isDev = isDev;

    this.mainWindow = null;
    this.settingsWindow = null;
  }

  createMainWindow() {
    if (this.mainWindow) {
      return this.mainWindow;
    }

    this.mainWindow = createMainWindow(this.isDev);

    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  openSettings() {
    if (this.settingsWindow) {
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    this.settingsWindow = createSettingsWindow();

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

module.exports = WindowManager;