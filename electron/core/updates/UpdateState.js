"use strict";

/**
 * UpdateState.js
 *
 * Definiert alle gültigen Update-Zustände, strukturierte Fehlercodes
 * und einen reinen Helfer zum Klonen des internen State-Objekts.
 *
 * Der UpdateManager hält den "lebenden" State als plain object.
 * Diese Datei stellt ausschließlich Konstanten und kleine reine
 * Helfer bereit – KEIN I/O, KEINE Auto-Updater-Aufrufe.
 */

const STATES = Object.freeze({
    IDLE: "idle",
    CHECKING: "checking",
    AVAILABLE: "available",
    NOT_AVAILABLE: "not-available",
    DOWNLOADING: "downloading",
    DOWNLOADED: "downloaded",
    INSTALLING: "installing",
    UP_TO_DATE: "up-to-date",
    ERROR: "error"
});

const ERROR_CODES = Object.freeze({
    NOT_AVAILABLE: "UPDATER_NOT_AVAILABLE",
    ALREADY_INITIALIZED: "UPDATER_ALREADY_INITIALIZED",
    NOT_INITIALIZED: "UPDATER_NOT_INITIALIZED",
    INVALID_CHANNEL: "UPDATER_INVALID_CHANNEL",
    INVALID_RESPONSE: "UPDATER_INVALID_RESPONSE",
    CHECK_FAILED: "UPDATER_CHECK_FAILED",
    DOWNLOAD_FAILED: "UPDATER_DOWNLOAD_FAILED",
    INSTALL_FAILED: "UPDATER_INSTALL_FAILED",
    CHANNEL_SWITCH_FAILED: "UPDATER_CHANNEL_SWITCH_FAILED",
    INTERNAL_ERROR: "UPDATER_INTERNAL_ERROR"
});

const CHANNELS = Object.freeze({
    STABLE: "stable",
    BETA: "beta"
});

/**
 * Erzeugt einen frischen Default-State.
 * Wird sowohl beim Initialize() als auch nach Channel-Wechsel
 * und nach "Später"-Aktion verwendet.
 */
function createDefaultState() {
    return {
        status: STATES.IDLE,
        currentVersion: null,
        availableVersion: null,
        channel: CHANNELS.STABLE,
        progress: 0,           // 0..1
        bytesPerSecond: 0,
        transferredBytes: 0,
        totalBytes: 0,
        releaseNotes: null,    // sanitized string
        releaseNotesRaw: null, // unangetasteter Markdown-Text
        releaseDate: null,
        file: null,            // electron-updater UpdateFileInfo
        downloaded: false,
        error: null,
        lastCheck: null,       // ISO string
        lastNotifiedVersion: null
    };
}

/**
 * Erzeugt eine tiefe Kopie des State – wichtig, damit der
 * Renderer niemals direkte Referenzen auf interne Objekte hält.
 */
function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
}

/**
 * Erzeugt eine strukturierte Fehlermeldung für IPC/Renderer.
 * Niemals rohe Error-Objekte oder Stacktraces an den Renderer geben.
 */
function buildErrorPayload(code, message, details) {
    const payload = {
        code: code || ERROR_CODES.INTERNAL_ERROR,
        message: message || "Update-Fehler",
        timestamp: new Date().toISOString()
    };
    if (details && typeof details === "object") {
        // Nur eine kleine, definierte Auswahl an Details erlauben.
        const safe = {};
        if (typeof details.statusCode === "number") {
            safe.statusCode = details.statusCode;
        }
        if (typeof details.stage === "string") {
            safe.stage = details.stage;
        }
        if (Object.keys(safe).length > 0) {
            payload.details = safe;
        }
    }
    return payload;
}

module.exports = {
    STATES,
    ERROR_CODES,
    CHANNELS,
    createDefaultState,
    cloneState,
    buildErrorPayload
};
