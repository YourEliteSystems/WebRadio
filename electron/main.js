const { app } = require("electron");

const WindowManager = require("./core/app/WindowManager");;
const { registerAllIpc } = require("./core/ipc/registerIpcHandlers");
const pluginManager = require("./plugins/pluginManager");
const { createTray, destroyTray } = require("./core/system/tray");
const { registerMediaKeys, unregisterMediaKeys } = require("./core/mediaKeys");
const { checkForUpdates } = require("./core/updater");

const isDev = !app.isPackaged;

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

app.whenReady().then(() => {
  const windowManager = new WindowManager(isDev);

  windowManager.createMainWindow();

  // IPC komplett auslagern
  registerAllIpc(windowManager);

  // Plugins
  pluginManager.loadPlugins();

  // System Features
  registerMediaKeys(windowManager.getMainWindow());

  createTray(windowManager.getMainWindow(), {
    openSettings: () => windowManager.openSettings(),
    checkForUpdates: () => checkForUpdates()
  });
});

app.on("before-quit", () => {
  unregisterMediaKeys();
  destroyTray();
});