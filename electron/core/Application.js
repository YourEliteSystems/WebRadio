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
const streamManager = require("./audio/streamManager");

// ─────────────────────────────────────────────
// Updater
// ─────────────────────────────────────────────

const { updateManager } = require("./updates");

// ─────────────────────────────────────────────
// Services
// ─────────────────────────────────────────────

const CredentialManager = require("./services/CredentialManager");
const DiscordRichPresence = require("./services/DiscordRichPresence");

const LogManager = require("./diagnostics/logging/LogManager");
const CrashHandler = require("./diagnostics/CrashHandler");
const CrashReportManager = require("./diagnostics/crash/CrashReportManager");
const HealthCheck = require("./diagnostics/health/HealthCheck");
const MemoryMonitor = require("./diagnostics/memory/MemoryMonitor");
const { DiagnosticsManager, BootupDiagnostics } = require("./diagnostics");

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

        BootupDiagnostics.markStart("core-init");

        logger.separator();
        logger.info("Starting WebRadio...");
        logger.separator();

        BootupDiagnostics.markStart("storage-init");
        await this.initializeStorage();
        BootupDiagnostics.markComplete("storage-init");

        BootupDiagnostics.markStart("diagnostics-init");
        await this.initializeDiagnostics();
        BootupDiagnostics.markComplete("diagnostics-init");

        BootupDiagnostics.markStart("window-created");
        await this.initializeWindow();
        BootupDiagnostics.markComplete("window-created");

        BootupDiagnostics.markStart("ipc-init");
        await this.initializeIPC();
        BootupDiagnostics.markComplete("ipc-init");

        BootupDiagnostics.markStart("navigation-init");
        await this.initializeNavigation();
        BootupDiagnostics.markComplete("navigation-init");

        BootupDiagnostics.markStart("plugins-init");
        await this.initializePlugins();
        BootupDiagnostics.markComplete("plugins-init");

        BootupDiagnostics.markStart("integrations-init");
        await this.initializeIntegrations();
        BootupDiagnostics.markComplete("integrations-init");

        BootupDiagnostics.markStart("themes-init");
        await this.initializeThemes();
        BootupDiagnostics.markComplete("themes-init");

        BootupDiagnostics.markStart("shortcuts-init");
        await this.initializeShortcuts();
        BootupDiagnostics.markComplete("shortcuts-init");

        BootupDiagnostics.markStart("tray-init");
        await this.initializeTray();
        BootupDiagnostics.markComplete("tray-init");

        BootupDiagnostics.markStart("updater-init");
        await this.initializeUpdater();
        BootupDiagnostics.markComplete("updater-init");

        BootupDiagnostics.markStart("services-init");
        await this.initializeServices();
        BootupDiagnostics.markComplete("services-init");

        this.initialized = true;

        BootupDiagnostics.markComplete("core-init");
        BootupDiagnostics.markComplete("app-ready");

        logger.info("WebRadio successfully started.");

    }

    async shutdown() {

        if (!this.initialized) {
            return;
        }

        logger.separator();
        logger.info("Stopping WebRadio...");
        logger.separator();

        DiagnosticsManager.stop();
        MemoryMonitor.shutdown();
        HealthCheck.shutdown();
        CrashReportManager.shutdown();
        CrashHandler.shutdown();
        updateManager.dispose();
        // Aktiven FFmpeg-/Stream-Prozess stoppen, damit beim App-Exit
        // kein verwaister ffmpeg-Prozess weiterläuft (Regression: fehlte
        // nach der Refaktorierung auf Application.shutdown()).
        streamManager.stop();
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
        
        // CredentialManager initialisieren (benötigt StorageManager Pfade)
        CredentialManager.initialize();

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
        CredentialManager.shutdown();
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