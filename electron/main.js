const { app } = require("electron");

const WindowManager = require("./core/app/WindowManager");;
const { registerAllIpc } = require("./core/ipc/registerIpcHandlers");
const pluginManager = require("./plugins/pluginManager");
const { createTray, destroyTray } = require("./core/system/tray");
const { registerMediaKeys, unregisterMediaKeys } = require("./core/mediaKeys");

const isDev = !app.isPackaged;

app.whenReady().then(() => {
  const window = new WindowManager(isDev);

  window.createMainWindow();

  // IPC komplett auslagern
  registerAllIpc(window);

  // Plugins
  pluginManager.loadPlugins();

  // System Features
  registerMediaKeys(window.getMainWindow());

  createTray(window.getMainWindow(),{
    openSettings: () => window.openSettings()
  });
});

app.on("before-quit", () => {
  unregisterMediaKeys();
  destroyTray();
});