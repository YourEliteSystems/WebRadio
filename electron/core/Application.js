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
// Themes
// ─────────────────────────────────────────────

const ThemeManager = require("./themes/ThemeManager");

// ─────────────────────────────────────────────
// System
// ─────────────────────────────────────────────

const { registerMediaKeys, unregisterMediaKeys } = require("./mediaKeys");
const { createTray, destroyTray } = require("./system/tray");
const { checkForUpdates } = require("./updater");

const LogManager = require("./diagnostics/logging/LogManager");
const CrashHandler = require("./diagnostics/crash/CrashHandler");
const CrashReportManager = require("./diagnostics/crash/CrashReportManager");
const HealthCheck = require("./diagnostics/health/HealthCheck");

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

        await this.initializeDiagnostics();

        await this.initializeWindow();

        await this.initializeIPC();

        await this.initializePlugins();

        await this.initializeThemes();

        await this.initializeMediaKeys();

        await this.initializeTray();

        await this.initializeUpdater();

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
        HealthCheck.shutdown();
        CrashReportManager.shutdown();
        CrashHandler.shutdown();
        LogManager.shutdown();
        unregisterMediaKeys();
        await this.shutdownThemes();
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
                    this.checkForUpdates()

            }

        );

    }

    async initializeUpdater() {
        // Aktuell keine Initialisierung notwendig.
        // Wird für zukünftige Versione vorbereitet.

    }

    async initializeDiagnostics() {

        LogManager.initialize();

        CrashHandler.initialize();

        CrashReportManager.initialize();

        HealthCheck.initialize();

    }
    
    async checkForUpdates() {

        return checkForUpdates();

    }

    async shutdownTray() {

        destroyTray();

    }

    async shutdownMediaKeys() {

        unregisterMediaKeys();

    }

    async shutdownPlugins() {

        PluginManager.shutdown();

    }

    async initializeThemes() {
        ThemeManager.initialize();
    }

    async shutdownWindow() {

        //if (this.windowManager?.shutdown) {
        //    this.windowManager.shutdown();
        //}

    }

    async shutdownDiagnostics() {

        if (HealthCheck.shutdown) {
            HealthCheck.shutdown();
        }

        if (CrashReportManager.shutdown) {
            CrashReportManager.shutdown();
        }

        if (CrashHandler.shutdown) {
            CrashHandler.shutdown();
        }

        if (LogManager.shutdown) {
            LogManager.shutdown();
        }

    }

    async shutdownThemes() {

        ThemeManager.shutdown();

    }

}

module.exports = new Application();