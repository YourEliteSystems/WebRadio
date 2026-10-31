"use strict";

/**
 * UnsupportedUpdateProvider.js
 *
 * Provider für Packaging-Typen, die kein automatisches App-spezifisches Update unterstützen.
 *
 * Verwendet wird dieser Provider für:
 *  - Linux .deb (Updates über Paketverwaltung)
 *  - Linux Arch (Updates über pacman)
 *  - macOS (kein automatischer Update-Mechanismus definiert)
 *  - Unbekannte Packaging-Typen
 *
 * Designprinzipien:
 *  - Liefert konsistente "unsupported" Antworten
 *  - Verhindert keine Updates, sondern delegiert an System-Update-Mechanismen
 *  - UI kann sauber "Update über Paketverwaltung erforderlich" anzeigen
 */

const BaseUpdateProvider = require("./BaseUpdateProvider");

class UnsupportedUpdateProvider extends BaseUpdateProvider {

    constructor(reason = "Packaging type does not support automatic app updates", suggestion = null) {
        super();
        this._reason = reason;
        this._suggestion = suggestion;
    }

    getProviderType() {
        return "unsupported";
    }

    /**
     * Liefert den Grund, warum dieser Pakettyp keine automatischen
     * App-Updates unterstützt. Für Diagnose-Einstellungen gedacht.
     */
    getReason() {
        return this._reason;
    }

    isSuitableForRuntime(_runtimeInfo) {
        // Dieser Provider ist der Fallback für alles, was nicht
        // von einem spezialisierten Provider abgedeckt wird.
        return true;
    }

    async checkForUpdates() {
        return {
            status: "unsupported",
            code: "UPDATES_UNSUPPORTED",
            message: this._reason,
            suggestion: this._getSuggestion()
        };
    }

    async downloadUpdate() {
        return {
            status: "unsupported",
            code: "UPDATES_UNSUPPORTED",
            message: this._reason
        };
    }

    async installUpdate() {
        return {
            status: "unsupported",
            code: "UPDATES_UNSUPPORTED",
            message: this._reason
        };
    }

    _getSuggestion() {
        return this._suggestion || "Bitte nutze die System-Paketverwaltung deines Systems, um WebRadio zu aktualisieren.";
    }
}

module.exports = UnsupportedUpdateProvider;
