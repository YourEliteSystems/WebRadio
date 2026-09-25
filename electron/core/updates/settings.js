"use strict";

/**
 * settings.js
 *
 * Zentrale Hilfsfunktionen für persistente Update-Channel-Einstellungen.
 *
 * Nutzt das existierende Settings-/Config-System:
 *   SettingsManager <-> StorageManager
 * Speicher liegt im Electron-Main-Prozess im userData-Bereich
 * (settings.json). Der Renderer hat keinen direkten
 * Dateisystemzugriff.
 */

const SettingsManager = require("../storage/SettingsManager");
const LogManager = require("../diagnostics/logging/LogManager");
const UpdateState = require("./UpdateState");
const UpdateChannel = require("./UpdateChannel");

const logger = LogManager.getLogger("ChannelSettings");

/** Nur kanonische Channel-IDs sind selektierbar. */
const VALID_CHANNELS = new Set([
    UpdateState.CHANNELS.STABLE,
    UpdateState.CHANNELS.BETA,
    UpdateState.CHANNELS.ALPHA
]);

/**
 * Liest den gespeicherten Update-Channel aus settings.json.
 * Unterstützt abwärtskompatibel alle historischen Speicherformate:
 * - updateChannel: "alpha"
 * - updates: { channel: "alpha" }
 * - "updates.channel": "alpha"
 * - channel: "alpha"
 *
 * @returns {string|null} Kanal-ID oder null, falls nicht gesetzt oder ungültig.
 */
function getStoredChannel() {
    try {
        const data = SettingsManager.get();
        if (!data || typeof data !== "object") return null;

        const raw = data.updateChannel ||
            (data.updates && typeof data.updates === "object" ? data.updates.channel : null) ||
            data["updates.channel"] ||
            data.channel;

        if (typeof raw !== "string" || !VALID_CHANNELS.has(raw)) {
            return null;
        }
        return raw;
    } catch (err) {
        logger.warn(`[ChannelStore] gespeicherter Channel nicht lesbar: ${err.message}`);
        return null;
    }
}

/**
 * Schreibt den ausgewählten Channel dauerhaft in settings.json.
 * Überschreibt keine bestehenden Benutzereinstellungen.
 *
 * @param {string} channel - Kanal-ID (stable|beta|alpha)
 * @returns {boolean} true bei Erfolg, false bei Validierungs- oder Schreibfehler
 */
function setStoredChannel(channel) {
    try {
        if (typeof channel !== "string" || !VALID_CHANNELS.has(channel)) {
            logger.warn(`[ChannelStore] ungültiger Channel abgelehnt: ${JSON.stringify(channel)}`);
            return false;
        }

        const data = SettingsManager.get() || {};

        // Bestehende Einstellungen beibehalten und Channel setzen
        data.updateChannel = channel;
        if (!data.updates || typeof data.updates !== "object") {
            data.updates = {};
        }
        data.updates.channel = channel;

        SettingsManager.update(data);

        // Verifizieren, dass der Wert lesbar ist
        const readBack = getStoredChannel();
        if (readBack !== channel) {
            logger.error(`[ChannelStore] Verifikation nach Speichern fehlgeschlagen: erwartet '${channel}', gefunden '${readBack}'`);
            return false;
        }

        return true;
    } catch (err) {
        logger.warn(`[ChannelStore] gespeicherter Channel nicht schreibbar: ${err.message}`);
        return false;
    }
}

/**
 * Prüft, ob ein Channel-Wert als gültiger gespeicherter Kanal gilt.
 *
 * @param {any} raw
 * @returns {boolean}
 */
function isValidStoredChannel(raw) {
    return typeof raw === "string" && VALID_CHANNELS.has(raw);
}

module.exports = {
    VALID_CHANNELS,
    getStoredChannel,
    setStoredChannel,
    isValidStoredChannel
};
