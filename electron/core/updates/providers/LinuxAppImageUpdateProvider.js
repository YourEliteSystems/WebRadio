"use strict";

/**
 * LinuxAppImageUpdateProvider.js
 *
 * Provider für Linux AppImage-Updates.
 *
 * Aktueller Status: VORBEREITET (nicht vollständig implementiert)
 *
 * Dieser Provider ist als Platzhalter für eine zukünftige AppImageUpdate-Integration
 * konzipiert. Die vollständige Implementierung erfordert:
 *
 * 1. AppImageUpdate-Integration (appimageupdatetool-binaries)
 * 2. zsync-Unterstützung im Build-Prozess
 * 3. Einbettung von Update-Metadaten in das AppImage
 * 4. SHA256-Verifikation für AppImage-Artefakte
 * 5. Stable/Beta-Channel-Integration für AppImage
 *
 * Bis diese Voraussetzungen erfüllt sind, delegiert dieser Provider an GitHub Releases
 * und informiert den Benutzer über manuelle Update-Optionen.
 *
 * Designprinzipien:
 *  - Saubere Architektur für zukünftige AppImageUpdate-Integration
 *  - Keine fragilen Workarounds
 *  - Konsistente API mit anderen Providern
 */

const BaseUpdateProvider = require("./BaseUpdateProvider");

class LinuxAppImageUpdateProvider extends BaseUpdateProvider {

    constructor(autoUpdater) {
        super();
        this._autoUpdater = autoUpdater;
        this._reason = "AppImage automatic updates are not yet fully implemented";
    }

    getProviderType() {
        return "appimage-github-fallback";
    }

    isSuitableForRuntime(runtimeInfo) {
        return runtimeInfo.platform === "linux" && runtimeInfo.isAppImage;
    }

    async checkForUpdates() {
        // TODO: Vollständige AppImageUpdate-Integration
        // - AppImageUpdate-Tool aufrufen
        // - zsync-Metadaten prüfen
        // - SHA256 verifizieren
        // - Stable/Beta-Channel berücksichtigen

        // Fallback: GitHub Releases prüfen (wie electron-updater)
        if (!this._autoUpdater) {
            return {
                status: "unsupported",
                code: "UPDATER_NOT_AVAILABLE",
                message: this._reason,
                suggestion: "Please download the latest AppImage from GitHub Releases manually."
            };
        }

        try {
            const result = await this._autoUpdater.checkForUpdates();
            if (!result || !result.updateInfo) {
                return {
                    status: "up-to-date",
                    currentVersion: result?.version || null
                };
            }
            return {
                status: "available",
                version: result.updateInfo.version,
                releaseNotes: result.updateInfo.releaseNotes,
                releaseDate: result.updateInfo.releaseDate,
                files: result.updateInfo.files,
                note: "Automatic AppImage updates are not yet implemented. Please download manually from GitHub Releases."
            };
        } catch (err) {
            return {
                status: "error",
                code: "CHECK_FAILED",
                message: err.message || "Update-Check fehlgeschlagen"
            };
        }
    }

    async downloadUpdate() {
        // TODO: AppImageUpdate-Download-Implementierung
        return {
            status: "unsupported",
            code: "NOT_IMPLEMENTED",
            message: this._reason,
            suggestion: "Please download the latest AppImage from GitHub Releases manually."
        };
    }

    async installUpdate() {
        // TODO: AppImageUpdate-Install-Implementierung
        return {
            status: "unsupported",
            code: "NOT_IMPLEMENTED",
            message: this._reason,
            suggestion: "Please download the latest AppImage from GitHub Releases manually."
        };
    }

    dispose() {
        // Keine Ressourcen zu bereinigen
    }
}

module.exports = LinuxAppImageUpdateProvider;
