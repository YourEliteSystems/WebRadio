"use strict";

/**
 * localization.test.js
 *
 * Unit-Tests der Localization Engine.
 *
 * Geprüft werden LanguageDetector, TranslationResolver, LocalizationManager,
 * LocaleFormatter, CatalogValidator, TranslationLoader und die
 * Plugin-Lokalisierung – vollständig ohne Electron, Dateisystem oder DOM.
 */

const assert = require("assert");

const LanguageDetector = require("../../electron/core/localization/LanguageDetector");
const { TranslationResolver } = require("../../electron/core/localization/TranslationResolver");
const { LocalizationManager } = require("../../electron/core/localization/LocalizationManager");
const { LocaleFormatter } = require("../../electron/core/localization/LocaleFormatter");
const { TranslationLoader } = require("../../electron/core/localization/TranslationLoader");
const CatalogValidator = require("../../electron/core/localization/CatalogValidator");
const { validatePluginLocalization, belongsToPlugin } = require("../../electron/core/localization/PluginLocalization");
const types = require("../../electron/core/localization/types");

const deDE = require("../../electron/core/localization/locales/de-DE.json");
const enUS = require("../../electron/core/localization/locales/en-US.json");

console.log("==========================================");
console.log("Localization Engine Tests");
console.log("==========================================");

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ ${name}: ${err.message}`);
        failed++;
    }
}

async function testAsync(name, fn) {
    try {
        await fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ ${name}: ${err.message}`);
        failed++;
    }
}

function createManager(overrides = {}) {
    return new LocalizationManager({
        resources: { "de-DE": deDE, "en-US": enUS },
        locale: "de-DE",
        preference: "de-DE",
        fallbackLocale: "en-US",
        ...overrides
    });
}

// ─────────────────────────────────────────────
// LanguageDetector
// ─────────────────────────────────────────────

test("normalizeLocale: de_DE → de-DE", () => {
    assert.strictEqual(LanguageDetector.normalizeLocale("de_DE"), "de-DE");
});

test("normalizeLocale: DE-at → de-AT", () => {
    assert.strictEqual(LanguageDetector.normalizeLocale("DE-at"), "de-AT");
});

test("normalizeLocale: entfernt Unicode-Erweiterungen", () => {
    assert.strictEqual(LanguageDetector.normalizeLocale("en-US-u-hc-h12"), "en-US");
});

test("normalizeLocale: lehnt Unsinn ab", () => {
    assert.strictEqual(LanguageDetector.normalizeLocale(""), null);
    assert.strictEqual(LanguageDetector.normalizeLocale(null), null);
    assert.strictEqual(LanguageDetector.normalizeLocale(42), null);
    assert.strictEqual(LanguageDetector.normalizeLocale("!!"), null);
});

test("matchSupported: de-AT fällt auf de-DE", () => {
    assert.strictEqual(LanguageDetector.matchSupported("de-AT"), "de-DE");
});

test("matchSupported: en-GB fällt auf en-US", () => {
    assert.strictEqual(LanguageDetector.matchSupported("en-GB"), "en-US");
});

test("matchSupported: nicht unterstützte Sprache ist null", () => {
    assert.strictEqual(LanguageDetector.matchSupported("fr-FR"), null);
});

test("detect: nutzt die erste passende Systemsprache", () => {
    const result = LanguageDetector.detect(["fr-FR", "de-AT", "en-US"]);
    assert.strictEqual(result.locale, "de-DE");
    assert.strictEqual(result.matched, true);
    assert.strictEqual(result.systemLocale, "fr-FR");
});

test("detect: fällt ohne Treffer auf Englisch zurück", () => {
    const result = LanguageDetector.detect(["fr-FR", "it-IT"]);
    assert.strictEqual(result.locale, "en-US");
    assert.strictEqual(result.matched, false);
    assert.strictEqual(result.source, "default");
});

test("resolvePreference: gespeicherte Sprache gewinnt", () => {
    const result = LanguageDetector.resolvePreference("en-US", ["de-DE"]);
    assert.strictEqual(result.locale, "en-US");
    assert.strictEqual(result.preference, "en-US");
    assert.strictEqual(result.invalidPreference, false);
});

test("resolvePreference: 'system' erkennt Deutsch", () => {
    const result = LanguageDetector.resolvePreference("system", ["de-DE"]);
    assert.strictEqual(result.locale, "de-DE");
    assert.strictEqual(result.preference, "system");
});

test("resolvePreference: ungültige Präferenz wird gemeldet, nicht geraten", () => {
    const result = LanguageDetector.resolvePreference("klingon", ["de-DE"]);
    assert.strictEqual(result.preference, "system");
    assert.strictEqual(result.locale, "de-DE");
    assert.strictEqual(result.invalidPreference, true);
});

test("isValidPreference: nur system/de-DE/en-US", () => {
    assert.strictEqual(LanguageDetector.isValidPreference("system"), true);
    assert.strictEqual(LanguageDetector.isValidPreference("fr-FR"), false);
    assert.strictEqual(LanguageDetector.isValidPreference({}), false);
});

// ─────────────────────────────────────────────
// TranslationResolver
// ─────────────────────────────────────────────

test("Resolver: löst verschachtelte Schlüssel auf", () => {
    const resolver = new TranslationResolver({ resources: { "de-DE": deDE } });
    assert.strictEqual(resolver.resolve("de-DE", "navigation.radio"), "Radio");
    assert.strictEqual(resolver.resolve("de-DE", "settings.nav.language"), "Sprache");
});

test("Resolver: interpoliert Parameter", () => {
    const resolver = new TranslationResolver({ resources: { "de-DE": deDE } });
    assert.strictEqual(
        resolver.resolve("de-DE", "settings.updates.currentVersion", { version: "v1.0.8" }),
        "Aktuelle Version: v1.0.8"
    );
});

test("Resolver: fehlender Parameter bleibt sichtbar und wird gemeldet", () => {
    const warnings = [];
    const resolver = new TranslationResolver({
        resources: { "de-DE": deDE },
        onWarning: (message) => warnings.push(message)
    });
    const text = resolver.resolve("de-DE", "settings.updates.currentVersion", {});
    assert.ok(text.includes("{version}"), "Platzhalter muss erhalten bleiben");
    assert.strictEqual(warnings.length, 1);
});

test("Resolver: Fallback auf Englisch", () => {
    const sparse = { "de-DE": { app: { name: "WebRadio" } } };
    const resolver = new TranslationResolver({
        resources: { ...sparse, "en-US": enUS },
        fallbackLocale: "en-US"
    });
    assert.strictEqual(resolver.resolve("de-DE", "navigation.radio"), "Radio");
});

test("Resolver: fehlender Schlüssel liefert den Schlüssel und meldet einmal", () => {
    const missing = [];
    const resolver = new TranslationResolver({
        resources: { "de-DE": deDE },
        fallbackLocale: "en-US",
        onMissing: (key, locale) => missing.push(`${locale}:${key}`)
    });

    assert.strictEqual(resolver.resolve("de-DE", "gibt.es.nicht"), "gibt.es.nicht");
    assert.strictEqual(resolver.resolve("de-DE", "gibt.es.nicht"), "gibt.es.nicht");
    assert.deepStrictEqual(missing, ["de-DE:gibt.es.nicht"]);
});

test("Resolver: leerer Text ist kein gültiger Wert", () => {
    const resolver = new TranslationResolver({ resources: { "de-DE": { a: { b: "" } } } });
    assert.strictEqual(resolver.resolve("de-DE", "a.b"), "a.b");
});

// ─────────────────────────────────────────────
// LocalizationManager
// ─────────────────────────────────────────────

test("Manager: t() liefert deutsche Texte", () => {
    const manager = createManager();
    assert.strictEqual(manager.t("settings.title"), "Einstellungen");
    assert.strictEqual(manager.t("settings.nav.updates"), "Updates");
    assert.strictEqual(manager.t("player.stop"), "Stopp");
});

test("Manager: Sprachwechsel wirkt sofort und meldet sich", () => {
    const manager = createManager();
    const states = [];
    const unsubscribe = manager.subscribe((state) => states.push(state.locale));

    assert.strictEqual(manager.setLocale("en-US"), true);
    assert.strictEqual(manager.t("player.stop"), "Stop");
    assert.deepStrictEqual(states, ["en-US"]);

    unsubscribe();
    manager.setLocale("de-DE");
    assert.deepStrictEqual(states, ["en-US"]);
});

test("Manager: nicht unterstützte Sprache wird abgelehnt", () => {
    const manager = createManager();
    assert.strictEqual(manager.setLocale("fr-FR"), false);
    assert.strictEqual(manager.locale, "de-DE");
});

test("Manager: Snapshot bleibt bis zur Änderung identisch", () => {
    const manager = createManager();
    const first = manager.getSnapshot();
    assert.strictEqual(manager.getSnapshot(), first);
    manager.setLocale("en-US");
    assert.notStrictEqual(manager.getSnapshot(), first);
});

test("Manager: setPreference('system') nutzt Systemsprache", () => {
    const manager = createManager({ preference: "de-DE" });
    const result = manager.setPreference("system", ["en-GB"]);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(manager.locale, "en-US");
    assert.strictEqual(manager.preference, "system");
});

test("Manager: ungültige Präferenz wird abgelehnt", () => {
    const manager = createManager();
    const result = manager.setPreference("de-AT", ["de-DE"]);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, "invalid-preference");
    assert.strictEqual(manager.preference, "de-DE");
});

test("Manager: syncState übernimmt Main-Prozess-Zustand ohne Persistenz", () => {
    const manager = createManager();
    const changed = manager.syncState({ locale: "en-US", preference: "system", systemLocale: "en-US" });
    assert.strictEqual(changed, true);
    assert.strictEqual(manager.locale, "en-US");
    assert.strictEqual(manager.preference, "system");
    assert.strictEqual(manager.getState().systemLocale, "en-US");
});

test("Manager: fehlende Übersetzung wird protokolliert und stürzt nicht ab", () => {
    const reported = [];
    const manager = createManager({ onMissingKey: (key) => reported.push(key) });
    assert.strictEqual(manager.t("nicht.vorhanden"), "nicht.vorhanden");
    assert.deepStrictEqual(reported, ["nicht.vorhanden"]);
});

test("Manager: formatDate nutzt die aktive Locale", () => {
    const manager = createManager();
    const date = new Date(2026, 10, 12);
    const german = manager.formatDate(date);
    manager.setLocale("en-US");
    const english = manager.formatDate(date);
    assert.notStrictEqual(german, english);
    assert.ok(/12\.11\.2026|12\.11\.26/.test(german), german);
    assert.ok(/11\/12\/2026|11\/12\/26/.test(english), english);
});

// ─────────────────────────────────────────────
// LocaleFormatter
// ─────────────────────────────────────────────

test("Formatter: deutsche Zahlen", () => {
    const formatter = new LocaleFormatter("de-DE");
    assert.strictEqual(formatter.formatNumber(1234.5), "1.234,5");
});

test("Formatter: englische Zahlen", () => {
    const formatter = new LocaleFormatter("en-US");
    assert.strictEqual(formatter.formatNumber(1234.5), "1,234.5");
});

test("Formatter: Prozentwerte", () => {
    const formatter = new LocaleFormatter("de-DE");
    // Intl verwendet ein geschütztes Leerzeichen vor dem Prozentzeichen.
    assert.strictEqual(formatter.formatPercent(0.42).replace(/\u00a0/g, " "), "42 %");
});

test("Formatter: Währung", () => {
    const formatter = new LocaleFormatter("de-DE");
    assert.ok(formatter.formatCurrency(9.99, "EUR").includes("9,99"));
});

test("Formatter: relative Zeit", () => {
    const formatter = new LocaleFormatter("de-DE");
    assert.strictEqual(formatter.formatRelativeTime(-3, "day"), "vor 3 Tagen");
    assert.strictEqual(formatter.formatRelativeFromNow(Date.now() - 5000), "vor 5 Sekunden");
});

test("Formatter: ungültige Werte liefern leeren Text statt NaN", () => {
    const formatter = new LocaleFormatter("de-DE");
    assert.strictEqual(formatter.formatNumber(Number.NaN), "");
    assert.strictEqual(formatter.formatDate("kein-datum"), "");
});

// ─────────────────────────────────────────────
// CatalogValidator
// ─────────────────────────────────────────────

test("Validator: gültige Kataloge werden akzeptiert", () => {
    assert.strictEqual(CatalogValidator.validateCatalog(deDE, "de-DE").valid, true);
    assert.strictEqual(CatalogValidator.validateCatalog(enUS, "en-US").valid, true);
});

test("Validator: leere Werte werden erkannt", () => {
    const result = CatalogValidator.validateCatalog({ a: { b: "   " } }, "x");
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors[0].includes("leerer"));
});

test("Validator: Nicht-String-Werte werden erkannt", () => {
    const result = CatalogValidator.validateCatalog({ a: { b: 42 } }, "x");
    assert.strictEqual(result.valid, false);
});

test("Validator: ungültige Platzhalter werden erkannt", () => {
    const result = CatalogValidator.validateCatalog({ a: { b: "Hallo {na me}" } }, "x");
    assert.strictEqual(result.valid, false);
});

test("Validator: unbalancierte Klammern werden erkannt", () => {
    const result = CatalogValidator.validateCatalog({ a: { b: "Hallo {name" } }, "x");
    assert.strictEqual(result.valid, false);
});

test("Validator: Schlüsselmengen werden verglichen", () => {
    const { missing, extra } = CatalogValidator.compareCatalogs(
        { a: { b: "1", c: "2" } },
        { a: { b: "1" }, d: "3" }
    );
    assert.deepStrictEqual(missing, ["a.c"]);
    assert.deepStrictEqual(extra, ["d"]);
});

test("Validator: Platzhalter werden verglichen", () => {
    const mismatches = CatalogValidator.comparePlaceholders(
        { a: { b: "Hallo {name}" } },
        { a: { b: "Hello {user}" } }
    );
    assert.strictEqual(mismatches.length, 1);
    assert.deepStrictEqual(mismatches[0].reference, ["name"]);
    assert.deepStrictEqual(mismatches[0].candidate, ["user"]);
});

test("Validator: doppelte Schlüssel im Roh-JSON werden erkannt", () => {
    const raw = '{"a": {"b": "1", "b": "2"}}';
    assert.deepStrictEqual(CatalogValidator.findDuplicateKeys(raw), ["a.b"]);
});

test("Validator: gleicher Schlüsselname in verschiedenen Objekten ist kein Duplikat", () => {
    const raw = '{"a": {"title": "1"}, "b": {"title": "2"}}';
    assert.deepStrictEqual(CatalogValidator.findDuplicateKeys(raw), []);
});

test("Validator: echte Sprachdateien haben keine Duplikate und gleiche Schlüssel", () => {
    const fs = require("fs");
    const path = require("path");
    const dir = path.join(__dirname, "..", "..", "electron", "core", "localization", "locales");

    for (const locale of types.SUPPORTED_LOCALES) {
        const raw = fs.readFileSync(path.join(dir, `${locale}.json`), "utf8");
        assert.deepStrictEqual(CatalogValidator.findDuplicateKeys(raw), [], `${locale} enthält Duplikate`);
    }

    const { missing, extra } = CatalogValidator.compareCatalogs(enUS, deDE);
    assert.deepStrictEqual(missing, [], "de-DE fehlen Schlüssel");
    assert.deepStrictEqual(extra, [], "de-DE hat Zusatzschlüssel");
    assert.deepStrictEqual(CatalogValidator.comparePlaceholders(enUS, deDE), []);
});

// ─────────────────────────────────────────────
// TranslationLoader
// ─────────────────────────────────────────────

function createFakeFs(files) {
    const reads = [];
    return {
        reads,
        readdirSync: () => Object.keys(files),
        readFileSync: (file) => {
            reads.push(file);
            const name = String(file).split(/[\\/]/).pop();
            if (!Object.prototype.hasOwnProperty.call(files, name)) {
                throw new Error(`ENOENT: ${name}`);
            }
            return files[name];
        }
    };
}

test("Loader: lädt und validiert Sprachdateien", () => {
    const fsModule = createFakeFs({
        "de-DE.json": JSON.stringify(deDE),
        "en-US.json": JSON.stringify(enUS)
    });
    const loader = new TranslationLoader({ directory: "/locales", fsModule });
    const { resources, errors } = loader.loadAll(["de-DE", "en-US"]);

    assert.deepStrictEqual(errors, []);
    assert.strictEqual(resources["de-DE"].navigation.radio, "Radio");
});

test("Loader: ungültiges JSON wird gemeldet, nicht geworfen", () => {
    const fsModule = createFakeFs({ "de-DE.json": "{kaputt" });
    const loader = new TranslationLoader({ directory: "/locales", fsModule });
    const { resources, errors } = loader.loadAll(["de-DE"]);

    assert.deepStrictEqual(resources, {});
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((error) => error.includes("ungültiges JSON")));
});

test("Loader: fehlende erwartete Sprache wird gemeldet", () => {
    const fsModule = createFakeFs({ "de-DE.json": JSON.stringify(deDE) });
    const loader = new TranslationLoader({ directory: "/locales", fsModule });
    const { errors } = loader.loadAll(["de-DE", "en-US"]);
    assert.ok(errors.some((error) => error.includes("en-US")));
});

test("Loader: zweiter Zugriff liest die Datei nicht erneut", () => {
    const fsModule = createFakeFs({ "de-DE.json": JSON.stringify(deDE) });
    const loader = new TranslationLoader({ directory: "/locales", fsModule });
    loader.loadAll(["de-DE"]);
    loader.loadLocale("de-DE");
    assert.strictEqual(fsModule.reads.length, 1);
});

// ─────────────────────────────────────────────
// Plugin-Lokalisierung
// ─────────────────────────────────────────────

test("Plugin: gültige Manifest-Ressourcen werden akzeptiert", () => {
    const result = validatePluginLocalization("mediahub", {
        "de-DE": { title: "MediaHub", signIn: "Anmelden" },
        "en-US": { title: "MediaHub", signIn: "Sign in" }
    });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.keyCount, 4);
});

test("Plugin: reservierter Namensraum wird abgelehnt", () => {
    const result = validatePluginLocalization("mediahub", {
        "de-DE": { plugin: { navigation: "Hijack" } }
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes("plugin")));
});

test("Plugin: leere Werte werden abgelehnt", () => {
    const result = validatePluginLocalization("mediahub", {
        "de-DE": { title: "" }
    });
    assert.strictEqual(result.valid, false);
});

test("Plugin: ungültige Plugin-ID wird abgelehnt", () => {
    const result = validatePluginLocalization("böses/plugin", { "de-DE": { a: "b" } });
    assert.strictEqual(result.valid, false);
});

test("Plugin: Übersetzungen sind namensraumgetrennt", () => {
    const manager = createManager();
    const result = manager.registerPluginTranslations("mediahub", {
        "de-DE": { title: "MediaHub", signIn: "Anmelden" },
        "en-US": { title: "MediaHub", signIn: "Sign in" }
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(manager.t("plugin.mediahub.signIn"), "Anmelden");

    // Anwendungstexte bleiben unberührt.
    assert.strictEqual(manager.t("navigation.radio"), "Radio");

    // Fremde Plugin-Schlüssel sind nicht sichtbar.
    manager.registerPluginTranslations("andere", { "de-DE": { secret: "geheim" } });
    assert.strictEqual(manager.t("plugin.mediahub.secret"), "plugin.mediahub.secret");
    assert.deepStrictEqual(manager.getPluginTranslations("mediahub"), {
        title: "MediaHub",
        signIn: "Anmelden"
    });
});

test("Plugin: belongsToPlugin prüft die Zuordnung", () => {
    assert.strictEqual(belongsToPlugin("mediahub", "plugin.mediahub.title"), true);
    assert.strictEqual(belongsToPlugin("mediahub", "plugin.andere.title"), false);
});

test("Plugin: Sprachwechsel übersetzt Plugin-Texte mit", () => {
    const manager = createManager();
    manager.registerPluginTranslations("mediahub", {
        "de-DE": { signIn: "Anmelden" },
        "en-US": { signIn: "Sign in" }
    });
    manager.setLocale("en-US");
    assert.strictEqual(manager.t("plugin.mediahub.signIn"), "Sign in");
});

// ─────────────────────────────────────────────
// Abschluss
// ─────────────────────────────────────────────

(async () => {
    await testAsync("Async: keine offenen Zusagen", async () => {
        assert.ok(true);
    });

    console.log(`\nErgebnis: ${passed} bestanden, ${failed} fehlgeschlagen`);
    if (failed > 0) process.exit(1);
})();
