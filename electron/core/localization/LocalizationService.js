"use strict";

const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");
const SettingsManager = require("../storage/SettingsManager");
const LogManager = require("../diagnostics/logging/LogManager");
const { LocalizationCatalogStore } = require("./LocalizationCatalogStore");
const { LocalizationManager } = require("./LocalizationManager");
const { createLocalizationAPI } = require("./LocalizationAPI");
const {
    SUPPORTED_LOCALES,
    SYSTEM_PREFERENCE,
    LANGUAGE_PREFERENCES,
    LANGUAGE_LABELS
} = require("./types");

const logger = LogManager.getLogger("Localization");

/**
 * Main-Prozess-Anbindung der Localization Engine.
 *
 * Zentrale Aufgaben:
 * - Kataloge ausschließlich aus `userData/localization/` laden
 *   (mitgelieferte Kataloge dienen nur der initialen Bereitstellung und
 *   kontrollierten Wiederherstellung).
 * - Gescopte APIs für Core, Plugins und Themes bereitstellen.
 * - Sprachwechsel persistieren und an alle Fenster melden.
 * - Plugin-/Theme-Kataloge provisionieren, aktualisieren und zurückrollen.
 */
class LocalizationService {
    constructor() {
        /** @type {LocalizationManager|null} */
        this._manager = null;
        /** @type {LocalizationCatalogStore|null} */
        this._store = null;
        /** @type {boolean} */
        this._initialized = false;
        /** @type {boolean} */
        this._bootstrapRegistered = false;
        /** @type {Map<string, Object>} */
        this._pluginApis = new Map();
    }

    get initialized() {
        return this._initialized;
    }

    /** @returns {LocalizationManager|null} */
    get manager() {
        return this._manager;
    }

    /** @returns {LocalizationCatalogStore|null} */
    get store() {
        return this._store;
    }

    /**
     * Initialisiert die Engine. Mehrfachaufrufe sind unschädlich.
     *
     * @returns {LocalizationManager}
     */
    initialize() {
        if (this._initialized && this._manager) return this._manager;

        const userDataPath = this.getUserDataPath();

        this._store = new LocalizationCatalogStore({
            userDataPath,
            bundledDir: path.join(__dirname, "locales"),
            onWarning: (message) => logger.warn(message)
        });

        // Initiale Bereitstellung bzw. kontrollierte Wiederherstellung.
        const ensured = this._store.ensureAppCatalogs(SUPPORTED_LOCALES);
        for (const error of ensured.errors) logger.warn(`Katalog-Bereitstellung: ${error}`);

        // Ab hier ist `userData` die einzige Laufzeitquelle.
        const { resources, errors } = this._store.loadAppCatalogs(SUPPORTED_LOCALES);
        for (const error of errors) logger.error(`Übersetzungsressource: ${error}`);

        if (!resources[SUPPORTED_LOCALES[0]]) {
            logger.error(
                "Keine Übersetzungsressourcen geladen – die Anwendung verwendet sichtbare Schlüssel als Fallback."
            );
        }

        const systemLocales = this.readSystemLocales();
        const stored = this.readStoredPreference();

        this._manager = new LocalizationManager({
            resources,
            fallbackLocale: "en-US",
            isDevelopment: this.isDevelopment(),
            onWarning: (message) => logger.warn(message),
            onMissingKey: (key, locale) => logger.warn(`Fehlender Übersetzungsschlüssel "${key}" (${locale})`)
        });

        this._manager.setPreference(stored.preference, systemLocales);
        this._initialized = true;

        this.registerBootstrapHandler();

        // Bereits provisionierte Plugin-/Theme-Kataloge aus `userData` laden.
        this.loadProvisionedCatalogs();

        logger.info(
            `Lokalisierung initialisiert: ${this._manager.locale} (Präferenz: ${this._manager.preference}, ` +
            `Systemsprache: ${this._manager.getState().systemLocale || "unbekannt"}, ` +
            `Quelle: ${this._store.root})`
        );

        return this._manager;
    }

    getUserDataPath() {
        try {
            return app.getPath("userData");
        } catch {
            // Tests/headless: Fallback auf ein temporäres Verzeichnis.
            return path.join(process.cwd(), ".tmp-userData");
        }
    }

    // ─────────────────────────────────────────────
    // APIs
    // ─────────────────────────────────────────────

    /**
     * Vollständige Core-API (Anwendung, Tray, native Dialoge).
     */
    createCoreAPI() {
        const manager = this._manager || this.initialize();
        return createLocalizationAPI({
            manager,
            scope: { type: "core" },
            onWarning: (message) => logger.warn(message)
        });
    }

    /**
     * Auf `plugin.<pluginId>.*` beschränkte API. Die Instanz wird je Plugin
     * zwischengespeichert, damit Listener beim Deaktivieren sauber entfernt
     * werden können.
     *
     * @param {string} pluginId
     */
    createPluginAPI(pluginId) {
        if (typeof pluginId !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(pluginId)) {
            throw new TypeError("Ungültige Plugin-ID für die Localization API");
        }
        const manager = this._manager || this.initialize();

        const existing = this._pluginApis.get(pluginId);
        if (existing) return existing;

        const api = createLocalizationAPI({
            manager,
            scope: { type: "plugin", id: pluginId },
            onWarning: (message) => logger.warn(`[plugin:${pluginId}] ${message}`)
        });
        this._pluginApis.set(pluginId, api);
        return api;
    }

    /**
     * Auf `theme.<themeId>.*` beschränkte API (Metadaten und künftige
     * Theme-Einstellungsoberflächen).
     *
     * @param {string} themeId
     */
    createThemeAPI(themeId) {
        if (typeof themeId !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(themeId)) {
            throw new TypeError("Ungültige Theme-ID für die Localization API");
        }
        const manager = this._manager || this.initialize();
        return createLocalizationAPI({
            manager,
            scope: { type: "theme", id: themeId },
            onWarning: (message) => logger.warn(`[theme:${themeId}] ${message}`)
        });
    }

    /** Entfernt die zwischengespeicherte Plugin-API und ihre Listener. */
    disposePluginAPI(pluginId) {
        const api = this._pluginApis.get(pluginId);
        if (!api) return false;
        api.dispose();
        this._pluginApis.delete(pluginId);
        return true;
    }

    // ─────────────────────────────────────────────
    // Übersetzen
    // ─────────────────────────────────────────────

    /**
     * @param {string} key
     * @param {Record<string, unknown>} [params]
     * @returns {string}
     */
    t(key, params) {
        if (!this._manager) this.initialize();
        return this._manager.t(key, params);
    }

    formatDate(value, options) {
        return (this._manager || this.initialize()).formatDate(value, options);
    }

    formatNumber(value, options) {
        return (this._manager || this.initialize()).formatNumber(value, options);
    }

    formatCurrency(value, currency, options) {
        return (this._manager || this.initialize()).formatCurrency(value, currency, options);
    }

    formatRelativeTime(value, unit, options) {
        return (this._manager || this.initialize()).formatRelativeTime(value, unit, options);
    }

    /**
     * Sprachzustand für den Renderer und die Einstellungen.
     *
     * @returns {Object}
     */
    getState() {
        const manager = this._manager || this.initialize();
        const state = manager.getState();

        return {
            ok: true,
            locale: state.locale,
            preference: state.preference,
            systemLocale: state.systemLocale,
            supported: [...state.supported],
            fallbackLocale: state.fallbackLocale,
            pluginIds: manager.getPluginIds(),
            themeIds: manager.getThemeIds(),
            languages: state.supported.map((id) => ({ id, label: LANGUAGE_LABELS[id] || id }))
        };
    }

    /**
     * Synchroner Bootstrap für das Preload: Kataloge und Zustand stehen fest,
     * bevor das Renderer-Skript läuft. Damit gibt es keine zweite
     * Katalogquelle im Renderer und kein Aufblitzen von Schlüsseln.
     */
    getBootstrap() {
        const manager = this._manager || this.initialize();
        return {
            ok: true,
            state: this.getState(),
            catalogs: manager.getAppCatalogs()
        };
    }

    /**
     * Registriert den synchronen Bootstrap-Kanal. Wird vor dem ersten Fenster
     * aufgerufen, damit das Preload ihn sicher nutzen kann.
     */
    registerBootstrapHandler() {
        if (this._bootstrapRegistered) return;
        try {
            ipcMain.on("localization:bootstrap", (event) => {
                try {
                    event.returnValue = this.getBootstrap();
                } catch (error) {
                    logger.error(`localization:bootstrap fehlgeschlagen: ${error.message}`);
                    event.returnValue = { ok: false, error: "bootstrap-unavailable" };
                }
            });
            this._bootstrapRegistered = true;
        } catch (error) {
            logger.warn(`Bootstrap-Kanal konnte nicht registriert werden: ${error.message}`);
        }
    }

    // ─────────────────────────────────────────────
    // Sprache wechseln
    // ─────────────────────────────────────────────

    /**
     * @param {unknown} preference
     * @returns {{ok: boolean, locale?: string, preference?: string, error?: string}}
     */
    setLanguage(preference) {
        const manager = this._manager || this.initialize();

        if (typeof preference !== "string" || !LANGUAGE_PREFERENCES.includes(preference)) {
            logger.warn(`Ungültige Sprachpräferenz abgelehnt: ${String(preference)}`);
            return { ok: false, error: "invalid-preference" };
        }

        const previous = manager.preference;
        const result = manager.setPreference(preference, this.readSystemLocales());

        if (!result.ok) {
            return { ok: false, error: result.reason || "apply-failed" };
        }

        try {
            SettingsManager.update({ language: manager.preference });
        } catch (err) {
            logger.error(`Spracheinstellung konnte nicht gespeichert werden: ${err.message}`);
            manager.setPreference(previous, this.readSystemLocales());
            return { ok: false, error: "persist-failed" };
        }

        this.rebuildTrayMenu();
        this.broadcast();

        logger.info(`Sprache geändert: ${manager.locale} (Präferenz: ${manager.preference})`);

        return { ok: true, locale: manager.locale, preference: manager.preference };
    }

    refreshSystemLocale() {
        const manager = this._manager || this.initialize();
        const changed = manager.refreshSystemLocale(this.readSystemLocales());
        if (changed) {
            this.rebuildTrayMenu();
            this.broadcast();
        }
        return changed;
    }

    // ─────────────────────────────────────────────
    // Plugin-Kataloge
    // ─────────────────────────────────────────────

    /**
     * Provisioniert die im Manifest deklarierten Plugin-Kataloge in
     * `userData/localization/plugins/<id>/` und registriert sie. Unveränderte
     * Kataloge werden nicht neu geschrieben (kein Backup-Wildwuchs).
     *
     * @param {string} pluginId
     * @param {unknown} localization
     * @returns {{ok:boolean, errors?:string[], backupPath?:string|null, keyCount?:number}}
     */
    provisionPluginCatalogs(pluginId, localization) {
        const manager = this._manager || this.initialize();
        if (localization === undefined || localization === null) {
            return { ok: true, skipped: true };
        }

        const { validatePluginLocalization } = require("./PluginLocalization");
        const validation = validatePluginLocalization(pluginId, localization);
        if (!validation.valid) {
            logger.warn(`Plugin-Lokalisierung abgelehnt (${pluginId}): ${validation.errors.join("; ")}`);
            return { ok: false, errors: validation.errors };
        }

        const current = this._store.readPluginCatalogs(pluginId);
        const unchanged = current && JSON.stringify(current) === JSON.stringify(validation.catalogs);

        let backupPath = null;
        if (!unchanged) {
            const written = this._store.provisionPlugin(pluginId, localization);
            if (!written.ok) {
                logger.warn(`Plugin-Kataloge konnten nicht geschrieben werden (${pluginId}): ${written.message}`);
                return { ok: false, errors: [written.message] };
            }
            backupPath = written.backupPath || null;
        }

        const registered = manager.registerPluginTranslations(pluginId, validation.catalogs);
        if (!registered.ok) {
            return { ok: false, errors: registered.errors };
        }

        this.broadcast();
        return {
            ok: true,
            backupPath,
            keyCount: validation.keyCount,
            unchanged: Boolean(unchanged)
        };
    }

    /**
     * Lädt die Kataloge eines Plugins ausschließlich aus `userData`.
     *
     * @param {string} pluginId
     * @returns {boolean}
     */
    loadPluginCatalogsFromStore(pluginId) {
        const manager = this._manager || this.initialize();
        const catalogs = this._store.readPluginCatalogs(pluginId);
        if (!catalogs) {
            manager.unregisterPluginTranslations(pluginId);
            return false;
        }
        const result = manager.registerPluginTranslations(pluginId, catalogs);
        return result.ok;
    }

    /**
     * Entfernt die Kataloge eines Plugins kontrolliert (Deinstallation oder
     * endgültiges Entfernen).
     *
     * @param {string} pluginId
     */
    removePluginCatalogs(pluginId) {
        const manager = this._manager || this.initialize();
        const removed = this._store.removePlugin(pluginId);
        manager.unregisterPluginTranslations(pluginId);
        this.disposePluginAPI(pluginId);
        this.broadcast();
        return removed;
    }

    /**
     * Stellt einen vorherigen Katalogzustand wieder her (Rollback).
     *
     * @param {string} pluginId
     * @param {string|null} backupPath
     */
    restorePluginCatalogs(pluginId, backupPath) {
        const manager = this._manager || this.initialize();
        const result = this._store.restorePlugin(pluginId, backupPath);
        if (result.ok) {
            this.loadPluginCatalogsFromStore(pluginId);
            this.broadcast();
        }
        return result;
    }

    /**
     * Entfernt Plugin-Kataloge mit Backup (für Versionen ohne Übersetzungen).
     *
     * @param {string} pluginId
     */
    clearPluginCatalogs(pluginId) {
        const manager = this._manager || this.initialize();
        const result = this._store.clearPlugin(pluginId);
        if (result.ok) {
            manager.unregisterPluginTranslations(pluginId);
            this.broadcast();
        }
        return result;
    }

    /**
     * @param {string} pluginId
     * @returns {Record<string, string>|null}
     */
    getPluginTranslations(pluginId) {
        const manager = this._manager || this.initialize();
        return manager.getPluginTranslations(pluginId);
    }

    /**
     * @param {string} pluginId
     * @returns {Record<string, Record<string, unknown>>|null}
     */
    getPluginCatalogs(pluginId) {
        const manager = this._manager || this.initialize();
        return manager.getPluginCatalogSet(pluginId);
    }

    /** @deprecated Kompatibilitätsname; Provisionierung erfolgt über den Store. */
    registerPluginTranslations(pluginId, catalogs) {
        return this.provisionPluginCatalogs(pluginId, catalogs);
    }

    // ─────────────────────────────────────────────
    // Theme-Kataloge (nur Metadaten)
    // ─────────────────────────────────────────────

    /**
     * Provisioniert Theme-Metadaten (`name`, `description`, optional
     * `settings`/`help`) aus `theme.json` in `userData/localization/themes/`.
     *
     * @param {string} themeId
     * @param {unknown} localization
     */
    provisionThemeCatalogs(themeId, localization) {
        const manager = this._manager || this.initialize();
        if (localization === undefined || localization === null) {
            return { ok: true, skipped: true };
        }

        const { validatePluginLocalization } = require("./PluginLocalization");
        const validation = validatePluginLocalization(themeId, localization);
        if (!validation.valid) {
            logger.warn(`Theme-Lokalisierung abgelehnt (${themeId}): ${validation.errors.join("; ")}`);
            return { ok: false, errors: validation.errors };
        }

        const current = this._store.readThemeCatalogs(themeId);
        const unchanged = current && JSON.stringify(current) === JSON.stringify(validation.catalogs);
        if (!unchanged) {
            const written = this._store.provisionTheme(themeId, localization);
            if (!written.ok) {
                return { ok: false, errors: [written.message] };
            }
        }

        const registered = manager.registerThemeTranslations(themeId, validation.catalogs);
        if (!registered.ok) return { ok: false, errors: registered.errors };

        this.broadcast();
        return { ok: true, keyCount: validation.keyCount, unchanged: Boolean(unchanged) };
    }

    /**
     * Lädt Theme-Metadaten ausschließlich aus `userData`.
     *
     * @param {string} themeId
     */
    loadThemeCatalogsFromStore(themeId) {
        const manager = this._manager || this.initialize();
        const catalogs = this._store.readThemeCatalogs(themeId);
        if (!catalogs) {
            manager.unregisterThemeTranslations(themeId);
            return false;
        }
        return manager.registerThemeTranslations(themeId, catalogs).ok;
    }

    /**
     * Lokalisierte Metadaten eines Themes für die aktive Sprache.
     *
     * @param {string} themeId
     * @param {{name?: string, description?: string}} fallback
     */
    getThemeMetadata(themeId, fallback) {
        const manager = this._manager || this.initialize();
        return manager.getThemeMetadata(themeId, fallback);
    }

    /**
     * Liefert die Theme-Kataloge für den Renderer (reine Daten).
     *
     * @param {string} themeId
     * @returns {object|null}
     */
    getThemeCatalogs(themeId) {
        const manager = this._manager || this.initialize();
        return manager.getThemeCatalogSet(themeId);
    }

    /** Entfernt Theme-Kataloge kontrolliert. */
    removeThemeCatalogs(themeId) {
        const manager = this._manager || this.initialize();
        const removed = this._store.removeTheme(themeId);
        manager.unregisterThemeTranslations(themeId);
        this.broadcast();
        return removed;
    }

    /**
     * Lädt alle bereits provisionierten Plugin- und Theme-Kataloge aus
     * `userData`. Wird beim Start und nach einem Katalog-Reload aufgerufen.
     */
    loadProvisionedCatalogs() {
        if (!this._store) return;
        for (const pluginId of this._store.listPluginIds()) {
            this.loadPluginCatalogsFromStore(pluginId);
        }
    }

    // ─────────────────────────────────────────────
    // Broadcast / Diagnose
    // ─────────────────────────────────────────────

    broadcast() {
        if (!this._manager) return;
        if (!BrowserWindow || typeof BrowserWindow.getAllWindows !== "function") return;
        const state = this.getState();

        for (const window of BrowserWindow.getAllWindows()) {
            if (window.isDestroyed()) continue;
            try {
                window.webContents.send("localization:changed", state);
            } catch (err) {
                logger.warn(`Lokalisierungs-Update konnte nicht gesendet werden: ${err.message}`);
            }
        }
    }

    rebuildTrayMenu() {
        try {
            const { refreshTrayMenu } = require("../system/tray");
            if (typeof refreshTrayMenu === "function") refreshTrayMenu();
        } catch (err) {
            logger.warn(`Tray-Menü konnte nicht aktualisiert werden: ${err.message}`);
        }
    }

    // ─────────────────────────────────────────────
    // Interne Helfer
    // ─────────────────────────────────────────────

    readSystemLocales() {
        const locales = [];

        try {
            if (app && typeof app.getPreferredSystemLanguages === "function") {
                locales.push(...app.getPreferredSystemLanguages());
            }
        } catch (err) {
            logger.warn(`Systemsprachen konnten nicht gelesen werden: ${err.message}`);
        }

        try {
            if (locales.length === 0 && app && typeof app.getLocale === "function") {
                locales.push(app.getLocale());
            }
        } catch (err) {
            logger.warn(`System-Locale konnte nicht gelesen werden: ${err.message}`);
        }

        if (locales.length === 0) {
            if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
                locales.push(Intl.DateTimeFormat().resolvedOptions().locale);
            }
        }

        return locales.filter((locale) => typeof locale === "string" && locale.trim() !== "");
    }

    readStoredPreference() {
        let raw;
        try {
            const settings = SettingsManager.get();
            raw = settings ? settings.language : undefined;
        } catch (err) {
            logger.warn(`Einstellungen konnten nicht gelesen werden: ${err.message}`);
        }

        if (LANGUAGE_PREFERENCES.includes(raw)) {
            return { preference: raw, raw };
        }

        if (raw !== undefined && raw !== null) {
            logger.warn(`Ungültige gespeicherte Sprache "${String(raw)}" – Systemstandard wird verwendet.`);
        }

        return { preference: SYSTEM_PREFERENCE, raw };
    }

    isDevelopment() {
        try {
            return Boolean(app && typeof app.isPackaged === "boolean" && !app.isPackaged);
        } catch {
            return false;
        }
    }

    /**
     * Für Tests: Zustand vollständig zurücksetzen.
     */
    reset() {
        for (const api of this._pluginApis.values()) api.dispose();
        this._pluginApis.clear();
        this._manager = null;
        this._store = null;
        this._initialized = false;
        this._bootstrapRegistered = false;
    }
}

module.exports = new LocalizationService();
module.exports.LocalizationService = LocalizationService;
