"use strict";

const { globalShortcut, app } = require("electron");
const LogManager = require("./diagnostics/logging/LogManager");

const logger = LogManager.getLogger("ShortcutManager");

class ShortcutManager {

    constructor() {
        this.initialized = false;
        this.isDev = !app.isPackaged;
        this.registeredGlobalShortcuts = new Map();
        this.mainWindow = null;
        this.inputEventHandler = null;
    }

    initialize(mainWindow) {
        if (this.initialized) {
            return;
        }

        this.mainWindow = mainWindow;
        
        this.registerMediaShortcuts();
        
        if (this.isDev) {
            this.registerDevelopmentShortcuts();
        }

        this.initialized = true;
        logger.info("ShortcutManager initialisiert.");
    }

    shutdown() {
        if (!this.initialized) {
            return;
        }

        this.unregisterAllGlobalShortcuts();
        this.unregisterInputEventHandler();
        this.mainWindow = null;
        this.initialized = false;
        logger.info("ShortcutManager beendet.");
    }

    registerMediaShortcuts() {
        this.registerGlobalShortcut("MediaPlayPause", () => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send("media-play-pause");
            }
        });

        this.registerGlobalShortcut("MediaStop", () => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send("media-stop");
            }
        });

        this.registerGlobalShortcut("MediaNextTrack", () => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send("media-next");
            }
        });

        logger.debug("Media-Shortcuts registriert.");
    }

    registerDevelopmentShortcuts() {
        this.registerInputEventHandler();
        logger.debug("Development-Shortcuts registriert.");
    }

    registerInputEventHandler() {
        if (!this.mainWindow) {
            logger.error("Kein MainWindow für Input-Event-Handler verfügbar");
            return;
        }

        // F-Tasten über webContents registrieren (zuverlässiger für Funktionstasten)
        this.mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.type !== "keyDown") {
                return;
            }

            if (input.key === "F12") {
                event.preventDefault();
                this.toggleDevTools();
            } else if (input.key === "F5") {
                event.preventDefault();
                this.reload();
            }
        });

        // Ctrl-Kombinationen über Window registrieren
        this.inputEventHandler = (event, input) => {
            if (input.type !== "keyDown") {
                return;
            }

            if (input.control && input.shift && (input.key === "I" || input.key === "i")) {
                event.preventDefault();
                this.toggleDevTools();
            } else if (input.control && (input.key === "R" || input.key === "r")) {
                if (input.shift) {
                    event.preventDefault();
                    this.hardReload();
                } else {
                    event.preventDefault();
                    this.reload();
                }
            }
        };

        this.mainWindow.on("before-input-event", this.inputEventHandler);
        logger.debug("Input-Event-Handler registriert.");
    }

    unregisterInputEventHandler() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            // Alle Listener entfernen
            try {
                this.mainWindow.removeAllListeners("before-input-event");
            } catch (err) {
                // Window bereits zerstört, ignorieren
            }
            
            try {
                if (this.mainWindow.webContents && !this.mainWindow.webContents.isDestroyed()) {
                    this.mainWindow.webContents.removeAllListeners("before-input-event");
                }
            } catch (err) {
                // webContents bereits zerstört, ignorieren
            }
            
            this.inputEventHandler = null;
            logger.debug("Input-Event-Handler deregistriert.");
        }
    }

    registerGlobalShortcut(accelerator, callback) {
        if (this.registeredGlobalShortcuts.has(accelerator)) {
            logger.warn(`Global Shortcut bereits registriert: ${accelerator}`);
            return false;
        }

        const success = globalShortcut.register(accelerator, callback);
        
        if (success) {
            this.registeredGlobalShortcuts.set(accelerator, callback);
            logger.debug(`Global Shortcut registriert: ${accelerator}`);
        } else {
            logger.error(`Global Shortcut konnte nicht registriert werden: ${accelerator}`);
        }

        return success;
    }

    unregisterGlobalShortcut(accelerator) {
        if (!this.registeredGlobalShortcuts.has(accelerator)) {
            return false;
        }

        globalShortcut.unregister(accelerator);
        this.registeredGlobalShortcuts.delete(accelerator);
        logger.debug(`Global Shortcut deregistriert: ${accelerator}`);
        return true;
    }

    unregisterAllGlobalShortcuts() {
        for (const accelerator of this.registeredGlobalShortcuts.keys()) {
            this.unregisterGlobalShortcut(accelerator);
        }
        logger.debug("Alle Global Shortcuts deregistriert.");
    }

    toggleDevTools() {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
            return;
        }

        if (this.mainWindow.webContents.isDevToolsOpened()) {
            this.mainWindow.webContents.closeDevTools();
        } else {
            this.mainWindow.webContents.openDevTools();
        }
    }

    reload() {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
            return;
        }

        this.mainWindow.webContents.reload();
    }

    hardReload() {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
            return;
        }

        this.mainWindow.webContents.reloadIgnoringCache();
    }

    isGlobalShortcutRegistered(accelerator) {
        return this.registeredGlobalShortcuts.has(accelerator);
    }

    getRegisteredGlobalShortcuts() {
        return Array.from(this.registeredGlobalShortcuts.keys());
    }

}

module.exports = new ShortcutManager();
