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
// Navigation
// ─────────────────────────────────────────────

const NavigationManager = require("./navigation/NavigationManager");

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

// ─────────────────────────────────────────────
// Updater
// ─────────────────────────────────────────────

const { updateManager } = require("./updates");

// ─────────────────────────────────────────────
// Services
// ─────────────────────────────────────────────

const DiscordRichPresence = require("./services/DiscordRichPresence");

const LogManager = require("./diagnostics/logging/LogManager");
const CrashHandler = require("./diagnostics/crash/CrashHandler");
const CrashReportManager = require("./diagnostics/crash/CrashReportManager");
const HealthCheck = require("./diagnostics/health/HealthCheck");
const MemoryMonitor = require("./diagnostics/memory/MemoryMonitor");

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

        await this.initializeNavigation();

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
        MemoryMonitor.shutdown();
        HealthCheck.shutdown();
        CrashReportManager.shutdown();
        CrashHandler.shutdown();
        updateManager.dispose();
        LogManager.shutdown();
        ShortcutManager.shutdown();
        await this.shutdownServices();
        await this.shutdownIntegrations();
        await this.shutdownPlugins();
        await this.shutdownNavigation();
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
        // Zentrale Update-Logik. Idempotent – initialize() ist ein
        // Singleton-Guard, weitere Aufrufe sind no-op.
        try {
            updateManager.initialize();
        } catch (err) {
            logger.error(`Updater-Initialisierung fehlgeschlagen: ${err.message}`);
        }
    }

    async initializeDiagnostics() {

        LogManager.initialize();

        CrashHandler.initialize();

        CrashReportManager.initialize();

        HealthCheck.initialize();

        MemoryMonitor.initialize(!app.isPackaged);

    }

    async initializeServices() {
        DiscordRichPresence.initialize();
    }

    async shutdownServices() {
        await DiscordRichPresence.shutdown();
    }
    
    async checkForUpdates() {
        try {
            return await updateManager.checkForUpdates();
        } catch (err) {
            logger.error(`checkForUpdates: ${err.message}`);
            return { status: "error", error: { code: "INTERNAL", message: err.message } };
        }
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

    async initializeNavigation() {
        NavigationManager.initialize();

        // Core-Navigation: Radio registrieren
        NavigationManager.registerItem({
            id: "home",
            label: "Radio",
            icon: "radio",
            route: "home",
            order: 10
        }, null); // null = Core-Owner
    }

    async shutdownNavigation() {
        NavigationManager.shutdown();
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