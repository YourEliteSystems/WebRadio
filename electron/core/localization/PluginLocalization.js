"use strict";

const { normalizeLocale } = require("./LanguageDetector");
const { validateCatalog } = require("./CatalogValidator");

/** Reine Sprachangaben (ohne Region), die als Locale zulässig sind. */
const LANGUAGES_WITHOUT_REGION = new Set(["de", "en"]);

/**
 * Schlüssel unterhalb von `plugin.` sind dem Plugin-Namensraum vorbehalten
 * und dürfen in Plugin-Katalogen nicht selbst auftauchen.
 *
 * @param {string} key
 * @returns {boolean}
 */
function isReservedKeyPrefix(key) {
    return key === "plugin" || key.startsWith("plugin.");
}

/**
 * Plugin-Lokalisierung.
 *
 * Plugins deklarieren ihre Übersetzungen ausschließlich als Daten im
 * Manifest (`localization`), nie als ausführbaren Code. Die Ressourcen werden
 * validiert und unter `plugin.<pluginId>.*` registriert, sodass sie keine
 * Anwendungstexte überschreiben können und ein Plugin niemals die Texte
 * eines anderen Plugins sieht.
 *
 * Manifest-Beispiel:
 *
 * ```json
 * {
 *   "id": "mediahub",
 *   "localization": {
 *     "de-DE": { "title": "MediaHub", "signIn": "Anmelden" },
 *     "en-US": { "title": "MediaHub", "signIn": "Sign in" }
 *   }
 * }
 * ```
 */

/** Maximale Anzahl Sprachen je Plugin (Schutz vor übergroßen Manifesten). */
const MAX_LOCALES_PER_PLUGIN = 20;

/** Maximale Schlüsseltiefe je Plugin-Katalog. */
const MAX_DEPTH = 6;

/** Maximale Länge eines Übersetzungswertes. */
const MAX_VALUE_LENGTH = 2000;

/**
 * Prüft die im Manifest deklarierten Übersetzungen eines Plugins.
 *
 * @param {string} pluginId
 * @param {unknown} localization
 * @returns {{valid: boolean, errors: string[], catalogs: Record<string, Record<string, unknown>>, keyCount: number}}
 */
function validatePluginLocalization(pluginId, localization) {
    const errors = [];

    if (typeof pluginId !== "string" || !/^[a-z0-9][a-z0-9-]*$/i.test(pluginId)) {
        return {
            valid: false,
            errors: [`Ungültige Plugin-ID für Lokalisierung: ${String(pluginId)}`],
            catalogs: {},
            keyCount: 0
        };
    }

    if (!localization || typeof localization !== "object" || Array.isArray(localization)) {
        return {
            valid: false,
            errors: [`[${pluginId}] localization muss ein Objekt mit Sprachkatalogen sein`],
            catalogs: {},
            keyCount: 0
        };
    }

    const locales = Object.keys(localization);
    if (locales.length === 0) {
        return { valid: false, errors: [`[${pluginId}] localization ist leer`], catalogs: {}, keyCount: 0 };
    }

    if (locales.length > MAX_LOCALES_PER_PLUGIN) {
        errors.push(`[${pluginId}] zu viele Sprachen (${locales.length} > ${MAX_LOCALES_PER_PLUGIN})`);
    }

    /** @type {Record<string, Record<string, unknown>>} */
    const catalogs = {};
    let keyCount = 0;

    for (const rawLocale of locales) {
        const locale = normalizeLocale(rawLocale);
        if (!locale) {
            errors.push(`[${pluginId}] ungültige Locale: "${rawLocale}"`);
            continue;
        }

        // Reine Sprachangaben sind zulässig ("de"), werden aber nicht auf
        // Regionen abgebildet – das übernimmt der Resolver zur Laufzeit.
        if (!/^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/.test(locale) && !LANGUAGES_WITHOUT_REGION.has(locale)) {
            errors.push(`[${pluginId}] nicht unterstütztes Locale-Format: "${rawLocale}"`);
            continue;
        }

        const catalog = localization[rawLocale];
        const validation = validateCatalog(catalog, `${pluginId}:${locale}`);
        if (!validation.valid) {
            errors.push(...validation.errors);
            continue;
        }

        if (exceedsDepth(catalog, MAX_DEPTH)) {
            errors.push(`[${pluginId}:${locale}] Katalog ist tiefer als ${MAX_DEPTH} Ebenen`);
            continue;
        }

        if (containsReservedPrefix(catalog)) {
            errors.push(`[${pluginId}:${locale}] Schlüssel dürfen nicht mit "plugin." beginnen`);
            continue;
        }

        if (containsOversizedValue(catalog)) {
            errors.push(`[${pluginId}:${locale}] Übersetzungswert überschreitet ${MAX_VALUE_LENGTH} Zeichen`);
            continue;
        }

        catalogs[locale] = catalog;
        keyCount += validation.keyCount;
    }

    return { valid: errors.length === 0 && Object.keys(catalogs).length > 0, errors, catalogs, keyCount };
}

/**
 * Stellt den vollständig qualifizierten Schlüssel eines Plugins her.
 *
 * @param {string} pluginId
 * @param {string} key
 * @returns {string}
 */
function pluginKey(pluginId, key) {
    return `plugin.${pluginId}.${key}`;
}

/**
 * Prüft, ob ein Schlüssel zu einem bestimmten Plugin gehört.
 *
 * @param {string} pluginId
 * @param {string} key
 * @returns {boolean}
 */
function belongsToPlugin(pluginId, key) {
    return typeof key === "string" && key.startsWith(`plugin.${pluginId}.`);
}

/** @param {unknown} catalog @param {number} max @param {number} [depth] */
function exceedsDepth(catalog, max, depth = 1) {
    if (!catalog || typeof catalog !== "object") return false;
    if (depth > max) return true;
    return Object.values(catalog).some((value) => (
        value && typeof value === "object" && !Array.isArray(value)
            ? exceedsDepth(value, max, depth + 1)
            : false
    ));
}

/** @param {unknown} catalog */
function containsReservedPrefix(catalog) {
    if (!catalog || typeof catalog !== "object") return false;
    return Object.entries(catalog).some(([key, value]) => {
        if (key === "plugin" || isReservedKeyPrefix(key)) return true;
        return value && typeof value === "object" ? containsReservedPrefix(value) : false;
    });
}

/** @param {unknown} catalog */
function containsOversizedValue(catalog) {
    if (!catalog || typeof catalog !== "object") return false;
    return Object.values(catalog).some((value) => {
        if (typeof value === "string") return value.length > MAX_VALUE_LENGTH;
        if (value && typeof value === "object") return containsOversizedValue(value);
        return false;
    });
}

module.exports = {
    MAX_LOCALES_PER_PLUGIN,
    MAX_DEPTH,
    MAX_VALUE_LENGTH,
    validatePluginLocalization,
    pluginKey,
    belongsToPlugin
};
