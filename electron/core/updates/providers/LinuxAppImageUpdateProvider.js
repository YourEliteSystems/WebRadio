"use strict";

/**
 * LinuxAppImageUpdateProvider.js
 *
 * Provider für Linux AppImage-Updates.
 *
 * Aktiver Status (Beta 4): Produktiv aktiv. Delegiert an electron-updater
 * in Kombination mit GitHub Releases (latest-linux.yml / beta-linux.yml),
 * die electron-builder fuer das AppImage-Target erzeugt.
 *
 * electron-updater unterstuetzt AppImage-Updates nativ:
 *   - Check   -> latest-linux.yml / beta-linux.yml (GitHub Releases) mit
 *                zentraler Stable/Beta-Semantik (allowPrerelease,
 *                allowDowngrade, channel) – konfiguriert im UpdateManager.
 *   - Download -> AppImage-Blockmap-Download via electron-updater.
 *   - Install  -> quitAndInstall() ersetzt die AppImage beim Beenden.
 *
 * Integritaet: electron-updater verifiziert die heruntergeladene AppImage-Datei
 * anhand der sha512/size-Angaben aus der yml-Metadatei automatisch.
 *
 * Noch NICHT implementiert (Future Work, sauber dokumentiert, nicht vorgetaeuscht):
 *   - Inkrementelles Update via appimageupdatetool + zsync-Metadaten
 *     (erfordert AppImageUpdate-Build-Tooling, zsync-Server und Einbettung
 *      von Update-Metadaten in die AppImage). Das hier verwendete Verfahren
 *      laedt stattdessen staets die vollstaendige neue AppImage-Datei herunter.
 *
 * Designprinzipien:
 *   - Saubere Architektur, bei Bedarf erweiterbar fuer AppImageUpdate-Tooling
 *   - autoDownload bleibt false (Benutzer muss Download/Installation
 *     explizit ausloesen) – durch den UpdateManager sichergestellt
 *   - Konsistente API mit anderen Providern
 */

const BaseUpdateProvider = require("./BaseUpdateProvider");
const LinuxAppImageInstaller = require("./LinuxAppImageInstaller");

class LinuxAppImageUpdateProvider extends BaseUpdateProvider {

    constructor(autoUpdater, app = null) {
        super();
        this._autoUpdater = autoUpdater;
        this._app = app;
        this._downloadedFilePath = null;
        // Grund, der in Diagnose-Antworten erscheint, wenn kein AutoUpdater
        // verfuegbar ist (z.B. `npm run dev`).
        this._reason = "AppImage-Updater verfuegbar nur in gepackten Builds via electron-updater";

        if (this._autoUpdater && typeof this._autoUpdater.on === "function") {
            this._onDownloaded = (info) => {
                this._downloadedFilePath = (info && info.downloadedFile) ||
                    (this._autoUpdater && this._autoUpdater.installerPath) ||
                    null;
            };
            this._autoUpdater.on("update-downloaded", this._onDownloaded);
        }
    }

    getProviderType() {
        return "appimage-github-fallback";
    }

    isSuitableForRuntime(runtimeInfo) {
        return runtimeInfo.platform === "linux" && runtimeInfo.isAppImage;
    }

    /**
     * Prüft auf verfügbare Updates.
     *
     * Delegiert an electron-updater, der die plattformspezifische
     * Metadatendatei (latest-linux.yml / beta-linux.yml) auswertet.
     * Stable/Beta-Semantik (Kanal, Prerelease, Downgrade) wird zentral
     * im UpdateManager über `_configureAutoUpdater()` gesetzt.
     */
    async checkForUpdates() {
        if (!this._autoUpdater) {
            return {
                status: "unsupported",
                code: "UPDATER_NOT_AVAILABLE",
                message: this._reason,
                suggestion: "Bitte lade die neueste AppImage manuell von den GitHub Releases herunter."
            };
        }

        try {
            const result = await this._autoUpdater.checkForUpdates();

            // electron-updater liefert updateInfo == null, wenn kein neueres
            // Release vorliegt. `version` ist dann die installierte Version.
            if (!result || !result.updateInfo) {
                return {
                    status: "up-to-date",
                    currentVersion: result?.version || null
                };
            }

            // Ungültige Antwort ohne Versionsangabe abfangen.
            if (!result.updateInfo.version) {
                return {
                    status: "error",
                    code: "INVALID_RESPONSE",
                    message: "Update-Antwort ohne Versionsangabe erhalten."
                };
            }

            return {
                status: "available",
                version: result.updateInfo.version,
                releaseNotes: result.updateInfo.releaseNotes || null,
                releaseDate: result.updateInfo.releaseDate || null,
                files: result.updateInfo.files || null,
                // Hinweis: vollständiger AppImage-Download (kein inkrementelles Update).
                note: "Die neue AppImage-Datei wird vollständig heruntergeladen."
            };
        } catch (err) {
            return {
                status: "error",
                code: "CHECK_FAILED",
                message: err.message || "Update-Check fehlgeschlagen"
            };
        }
    }

    /**
     * Lädt ein gefundenes Update herunter (Benutzer-ausgelöst).
     *
     * Delegiert an electron-updater. Das Ergebnis wird asynchron über den
     * "update-downloaded"-Listener im UpdateManager verarbeitet.
     */
    async downloadUpdate() {
        if (!this._autoUpdater) {
            return {
                status: "unsupported",
                code: "UPDATER_NOT_AVAILABLE",
                message: this._reason,
                suggestion: "Bitte lade die neueste AppImage manuell von den GitHub Releases herunter."
            };
        }

        try {
            await this._autoUpdater.downloadUpdate();
            return { status: "downloading" };
        } catch (err) {
            return {
                status: "error",
                code: "DOWNLOAD_FAILED",
                message: err.message || "Update konnte nicht heruntergeladen werden"
            };
        }
    }

    /**
     * Installiert ein heruntergeladenes Update (Benutzer-ausgelöst).
     *
     * Verwendet LinuxAppImageInstaller für den sicheren, atomaren Austausch unter
     * Linux mit vollständigem Erhalt der Dateiberechtigungen (chmod 755/stat.mode)
     * und Symlink-Erhalt.
     *
     * @param {object} [options={}]
     * @returns {Promise<object>}
     */
    async installUpdate(options = {}) {
        if (!this._autoUpdater) {
            return {
                status: "unsupported",
                code: "UPDATER_NOT_AVAILABLE",
                message: this._reason,
                suggestion: "Bitte lade die neueste AppImage manuell von den GitHub Releases herunter."
            };
        }

        // Sicherstellen, dass ein Download erfolgreich war.
        if (!this._isInstalledReady()) {
            return {
                status: "error",
                code: "NOT_DOWNLOADED",
                message: "Kein heruntergeladenes Update vorhanden. Bitte zuerst herunterladen."
            };
        }

        const currentAppPath = options.currentAppPath || process.env.APPIMAGE;
        const downloadedFilePath = options.downloadedFilePath ||
            this._downloadedFilePath ||
            (this._autoUpdater && this._autoUpdater.installerPath);

        // Sicherer atomarer Austausch über LinuxAppImageInstaller
        if (currentAppPath && downloadedFilePath) {
            try {
                const fsObj = options.fsObj || require("fs");
                const appObj = options.appObj !== undefined ? options.appObj : this._app;
                const result = LinuxAppImageInstaller.applyUpdate({
                    currentAppPath,
                    downloadedUpdatePath: downloadedFilePath,
                    fsObj,
                    appObj
                });
                return {
                    status: "installing",
                    targetPath: result.targetPath
                };
            } catch (err) {
                return {
                    status: "error",
                    code: "INSTALL_FAILED",
                    message: err.message || "Update konnte nicht installiert werden"
                };
            }
        }

        // Schutz vor Umgehung der sicheren Installationslogik:
        // Auf Linux darf quitAndInstall() nicht unkontrolliert als Fallback aufgerufen werden,
        // da dies die Dateiberechtigungen zerstören würde.
        if (options.allowUnsafeFallback && typeof this._autoUpdater.quitAndInstall === "function") {
            try {
                this._autoUpdater.quitAndInstall(false, false);
                return { status: "installing" };
            } catch (err) {
                return {
                    status: "error",
                    code: "INSTALL_FAILED",
                    message: err.message || "Update konnte nicht installiert werden"
                };
            }
        }

        return {
            status: "error",
            code: "INSTALL_FAILED",
            message: !currentAppPath
                ? "AppImage-Pfad (APPIMAGE) nicht ermittelt. Update abgebrochen, um Rechteverlust zu verhindern."
                : "Pfad zum heruntergeladenen Update-Artefakt nicht ermittelt."
        };
    }

    dispose() {
        if (this._autoUpdater && this._onDownloaded && typeof this._autoUpdater.off === "function") {
            try {
                this._autoUpdater.off("update-downloaded", this._onDownloaded);
            } catch {
                /* ignore */
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // Interne Helfer
    // ─────────────────────────────────────────────────────────

    /**
     * Heuristik: Wurde ein Update vollständig heruntergeladen?
     * electron-updater >= 5.x stellt isUpdateDownloaded() bereit.
     */
    _isInstalledReady() {
        if (!this._autoUpdater) return false;
        try {
            if (typeof this._autoUpdater.isUpdateDownloaded === "function") {
                return !!this._autoUpdater.isUpdateDownloaded();
            }
            // Fallback: wenn kein API-Zugriff möglich, nicht freigeben.
            return false;
        } catch {
            return false;
        }
    }
}

module.exports = LinuxAppImageUpdateProvider;
