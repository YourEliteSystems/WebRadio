const { app } = require("electron");

const WindowManager = require("./core/app/WindowManager");
const { registerAllIpc } = require("./core/ipc/registerIpcHandlers");

const pluginManager = require("./plugins/pluginManager");

const { createTray, destroyTray } = require("./core/system/tray");
const { registerMediaKeys, unregisterMediaKeys } = require("./core/mediaKeys");
const { checkForUpdates } = require("./core/updater");

// Storage
const StorageManager = require("./core/storage/StorageManager");

// Diagnostics
const LogManager = require("./core/diagnostics/logging/LogManager");
const CrashHandler = require("./core/diagnostics/crash/CrashHandler");
const HealthCheck = require("./core/diagnostics/health/HealthCheck");

const isDev = !app.isPackaged;

app.whenReady().then(() => {

    //
    // Infrastruktur
    //

    StorageManager.initialize();

    LogManager.initialize();

    const logger = LogManager.createLogger("Main");

    CrashHandler.initialize(logger);

    //
    // Diagnose
    //

    const health = HealthCheck.run();

    logger.info("HealthCheck abgeschlossen.", health);

    //
    // Fenster
    //

    const windowManager = new WindowManager(isDev);

    windowManager.createMainWindow();

    //
    // IPC
    //

    registerAllIpc(windowManager);

    //
    // Plugins
    //

    pluginManager.loadPlugins();

    //
    // System
    //

    registerMediaKeys(
        windowManager.getMainWindow()
    );

    createTray(
        windowManager.getMainWindow(),
        {
            openSettings: () => windowManager.openSettings(),
            checkForUpdates: () => checkForUpdates()
        }
    );

});

app.on("before-quit", () => {

    unregisterMediaKeys();

    destroyTray();

});