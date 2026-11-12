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
    INTERNAL_ERROR: "UPDATER_INTERNAL_ERROR",

    // v1.0.7: Erkennung, Berechtigungen, Integrität und Rollback
    PLATFORM_UNSUPPORTED: "UPDATER_PLATFORM_UNSUPPORTED",
    INSTALLATION_UNKNOWN: "UPDATER_INSTALLATION_UNKNOWN",
    PROVIDER_SELECTION_FAILED: "UPDATER_PROVIDER_SELECTION_FAILED",
    PERMISSION_DENIED: "UPDATER_PERMISSION_DENIED",
    INTEGRITY_FAILED: "UPDATER_INTEGRITY_FAILED",
    SIGNATURE_FAILED: "UPDATER_SIGNATURE_FAILED",
    DOWNLOAD_INCOMPLETE: "UPDATER_DOWNLOAD_INCOMPLETE",
    DISK_SPACE_INSUFFICIENT: "UPDATER_DISK_SPACE_INSUFFICIENT",
    ROLLBACK_FAILED: "UPDATER_ROLLBACK_FAILED"
});

/**
 * Stabile Fehlerkategorien. Jede Fehlermeldung im Renderer erhält
 * eine dieser Kategorien, damit Probleme filterbar bleiben.
 */
const ERROR_CATEGORIES = Object.freeze({
    NETWORK: "network",
    INTEGRITY: "integrity",
    PERMISSION: "permission",
    PLATFORM: "platform",
    INSTALLATION: "installation",
    CHANNEL: "channel",
    INTERNAL: "internal"
});

const ERROR_CATEGORY_BY_CODE = Object.freeze({
    UPDATER_CHECK_FAILED: ERROR_CATEGORIES.NETWORK,
    UPDATER_DOWNLOAD_FAILED: ERROR_CATEGORIES.NETWORK,
    UPDATER_DOWNLOAD_INCOMPLETE: ERROR_CATEGORIES.NETWORK,
    UPDATER_INVALID_RESPONSE: ERROR_CATEGORIES.NETWORK,
    UPDATER_INTEGRITY_FAILED: ERROR_CATEGORIES.INTEGRITY,
    UPDATER_SIGNATURE_FAILED: ERROR_CATEGORIES.INTEGRITY,
    UPDATER_PERMISSION_DENIED: ERROR_CATEGORIES.PERMISSION,
    UPDATER_DISK_SPACE_INSUFFICIENT: ERROR_CATEGORIES.PERMISSION,
    UPDATER_PLATFORM_UNSUPPORTED: ERROR_CATEGORIES.PLATFORM,
    UPDATER_PROVIDER_SELECTION_FAILED: ERROR_CATEGORIES.PLATFORM,
    UPDATER_INSTALLATION_UNKNOWN: ERROR_CATEGORIES.INSTALLATION,
    UPDATER_INSTALL_FAILED: ERROR_CATEGORIES.INSTALLATION,
    UPDATER_ROLLBACK_FAILED: ERROR_CATEGORIES.INSTALLATION,
    UPDATER_INVALID_CHANNEL: ERROR_CATEGORIES.CHANNEL,
    UPDATER_CHANNEL_SWITCH_FAILED: ERROR_CATEGORIES.CHANNEL,
    UPDATER_NOT_AVAILABLE: ERROR_CATEGORIES.INTERNAL,
    UPDATER_ALREADY_INITIALIZED: ERROR_CATEGORIES.INTERNAL,
    UPDATER_NOT_INITIALIZED: ERROR_CATEGORIES.INTERNAL,
    UPDATER_INTERNAL_ERROR: ERROR_CATEGORIES.INTERNAL
});

const CHANNELS = Object.freeze({
    STABLE: "stable",
    BETA: "beta",
    RC: "rc",
    ALPHA: "alpha"
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
    const resolvedCode = code || ERROR_CODES.INTERNAL_ERROR;
    const payload = {
        code: resolvedCode,
        category: ERROR_CATEGORY_BY_CODE[resolvedCode] || ERROR_CATEGORIES.INTERNAL,
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
    ERROR_CATEGORIES,
    ERROR_CATEGORY_BY_CODE,
    CHANNELS,
    createDefaultState,
    cloneState,
    buildErrorPayload
};
