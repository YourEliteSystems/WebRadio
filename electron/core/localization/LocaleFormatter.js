"use strict";

/**
 * Regionale Formatierung auf Basis der nativen `Intl`-APIs.
 *
 * Es wird bewusst keine eigene Formatierungslogik implementiert: Datum,
 * Uhrzeit, Zahlen, Währungen, Prozente und relative Zeitangaben kommen aus
 * `Intl.DateTimeFormat`, `Intl.NumberFormat` und `Intl.RelativeTimeFormat`.
 * Die Objekte werden je Sprache und Optionssignatur zwischengespeichert,
 * damit wiederholte Renderings keine neuen Instanzen erzeugen.
 */

const relativeTimeCache = new Map();
const dateTimeCache = new Map();
const numberCache = new Map();

function cacheKey(locale, options) {
    return `${locale}|${JSON.stringify(options || {})}`;
}

function getDateTimeFormat(locale, options) {
    const key = cacheKey(locale, options);
    if (!dateTimeCache.has(key)) {
        dateTimeCache.set(key, new Intl.DateTimeFormat(locale, options));
    }
    return dateTimeCache.get(key);
}

function getNumberFormat(locale, options) {
    const key = cacheKey(locale, options);
    if (!numberCache.has(key)) {
        numberCache.set(key, new Intl.NumberFormat(locale, options));
    }
    return numberCache.get(key);
}

function getRelativeTimeFormat(locale, options) {
    const key = cacheKey(locale, options);
    if (!relativeTimeCache.has(key)) {
        relativeTimeCache.set(key, new Intl.RelativeTimeFormat(locale, options));
    }
    return relativeTimeCache.get(key);
}

const RELATIVE_UNITS = Object.freeze({
    year: 365 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    minute: 60 * 1000,
    second: 1000
});

class LocaleFormatter {
    /**
     * @param {string} locale BCP-47-Sprache, z. B. "de-DE"
     */
    constructor(locale) {
        this._locale = locale;
    }

    get locale() {
        return this._locale;
    }

    setLocale(locale) {
        this._locale = locale;
    }

    /**
     * @param {Date|number|string} value
     * @param {Intl.DateTimeFormatOptions} [options]
     * @returns {string}
     */
    formatDate(value, options = { year: "numeric", month: "2-digit", day: "2-digit" }) {
        const date = toDate(value);
        if (!date) return "";
        return getDateTimeFormat(this._locale, options).format(date);
    }

    /**
     * @param {Date|number|string} value
     * @param {Intl.DateTimeFormatOptions} [options]
     * @returns {string}
     */
    formatTime(value, options = { hour: "2-digit", minute: "2-digit" }) {
        const date = toDate(value);
        if (!date) return "";
        return getDateTimeFormat(this._locale, options).format(date);
    }

    /**
     * @param {Date|number|string} value
     * @param {Intl.DateTimeFormatOptions} [options]
     * @returns {string}
     */
    formatDateTime(value, options = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    }) {
        const date = toDate(value);
        if (!date) return "";
        return getDateTimeFormat(this._locale, options).format(date);
    }

    /**
     * @param {number} value
     * @param {Intl.NumberFormatOptions} [options]
     * @returns {string}
     */
    formatNumber(value, options = {}) {
        if (typeof value !== "number" || !Number.isFinite(value)) return "";
        return getNumberFormat(this._locale, options).format(value);
    }

    /**
     * @param {number} value
     * @param {string} currency ISO-4217-Code, z. B. "EUR"
     * @param {Intl.NumberFormatOptions} [options]
     * @returns {string}
     */
    formatCurrency(value, currency, options = {}) {
        if (typeof value !== "number" || !Number.isFinite(value)) return "";
        return getNumberFormat(this._locale, { style: "currency", currency, ...options }).format(value);
    }

    /**
     * Prozentangabe. `value` ist der Anteil (0.42 → "42 %").
     *
     * @param {number} value
     * @param {Intl.NumberFormatOptions} [options]
     * @returns {string}
     */
    formatPercent(value, options = { maximumFractionDigits: 0 }) {
        if (typeof value !== "number" || !Number.isFinite(value)) return "";
        return getNumberFormat(this._locale, { style: "percent", ...options }).format(value);
    }

    /**
     * Relative Zeitangabe, z. B. "vor 3 Minuten".
     *
     * @param {number} value Differenz in der angegebenen Einheit
     * @param {'year'|'month'|'week'|'day'|'hour'|'minute'|'second'} unit
     * @param {Intl.RelativeTimeFormatOptions} [options]
     * @returns {string}
     */
    formatRelativeTime(value, unit, options = { numeric: "auto" }) {
        if (typeof value !== "number" || !Number.isFinite(value)) return "";
        return getRelativeTimeFormat(this._locale, options).format(Math.round(value), unit);
    }

    /**
     * Relative Zeitangabe aus einem Zeitstempel (Vergangenheit → negativ).
     *
     * @param {Date|number|string} value
     * @param {Date|number} [now]
     * @returns {string}
     */
    formatRelativeFromNow(value, now = Date.now()) {
        const date = toDate(value);
        if (!date) return "";
        const reference = toDate(now) || new Date();
        const deltaMs = date.getTime() - reference.getTime();
        const absolute = Math.abs(deltaMs);

        for (const [unit, size] of Object.entries(RELATIVE_UNITS)) {
            if (absolute >= size || unit === "second") {
                const amount = deltaMs / size;
                // Bei "auto" liefert Intl selbst "gestern"/"heute".
                return this.formatRelativeTime(amount, /** @type {any} */ (unit), { numeric: "auto" });
            }
        }

        return "";
    }

    /**
     * Ordnet einen Wert einer Pluralkategorie zu ("one"/"other"/…).
     *
     * @param {number} count
     * @returns {Intl.LDMLPluralRule}
     */
    selectPluralCategory(count) {
        if (typeof count !== "number" || !Number.isFinite(count)) {
            return "other";
        }
        return new Intl.PluralRules(this._locale).select(count);
    }
}

/**
 * @param {Date|number|string} value
 * @returns {Date|null}
 */
function toDate(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "number") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === "string") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

module.exports = { LocaleFormatter, RELATIVE_UNITS };
