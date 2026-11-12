"use strict";

const {
    SYSTEM_PREFERENCE,
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
    LANGUAGE_PREFERENCES,
    LANGUAGE_FAMILIES
} = require("./types");

/**
 * Locale normalisieren.
 *
 * Akzeptiert Schreibweisen wie "de", "de-de", "de_DE", "DE_at",
 * "en-US-u-hc-h12" und liefert die kanonische BCP-47-Form ohne
 * Erweiterungen ("de-DE", "de-AT", "en-US"). Ungültige Eingaben liefern
 * `null` – es wird nie eine Sprache geraten.
 *
 * @param {unknown} input
 * @returns {string|null}
 */
function normalizeLocale(input) {
    if (typeof input !== "string") return null;

    const trimmed = input.trim();
    if (!trimmed) return null;

    // Erweiterungen/Subtags hinter der Region entfernen ("en-US-u-hc-h12").
    const parts = trimmed.replace(/_/g, "-").split("-").filter(Boolean);
    if (parts.length === 0) return null;

    const language = parts[0].toLowerCase();
    if (!/^[a-z]{2,3}$/.test(language)) return null;

    let normalized = language;

    if (parts.length > 1) {
        const second = parts[1];
        if (/^[A-Za-z]{4}$/.test(second)) {
            // Script-Subtag (z. B. "zh-Hant") – unverändert, aber kanonisch.
            normalized += `-${second.charAt(0).toUpperCase()}${second.slice(1).toLowerCase()}`;
        } else if (/^[A-Za-z]{2}$/.test(second) || /^\d{3}$/.test(second)) {
            normalized += `-${second.toUpperCase()}`;
        } else {
            return normalized;
        }
    }

    return normalized;
}

/**
 * Ordnet eine beliebige Locale einer unterstützten Sprache zu.
 *
 * Reihenfolge: exakte Übereinstimmung → Sprachfamilie (de/en) → `null`.
 * Eine Region allein (z. B. "de-AT") begründet keine neue Sprache, sie wird
 * auf die passende unterstützte Variante abgebildet.
 *
 * @param {unknown} input
 * @param {readonly string[]} [supported]
 * @returns {string|null}
 */
function matchSupported(input, supported = SUPPORTED_LOCALES) {
    const normalized = normalizeLocale(input);
    if (!normalized) return null;

    if (supported.includes(normalized)) return normalized;

    const language = normalized.split("-")[0].toLowerCase();
    const family = LANGUAGE_FAMILIES[language];
    if (family && supported.includes(family)) return family;

    return null;
}

/**
 * Erkennt die bevorzugte Sprache aus einer Liste von Systemsprachen.
 *
 * Die Liste wird in Prioritätsreihenfolge durchlaufen (wie sie das
 * Betriebssystem liefert); der erste Treffer gewinnt. Gibt es keinen
 * Treffer, wird die Standardsprache verwendet.
 *
 * @param {unknown[]} systemLocales
 * @param {Object} [options]
 * @param {readonly string[]} [options.supported]
 * @param {string} [options.defaultLocale]
 * @returns {{locale: string, systemLocale: string|null, matched: boolean, source: 'system'|'default'}}
 */
function detect(systemLocales, options = {}) {
    const supported = options.supported || SUPPORTED_LOCALES;
    const defaultLocale = options.defaultLocale || DEFAULT_LOCALE;
    const list = Array.isArray(systemLocales) ? systemLocales : [systemLocales];

    let firstValid = null;

    for (const candidate of list) {
        const normalized = normalizeLocale(candidate);
        if (!normalized) continue;
        if (firstValid === null) firstValid = normalized;

        const matched = matchSupported(normalized, supported);
        if (matched) {
            // `systemLocale` beschreibt die bevorzugte Systemsprache (erster
            // gültiger Eintrag), `locale` die tatsächlich verwendete Sprache.
            return { locale: matched, systemLocale: firstValid, matched: true, source: "system" };
        }
    }

    return {
        locale: supported.includes(defaultLocale) ? defaultLocale : supported[0],
        systemLocale: firstValid,
        matched: false,
        source: "default"
    };
}

/**
 * Prüft, ob ein Wert eine gültige Sprachpräferenz ist.
 *
 * @param {unknown} preference
 * @returns {boolean}
 */
function isValidPreference(preference) {
    return typeof preference === "string" && LANGUAGE_PREFERENCES.includes(preference);
}

/**
 * Löst die gespeicherte Präferenz in eine aktive Sprache auf.
 *
 * - Konkrete Sprache: wird direkt verwendet.
 * - "system" (oder fehlend/ungültig): Systemsprache erkennen, sonst Englisch.
 *
 * Eine ungültige Präferenz wird nie stillschweigend als gültige Sprache
 * interpretiert; sie fällt auf den Systemstandard zurück und wird als
 * `invalidPreference` gemeldet.
 *
 * @param {unknown} preference
 * @param {unknown[]} systemLocales
 * @param {Object} [options]
 * @returns {{preference: string, locale: string, systemLocale: string|null, source: string, invalidPreference: boolean}}
 */
function resolvePreference(preference, systemLocales, options = {}) {
    const supported = options.supported || SUPPORTED_LOCALES;
    const defaultLocale = options.defaultLocale || DEFAULT_LOCALE;

    if (isValidPreference(preference) && preference !== SYSTEM_PREFERENCE) {
        return {
            preference,
            locale: preference,
            systemLocale: detect(systemLocales, { supported, defaultLocale }).systemLocale,
            source: "preference",
            invalidPreference: false
        };
    }

    const invalidPreference = preference !== undefined && preference !== null && preference !== SYSTEM_PREFERENCE;
    const detection = detect(systemLocales, { supported, defaultLocale });

    return {
        preference: SYSTEM_PREFERENCE,
        locale: detection.locale,
        systemLocale: detection.systemLocale,
        source: detection.source,
        invalidPreference
    };
}

module.exports = {
    normalizeLocale,
    matchSupported,
    detect,
    isValidPreference,
    resolvePreference
};
