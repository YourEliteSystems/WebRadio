"use strict";

/**
 * Zentrale Typ- und Konstantendefinitionen der Localization Engine.
 *
 * Das Projekt verwendet JavaScript (kein TypeScript). Die typsichere
 * Verwendung der Übersetzungsschlüssel wird deshalb durch JSDoc-Typen und
 * eine statische Schlüsselprüfung (`npm run i18n:validate`) abgesichert.
 *
 * @typedef {string} TranslationKey
 *   Punktnotation eines Übersetzungsschlüssels, z. B. "navigation.settings".
 *
 * @typedef {'de-DE'|'en-US'} SupportedLocale
 *
 * @typedef {'system'|'de-DE'|'en-US'} LanguagePreference
 *
 * @typedef {Object} TranslationParams
 *   Werte für Platzhalter im Format `{name}`.
 *
 * @typedef {Object} LocalizationState
 * @property {SupportedLocale} locale     Aufgelöste aktive Sprache.
 * @property {LanguagePreference} preference Gespeicherte Benutzerwahl.
 * @property {string|null} systemLocale   Erkannte Systemsprache (roh).
 * @property {SupportedLocale[]} supported Unterstützte Sprachen.
 * @property {SupportedLocale} fallbackLocale Sprache für Rückfalltexte.
 */

/** Sprachpräferenz "Systemstandard". */
const SYSTEM_PREFERENCE = "system";

/**
 * Unterstützte Sprachen. Reihenfolge = Anzeigereihenfolge in den
 * Einstellungen. Weitere Sprachen werden hier ergänzt, sobald eine
 * vollständige Übersetzungsdatei vorliegt.
 */
const SUPPORTED_LOCALES = Object.freeze(["de-DE", "en-US"]);

/**
 * Standardsprache und gleichzeitig Rückfallsprache. Ist die Systemsprache
 * nicht unterstützt, wird Englisch verwendet.
 */
const DEFAULT_LOCALE = "en-US";

/** Rückfallsprache für fehlende Schlüssel der aktiven Sprache. */
const FALLBACK_LOCALE = "en-US";

/** Zulässige Werte für die gespeicherte Sprachpräferenz. */
const LANGUAGE_PREFERENCES = Object.freeze([SYSTEM_PREFERENCE, ...SUPPORTED_LOCALES]);

/**
 * Anzeigenamen der Sprachen. Bewusst nicht übersetzt: Sprachen werden in
 * ihrer eigenen Sprache benannt (Deutsch, English), damit die Auswahl auch
 * dann verständlich bleibt, wenn die aktive Sprache nicht die Muttersprache
 * des Benutzers ist.
 */
const LANGUAGE_LABELS = Object.freeze({
    "de-DE": "Deutsch",
    "en-US": "English"
});

/** BCP-47-Sprachanteile, die auf eine unterstützte Sprache abgebildet werden. */
const LANGUAGE_FAMILIES = Object.freeze({
    de: "de-DE",
    en: "en-US"
});

module.exports = {
    SYSTEM_PREFERENCE,
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
    FALLBACK_LOCALE,
    LANGUAGE_PREFERENCES,
    LANGUAGE_LABELS,
    LANGUAGE_FAMILIES
};
