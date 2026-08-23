"use strict";

const { BrowserWindow } = require("electron");
const NavigationRegistry = require("./NavigationRegistry");
const eventBus = require("../eventBus");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("NavigationManager");

class NavigationManager {

    constructor() {
        this.initialized = false;
    }

    /**
     * Initialisiert den NavigationManager.
     */
    initialize() {
        if (this.initialized) return;

        logger.info("NavigationManager initialisiert.");
        this.initialized = true;
    }

    shutdown() {
        if (!this.initialized) return;
        NavigationRegistry.clearAll();
        this.initialized = false;
        logger.info("NavigationManager heruntergefahren.");
    }

    /**
     * Registriert eine Section und broadcastet die Änderung.
     */
    registerSection(section, ownerPluginId = "core") {
        const result = NavigationRegistry.registerSection(section, ownerPluginId);
        this._notifyChange();
        return result;
    }

    /**
     * Registriert ein Item und broadcastet die Änderung.
     */
    registerItem(item, ownerPluginId = "core") {
        const result = NavigationRegistry.registerItem(item, ownerPluginId);
        this._notifyChange();
        return result;
    }

    /**
     * Aktualisiert ein Item und broadcastet die Änderung.
     */
    updateItem(id, updates, ownerPluginId = "core") {
        const result = NavigationRegistry.updateItem(id, updates, ownerPluginId);
        this._notifyChange();
        return result;
    }

    /**
     * Entfernt ein Item und broadcastet die Änderung.
     */
    removeItem(id, ownerPluginId = "core") {
        const result = NavigationRegistry.removeItem(id, ownerPluginId);
        if (result) this._notifyChange();
        return result;
    }

    /**
     * Entfernt eine Section und broadcastet die Änderung.
     */
    removeSection(id, ownerPluginId = "core") {
        const result = NavigationRegistry.removeSection(id, ownerPluginId);
        if (result) this._notifyChange();
        return result;
    }

    /**
     * Entfernt alle Einträge eines Plugins beim Unload/Stop.
     */
    clearPlugin(pluginId) {
        NavigationRegistry.clearPlugin(pluginId);
        this._notifyChange();
    }

    /**
     * Liefert den aktuellen Navigationsbaum.
     */
    getTree() {
        return NavigationRegistry.getTree();
    }

    getSections() {
        return NavigationRegistry.getAllSections();
    }

    getItems(sectionId) {
        return NavigationRegistry.getItemsBySection(sectionId);
    }

    /**
     * Sendet Aktualisierungs-Events via EventBus und IPC.
     */
    _notifyChange() {
        const tree = NavigationRegistry.getTree();
        eventBus.emit("navigation:changed", tree);

        try {
            BrowserWindow.getAllWindows().forEach(win => {
                if (win && !win.isDestroyed()) {
                    win.webContents.send("navigation:updated", tree);
                }
            });
        } catch {
            // Ignorieren falls noch keine Fenster existieren
        }
    }

}

module.exports = new NavigationManager();
