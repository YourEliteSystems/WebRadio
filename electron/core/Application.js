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
const PluginPermissions = require("./plugins/PluginPermissions");

// ─────────────────────────────────────────────
// Packages
// ─────────────────────────────────────────────

const PackageManager = require("./packages/PackageManager");

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

// ─────────────────────────────────────────────
// Player
// ─────────────────────────────────────────────

const playerManager          = require("./player/PlayerManager");
const radioProvider          = require("./player/RadioProvider");
const mediaHubProvider        = require("./player/MediaHubProvider");
const discordPresenceAdapter = require("./player/DiscordPresenceAdapter");
const PluginHttpServer       = require("./plugins/PluginHttpServer");

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

        BootupDiagnostics.markStart("plugin-http-init");
        await this.initializePluginHttpServer();
        BootupDiagnostics.markComplete("plugin-http-init");

        BootupDiagnostics.markStart("plugin-http-init");
        await this.initializePluginHttpServer();
        BootupDiagnostics.markComplete("plugin-http-init");

        BootupDiagnostics.markStart("navigation-init");
        await this.initializeNavigation();
        BootupDiagnostics.markComplete("navigation-init");

        BootupDiagnostics.markStart("packages-init");
        await this.initializePackages();
        BootupDiagnostics.markComplete("packages-init");

        BootupDiagnostics.markStart("plugins-init");
        await this.initializePlugins();
        BootupDiagnostics.markComplete("plugins-init");

        BootupDiagnostics.markStart("player-init");
        await this.initializePlayer();
        BootupDiagnostics.markComplete("player-init");

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

        BootupDiagnostics.markStart("discord-adapter-init");
        await this.initializeDiscordAdapter();
        BootupDiagnostics.markComplete("discord-adapter-init");

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
        await this.shutdownDiscordAdapter();
        await this.shutdownServices();
        await this.shutdownPlayer();
        await this.shutdownNavigation();
        await this.shutdownPackages();
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

    async initializePluginHttpServer() {
        // Start wird von initializePlugins() übernommen.
        // Diese Methode bleibt aus Kompatibilitätsgründen erhalten.
    }

    // ─────────────────────────────────────────
    // Legacy: initializePluginHttpServer wurde in initializePlugins()
    // integriert. Diese Markierungen bleiben aus Kompatibilitätsgründen.
    // ─────────────────────────────────────────

    async initializePlugins() {
        BootupDiagnostics.markStart("plugins-init");

        logger.info("Initialisiere Plugins...");

        // 1) PluginManager initialisieren (entdeckt und lädt Plugins)
        await PluginManager.initialize();

        // 2) PluginHttpServer starten (für Plugins mit "http-origin": true)
        await PluginHttpServer.start();

        // 3) Für jedes Plugin mit http-origin: Plugin-Ordner beim HTTP-Server registrieren
        //    Capabilities werden aus dem Manifest extrahiert und validiert
        for (const [id, plugin] of PluginManager.plugins) {
            const manifest = plugin.manifest || plugin;
            if (manifest["http-origin"]) {
                // Capabilities aus Manifest extrahieren
                const requestedCapabilities = manifest.capabilities || [];
                
                // Capabilities validieren
                const permissions = manifest.permissions || [];
                const capabilityValidation = PluginPermissions.validateCapabilities(
                    requestedCapabilities,
                    permissions
                );

                // Nur gewährte Capabilities registrieren
                const grantedCapabilities = capabilityValidation.granted;
                
                logger.info(`Plugin ${id}: Capabilities gewährt: ${grantedCapabilities.join(", ")}`);
                if (capabilityValidation.denied.length > 0) {
                    logger.warn(`Plugin ${id}: Capabilities abgelehnt: ${capabilityValidation.denied.join(", ")}`);
                }

                PluginHttpServer.servePlugin(id, plugin.path, grantedCapabilities);
            }
        }

        BootupDiagnostics.markComplete("plugins-init");

        logger.info("Plugins initialisiert");
    }

    async shutdownPlugins() {
        // PluginHttpServer stoppt zuerst – damit Renderer-Skripte nicht mehr
        // verfügbar sind, bevor Plugins selbst beendet werden.
        await PluginHttpServer.stop();

        await PluginManager.shutdown();

        logger.info("Plugins heruntergefahren");
    }

    async initializePackages() {
        logger.info("Initialisiere Package-Manager...");

        PackageManager.initialize();
        PackageManager.setInstallBaseDir(
            PackageManager.getInstallBaseDir()
        );

        logger.info("Package-Manager initialisiert");
    }

    async shutdownPackages() {
        PackageManager.shutdown();
        logger.info("Package-Manager heruntergefahren");
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
        // DiscordPresenceAdapter wird in initializeDiscordAdapter() initialisiert,
        // nachdem PlayerManager und RadioProvider bereit sind.
    }

    async initializePlayer() {
        // RadioProvider als ersten Core-Provider registrieren
        playerManager.registerProvider("radio", radioProvider);
        radioProvider.activate();
        playerManager.setActiveProvider("radio");

        // MediaHubProvider registrieren (wird aktiv, wenn MediaHub-Plugin startet)
        playerManager.registerProvider("mediahub", mediaHubProvider);

        // DiscordPresenceAdapter initialisieren – abonniert ab sofort
        // PlayerState-Änderungen über playerManager.subscribe()
        discordPresenceAdapter.initialize(playerManager, DiscordRichPresence);

        logger.info("Unified Player API initialisiert (RadioProvider aktiv, MediaHubProvider registriert)");
    }

    // Discord-Presence-Adapter wird in initializePlayer() initialisiert.
    // Diese Methode bleibt aus kompatiblen Gründen, ist aber kein no-op mehr.
    async initializeDiscordAdapter() {
        // Initialisierung bereits in initializePlayer() erfolgt.
    }

    async shutdownServices() {
        await DiscordRichPresence.shutdown();
        CredentialManager.shutdown();
    }

    async shutdownPlayer() {
        radioProvider.deactivate();
        await discordPresenceAdapter.shutdown();
        logger.info("Player heruntergefahren");
    }

    async shutdownDiscordAdapter() {
        await discordPresenceAdapter.shutdown();
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