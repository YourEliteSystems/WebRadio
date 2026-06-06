const { ipcMain } = require("electron");
const updater = require("../updater");
const { app } = require("electron");

/**
 * Registriert IPC-Handler für System-Funktionen (Updater, Version, Fenster)
 */
function registerSystemHandlers(mainWindow, settingsWindow) {
  // --- Updater ---
  ipcMain.handle("updater:check", async () => {
    try {
      const result = await updater.checkForUpdates();
      // Broadcast an alle offenen Fenster
      if (result.available) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("updater:available", result);
        }
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.webContents.send("updater:available", result);
        }
      }
      return result;
    } catch (err) {
      console.error("Fehler beim Update-Check:", err);
      return { available: false };
    }
  });

  ipcMain.handle("updater:install", async () => {
    try {
      await updater.openDownloadPage();
      return { success: true };
    } catch (err) {
      console.error("Fehler beim Öffnen der Download-Seite:", err);
      return { success: false, error: err.message };
    }
  });

  // --- App-Version ---
  ipcMain.handle("app:version", () => {
    return app.getVersion();
  });

  // --- Window Controls ---
  ipcMain.on("window:minimize", (event) => {
    const { BrowserWindow } = require("electron");
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.minimize();
      console.log("Fenster minimiert.");
    }
  });

  ipcMain.on("window:maximize", (event) => {
    const { BrowserWindow } = require("electron");
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
      console.log("Fenster maximiert/wiederhergestellt.");
    }
  });

  ipcMain.on("window:close", (event) => {
    const { BrowserWindow } = require("electron");
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.close();
      console.log("Fenster geschlossen.");
    }
  });

  // --- Settings-Fenster öffnen ---
  ipcMain.on("open-settings", () => {
    if (settingsWindow) {
      settingsWindow.focus();
    } else {
      // wird durch windowManager erstellt
      const { BrowserWindow } = require("electron");
      const newSettingsWindow = new BrowserWindow({
        width: 600,
        height: 500,
        frame: false,
        resizable: false,
        icon: require("path").join(__dirname, "../../assets/icons/tray.ico"),
        webPreferences: {
          preload: require("path").join(__dirname, "../../preload.js"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      });
      newSettingsWindow.loadFile(
        require("path").join(__dirname, "../../renderer/settings.html")
      );
      newSettingsWindow.on("closed", () => {
        settingsWindow = null;
      });
    }
  });
}

module.exports = { registerSystemHandlers };
