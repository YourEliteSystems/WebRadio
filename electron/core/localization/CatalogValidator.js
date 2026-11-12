"use strict";

/**
 * Validierung von Übersetzungskatalogen.
 *
 * Alle Funktionen sind rein (kein Dateisystem, keine Electron-Abhängigkeit),
 * damit sie sowohl im Main-Prozess als auch im Prüfskript
 * (`scripts/localization/validate-translations.js`) verwendet werden können.
 */

const PLACEHOLDER_PATTERN = /\{([^{}]*)\}/g;
const VALID_PLACEHOLDER_NAME = /^[A-Za-z0-9_]+$/;

/**
 * Wandelt einen Katalog in eine flache Map `pfad -> wert`.
 *
 * @param {Record<string, unknown>} catalog
 * @param {string} [prefix]
 * @param {Map<string, unknown>} [target]
 * @returns {Map<string, unknown>}
 */
function flattenCatalog(catalog, prefix = "", target = new Map()) {
    if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
        return target;
    }

    for (const [key, value] of Object.entries(catalog)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            flattenCatalog(value, path, target);
        } else {
            target.set(path, value);
        }
    }

    return target;
}

/**
 * Extrahiert die Platzhalternamen eines Textes.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
function extractPlaceholders(value) {
    if (typeof value !== "string") return [];
    const names = [];
    for (const match of value.matchAll(PLACEHOLDER_PATTERN)) {
        names.push(match[1]);
    }
    return names;
}

/**
 * Prüft einen einzelnen Katalog auf strukturelle Fehler.
 *
 * Meldet: leere Werte, Nicht-String-Werte, ungültige Platzhalter,
 * Schlüssel mit Leerraum oder führenden/abschließenden Punkten.
 *
 * @param {unknown} catalog
 * @param {string} [locale]
 * @returns {{valid: boolean, errors: string[], keyCount: number}}
 */
function validateCatalog(catalog, locale = "") {
    const errors = [];
    const label = locale ? `[${locale}] ` : "";

    if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
        return { valid: false, errors: [`${label}Katalog ist kein Objekt`], keyCount: 0 };
    }

    const flat = flattenCatalog(catalog);

    for (const [key, value] of flat) {
        if (typeof value !== "string") {
            errors.push(`${label}${key}: Wert ist kein String (${typeof value})`);
            continue;
        }

        if (value.trim() === "") {
            errors.push(`${label}${key}: leerer Übersetzungswert`);
        }

        if (value !== value.trim()) {
            errors.push(`${label}${key}: führender oder abschließender Leerraum`);
        }

        if (/\.\.|^\.|\.$/.test(key) || /\s/.test(key)) {
            errors.push(`${label}${key}: ungültiger Schlüssel`);
        }

        for (const placeholder of extractPlaceholders(value)) {
            if (!VALID_PLACEHOLDER_NAME.test(placeholder)) {
                errors.push(`${label}${key}: ungültiger Platzhalter "{${placeholder}}"`);
            }
        }

        const opened = (value.match(/\{/g) || []).length;
        const closed = (value.match(/\}/g) || []).length;
        if (opened !== closed) {
            errors.push(`${label}${key}: unbalancierte Platzhalterklammern`);
        }
    }

    return { valid: errors.length === 0, errors, keyCount: flat.size };
}

/**
 * Vergleicht zwei Kataloge auf Schlüsselgleichheit.
 *
 * @param {Record<string, unknown>} reference
 * @param {Record<string, unknown>} candidate
 * @param {string} [locale]
 * @returns {{missing: string[], extra: string[]}}
 */
function compareCatalogs(reference, candidate, locale = "") {
    const referenceKeys = flattenCatalog(reference);
    const candidateKeys = flattenCatalog(candidate);
    void locale;

    const missing = [];
    const extra = [];

    for (const key of referenceKeys.keys()) {
        if (!candidateKeys.has(key)) missing.push(key);
    }
    for (const key of candidateKeys.keys()) {
        if (!referenceKeys.has(key)) extra.push(key);
    }

    return { missing: missing.sort(), extra: extra.sort() };
}

/**
 * Vergleicht die Platzhalter zweier Kataloge je Schlüssel.
 *
 * @param {Record<string, unknown>} reference
 * @param {Record<string, unknown>} candidate
 * @returns {Array<{key: string, reference: string[], candidate: string[]}>}
 */
function comparePlaceholders(reference, candidate) {
    const referenceKeys = flattenCatalog(reference);
    const candidateKeys = flattenCatalog(candidate);
    const mismatches = [];

    for (const [key, referenceValue] of referenceKeys) {
        if (!candidateKeys.has(key)) continue;

        const referenceNames = [...new Set(extractPlaceholders(referenceValue))].sort();
        const candidateNames = [...new Set(extractPlaceholders(candidateKeys.get(key)))].sort();

        if (referenceNames.join(",") !== candidateNames.join(",")) {
            mismatches.push({ key, reference: referenceNames, candidate: candidateNames });
        }
    }

    return mismatches;
}

/**
 * Findet doppelte Schlüssel in rohem JSON-Text.
 *
 * `JSON.parse` verwirft Duplikate stillschweigend, deshalb wird der Text
 * hier leichtgewichtig gescannt: Es wird ein Pfad-Stack geführt, sodass
 * derselbe Schlüsselname in unterschiedlichen Objekten erlaubt bleibt.
 *
 * @param {string} rawText
 * @returns {string[]} Pfade doppelter Schlüssel
 */
function findDuplicateKeys(rawText) {
    if (typeof rawText !== "string" || rawText.trim() === "") return [];

    const duplicates = [];
    const stack = [{ type: "object", keys: new Set(), path: "", pendingKey: null }];
    let index = 0;

    while (index < rawText.length) {
        const char = rawText[index];

        if (char === "\"") {
            // String einlesen (inkl. Escapes).
            let cursor = index + 1;
            let value = "";
            while (cursor < rawText.length) {
                const c = rawText[cursor];
                if (c === "\\") {
                    value += rawText[cursor + 1] || "";
                    cursor += 2;
                    continue;
                }
                if (c === "\"") break;
                value += c;
                cursor += 1;
            }

            // Prüfen, ob dieser String ein Objektschlüssel ist (":" folgt).
            let lookahead = cursor + 1;
            while (lookahead < rawText.length && /\s/.test(rawText[lookahead])) lookahead += 1;
            const isKey = rawText[lookahead] === ":";
            const frame = stack[stack.length - 1];

            if (isKey && frame.type === "object") {
                const path = frame.path ? `${frame.path}.${value}` : value;
                if (frame.keys.has(value)) {
                    duplicates.push(path);
                } else {
                    frame.keys.add(value);
                }
                frame.pendingKey = value;
            }

            index = cursor + 1;
            continue;
        }

        if (char === "{" || char === "[") {
            const parent = stack[stack.length - 1];
            const key = parent.pendingKey;
            const path = key === null || key === undefined
                ? parent.path
                : (parent.path ? `${parent.path}.${key}` : key);
            stack.push({ type: char === "{" ? "object" : "array", keys: new Set(), path, pendingKey: null });
            parent.pendingKey = null;
            index += 1;
            continue;
        }

        if (char === "}" || char === "]") {
            if (stack.length > 1) stack.pop();
            index += 1;
            continue;
        }

        if (char === ",") {
            const frame = stack[stack.length - 1];
            if (frame) frame.pendingKey = null;
            index += 1;
            continue;
        }

        index += 1;
    }

    return duplicates;
}

module.exports = {
    flattenCatalog,
    extractPlaceholders,
    validateCatalog,
    compareCatalogs,
    comparePlaceholders,
    findDuplicateKeys
};
