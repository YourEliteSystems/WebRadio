"use strict";

const fsDefault = require("fs");
const path = require("path");
const { validateCatalog } = require("./CatalogValidator");

/**
 * Verwaltung der Übersetzungsressourcen im Main-Prozess.
 *
 * Die Dateien liegen als JSON unter `locales/<locale>.json`. Sie werden beim
 * Start einmal gelesen, validiert und zwischengespeichert; ein Sprachwechsel
 * liest keine Dateien neu ein. Fehler beim Laden einzelner Sprachen werden
 * gesammelt und gemeldet, ohne die Anwendung zu blockieren – eine defekte
 * Sprachdatei darf den Start nicht verhindern.
 */
class TranslationLoader {
    /**
     * @param {Object} options
     * @param {string} options.directory Verzeichnis mit den Sprachdateien
     * @param {typeof import('fs')} [options.fsModule] Für Tests injizierbar
     * @param {(message: string) => void} [options.onWarning]
     */
    constructor({ directory, fsModule = fsDefault, onWarning = null } = {}) {
        if (typeof directory !== "string" || directory === "") {
            throw new TypeError("TranslationLoader benötigt ein Verzeichnis");
        }
        this._directory = directory;
        this._fs = fsModule;
        this._onWarning = onWarning;
        /** @type {Map<string, Record<string, unknown>>} */
        this._cache = new Map();
        /** @type {string[]} */
        this._errors = [];
    }

    get directory() {
        return this._directory;
    }

    get errors() {
        return [...this._errors];
    }

    /**
     * Verfügbare Sprachdateien ermitteln (Dateiname ohne Endung = Locale).
     *
     * @returns {string[]}
     */
    listLocales() {
        try {
            return this._fs
                .readdirSync(this._directory)
                .filter((file) => file.endsWith(".json"))
                .map((file) => path.basename(file, ".json"))
                .sort();
        } catch (err) {
            this._warn(`Sprachverzeichnis nicht lesbar (${this._directory}): ${err.message}`);
            return [];
        }
    }

    /**
     * Katalog einer Sprache laden (mit Cache).
     *
     * @param {string} locale
     * @returns {Record<string, unknown>|null}
     */
    loadLocale(locale) {
        if (typeof locale !== "string" || locale === "") return null;
        if (this._cache.has(locale)) return this._cache.get(locale);

        const file = path.join(this._directory, `${locale}.json`);

        let raw;
        try {
            raw = this._fs.readFileSync(file, "utf8");
        } catch (err) {
            this._error(`Sprachdatei ${locale}.json konnte nicht gelesen werden: ${err.message}`);
            return null;
        }

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            this._error(`Sprachdatei ${locale}.json enthält ungültiges JSON: ${err.message}`);
            return null;
        }

        const validation = validateCatalog(parsed, locale);
        if (!validation.valid) {
            for (const message of validation.errors) this._error(message);
            return null;
        }

        this._cache.set(locale, parsed);
        return parsed;
    }

    /**
     * Alle Sprachdateien laden.
     *
     * @param {string[]} [expectedLocales] Sprachen, die vorhanden sein müssen
     * @returns {{resources: Record<string, Record<string, unknown>>, errors: string[]}}
     */
    loadAll(expectedLocales = []) {
        /** @type {Record<string, Record<string, unknown>>} */
        const resources = {};
        const available = this.listLocales();

        for (const locale of available) {
            const catalog = this.loadLocale(locale);
            if (catalog) resources[locale] = catalog;
        }

        for (const locale of expectedLocales) {
            if (!resources[locale]) {
                this._error(`Erwartete Sprache fehlt oder ist ungültig: ${locale}`);
            }
        }

        return { resources, errors: [...this._errors] };
    }

    /**
     * Cache verwerfen (z. B. nach einem Update der Sprachdateien).
     */
    clearCache() {
        this._cache.clear();
        this._errors = [];
    }

    _warn(message) {
        if (typeof this._onWarning === "function") this._onWarning(message);
    }

    _error(message) {
        this._errors.push(message);
        this._warn(message);
    }
}

module.exports = { TranslationLoader };
