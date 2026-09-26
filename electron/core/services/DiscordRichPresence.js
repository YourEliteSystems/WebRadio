"use strict";

const RPC = require("discord-rpc");
const eventBus = require("../eventBus");
const SettingsManager = require("../storage/SettingsManager");
const LogManager = require("../diagnostics/logging/LogManager");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const logger = LogManager.getLogger("DiscordRichPresence");

const CLIENT_ID = "1512468839508476037";

// ─── Settings keys (single source of truth, no duplicate config store) ───────────
const SETTING_KEYS = Object.freeze({
    DISCORD_RICH_PRESENCE: "integrations.discordRichPresence",
});

class DiscordRichPresence {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.currentStation = null;
        this.startTimestamp = null;
        this.isEnabled = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.reconnectTimer = null;

        // Lifecycle/Load-Session tracking (per Application start)
        this._listened = false;
        this._started = false;
    }

    // ─────────────────────────────────────────────
    // Settings / Persistence
    // ─────────────────────────────────────────────

    /**
     * Reads the stored Discord setting from settings.json (SettingsManager).
     * @returns {boolean} true when Rich Presence is enabled in storage.
     */
    _readStoredEnabled() {
        try {
            const data = SettingsManager.get();
            if (!data || typeof data !== "object") return false;
            const raw =
                data[SETTING_KEYS.DISCORD_RICH_PRESENCE] ||
                data.integrations?.discordRichPresence;
            return raw === true;
        } catch (err) {
            logger.warn(`[DiscordRichPresence] gespeicherter Wert nicht lesbar: ${err.message}`);
            return false;
        }
    }

    /**
     * Writes the enabled state into settings.json.
     * @param {boolean} enabled
     * @returns {boolean} true on success.
     */
    _writeEnabled(enabled) {
        try {
            const data = SettingsManager.get() || {};
            if (!data.integrations || typeof data.integrations !== "object") {
                data.integrations = {};
            }
            data[SETTING_KEYS.DISCORD_RICH_PRESENCE] = enabled;
            data.integrations.discordRichPresence = enabled;
            SettingsManager.update(data);
            // Verify read-back
            const readBack = this._readStoredEnabled();
            if (readBack !== enabled) {
                logger.error(
                    `[DiscordRichPresence] Verifikation nach Speichern fehlgeschlagen: erwartet '${enabled}', gefunden '${readBack}'`
                );
                return false;
            }
            return true;
        } catch (err) {
            logger.warn(`[DiscordRichPresence] gespeicherter Wert nicht schreibbar: ${err.message}`);
            return false;
        }
    }

    /**
     * Loads the persisted setting and validates it. Resets any invalid
     * value to the default (false) without deleting other settings.
     * @returns {boolean} the actually active enabled state.
     */
    loadStoredSettings() {
        const stored = this._readStoredEnabled();
        if (stored) {
            this.isEnabled = true;
            logger.info("[DiscordRichPresence] Einstellung aus settings.json geladen (aktiv)");
            return true;
        }
        // Invalid / missing → fall back to default (disabled).
        // Kein Löschen anderer Einstellungen.
        this.isEnabled = false;
        logger.info("[DiscordRichPresence] Kein gültiger gespeicherter Wert; zurück auf Standard (deaktiviert)");
        return false;
    }

    // ─────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────

    initialize() {
        try {
            // Migration: Falls Discord-RPC Status in integrations.json liegt,
            // zu settings.json migrieren (Alt-Kompatibilität).
            this._migrateFromLegacyStorage();

            // 1) Speicherte Einstellung laden + validieren
            this.loadStoredSettings();

            // 2) Initialisiere Runtime nur bei gültig aktivierter Einstellung
            if (this.isEnabled) {
                this.connect();
            }

            // 3) Event-Listener nur registrieren, wenn Einstellung geladen ist
            //    (Auch im Fall "disabled", damit das Handler-Verhalten konsistent
            //    bleibt und kein späteres Re-Enabling über den EventBus
            //    ungeprüft auslöst.)
            this.setupEventListeners();

            logger.info("Discord Rich Presence initialized");
        } catch (err) {
            logger.error("Failed to initialize Discord Rich Presence:", err);
        }
    }

    setupEventListeners() {
        eventBus.on("play", this.handlePlay.bind(this));
        eventBus.on("stop", this.handleStop.bind(this));
        eventBus.on("metadata", this.handleMetadata.bind(this));
        logger.info("DiscordRichPresence event listeners registered");
    }

    removeEventListeners() {
        eventBus.off("play", this.handlePlay.bind(this));
        eventBus.off("stop", this.handleStop.bind(this));
        eventBus.off("metadata", this.handleMetadata.bind(this));
    }

    async connect() {
        if (this.client) {
            return;
        }

        try {
            this.client = new RPC.Client({ transport: "ipc" });

            this.client.on("ready", () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                logger.info("Discord RPC connected");
            });

            this.client.on("disconnected", () => {
                this.isConnected = false;
                logger.warn("Discord RPC disconnected");
                this.scheduleReconnect();
            });

            await this.client.login({ clientId: CLIENT_ID });
        } catch (err) {
            logger.error("Failed to connect to Discord RPC:", err);
            this.client = null;
            this.isConnected = false;
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (!this.isEnabled) {
            return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error("Max reconnect attempts reached, giving up");
            return;
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;

        logger.info(
            `Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
        );

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.client = null;
            this.connect();
        }, delay);
    }

    async disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (!this.client) {
            return;
        }

        try {
            await this.clearActivity();
            await this.client.destroy();
            this.client = null;
            this.isConnected = false;
            this.reconnectAttempts = 0;
            logger.info("Discord RPC disconnected");
        } catch (err) {
            logger.error("Error disconnecting Discord RPC:", err);
        }
    }

    // ─────────────────────────────────────────────
    // Presence
    // ─────────────────────────────────────────────

    async setActivity(station, metadata = {}) {
        if (!this.client || !this.isConnected) {
            if (!this.client && this.isEnabled) {
                this.connect();
            }
            return;
        }

        try {
            const activity = {
                details: metadata.Song || metadata.StreamTitle || "Radio hören",
                state: metadata.Artist || station?.name || "WebRadio",
                startTimestamp: this.startTimestamp,
                largeImageKey: "logo",
                largeImageText: station?.name || "WebRadio",
                smallImageKey: "webradio",
                smallImageText: "WebRadio",
                instance: false,
            };

            if (metadata.Album) {
                activity.assets = {
                    largeImageKey: "logo",
                    largeImageText: metadata.Album,
                };
            }

            await this.client.setActivity(activity);
            logger.debug("Discord activity updated:", activity);
        } catch (err) {
            logger.error("Failed to set Discord activity:", err);
            this.isConnected = false;
            this.scheduleReconnect();
        }
    }

    async clearActivity() {
        if (!this.client || !this.isConnected) {
            return;
        }

        try {
            await this.client.clearActivity();
            logger.debug("Discord activity cleared");
        } catch (err) {
            logger.error("Failed to clear Discord activity:", err);
        }
    }

    handlePlay(data) {
        if (!this.isEnabled) {
            return;
        }

        this.currentStation = data;
        this.startTimestamp = Date.now();

        if (!this.client) {
            this.connect();
        }

        this.setActivity(this.currentStation);
    }

    handleStop() {
        if (!this.isEnabled) {
            return;
        }

        this.currentStation = null;
        this.startTimestamp = null;
        this.clearActivity();
    }

    handleMetadata(metadata) {
        if (!this.isEnabled || !this.currentStation) {
            return;
        }

        this.setActivity(this.currentStation, metadata);
    }

    // ─────────────────────────────────────────────
    // Runtime update (IPC / Settings-UI)
    // ─────────────────────────────────────────────

    /**
     * Haupt-Wechselfunktion: lädt die gesendete Einstellung, validiert sie,
     * speichert sie dauerhaft und aktive/Deaktiviert den Runtime-Lifecycle.
     * Gibt ein strukturiertes Ergebnis zurück (kein bool, damit der Renderer
     * zwischen "geschrieben", "nicht geändert" und "Fehler" unterscheiden kann).
     */
    async updateSettings(enabled) {
        // 1) Input validieren
        if (typeof enabled !== "boolean") {
            return {
                ok: false,
                changed: false,
                error: { code: "INVALID_INPUT", message: "enabled muss ein Boolean sein" },
            };
        }

        const normalized = !!enabled;

        if (normalized === this.isEnabled) {
            // Nicht geändert → kein Speichern, kein neuer Connect
            return {
                ok: true,
                changed: false,
                enabled: this.isEnabled,
            };
        }

        const wasEnabled = this.isEnabled;
        this.isEnabled = normalized;

        // 2) Dauerhaft schreiben (Main-Prozess)
        const saved = this._writeEnabled(normalized);
        if (!saved) {
            // ROLLBACK: vorherigen gültigen Wert wiederherstellen
            this.isEnabled = wasEnabled;
            return {
                ok: false,
                changed: false,
                error: { code: "STORAGE_FAILED", message: "Einstellung konnte nicht persistent geschrieben werden" },
            };
        }

        // 3) Runtime-Transfer
        if (this.isEnabled && !wasEnabled) {
            logger.info("Discord Rich Presence enabled");
            this._started = true;
            this.connect();
            return { ok: true, changed: true, enabled: true };
        } else if (!this.isEnabled && wasEnabled) {
            logger.info("Discord Rich Presence disabled");
            this._started = false;
            await this.disconnect();
            return { ok: true, changed: true, enabled: false };
        }

        return { ok: true, changed: false, enabled: this.isEnabled };
    }

    // ─────────────────────────────────────────────
    // Shutdown
    // ─────────────────────────────────────────────

    async shutdown() {
        this.removeEventListeners();
        await this.disconnect();
        logger.info("Discord Rich Presence shutdown");
    }

    // ─────────────────────────────────────────────
    // Migration (legacy integrations.json → settings.json)
    // ─────────────────────────────────────────────

    _migrateFromLegacyStorage() {
        try {
            const legacyConfigPath = path.join(app.getPath("userData"), "integrations/integrations.json");
            if (!fs.existsSync(legacyConfigPath)) {
                return;
            }

            const legacyConfig = JSON.parse(fs.readFileSync(legacyConfigPath, "utf8"));
            const discordConfig = legacyConfig.integrations?.["discord-rpc"];

            if (discordConfig && discordConfig.enabled !== undefined) {
                const settings = SettingsManager.get();
                if (!settings.integrations) settings.integrations = {};

                // Nur migrieren, wenn noch kein Wert in settings.json existiert
                if (settings.integrations.discordRichPresence === undefined) {
                    settings.integrations.discordRichPresence = discordConfig.enabled;
                    SettingsManager.update(settings);
                    logger.info(`Discord-RPC Status von integrations.json migriert: ${discordConfig.enabled}`);
                }

                // Legacy-Datei nach erfolgreicher Migration löschen
                fs.unlinkSync(legacyConfigPath);
                logger.info("Legacy integrations.json nach Migration gelöscht");
            }
        } catch (err) {
            logger.warn(`Migration von integrations.json fehlgeschlagen: ${err.message}`);
        }
    }
}

module.exports = new DiscordRichPresence();
