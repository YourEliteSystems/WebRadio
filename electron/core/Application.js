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

const PluginManager = require("./plugins/PluginManager");

// ─────────────────────────────────────────────
// Integrations
// ─────────────────────────────────────────────

const IntegrationManager = require("./integrations/IntegrationManager");

// ─────────────────────────────────────────────
// Themes
// ─────────────────────────────────────────────

const ThemeManager = require("./themes/ThemeManager");

// ─────────────────────────────────────────────
// System
// ─────────────────────────────────────────────

const ShortcutManager = require("./ShortcutManager");
const { createTray, destroyTray } = require("./system/tray");
const { checkForUpdates } = require("./updater");

// ─────────────────────────────────────────────
// Services
// ─────────────────────────────────────────────

const DiscordRichPresence = require("./services/DiscordRichPresence");

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

        await this.initializeIntegrations();

        await this.initializeThemes();

        await this.initializeShortcuts();

        await this.initializeTray();

        await this.initializeUpdater();

        await this.initializeServices();

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
        ShortcutManager.shutdown();
        await this.shutdownServices();
        await this.shutdownIntegrations();
        await this.shutdownPlugins();
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

    async initializeIntegrations() {

        IntegrationManager.initialize();

    }

    async initializeShortcuts() {

        ShortcutManager.initialize(
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

    async initializeServices() {
        DiscordRichPresence.initialize();
    }

    async shutdownServices() {
        await DiscordRichPresence.shutdown();
    }
    
    async checkForUpdates() {

        return checkForUpdates();

    }

    async shutdownTray() {

        destroyTray();

    }

    async shutdownPlugins() {

        PluginManager.shutdown();

    }

    async shutdownIntegrations() {

        IntegrationManager.shutdown();

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