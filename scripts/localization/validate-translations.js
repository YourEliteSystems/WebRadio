#!/usr/bin/env node
"use strict";

/**
 * Automatisierter Übersetzungs-Vollständigkeitscheck.
 *
 * Prüft alle Sprachdateien unter `electron/core/localization/locales`:
 *  - gültiges JSON
 *  - doppelte Schlüssel (auch wenn `JSON.parse` sie verwerfen würde)
 *  - identische Schlüsselmengen zwischen den Sprachen
 *  - keine leeren Werte, keine Nicht-String-Werte
 *  - einheitliche Platzhalter
 *  - korrekte Syntax der Platzhalter
 *
 * Zusätzlich werden alle `t('…')`-Aufrufe im Quellcode gegen den Katalog
 * geprüft. Nur String-Literale werden ausgewertet; dynamische Schlüssel
 * (z. B. `t(item.labelKey)`) werden übersprungen und separat gezählt.
 *
 * Aufruf: node scripts/localization/validate-translations.js [--strict]
 * Exit-Code 0 = alles gültig, 1 = Fehler gefunden.
 */

const fs = require("fs");
const path = require("path");

const {
    validateCatalog,
    compareCatalogs,
    comparePlaceholders,
    findDuplicateKeys,
    flattenCatalog
} = require("../../electron/core/localization/CatalogValidator");
const { SUPPORTED_LOCALES, DEFAULT_LOCALE } = require("../../electron/core/localization/types");

const ROOT = path.join(__dirname, "..", "..");
const LOCALES_DIR = path.join(ROOT, "electron", "core", "localization", "locales");
const SOURCE_DIRS = [path.join(ROOT, "renderer"), path.join(ROOT, "electron")];
const SKIP_DIRS = new Set(["node_modules", "dist", "out", "build", "site", ".git"]);

const errors = [];
const warnings = [];

function readJson(file) {
    const raw = fs.readFileSync(file, "utf8");
    return { raw, parsed: JSON.parse(raw) };
}

function main() {
    console.log("🌐 Übersetzungs-Validierung\n");

    if (!fs.existsSync(LOCALES_DIR)) {
        console.error(`❌ Sprachverzeichnis fehlt: ${LOCALES_DIR}`);
        process.exit(1);
    }

    /** @type {Record<string, Record<string, unknown>>} */
    const catalogs = {};

    for (const locale of SUPPORTED_LOCALES) {
        const file = path.join(LOCALES_DIR, `${locale}.json`);

        if (!fs.existsSync(file)) {
            errors.push(`Sprachdatei fehlt: ${locale}.json`);
            continue;
        }

        let data;
        try {
            data = readJson(file);
        } catch (err) {
            errors.push(`${locale}.json: ungültiges JSON (${err.message})`);
            continue;
        }

        const duplicates = findDuplicateKeys(data.raw);
        for (const key of duplicates) {
            errors.push(`${locale}.json: doppelter Schlüssel "${key}"`);
        }

        const validation = validateCatalog(data.parsed, locale);
        errors.push(...validation.errors);

        catalogs[locale] = data.parsed;
        console.log(`  ${locale}: ${validation.keyCount} Schlüssel, ${validation.errors.length} Fehler`);
    }

    // Schlüssel- und Platzhaltervergleich gegen die Standardsprache.
    const reference = catalogs[DEFAULT_LOCALE];
    if (reference) {
        for (const locale of Object.keys(catalogs)) {
            if (locale === DEFAULT_LOCALE) continue;

            const { missing, extra } = compareCatalogs(reference, catalogs[locale], locale);
            for (const key of missing) errors.push(`${locale}: Schlüssel fehlt (${key})`);
            for (const key of extra) errors.push(`${locale}: unbekannter Zusatzschlüssel (${key})`);

            for (const mismatch of comparePlaceholders(reference, catalogs[locale])) {
                errors.push(
                    `${locale}: Platzhalter weichen ab bei "${mismatch.key}" ` +
                    `(erwartet: ${mismatch.reference.join(", ") || "keine"}; gefunden: ${mismatch.candidate.join(", ") || "keine"})`
                );
            }
        }
    }

    // Statische Prüfung der t()-Aufrufe im Quellcode.
    const knownKeys = new Set();
    for (const catalog of Object.values(catalogs)) {
        for (const key of flattenCatalog(catalog).keys()) knownKeys.add(key);
    }

    let literalCalls = 0;
    let dynamicCalls = 0;

    for (const file of walk(SOURCE_DIRS)) {
        const relative = path.relative(ROOT, file).replace(/\\/g, "/");
        const source = fs.readFileSync(file, "utf8");
        const regex = /\bt\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;

        for (const match of source.matchAll(regex)) {
            const key = match[2];
            literalCalls += 1;

            if (key.includes("${")) {
                dynamicCalls += 1;
                continue;
            }

            if (!key.includes(".")) continue; // z. B. t('x') in fremden Kontexten
            if (!knownKeys.has(key)) {
                // Plugin-Schlüssel sind zur Build-Zeit nicht bekannt.
                if (key.startsWith("plugin.")) continue;
                errors.push(`${relative}: unbekannter Übersetzungsschlüssel "${key}"`);
            }
        }
    }

    const usedKeys = new Set();
    for (const file of walk(SOURCE_DIRS)) {
        const source = fs.readFileSync(file, "utf8");
        for (const match of source.matchAll(/\bt\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) {
            usedKeys.add(match[2]);
        }
    }

    for (const key of knownKeys) {
        if (!usedKeys.has(key)) warnings.push(`Schlüssel wird im Code nicht verwendet: "${key}"`);
        if (/Modal\.|^common\./.test(key)) continue;
    }

    console.log(`\n  Literale t()-Aufrufe: ${literalCalls} (davon dynamisch: ${dynamicCalls})`);
    console.log(`  Katalogschlüssel: ${knownKeys.size}`);

    if (warnings.length > 0) {
        console.log("\n⚠️  Hinweise:");
        for (const warning of warnings) console.log(`   - ${warning}`);
    }

    if (errors.length > 0) {
        console.error("\n❌ Fehler:");
        for (const error of errors) console.error(`   - ${error}`);
        console.error(`\n❌ Übersetzungs-Validierung fehlgeschlagen (${errors.length} Fehler).`);
        process.exit(1);
    }

    console.log("\n✅ Übersetzungen vollständig und konsistent.");
}

function walk(directories) {
    const files = [];

    for (const directory of directories) {
        if (!fs.existsSync(directory)) continue;
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
            const full = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                files.push(...walk([full]));
            } else if (/\.(js|jsx)$/.test(entry.name)) {
                files.push(full);
            }
        }
    }

    return files;
}

main();
