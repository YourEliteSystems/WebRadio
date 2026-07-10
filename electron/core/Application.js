// ─────────────────────────────────────────────
// Electron
// ─────────────────────────────────────────────

const { app } = require("electron");

// ─────────────────────────────────────────────
// Core
// ─────────────────────────────────────────────

const StorageManager = require("./storage/StorageManager");
const WindowManager = require("./app/WindowManager");

// ─────────────────────────────────────────────
// IPC
// ─────────────────────────────────────────────

const { registerAllIpc } = require("./ipc/registerIpcHandlers");

// ─────────────────────────────────────────────
// Plugins
// ─────────────────────────────────────────────

const PluginManager = require("../plugins/pluginManager");

// ─────────────────────────────────────────────
// System
// ─────────────────────────────────────────────

const { registerMediaKeys, unregisterMediaKeys } = require("./mediaKeys");
const { createTray, destroyTray } = require("./system/tray");
const { checkForUpdates } = require("./updater");
const LogManager = require("./diagnostics/logging/LogManager");

const logger = LogManager.getLogger("Application");

class Application {

    constructor() {

        this.initialized = false;
        this.windowManager = null;

    }

    // ─────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────

    async start() {

        if (this.initialized) {
            return;
        }

        logger.separator();
        logger.info("Starting WebRadio...");
        logger.separator();

        await this.initializeStorage();

        await this.initializeWindow();

        await this.initializeIPC();

        await this.initializePlugins();

        await this.initializeMediaKeys();

        await this.initializeTray();

        this.initialized = true;

        logger.info("WebRadio successfully started.");

    }

    async shutdown() {

        if (!this.initialized) {
            return;
        }

        logger.separator();
        logger.info("Stopping WebRadio...");
        logger.separator();

        unregisterMediaKeys();

        destroyTray();

        this.initialized = false;

        logger.info("WebRadio successfully stopped.");

    }

    // ─────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────

    async initializeStorage() {

        StorageManager.initialize();

    }

    async initializeWindow() {

        this.windowManager = new WindowManager(
            !app.isPackaged
        );

        this.windowManager.createMainWindow();

    }

    async initializeIPC() {

        registerAllIpc(
            this.windowManager
        );

    }

    async initializePlugins() {

        // Aktuell besitzt der PluginManager noch loadPlugins().
        // Sobald wir ihn umbauen, wird daraus initialize().

        PluginManager.loadPlugins();

    }

    async initializeMediaKeys() {

        registerMediaKeys(
            this.windowManager.getMainWindow()
        );

    }

    async initializeTray() {

        createTray(

            this.windowManager.getMainWindow(),

            {

                openSettings: () =>
                    this.windowManager.openSettings(),

                checkForUpdates: () =>
                    checkForUpdates()

            }

        );

    }

}

module.exports = new Application();