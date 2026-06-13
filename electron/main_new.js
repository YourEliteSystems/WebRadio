const { app } = require("electron");

const createMainWindow = require("./core/app/createMainWindow");
const { registerAllIpc } = require("./core/ipc/registerIpcHandlers");
const pluginManager = require("./plugins/pluginManager");
const { createTray, destroyTray } = require("./core/system/tray");
const { registerMediaKeys, unregisterMediaKeys } = require("./core/system/mediaKeys");

app.whenReady().then(() => {
  const mainWindow = createMainWindow();

  // IPC komplett auslagern
  registerAllIpc(mainWindow);

  // Plugins
  pluginManager.loadPlugins();

  // System Features
  registerMediaKeys(mainWindow);

  createTray(mainWindow);
});

app.on("before-quit", () => {
  unregisterMediaKeys();
  destroyTray();
});