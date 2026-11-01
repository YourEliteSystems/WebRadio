const { ipcMain, BrowserWindow, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const LogManager = require("../diagnostics/logging/LogManager");
const StorageManager = require("../storage/StorageManager");
const { isAllowedDirectory } = require("./pathAllowList");

const logger = LogManager.getLogger("WindowHandlers");

function getAllowedOpenDirectories() {
  return [
    StorageManager.getUserDataPath(),
    StorageManager.getLogsPath(),
    StorageManager.getCrashPath(),
    StorageManager.getReportsPath(),
    StorageManager.getPackagesPath(),
    StorageManager.getPluginPath(),
    StorageManager.getThemePath(),
    StorageManager.getPluginDataPath()
  ];
}

function registerWindowHandlers(windowManager) {

  ipcMain.on("open-settings", () => {
    windowManager.openSettings();
  });

  ipcMain.on("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.on("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.on("window:maximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    if (win.isMaximized()) {
      win.unmaximize();
      win.webContents.send("window:onUnmaximized", false);
    } else {
      win.maximize();
      win.webContents.send("window:onMaximized", true);
    }
  });

  // ── Window State Queries ──────────────────────────────────────
  // Wird von Settings-Fenster verwendet, um den Fensterzustand zu synchronisieren
  ipcMain.handle("window:isMaximized", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? win.isMaximized() : false;
  });

  ipcMain.handle("window:isMinimized", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? win.isMinimized() : false;
  });

  // ── Shell / Filesystem ────────────────────────────────────
  ipcMain.handle("shell:openPath", async (_, folderPath) => {
    if (typeof folderPath !== "string" || !folderPath.trim()) {
      logger.warn("shell:openPath abgelehnt: Ungültiger oder leerer Pfad");
      return "Ungültiger Pfad";
    }

    try {
      const resolved = path.resolve(folderPath.trim());
      if (!fs.existsSync(resolved)) {
        logger.warn(`shell:openPath abgelehnt: Pfad existiert nicht (${resolved})`);
        return "Pfad existiert nicht";
      }

      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        logger.warn(`shell:openPath abgelehnt: Kein Verzeichnis (${resolved})`);
        return "Nur Verzeichnisse dürfen geöffnet werden";
      }

      if (!isAllowedDirectory(resolved, getAllowedOpenDirectories())) {
        logger.warn(`shell:openPath abgelehnt: Pfad ist nicht freigegeben (${resolved})`);
        return "Pfad ist nicht freigegeben";
      }

      return await shell.openPath(resolved);
    } catch (err) {
      logger.error(`shell:openPath Fehler: ${err.message}`);
      return err.message;
    }
  });
}

module.exports = registerWindowHandlers;
