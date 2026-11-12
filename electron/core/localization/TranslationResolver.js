"use strict";

/**
 * Auflösung von Übersetzungsschlüsseln.
 *
 * Reines Modul ohne Dateisystem-, Electron- oder React-Abhängigkeit.
 * Der Resolver kennt weder Persistenz noch UI – er beantwortet ausschließlich
 * die Frage "welcher Text gehört zu diesem Schlüssel in dieser Sprache?".
 */

const PLACEHOLDER_PATTERN = /\{([A-Za-z0-9_]+)\}/g;

/**
 * Wert anhand eines Punktpfads in einem verschachtelten Objekt suchen.
 *
 * @param {Record<string, unknown>} catalog
 * @param {string} key
 * @returns {string|undefined}
 */
function lookup(catalog, key) {
    if (!catalog || typeof catalog !== "object" || typeof key !== "string" || key === "") {
        return undefined;
    }

    const segments = key.split(".");
    let current = catalog;

    for (const segment of segments) {
        if (!current || typeof current !== "object") return undefined;
        if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
        current = current[segment];
    }

    // Leere oder nur aus Leerraum bestehende Werte gelten als fehlend:
    // sie dürfen nie als sichtbarer leerer Text erscheinen.
    return typeof current === "string" && current.trim() !== "" ? current : undefined;
}

/**
 * Platzhalter in einem Text ersetzen.
 *
 * Fehlende Parameter werden nicht verschluckt: Der Platzhalter bleibt stehen
 * und wird als Warnung gemeldet, damit der Fehler im Entwicklungsmodus
 * sichtbar ist und im Produktivbetrieb kein leerer Text entsteht.
 *
 * @param {string} template
 * @param {Record<string, unknown>|undefined} params
 * @param {(message: string) => void} [onWarning]
 * @returns {string}
 */
function interpolate(template, params, onWarning) {
    if (!params || typeof params !== "object") return template;

    return template.replace(PLACEHOLDER_PATTERN, (match, name) => {
        if (!Object.prototype.hasOwnProperty.call(params, name)) {
            if (onWarning) onWarning(`Fehlender Parameter "${name}" für Platzhalter ${match}`);
            return match;
        }

        const value = params[name];
        if (value === null || value === undefined) {
            if (onWarning) onWarning(`Parameter "${name}" ist leer`);
            return match;
        }

        return String(value);
    });
}

class TranslationResolver {
    /**
     * @param {Object} options
     * @param {Record<string, Record<string, unknown>>} options.resources Kataloge je Sprache
     * @param {string} [options.fallbackLocale]
     * @param {(key: string, locale: string) => void} [options.onMissing]
     * @param {(message: string) => void} [options.onWarning]
     */
    constructor({ resources = {}, fallbackLocale = "en-US", onMissing = null, onWarning = null } = {}) {
        this._resources = { ...resources };
        this._fallbackLocale = fallbackLocale;
        this._onMissing = onMissing;
        this._onWarning = onWarning;
        /** @type {Set<string>} */
        this._reportedMissing = new Set();
    }

    get fallbackLocale() {
        return this._fallbackLocale;
    }

    setFallbackLocale(locale) {
        this._fallbackLocale = locale;
    }

    /**
     * Katalog einer Sprache setzen oder ersetzen (z. B. Plugin-Katalog).
     *
     * @param {string} locale
     * @param {Record<string, unknown>} catalog
     */
    setCatalog(locale, catalog) {
        this._resources[locale] = catalog;
    }

    /**
     * @param {string} locale
     * @returns {Record<string, unknown>|undefined}
     */
    getCatalog(locale) {
        return this._resources[locale];
    }

    /**
     * Prüft, ob ein Schlüssel in der angegebenen Sprache existiert.
     *
     * @param {string} locale
     * @param {string} key
     * @returns {boolean}
     */
    has(locale, key) {
        return lookup(this._resources[locale], key) !== undefined;
    }

    /**
     * Auflösung mit Fallback-Kette: aktive Sprache → Rückfallsprache.
     *
     * @param {string} locale
     * @param {string} key
     * @returns {{value: string|undefined, locale: string|null}}
     */
    resolveWithLocale(locale, key) {
        const primary = lookup(this._resources[locale], key);
        if (primary !== undefined) return { value: primary, locale };

        if (this._fallbackLocale && this._fallbackLocale !== locale) {
            const fallback = lookup(this._resources[this._fallbackLocale], key);
            if (fallback !== undefined) return { value: fallback, locale: this._fallbackLocale };
        }

        return { value: undefined, locale: null };
    }

    /**
     * Übersetzung auflösen.
     *
     * Fallback-Reihenfolge: aktive Sprache → Rückfallsprache → Schlüssel.
     * Fehlende Schlüssel werden einmalig je Sprache/Schlüssel gemeldet.
     *
     * @param {string} locale
     * @param {string} key
     * @param {Record<string, unknown>} [params]
     * @returns {string}
     */
    resolve(locale, key, params) {
        const { value, locale: usedLocale } = this.resolveWithLocale(locale, key);

        if (value === undefined) {
            this._reportMissing(locale, key);
            return key;
        }

        if (usedLocale !== locale) {
            this._reportFallback(locale, key, usedLocale);
        }

        return interpolate(value, params, this._onWarning || undefined);
    }

    _reportMissing(locale, key) {
        const id = `${locale}::${key}`;
        if (this._reportedMissing.has(id)) return;
        this._reportedMissing.add(id);
        if (this._onMissing) this._onMissing(key, locale);
    }

    _reportFallback(locale, key, usedLocale) {
        const id = `fallback::${locale}::${key}`;
        if (this._reportedMissing.has(id)) return;
        this._reportedMissing.add(id);
        if (this._onWarning) {
            this._onWarning(`Schlüssel "${key}" fehlt in "${locale}", verwendet "${usedLocale}"`);
        }
    }

    /**
     * Meldungen zurücksetzen (z. B. nach einem Sprachwechsel).
     */
    resetReports() {
        this._reportedMissing.clear();
    }
}

module.exports = { TranslationResolver, lookup, interpolate };
