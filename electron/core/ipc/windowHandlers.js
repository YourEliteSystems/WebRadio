const { ipcMain, BrowserWindow, shell } = require("electron");

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
  ipcMain.handle("shell:openPath", (_, folderPath) => {
    return shell.openPath(folderPath);
  });
}

module.exports = registerWindowHandlers;