"use strict";

const { TranslationResolver, lookup } = require("./TranslationResolver");
const { LocaleFormatter } = require("./LocaleFormatter");
const { normalizeLocale, matchSupported, resolvePreference } = require("./LanguageDetector");
const {
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
    FALLBACK_LOCALE,
    SYSTEM_PREFERENCE,
    LANGUAGE_PREFERENCES
} = require("./types");

/**
 * Zentrale Verwaltung der aktiven Sprache.
 *
 * Der Manager ist bewusst frei von Electron-, Dateisystem- und
 * React-Abhängigkeiten: Main-Prozess und Renderer verwenden dieselbe Klasse,
 * nur die Herkunft der Übersetzungskataloge (Datei vs. gebündeltes JSON)
 * und die Persistenz unterscheiden sich.
 */
class LocalizationManager {
    /**
     * @param {Object} options
     * @param {Record<string, Record<string, unknown>>} options.resources Kataloge je Sprache
     * @param {string} [options.locale] aktive Sprache
     * @param {string} [options.preference] gespeicherte Präferenz
     * @param {string|null} [options.systemLocale]
     * @param {string} [options.fallbackLocale]
     * @param {boolean} [options.isDevelopment]
     * @param {(key: string, locale: string) => void} [options.onMissingKey]
     * @param {(message: string) => void} [options.onWarning]
     */
    constructor({
        resources = {},
        locale = DEFAULT_LOCALE,
        preference = SYSTEM_PREFERENCE,
        systemLocale = null,
        fallbackLocale = FALLBACK_LOCALE,
        isDevelopment = false,
        onMissingKey = null,
        onWarning = null
    } = {}) {
        this._resources = { ...resources };
        this._fallbackLocale = fallbackLocale;
        this._supported = Object.keys(this._resources).length > 0
            ? Object.keys(this._resources)
            : [...SUPPORTED_LOCALES];
        this._locale = this._normalizeActiveLocale(locale);
        this._preference = preference;
        this._systemLocale = systemLocale;
        this._isDevelopment = Boolean(isDevelopment);
        this._listeners = new Set();
        this._pluginCatalogs = new Map();
        this._themeCatalogs = new Map();
        this._onMissingKey = onMissingKey;
        this._onWarning = onWarning;

        this._resolver = new TranslationResolver({
            resources: this._resources,
            fallbackLocale: this._fallbackLocale,
            onMissing: (key, missingLocale) => this._handleMissing(key, missingLocale),
            onWarning: (message) => this._warn(message)
        });

        this._formatter = new LocaleFormatter(this._locale);
        this._state = this._buildState();
    }

    // ─────────────────────────────────────────────
    // Zustand
    // ─────────────────────────────────────────────

    get locale() {
        return this._locale;
    }

    get preference() {
        return this._preference;
    }

    get supportedLocales() {
        return [...this._supported];
    }

    get fallbackLocale() {
        return this._fallbackLocale;
    }

    get formatter() {
        return this._formatter;
    }

    /**
     * Stabiler Zustandsschnappschuss für `useSyncExternalStore`: Das Objekt
     * bleibt bis zur nächsten Änderung identisch, damit React nicht bei jedem
     * Aufruf neu rendert.
     *
     * @returns {import('./types').LocalizationState}
     */
    getSnapshot() {
        return this._state;
    }

    getState() {
        return this._state;
    }

    _buildState() {
        return Object.freeze({
            locale: this._locale,
            preference: this._preference,
            systemLocale: this._systemLocale,
            supported: [...this._supported],
            fallbackLocale: this._fallbackLocale
        });
    }

    _emitChange() {
        this._state = this._buildState();
        for (const listener of this._listeners) {
            try {
                listener(this._state);
            } catch (err) {
                this._warn(`Localization-Listener fehlgeschlagen: ${err && err.message ? err.message : err}`);
            }
        }
    }

    /**
     * @param {(state: import('./types').LocalizationState) => void} listener
     * @returns {() => void} Unsubscribe
     */
    subscribe(listener) {
        if (typeof listener !== "function") {
            throw new TypeError("LocalizationManager.subscribe erwartet eine Funktion");
        }
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    // ─────────────────────────────────────────────
    // Übersetzen
    // ─────────────────────────────────────────────

    /**
     * Übersetzung für einen Schlüssel.
     *
     * Reihenfolge: aktive Sprache → Rückfallsprache → Schlüssel selbst.
     * Der Schlüssel als Rückfall ist bewusst sichtbar (kein leerer Text,
     * kein stiller Fehler) und wird protokolliert.
     *
     * @param {import('./types').TranslationKey} key
     * @param {import('./types').TranslationParams} [params]
     * @returns {string}
     */
    t(key, params) {
        if (typeof key !== "string" || key === "") {
            this._warn("t() wurde ohne gültigen Schlüssel aufgerufen");
            return "";
        }

        if (key.startsWith("plugin.")) {
            const pluginText = this._resolveNamespacedKey(this._pluginCatalogs, key, params);
            if (pluginText !== undefined) return pluginText;
            this._handleMissing(key, this._locale, true);
            return key;
        }

        if (key.startsWith("theme.")) {
            const themeText = this._resolveNamespacedKey(this._themeCatalogs, key, params);
            if (themeText !== undefined) return themeText;
            this._handleMissing(key, this._locale, true);
            return key;
        }

        return this._resolver.resolve(this._locale, key, params);
    }

    /**
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        if (typeof key !== "string") return false;
        if (key.startsWith("plugin.")) {
            return this._resolveNamespacedKey(this._pluginCatalogs, key, undefined) !== undefined;
        }
        if (key.startsWith("theme.")) {
            return this._resolveNamespacedKey(this._themeCatalogs, key, undefined) !== undefined;
        }
        return this._resolver.has(this._locale, key);
    }

    /**
     * Liefert die Rohkataloge (nur lesend zu verwenden).
     *
     * @returns {Record<string, Record<string, unknown>>}
     */
    getResources() {
        return this._resources;
    }

    /**
     * Ersetzt die Anwendungskataloge zur Laufzeit (nach einem kontrollierten
     * Neuladen aus `userData`). Plugin- und Theme-Namensräume bleiben
     * unberührt.
     *
     * @param {Record<string, Record<string, unknown>>} resources
     * @returns {boolean} true, wenn sich etwas geändert hat
     */
    setResources(resources) {
        if (!resources || typeof resources !== "object") return false;
        const next = { ...resources };
        const nextSupported = Object.keys(next);
        if (nextSupported.length === 0) return false;

        if (JSON.stringify(next) === JSON.stringify(this._resources)) return false;

        this._resources = next;
        this._supported = nextSupported;
        this._resolver = new TranslationResolver({
            resources: this._resources,
            fallbackLocale: this._fallbackLocale,
            onMissing: (key, missingLocale) => this._handleMissing(key, missingLocale),
            onWarning: (message) => this._warn(message)
        });
        this._locale = this._normalizeActiveLocale(this._locale);
        this._formatter.setLocale(this._locale);
        this._emitChange();
        return true;
    }

    /**
     * Tiefe Kopie aller Anwendungskataloge (für den Renderer-Bootstrap).
     *
     * @returns {Record<string, Record<string, unknown>>}
     */
    getAppCatalogs() {
        return JSON.parse(JSON.stringify(this._resources));
    }

    // ─────────────────────────────────────────────
    // Sprache wechseln
    // ─────────────────────────────────────────────

    /**
     * Aktive Sprache setzen. Ungültige oder nicht unterstützte Sprachen
     * werden abgelehnt (`false`), der bisherige Zustand bleibt erhalten.
     *
     * @param {string} locale
     * @returns {boolean} true, wenn die Sprache übernommen wurde
     */
    setLocale(locale) {
        // Nur exakt unterstützte Sprachen (bzw. deren Regionen) sind gültig.
        // Eine unbekannte Sprache wird nie stillschweigend ersetzt.
        const next = matchSupported(locale, this._supported);
        if (!next) {
            this._warn(`Nicht unterstützte Sprache angefordert: ${String(locale)}`);
            return false;
        }

        if (next === this._locale) return false;

        this._locale = next;
        this._formatter.setLocale(next);
        this._resolver.resetReports();
        this._emitChange();
        return true;
    }

    /**
     * Gespeicherte Präferenz setzen und daraus die aktive Sprache ableiten.
     *
     * @param {string} preference "system" oder eine unterstützte Sprache
     * @param {unknown[]} [systemLocales] Systemsprachen für "system"
     * @returns {{ok: boolean, locale: string, preference: string, reason?: string}}
     */
    setPreference(preference, systemLocales = this._systemLocale) {
        if (!LANGUAGE_PREFERENCES.includes(preference)) {
            this._warn(`Ungültige Sprachpräferenz abgelehnt: ${String(preference)}`);
            return {
                ok: false,
                locale: this._locale,
                preference: this._preference,
                reason: "invalid-preference"
            };
        }

        const resolved = resolvePreference(preference, systemLocales, {
            supported: this._supported,
            defaultLocale: this._fallbackLocale
        });

        const changedPreference = resolved.preference !== this._preference;
        const changedLocale = resolved.locale !== this._locale;
        const changedSystemLocale = resolved.systemLocale !== this._systemLocale;

        this._preference = resolved.preference;
        this._systemLocale = resolved.systemLocale;

        if (changedLocale) {
            this._locale = resolved.locale;
            this._formatter.setLocale(resolved.locale);
            this._resolver.resetReports();
        }

        // Auch eine reine Änderung der erkannten Systemsprache muss den
        // Zustandsschnappschuss erneuern, sonst zeigt die UI veraltete Werte.
        if (changedLocale || changedPreference || changedSystemLocale) {
            this._emitChange();
        }

        return { ok: true, locale: this._locale, preference: this._preference };
    }

    /**
     * Zustand von außen übernehmen (z. B. Broadcast des Main-Prozesses),
     * ohne zu persistieren oder einen IPC-Aufruf auszulösen.
     *
     * @param {{locale?: string, preference?: string, systemLocale?: string|null}} state
     * @returns {boolean} true, wenn sich etwas geändert hat
     */
    syncState(state = {}) {
        let changed = false;

        if (typeof state.preference === "string" && state.preference !== this._preference) {
            this._preference = state.preference;
            changed = true;
        }

        if (typeof state.systemLocale === "string" && state.systemLocale !== this._systemLocale) {
            this._systemLocale = state.systemLocale;
            changed = true;
        }

        if (typeof state.locale === "string" && state.locale !== this._locale) {
            const next = this._normalizeActiveLocale(state.locale);
            if (next !== this._locale) {
                this._locale = next;
                this._formatter.setLocale(next);
                this._resolver.resetReports();
                changed = true;
            }
        }

        if (changed) this._emitChange();
        return changed;
    }

    /**
     * Systemsprache neu auswerten (nur wirksam bei Präferenz "system").
     *
     * @param {unknown[]} systemLocales
     * @returns {boolean} true, wenn sich die aktive Sprache geändert hat
     */
    refreshSystemLocale(systemLocales) {
        this._systemLocale = normalizeLocale(
            Array.isArray(systemLocales) ? systemLocales[0] : systemLocales
        );

        const previous = this._locale;
        const resolved = resolvePreference(this._preference, systemLocales, {
            supported: this._supported,
            defaultLocale: this._fallbackLocale
        });

        if (resolved.preference === this._preference && resolved.locale !== this._locale) {
            this._locale = resolved.locale;
            this._formatter.setLocale(resolved.locale);
            this._resolver.resetReports();
        }

        if (this._locale !== previous || this._state.systemLocale !== this._systemLocale) {
            this._emitChange();
            return this._locale !== previous;
        }

        return false;
    }

    _normalizeActiveLocale(locale) {
        if (typeof locale === "string" && this._supported.includes(locale)) {
            return locale;
        }
        const matched = matchSupported(locale, this._supported);
        if (matched) return matched;
        return this._supported.includes(this._fallbackLocale) ? this._fallbackLocale : this._supported[0];
    }

    // ─────────────────────────────────────────────
    // Formatierung
    // ─────────────────────────────────────────────

    formatDate(value, options) {
        return this._formatter.formatDate(value, options);
    }

    formatTime(value, options) {
        return this._formatter.formatTime(value, options);
    }

    formatDateTime(value, options) {
        return this._formatter.formatDateTime(value, options);
    }

    formatNumber(value, options) {
        return this._formatter.formatNumber(value, options);
    }

    formatCurrency(value, currency, options) {
        return this._formatter.formatCurrency(value, currency, options);
    }

    formatPercent(value, options) {
        return this._formatter.formatPercent(value, options);
    }

    formatRelativeTime(value, unit, options) {
        return this._formatter.formatRelativeTime(value, unit, options);
    }

    formatRelativeFromNow(value, now) {
        return this._formatter.formatRelativeFromNow(value, now);
    }

    // ─────────────────────────────────────────────
    // Plugin-Übersetzungen
    // ─────────────────────────────────────────────

    /**
     * Übersetzungsressourcen eines Plugins registrieren.
     *
     * Plugin-Schlüssel liegen immer unter `plugin.<pluginId>.…` und können
     * Anwendungstexte daher nicht überschreiben. Die Registrierung ersetzt
     * vorhandene Ressourcen desselben Plugins (Reload).
     *
     * @param {string} pluginId
     * @param {Record<string, Record<string, unknown>>} catalogs Kataloge je Sprache
     * @returns {{ok: boolean, errors: string[], keyCount: number}}
     */
    registerPluginTranslations(pluginId, catalogs) {
        const { validatePluginLocalization } = require("./PluginLocalization");
        const validation = validatePluginLocalization(pluginId, catalogs);
        if (!validation.valid) {
            return { ok: false, errors: validation.errors, keyCount: 0 };
        }

        // Unveränderte Kataloge lösen kein Re-Render aus (Broadcast-Sync).
        const existing = this._pluginCatalogs.get(pluginId);
        if (existing && JSON.stringify(existing) === JSON.stringify(validation.catalogs)) {
            return { ok: true, errors: [], keyCount: validation.keyCount };
        }

        this._pluginCatalogs.set(pluginId, validation.catalogs);

        if (this._state.locale) {
            // Ein Sprachwechsel ist nicht nötig, aber bereits gerenderte
            // Plugin-Texte sollen sofort neu aufgelöst werden.
            this._emitChange();
        }

        return { ok: true, errors: [], keyCount: validation.keyCount };
    }

    /**
     * @param {string} pluginId
     * @returns {boolean}
     */
    unregisterPluginTranslations(pluginId) {
        return this._pluginCatalogs.delete(pluginId);
    }

    /**
     * @param {string} pluginId
     * @returns {boolean}
     */
    hasPluginTranslations(pluginId) {
        return this._pluginCatalogs.has(pluginId);
    }

    /**
     * IDs aller Plugins mit registrierten Übersetzungen.
     *
     * @returns {string[]}
     */
    getPluginIds() {
        return [...this._pluginCatalogs.keys()];
    }

    /**
     * Rohkataloge eines Plugins (Daten, kein aufgelöster Text). Wird für die
     * Übertragung an den Renderer benötigt, damit dieser dieselben Texte
     * ohne eigenen Dateizugriff auflösen kann.
     *
     * @param {string} pluginId
     * @returns {Record<string, Record<string, unknown>>|null}
     */
    getPluginCatalogSet(pluginId) {
        const catalogs = this._pluginCatalogs.get(pluginId);
        if (!catalogs) return null;
        return JSON.parse(JSON.stringify(catalogs));
    }

    /**
     * Aufgelöste Übersetzungen eines Plugins für die aktive Sprache.
     *
     * Rückgabe ist absichtlich auf die Schlüssel des Plugins beschränkt –
     * Plugins erhalten keinen Zugriff auf Anwendungstexte.
     *
     * @param {string} pluginId
     * @param {string} [locale]
     * @returns {Record<string, string>|null}
     */
    getPluginTranslations(pluginId, locale = this._locale) {
        const catalog = this._pluginCatalogs.get(pluginId);
        if (!catalog) return null;

        const effectiveLocale = catalog[locale]
            ? locale
            : (catalog[this._fallbackLocale] ? this._fallbackLocale : null);
        if (!effectiveLocale) return null;

        /** @type {Record<string, string>} */
        const flat = {};
        flattenInto(catalog[effectiveLocale], "", flat);
        return flat;
    }

    /**
     * Löst einen Schlüssel innerhalb eines Namensraums (`plugin.*` oder
     * `theme.*`) auf. Der Namensraum wird ausschließlich aus dem Schlüssel
     * selbst bestimmt – Aufrufer können keinen fremden Katalog wählen.
     *
     * @param {Map<string, Record<string, Record<string, unknown>>>} catalogs
     * @param {string} key
     * @param {Record<string, unknown>|undefined} params
     * @returns {string|undefined}
     */
    _resolveNamespacedKey(catalogs, key, params) {
        const [, namespaceId, ...rest] = key.split(".");
        if (!namespaceId || rest.length === 0) return undefined;

        const catalog = catalogs.get(namespaceId);
        if (!catalog) return undefined;

        const locale = catalog[this._locale] ? this._locale : this._fallbackLocale;
        const raw = lookup(catalog[locale], rest.join("."));
        if (raw === undefined) return undefined;

        const { interpolate } = require("./TranslationResolver");
        return interpolate(raw, params, (message) => this._warn(message));
    }

    // ─────────────────────────────────────────────
    // Theme-Übersetzungen (nur Metadaten)
    // ─────────────────────────────────────────────

    /**
     * Registriert Theme-Metadaten unter `theme.<themeId>.*`. Themes erhalten
     * niemals Zugriff auf Anwendungs- oder Plugin-Texte.
     *
     * @param {string} themeId
     * @param {Record<string, Record<string, unknown>>} catalogs
     * @returns {{ok: boolean, errors: string[], keyCount: number}}
     */
    registerThemeTranslations(themeId, catalogs) {
        const { validatePluginLocalization } = require("./PluginLocalization");
        const validation = validatePluginLocalization(themeId, catalogs);
        if (!validation.valid) {
            return { ok: false, errors: validation.errors, keyCount: 0 };
        }

        const existing = this._themeCatalogs.get(themeId);
        if (existing && JSON.stringify(existing) === JSON.stringify(validation.catalogs)) {
            return { ok: true, errors: [], keyCount: validation.keyCount };
        }

        this._themeCatalogs.set(themeId, validation.catalogs);
        this._emitChange();
        return { ok: true, errors: [], keyCount: validation.keyCount };
    }

    /** @param {string} themeId */
    unregisterThemeTranslations(themeId) {
        return this._themeCatalogs.delete(themeId);
    }

    /** @param {string} themeId */
    hasThemeTranslations(themeId) {
        return this._themeCatalogs.has(themeId);
    }

    /** @returns {string[]} */
    getThemeIds() {
        return [...this._themeCatalogs.keys()];
    }

    /**
     * @param {string} themeId
     * @returns {Record<string, Record<string, unknown>>|null}
     */
    getThemeCatalogSet(themeId) {
        const catalogs = this._themeCatalogs.get(themeId);
        return catalogs ? JSON.parse(JSON.stringify(catalogs)) : null;
    }

    /**
     * Lokalisierte Theme-Metadaten. Fehlt ein Katalog oder ein Feld, bleibt
     * der Manifest-Wert sichtbar – es wird nie ein leerer Name angezeigt.
     *
     * @param {string} themeId
     * @param {{name?: string, description?: string}} fallback
     * @returns {{name: string, description: string, settings: Record<string, unknown>|null}}
     */
    getThemeMetadata(themeId, fallback = {}) {
        const catalogs = this._themeCatalogs.get(themeId);
        const result = {
            name: typeof fallback.name === "string" ? fallback.name : "",
            description: typeof fallback.description === "string" ? fallback.description : "",
            settings: null
        };
        if (!catalogs) return result;

        const locale = catalogs[this._locale] ? this._locale : this._fallbackLocale;
        const catalog = catalogs[locale];
        if (!catalog) return result;

        if (typeof catalog.name === "string" && catalog.name.trim() !== "") {
            result.name = catalog.name;
        }
        if (typeof catalog.description === "string" && catalog.description.trim() !== "") {
            result.description = catalog.description;
        }
        if (catalog.settings && typeof catalog.settings === "object" && !Array.isArray(catalog.settings)) {
            result.settings = JSON.parse(JSON.stringify(catalog.settings));
        }
        return result;
    }

    // ─────────────────────────────────────────────
    // Diagnose
    // ─────────────────────────────────────────────

    _handleMissing(key, locale, isPlugin = false) {
        const message = isPlugin
            ? `Fehlende Plugin-Übersetzung: "${key}" (${locale})`
            : `Fehlende Übersetzung: "${key}" (${locale})`;

        if (this._isDevelopment) {
            this._warn(message);
        } else if (this._onWarning) {
            // Im Produktivbetrieb nicht spammen: der Resolver meldet jeden
            // fehlenden Schlüssel nur einmal, daher genügt eine Warnung.
            this._onWarning(message);
        }

        if (typeof this._onMissingKey === "function") {
            try {
                this._onMissingKey(key, locale);
            } catch { /* Diagnose darf die App nie unterbrechen */ }
        }
    }

    _warn(message) {
        if (typeof this._onWarning === "function") {
            try {
                this._onWarning(message);
            } catch { /* ignore */ }
        }
    }
}

/**
 * @param {unknown} catalog
 * @param {string} prefix
 * @param {Record<string, string>} target
 */
function flattenInto(catalog, prefix, target) {
    if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) return;
    for (const [key, value] of Object.entries(catalog)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            flattenInto(value, path, target);
        } else if (typeof value === "string") {
            target[path] = value;
        }
    }
}

module.exports = { LocalizationManager, flattenInto, SYSTEM_PREFERENCE };
