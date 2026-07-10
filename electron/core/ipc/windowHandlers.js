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

    win.isMaximized() ? win.unmaximize() : win.maximize();
  });

  // ── Shell / Filesystem ────────────────────────────────────
  ipcMain.handle("shell:openPath", (_, folderPath) => {
    return shell.openPath(folderPath);
  });
}

module.exports = registerWindowHandlers;