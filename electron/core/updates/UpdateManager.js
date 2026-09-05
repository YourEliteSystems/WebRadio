"use strict";

/**
 * UpdateManager.js
 *
 * Zentrale, einzige Update-Logik für WebRadio.
 *
 * Aufgaben:
 *  - Initialisierung des electron-updater AutoUpdaters (nur 1x)
 *  - Konfiguration des Stable / Beta Update-Kanals
 *  - Persistenz der Channel-Auswahl und "zuletzt benachrichtigt"-Info
 *    in der bestehenden SettingsManager-Instanz
 *  - Bereitstellung strukturierter Update-Statusinformationen
 *  - Anstoßen von Check / Download / Install
 *  - Sanitization von GitHub-Release-Notes
 *  - Broadcast von Update-Events an alle Browser-Fenster
 *  - Sauberes Dispose() zum Beenden
 *
 * Designprinzipien:
 *  - Singleton-Instanz (über module.exports)
 *  - initialize() ist idempotent (zweiter Aufruf = no-op)
 *  - Keine direkten Renderer-Referenzen
 *  - Auto-Check nur in packaged/production-Builds
 *  - Auto-Download = false (Benutzer muss bestätigen)
 *  - Keine GitHub-Tokens, keine User-Update-URLs
 */

const { app, BrowserWindow, Notification } = require("electron");

const LogManager = require("../diagnostics/logging/LogManager");
const SettingsManager = require("../storage/SettingsManager");

const UpdateState = require("./UpdateState");
const UpdateChannel = require("./UpdateChannel");
const MarkdownSanitizer = require("./MarkdownSanitizer");

const logger = LogManager.getLogger("Updater");

// electron-updater wird NUR in packaged/production-Builds aktiv.
// In development oder im Test-Kontext fällt alles auf einen
// "Stub-Modus" zurück, der den Lebenszyklus sauber durchspielt,
// aber niemals echte HTTP-Calls ausführt.
let autoUpdater = null;
let isPackaged = false;
try {
    // require erst nach App-Ready, um sicher zu gehen, dass
    // electron vollständig initialisiert ist.
    isPackaged = !!app && !!app.isPackaged;
    if (isPackaged) {
        const electronUpdater = require("electron-updater");
        autoUpdater = electronUpdater.autoUpdater;
    } else {
        logger.info("[Updater] Auto-update unavailable in development mode");
    }
} catch (err) {
    logger.warn(`[Updater] electron-updater konnte nicht geladen werden: ${err.message}`);
}

const SETTING_KEYS = Object.freeze({
    CHANNEL: "updates.channel",
    LAST_CHECK: "updates.lastCheck",
    LAST_NOTIFIED: "updates.lastNotifiedVersion",
    AUTO_CHECK: "updates.autoCheckOnStart"
});

const DEFAULT_AUTO_CHECK = true;
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 Stunden
const SETTINGS_DEBOUNCE_MS = 250;                // einfache Schreib-Drossel

class UpdateManager {

    constructor() {
        this._initialized = false;
        this._initializing = false;
        this._state = UpdateState.createDefaultState();
        this._listeners = new Map();   // event -> Set<callback>
        this._autoCheckTimer = null;
        this._lastAutoCheckAt = 0;
        this._settingsWriteTimer = null;
        this._cachedUpdateInfo = null;
        this._downloadedFile = null;
        this._autoCheck = DEFAULT_AUTO_CHECK;
    }

    // ─────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────

    /**
     * Idempotente Initialisierung. Darf nur einmal aufgerufen werden.
     * Mehrfacher Aufruf ist ein no-op.
     */
    initialize() {
        if (this._initialized || this._initializing) {
            return;
        }
        this._initializing = true;

        try {
            const settings = this._readSettings();
            this._state.channel = this._resolveChannel(settings.channel);
            this._autoCheck = this._shouldAutoCheck(settings);
            // currentVersion JEDES Mal setzen, auch nach dispose()/re-init
            this._state.currentVersion = app.getVersion();

            logger.info(`[Updater] Initialized`);
            logger.info(`[Updater] Channel: ${this._state.channel}`);
            logger.info(`[Updater] Current version: ${this._state.currentVersion}`);

            if (!autoUpdater) {
                logger.info("[Updater] Auto-update unavailable in development mode");
                this._setStatus(UpdateState.STATES.IDLE);
                this._initializing = false;
                this._initialized = true;
                return;
            }

            this._configureAutoUpdater();
            this._registerAutoUpdaterListeners();
            this._restoreLastNotified(settings);

            this._state.error = null;
            this._setStatus(UpdateState.STATES.IDLE);

            // Auto-Check nur in produktiven, packaged Builds.
            if (isPackaged && this._shouldAutoCheck(settings)) {
                // Sanftes Delay, damit der App-Start nicht blockiert wird.
                setTimeout(() => {
                    this._maybeAutoCheck();
                }, 4000);
            }

            this._initialized = true;
        } catch (err) {
            logger.error(`[Updater] Initialisierung fehlgeschlagen: ${err.message}`);
            this._setStatus(UpdateState.STATES.ERROR);
            this._state.error = UpdateState.buildErrorPayload(
                UpdateState.ERROR_CODES.INTERNAL_ERROR,
                "Update-System konnte nicht initialisiert werden"
            );
            this._initialized = true; // wir lassen Folgeaufrufe zu
        } finally {
            this._initializing = false;
        }
    }

    /**
     * Liefert eine defensive Kopie des aktuellen State.
     * Renderer / IPC bekommen niemals direkten Zugriff auf
     * interne Objekte.
     */
    getState() {
        return UpdateState.cloneState(this._state);
    }

    /**
     * Liefert den aktuell aktiven Channel.
     */
    getChannel() {
        return this._state.channel;
    }

    /**
     * Liefert die aktuell installierte Version.
     */
    getCurrentVersion() {
        return app.getVersion();
    }

    /**
     * Setzt den Update-Kanal und persistiert die Wahl.
     *
     * Beim Wechsel auf "beta" wird KEINE Warnung ausgelöst –
     * das übernimmt der Renderer (Beta-Warnung im UI).
     *
     * @param {"stable"|"beta"} channel
     */
    setChannel(channel) {
        if (!UpdateChannel.isValidChannel(channel)) {
            throw new Error(UpdateState.ERROR_CODES.INVALID_CHANNEL);
        }
        if (this._state.channel === channel) {
            return UpdateState.cloneState(this._state);
        }

        const previous = this._state.channel;
        this._state.channel = channel;
        logger.info(`[Updater] Channel-Wechsel: ${previous} -> ${channel}`);

        this._persistSetting(SETTING_KEYS.CHANNEL, channel);

        // Bei Channel-Wechsel: notified-state neu bewerten, damit
        // der Benutzer ggf. über bereits bekannte Versionen des
        // neuen Channels informiert wird.
        this._state.lastNotifiedVersion = null;
        this._persistSetting(SETTING_KEYS.LAST_NOTIFIED, null);

        // Beim Channel-Wechsel: laufende Downloads / bekannte Updates
        // zurücksetzen, damit der Renderer sauber neu anzeigen kann.
        this._resetForChannelSwitch();

        this._emit("channel-changed", {
            channel: channel,
            previous: previous
        });

        // Auto-Updater neu konfigurieren, falls vorhanden.
        if (autoUpdater) {
            try {
                this._configureAutoUpdater();
            } catch (err) {
                logger.error(`[Updater] Channel-Rekonfiguration fehlgeschlagen: ${err.message}`);
            }
        }

        this._broadcastState();
        return UpdateState.cloneState(this._state);
    }

    /**
     * Manuell ausgelöster Update-Check.
     * Wird vom "Nach Updates suchen"-Button im Renderer aufgerufen.
     *
     * @returns {Promise<object>} Strukturiertes Resultat für IPC.
     */
    async checkForUpdates() {
        logger.info("[Updater] Checking for updates");
        this._setStatus(UpdateState.STATES.CHECKING);
        this._broadcastState();

        if (!autoUpdater) {
            // Im Dev-Modus liefern wir "up-to-date" – das verhindert
            // störende Fehler-Toasts während `npm run dev`.
            logger.info("[Updater] Auto-update unavailable in development mode");
            this._setStatus(UpdateState.STATES.UP_TO_DATE);
            this._state.availableVersion = null;
            this._state.error = null;
            this._broadcastState();
            return this._buildCheckResult("up-to-date");
        }

        try {
            const result = await autoUpdater.checkForUpdates();
            return this._handleCheckResult(result);
        } catch (err) {
            logger.error(`[Updater] Check fehlgeschlagen: ${err.message}`);
            this._setStatus(UpdateState.STATES.ERROR);
            this._state.error = UpdateState.buildErrorPayload(
                UpdateState.ERROR_CODES.CHECK_FAILED,
                "Update konnte nicht geprüft werden",
                { stage: "check" }
            );
            this._broadcastState();
            return this._buildCheckResult("error");
        }
    }

    /**
     * Lädt ein gefundenes Update herunter.
     * Voraussetzung: State.available oder state.downloaded = false
     * und ein pending UpdateInfo wurde von electron-updater
     * bereitgestellt.
     */
    async downloadUpdate() {
        if (!autoUpdater) {
            return this._buildErrorResult(
                UpdateState.ERROR_CODES.NOT_AVAILABLE,
                "Update-Download nicht verfügbar"
            );
        }
        if (!this._cachedUpdateInfo) {
            return this._buildErrorResult(
                UpdateState.ERROR_CODES.CHECK_FAILED,
                "Kein Update zum Herunterladen vorhanden"
            );
        }

        logger.info(`[Updater] Download started (${this._cachedUpdateInfo.version})`);
        this._setStatus(UpdateState.STATES.DOWNLOADING);
        this._state.progress = 0;
        this._state.transferredBytes = 0;
        this._state.totalBytes = 0;
        this._state.bytesPerSecond = 0;
        this._state.error = null;
        this._broadcastState();

        try {
            await autoUpdater.downloadUpdate();
            // Erfolg wird über den "update-downloaded" Listener
            // verarbeitet, der _setDownloaded() aufruft.
            return { status: "downloading" };
        } catch (err) {
            logger.error(`[Updater] Download fehlgeschlagen: ${err.message}`);
            this._setStatus(UpdateState.STATES.ERROR);
            this._state.error = UpdateState.buildErrorPayload(
                UpdateState.ERROR_CODES.DOWNLOAD_FAILED,
                "Update konnte nicht heruntergeladen werden",
                { stage: "download" }
            );
            this._broadcastState();
            return this._buildErrorResult(
                UpdateState.ERROR_CODES.DOWNLOAD_FAILED,
                "Update konnte nicht heruntergeladen werden"
            );
        }
    }

    /**
     * Installiert ein heruntergeladenes Update nach Benutzer-Bestätigung.
     * Ruft autoUpdater.quitAndInstall() auf – das ist der offizielle
     * Mechanismus von electron-updater.
     */
    async installUpdate() {
        if (!autoUpdater) {
            return this._buildErrorResult(
                UpdateState.ERROR_CODES.NOT_AVAILABLE,
                "Update-Installation nicht verfügbar"
            );
        }
        if (!this._state.downloaded) {
            return this._buildErrorResult(
                UpdateState.ERROR_CODES.INSTALL_FAILED,
                "Kein heruntergeladenes Update vorhanden"
            );
        }

        logger.info("[Updater] Installing update");
        this._setStatus(UpdateState.STATES.INSTALLING);
        this._broadcastState();

        try {
            // isSilent=false, isForceRunAfter=false => Benutzer hat
            // bereits explizit "Jetzt neu starten" gedrückt.
            autoUpdater.quitAndInstall(false, false);
            return { status: "installing" };
        } catch (err) {
            logger.error(`[Updater] Installation fehlgeschlagen: ${err.message}`);
            this._setStatus(UpdateState.STATES.ERROR);
            this._state.error = UpdateState.buildErrorPayload(
                UpdateState.ERROR_CODES.INSTALL_FAILED,
                "Update konnte nicht installiert werden",
                { stage: "install" }
            );
            this._broadcastState();
            return this._buildErrorResult(
                UpdateState.ERROR_CODES.INSTALL_FAILED,
                "Update konnte nicht installiert werden"
            );
        }
    }

    /**
     * Liefert true, wenn ein Update verfügbar ist.
     */
    isUpdateAvailable() {
        return this._state.status === UpdateState.STATES.AVAILABLE
            || this._state.status === UpdateState.STATES.DOWNLOADING
            || this._state.status === UpdateState.STATES.DOWNLOADED;
    }

    /**
     * Liefert true, wenn aktuell ein Download läuft.
     */
    isDownloading() {
        return this._state.status === UpdateState.STATES.DOWNLOADING;
    }

    /**
     * Liefert true, wenn ein Update vollständig heruntergeladen wurde.
     */
    isDownloaded() {
        return this._state.status === UpdateState.STATES.DOWNLOADED;
    }

    /**
     * Liefert true, wenn die installierte Version ein Pre-Release ist.
     */
    isPrerelease() {
        return UpdateChannel.isPrerelease(this.getCurrentVersion());
    }

    /**
     * Liefert die Versionsinformationen des gefundenen Updates.
     */
    getAvailableVersion() {
        return this._state.availableVersion;
    }

    /**
     * Liefert die sanitisierten Release-Notes.
     */
    getReleaseNotes() {
        return this._state.releaseNotes;
    }

    /**
     * Liefert die rohen Release-Notes (Markdown).
     */
    getReleaseNotesRaw() {
        return this._state.releaseNotesRaw;
    }

    /**
     * Liefert das heruntergeladene UpdateInfo-Objekt, sofern vorhanden.
     */
    getDownloadedUpdate() {
        return this._downloadedFile;
    }

    /**
     * Markiert die aktuell gefundene Version als "vom Benutzer
     * wahrgenommen" (Notification unterdrückt, wenn man später
     * den gleichen Channel nochmal prüft).
     */
    markCurrentVersionAsNotified() {
        if (!this._state.availableVersion) return;
        this._state.lastNotifiedVersion = this._state.availableVersion;
        this._persistSetting(SETTING_KEYS.LAST_NOTIFIED, this._state.availableVersion);
    }

    /**
     * Liest die Einstellung, ob beim Start automatisch geprüft werden soll.
     * @returns {boolean}
     */
    getAutoCheck() {
        return typeof this._autoCheck === "boolean" ? this._autoCheck : DEFAULT_AUTO_CHECK;
    }

    /**
     * Setzt die Einstellung, ob beim Start automatisch geprüft werden soll.
     * @param {boolean} enabled
     * @returns {boolean}
     */
    setAutoCheck(enabled) {
        const val = !!enabled;
        this._autoCheck = val;
        this._persistSetting(SETTING_KEYS.AUTO_CHECK, val);
        return val;
    }

    /**
     * Setzt die Anzeige auf "Später" zurück:
     * Die Version wird als wahrgenommen/notified markiert,
     * so dass keine wiederholten Notifications erscheinen.
     */
    dismissUpdateForLater() {
        this.markCurrentVersionAsNotified();
        this._setStatus(UpdateState.STATES.IDLE);
        this._broadcastState();
        return UpdateState.cloneState(this._state);
    }

    /**
     * Erlaubt Tests, einen synthetischen Update-Info zu injizieren,
     * ohne echtes electron-updater-Verhalten.
     */
    _setTestUpdateInfo(info) {
        this._cachedUpdateInfo = info;
    }

    /**
     * Erlaubt Tests, einen kompletten electron-updater-Stub zu
     * injizieren. Wird nur in Test-Kontexten verwendet.
     */
    _setTestAutoUpdater(stub) {
        autoUpdater = stub;
    }

    /**
     * Sauberer Lifecycle-Stop. Entfernt alle Listener,
     * Timer und Referenzen.
     */
    dispose() {
        if (!this._initialized && !this._initializing) {
            return;
        }
        logger.info("[Updater] Disposing");

        if (this._autoCheckTimer) {
            clearTimeout(this._autoCheckTimer);
            this._autoCheckTimer = null;
        }
        // Letzte ausstehende Settings synchron schreiben,
        // damit nichts verloren geht.
        this._flushPendingSettingsWrite();

        if (autoUpdater && this._detachAutoUpdaterListeners) {
            try {
                this._detachAutoUpdaterListeners();
            } catch (err) {
                logger.warn(`[Updater] Listener cleanup fehlgeschlagen: ${err.message}`);
            }
        }

        this._listeners.clear();
        this._cachedUpdateInfo = null;
        this._downloadedFile = null;
        this._initialized = false;
        this._initializing = false;
    }

    // ─────────────────────────────────────────────
    // Public Event-Subscription
    // ─────────────────────────────────────────────

    on(event, callback) {
        if (typeof callback !== "function") return () => {};
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        const set = this._listeners.get(event);
        if (!set) return;
        set.delete(callback);
    }

    // ─────────────────────────────────────────────
    // Internal – AutoUpdater Wiring
    // ─────────────────────────────────────────────

    _configureAutoUpdater() {
        if (!autoUpdater) return;
        const config = UpdateChannel.getUpdaterConfig(this._state.channel, this.getCurrentVersion());

        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = false;
        autoUpdater.allowDowngrade = !!config.allowDowngrade;
        autoUpdater.allowPrerelease = !!config.allowPrerelease;

        if (config.channel) {
            autoUpdater.channel = config.channel;
        } else {
            // Stable = electron-updater default
            // channel auf "latest" setzen, falls vorher Beta aktiv war.
            try {
                autoUpdater.channel = null;
            } catch {
                // ignore
            }
        }

        logger.info(
            `[Updater] AutoUpdater config: channel=${config.channel || "latest"} `
            + `allowPrerelease=${autoUpdater.allowPrerelease} `
            + `allowDowngrade=${autoUpdater.allowDowngrade}`
        );
    }

    _registerAutoUpdaterListeners() {
        if (!autoUpdater) return;

        const onChecking = () => {
            logger.info("[Updater] AutoUpdater: checking-for-update");
        };

        const onAvailable = (info) => {
            logger.info(`[Updater] Update available: ${info?.version}`);
            this._handleAvailableUpdate(info);
        };

        const onNotAvailable = (info) => {
            logger.info(`[Updater] Update not available (current: ${info?.version || app.getVersion()})`);
            this._handleNoUpdate(info);
        };

        const onProgress = (progress) => {
            if (!progress) return;
            const total = Number(progress.total) || 0;
            const transferred = Number(progress.transferred) || 0;
            const percent = total > 0 ? transferred / total : 0;
            this._state.progress = Math.max(0, Math.min(1, percent));
            this._state.transferredBytes = transferred;
            this._state.totalBytes = total;
            this._state.bytesPerSecond = Number(progress.bytesPerSecond) || 0;
            this._broadcastEvent("download-progress", {
                progress: this._state.progress,
                transferred: transferred,
                total: total,
                bytesPerSecond: this._state.bytesPerSecond
            });
        };

        const onDownloaded = (info) => {
            logger.info(`[Updater] Download completed: ${info?.version}`);
            this._handleDownloaded(info);
        };

        const onError = (err) => {
            // electron-updater wirft manchmal harmlose "Cannot find any
            // updates" / "no published versions" – wir klassifizieren
            // das als sauberen "up-to-date"-Fall, nicht als Fehler.
            const msg = (err && err.message) || String(err);
            if (/no published versions/i.test(msg)
                || /no update available/i.test(msg)
                || /not signed/i.test(msg)) {
                logger.info(`[Updater] AutoUpdater no-update: ${msg}`);
                this._handleNoUpdate();
                return;
            }
            logger.error(`[Updater] AutoUpdater error: ${msg}`);
            this._setStatus(UpdateState.STATES.ERROR);
            this._state.error = UpdateState.buildErrorPayload(
                UpdateState.ERROR_CODES.CHECK_FAILED,
                "Update-Fehler aufgetreten",
                { stage: "auto" }
            );
            this._broadcastState();
        };

        autoUpdater.on("checking-for-update", onChecking);
        autoUpdater.on("update-available", onAvailable);
        autoUpdater.on("update-not-available", onNotAvailable);
        autoUpdater.on("download-progress", onProgress);
        autoUpdater.on("update-downloaded", onDownloaded);
        autoUpdater.on("error", onError);

        this._detachAutoUpdaterListeners = () => {
            try { autoUpdater.off("checking-for-update", onChecking); } catch { /* ignore */ }
            try { autoUpdater.off("update-available", onAvailable); } catch { /* ignore */ }
            try { autoUpdater.off("update-not-available", onNotAvailable); } catch { /* ignore */ }
            try { autoUpdater.off("download-progress", onProgress); } catch { /* ignore */ }
            try { autoUpdater.off("update-downloaded", onDownloaded); } catch { /* ignore */ }
            try { autoUpdater.off("error", onError); } catch { /* ignore */ }
        };
    }

    _handleAvailableUpdate(info) {
        if (!info || !info.version) {
            this._setStatus(UpdateState.STATES.ERROR);
            this._state.error = UpdateState.buildErrorPayload(
                UpdateState.ERROR_CODES.INVALID_RESPONSE,
                "Ungültige Update-Antwort"
            );
            this._broadcastState();
            return;
        }

        // v1-Regel: alpha-Releases werden für Beta-User ignoriert.
        const filter = UpdateChannel.getAllowedPreReleaseFilter(this._state.channel);
        if (!filter(info)) {
            logger.info(`[Updater] Update wird ignoriert (Channel-Filter): ${info.version}`);
            this._setStatus(UpdateState.STATES.UP_TO_DATE);
            this._state.availableVersion = null;
            this._state.error = null;
            this._broadcastState();
            return;
        }

        this._cachedUpdateInfo = info;
        this._state.availableVersion = info.version;
        this._state.releaseNotesRaw = this._extractReleaseNotes(info);
        this._state.releaseNotes = this._state.releaseNotesRaw
            ? MarkdownSanitizer.sanitize(this._state.releaseNotesRaw)
            : null;
        this._state.releaseDate = info.releaseDate
            ? new Date(info.releaseDate).toISOString()
            : null;
        this._state.file = info.files && info.files[0] ? {
            url: info.files[0].url,
            size: info.files[0].size,
            sha512: info.files[0].sha512
        } : null;
        this._state.error = null;
        this._state.downloaded = false;
        this._state.lastCheck = new Date().toISOString();
        this._persistSetting(SETTING_KEYS.LAST_CHECK, this._state.lastCheck);

        this._setStatus(UpdateState.STATES.AVAILABLE);
        this._broadcastState();
        this._broadcastEvent("available", {
            version: info.version,
            releaseNotes: this._state.releaseNotes,
            releaseDate: this._state.releaseDate,
            channel: this._state.channel
        });

        // System-Notification nur einmal pro Version.
        this._maybeShowSystemNotification();
    }

    _handleNoUpdate(info) {
        this._state.availableVersion = null;
        this._state.downloaded = false;
        this._state.error = null;
        this._state.lastCheck = new Date().toISOString();
        this._persistSetting(SETTING_KEYS.LAST_CHECK, this._state.lastCheck);
        this._setStatus(UpdateState.STATES.UP_TO_DATE);
        this._broadcastState();
        this._broadcastEvent("not-available", {
            version: (info && info.version) || app.getVersion(),
            channel: this._state.channel
        });
    }

    _handleDownloaded(info) {
        this._state.availableVersion = info?.version || this._state.availableVersion;
        this._state.downloaded = true;
        this._state.progress = 1;
        this._state.transferredBytes = this._state.totalBytes;
        this._state.error = null;
        this._downloadedFile = info;
        this._setStatus(UpdateState.STATES.DOWNLOADED);
        this._broadcastState();
        this._broadcastEvent("downloaded", {
            version: info?.version,
            channel: this._state.channel
        });
    }

    _handleCheckResult(result) {
        // electron-updater liefert bei "kein Update" ein Objekt mit
        // updateInfo == null. In dem Fall war der Check erfolgreich,
        // nur ohne Treffer.
        if (!result) {
            this._setStatus(UpdateState.STATES.UP_TO_DATE);
            this._broadcastState();
            return this._buildCheckResult("up-to-date");
        }
        // Die _handleAvailableUpdate / _handleNoUpdate Listener
        // haben den State bereits korrekt gesetzt.
        if (this._state.status === UpdateState.STATES.AVAILABLE) {
            return this._buildCheckResult("available");
        }
        if (this._state.status === UpdateState.STATES.ERROR) {
            return this._buildCheckResult("error");
        }
        return this._buildCheckResult("up-to-date");
    }

    // ─────────────────────────────────────────────
    // Internal – Settings / Persistenz
    // ─────────────────────────────────────────────

    _readSettings() {
        try {
            const all = SettingsManager.get() || {};
            return {
                channel: all[SETTING_KEYS.CHANNEL],
                lastCheck: all[SETTING_KEYS.LAST_CHECK],
                lastNotified: all[SETTING_KEYS.LAST_NOTIFIED],
                autoCheck: all[SETTING_KEYS.AUTO_CHECK]
            };
        } catch (err) {
            logger.warn(`[Updater] Settings lesen fehlgeschlagen: ${err.message}`);
            return {};
        }
    }

    _persistSetting(key, value) {
        // In Test-Kontexten schreiben wir sofort synchron, um
        // Race-Conditions mit dem Debounce-Timer zu vermeiden.
        if (process.env.WEBRADIO_UPDATER_SYNC === "1" || !SETTINGS_DEBOUNCE_MS) {
            this._persistSettingSync(key, value);
            return;
        }
        if (this._settingsWriteTimer) {
            clearTimeout(this._settingsWriteTimer);
        }
        this._settingsWriteTimer = setTimeout(() => {
            try {
                const current = SettingsManager.get() || {};
                current[key] = value;
                SettingsManager.update(current);
            } catch (err) {
                logger.warn(`[Updater] Settings schreiben fehlgeschlagen: ${err.message}`);
            }
            this._settingsWriteTimer = null;
        }, SETTINGS_DEBOUNCE_MS);
    }

    /**
     * Hilfsmethode für Tests: erzwingt das sofortige Schreiben
     * aller ausstehenden Settings. Wird in dispose() und am Ende
     * des Persistenz-Tests verwendet.
     */
    _flushPendingSettingsWrite() {
        if (this._settingsWriteTimer) {
            clearTimeout(this._settingsWriteTimer);
            this._settingsWriteTimer = null;
        }
        // Schreibt alle aktuellen Update-bezogenen Settings sync.
        // Wird in Tests und dispose() verwendet, um Race-Conditions
        // mit dem Debounce-Timer zu vermeiden.
        this._persistSettingSync(SETTING_KEYS.CHANNEL, this._state.channel);
        this._persistSettingSync(SETTING_KEYS.LAST_NOTIFIED, this._state.lastNotifiedVersion);
        this._persistSettingSync(SETTING_KEYS.LAST_CHECK, this._state.lastCheck);
        this._persistSettingSync(SETTING_KEYS.AUTO_CHECK, this.getAutoCheck());
    }

    _persistSettingSync(key, value) {
        try {
            const current = SettingsManager.get() || {};
            current[key] = value;
            SettingsManager.update(current);
        } catch (err) {
            logger.warn(`[Updater] Settings schreiben (sync) fehlgeschlagen: ${err.message}`);
        }
    }

    _restoreLastNotified(settings) {
        if (settings.lastNotified && typeof settings.lastNotified === "string") {
            this._state.lastNotifiedVersion = settings.lastNotified;
        }
    }

    _shouldAutoCheck(settings) {
        if (settings.autoCheck === false) return false;
        return DEFAULT_AUTO_CHECK;
    }

    _resolveChannel(raw) {
        if (UpdateChannel.isValidChannel(raw)) return raw;
        // Default = stable
        return UpdateState.CHANNELS.STABLE;
    }

    _resetForChannelSwitch() {
        this._cachedUpdateInfo = null;
        this._downloadedFile = null;
        this._state.availableVersion = null;
        this._state.progress = 0;
        this._state.transferredBytes = 0;
        this._state.totalBytes = 0;
        this._state.releaseNotes = null;
        this._state.releaseNotesRaw = null;
        this._state.releaseDate = null;
        this._state.file = null;
        this._state.downloaded = false;
        this._state.error = null;
        this._setStatus(UpdateState.STATES.IDLE);
    }

    // ─────────────────────────────────────────────
    // Internal – Auto-Check Steuerung
    // ─────────────────────────────────────────────

    _maybeAutoCheck() {
        const now = Date.now();
        if (now - this._lastAutoCheckAt < RECHECK_INTERVAL_MS) {
            // innerhalb des 6h-Fensters -> kein erneuter Check
            return;
        }
        this._lastAutoCheckAt = now;
        // bewusst kein await – blockiert nicht den App-Start
        this.checkForUpdates().catch((err) => {
            logger.warn(`[Updater] Auto-Check Fehler: ${err.message}`);
        });
    }

    // ─────────────────────────────────────────────
    // Internal – System-Notification
    // ─────────────────────────────────────────────

    _maybeShowSystemNotification() {
        const version = this._state.availableVersion;
        if (!version) return;
        if (this._state.lastNotifiedVersion === version) return;
        if (!Notification || !Notification.isSupported || !Notification.isSupported()) {
            return;
        }

        try {
            const channelLabel = this._state.channel === UpdateState.CHANNELS.BETA
                ? "Beta" : "Stable";
            const n = new Notification({
                title: "WebRadio – Update verfügbar",
                body: `WebRadio ${version} (${channelLabel}) ist verfügbar.`,
                silent: false
            });
            n.show();
            this.markCurrentVersionAsNotified();
        } catch (err) {
            logger.warn(`[Updater] Notification fehlgeschlagen: ${err.message}`);
        }
    }

    // ─────────────────────────────────────────────
    // Internal – State-Management
    // ─────────────────────────────────────────────

    _setStatus(status) {
        this._state.status = status;
    }

    _buildCheckResult(kind) {
        const base = {
            status: kind,
            currentVersion: this._state.currentVersion || this.getCurrentVersion(),
            channel: this._state.channel
        };
        if (kind === "available") {
            return {
                ...base,
                version: this._state.availableVersion,
                releaseNotes: this._state.releaseNotes,
                releaseDate: this._state.releaseDate,
                downloaded: !!this._state.downloaded
            };
        }
        if (kind === "error") {
            return {
                ...base,
                error: this._state.error
            };
        }
        return base;
    }

    _buildErrorResult(code, message) {
        return {
            status: "error",
            error: UpdateState.buildErrorPayload(code, message)
        };
    }

    // ─────────────────────────────────────────────
    // Internal – Release-Notes Extraktion
    // ─────────────────────────────────────────────

    _extractReleaseNotes(info) {
        if (!info) return null;
        if (typeof info.releaseNotes === "string") return info.releaseNotes;
        if (Array.isArray(info.releaseNotes)) {
            // GitHub kann sprachspezifische Notes liefern.
            // Wir bevorzugen "de", dann "en", dann den ersten Eintrag.
            const de = info.releaseNotes.find((n) => n && n.language === "de");
            if (de && typeof de.note === "string") return de.note;
            const en = info.releaseNotes.find((n) => n && n.language === "en");
            if (en && typeof en.note === "string") return en.note;
            const first = info.releaseNotes[0];
            if (first && typeof first.note === "string") return first.note;
        }
        return null;
    }

    // ─────────────────────────────────────────────
    // Internal – Event Broadcasting
    // ─────────────────────────────────────────────

    _emit(event, data) {
        const set = this._listeners.get(event);
        if (!set) return;
        for (const cb of [...set]) {
            try {
                cb(data);
            } catch (err) {
                logger.warn(`[Updater] Listener-Fehler (${event}): ${err.message}`);
            }
        }
    }

    _broadcastState() {
        const snapshot = UpdateState.cloneState(this._state);
        this._emit("state-changed", snapshot);
        for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
                win.webContents.send("updates:state-changed", snapshot);
            }
        }
    }

    _broadcastEvent(event, data) {
        this._emit(event, data);
        for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
                win.webContents.send(`updates:${event}`, data);
            }
        }
    }
}

module.exports = new UpdateManager();
