const { createMainWindow } = require("./MainWindow");
const { createSettingsWindow } = require("./SettingsWindow");
const SplashWindow = require("./SplashWindow");

class WindowManager {
  constructor(isDev) {
    this.isDev = isDev;

    this.mainWindow    = null;
    this.settingsWindow = null;
    this.splashWindow  = new SplashWindow();
  }

  // ─────────────────────────────────────────────────────────
  // Splash
  // ─────────────────────────────────────────────────────────

  openSplash() {
    this.splashWindow.open();
    return this.splashWindow;
  }

  sendSplashBootupState(state) {
    this.splashWindow.sendBootupState(state);
  }

  closeSplash(delay = 600) {
    this.splashWindow.close(delay);
  }

  // ─────────────────────────────────────────────────────────
  // Main Window
  // ─────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────
  // Settings Window
  // ─────────────────────────────────────────────────────────

  openSettings() {
    if (this.settingsWindow) {
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    this.settingsWindow = createSettingsWindow(this.isDev);

    this.settingsWindow.on("closed", () => {
      this.settingsWindow = null;
    });

    return this.settingsWindow;
  }

  // ─────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────

  getMainWindow() {
    return this.mainWindow;
  }

  getSettingsWindow() {
    return this.settingsWindow;
  }
}

module.exports = WindowManager;