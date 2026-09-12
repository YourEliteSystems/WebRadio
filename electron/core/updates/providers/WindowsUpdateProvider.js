"use strict";

/**
 * WindowsUpdateProvider.js
 *
 * Kapselt den bestehenden electron-updater für Windows.
 *
 * Dieser Provider:
 *  - Verwendet electron-updater für alle Windows-Updates
 *  - Unterstützt NSIS-Installer und Portable-Builds
 *  - Liefert die gleiche Funktionalität wie der bisherige UpdateManager
 *  - Ändert nichts am bestehenden Windows-Update-Verhalten
 *
 * Designprinzipien:
 *  - Wrapper um electron-updater, keine Neuerfindung
 *  - API-Kompatibilität mit bestehendem UpdateManager
 *  - Keine Änderungen am Windows-Installer-Verhalten
 */

const BaseUpdateProvider = require("./BaseUpdateProvider");

class WindowsUpdateProvider extends BaseUpdateProvider {

    constructor(autoUpdater) {
        super();
        this._autoUpdater = autoUpdater;
        this._listeners = new Map();
    }

    getProviderType() {
        return "electron-updater";
    }

    isSuitableForRuntime(runtimeInfo) {
        return runtimeInfo.platform === "windows" && !!this._autoUpdater;
    }

    async checkForUpdates() {
        if (!this._autoUpdater) {
            return {
                status: "error",
                code: "UPDATER_NOT_AVAILABLE",
                message: "electron-updater nicht verfügbar"
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
                files: result.updateInfo.files
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
        if (!this._autoUpdater) {
            return {
                status: "error",
                code: "UPDATER_NOT_AVAILABLE",
                message: "electron-updater nicht verfügbar"
            };
        }

        try {
            await this._autoUpdater.downloadUpdate();
            return {
                status: "downloading"
            };
        } catch (err) {
            return {
                status: "error",
                code: "DOWNLOAD_FAILED",
                message: err.message || "Download fehlgeschlagen"
            };
        }
    }

    async installUpdate() {
        if (!this._autoUpdater) {
            return {
                status: "error",
                code: "UPDATER_NOT_AVAILABLE",
                message: "electron-updater nicht verfügbar"
            };
        }

        try {
            // isSilent=false, isForceRunAfter=false => Benutzer hat
            // bereits explizit "Jetzt neu starten" gedrückt.
            this._autoUpdater.quitAndInstall(false, false);
            return {
                status: "installing"
            };
        } catch (err) {
            return {
                status: "error",
                code: "INSTALL_FAILED",
                message: err.message || "Installation fehlgeschlagen"
            };
        }
    }

    /**
     * Registriert Event-Listener für electron-updater Events.
     * Wird vom UpdateManager aufgerufen, um State-Updates zu empfangen.
     */
    on(event, callback) {
        if (!this._autoUpdater) return () => {};
        if (typeof callback !== "function") return () => {};

        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);

        this._autoUpdater.on(event, callback);

        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (!this._autoUpdater) return;
        const set = this._listeners.get(event);
        if (!set) return;
        set.delete(callback);
        this._autoUpdater.off(event, callback);
    }

    dispose() {
        if (!this._autoUpdater) return;
        this._listeners.forEach((callbacks, event) => {
            callbacks.forEach(callback => {
                try {
                    this._autoUpdater.off(event, callback);
                } catch {
                    // ignore
                }
            });
        });
        this._listeners.clear();
    }
}

module.exports = WindowsUpdateProvider;
