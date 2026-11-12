"use strict";

/**
 * localization-integration.test.js
 *
 * Integrationstests der Localization Engine.
 *
 * Diese Tests bilden den Ablauf Main-Prozess ⇄ Persistenz ⇄ Renderer-Store
 * nach. Der Electron-Prozess selbst wird nicht gestartet; die IPC-Grenze wird
 * durch die validierende Präferenzlogik und die `syncState`-Schnittstelle
 * abgebildet. Damit sind es simulierte Integrationstests, keine echten
 * End-to-End-Tests der laufenden Anwendung.
 */

const assert = require("assert");

const { LocalizationManager } = require("../../electron/core/localization/LocalizationManager");
const types = require("../../electron/core/localization/types");

const deDE = require("../../electron/core/localization/locales/de-DE.json");
const enUS = require("../../electron/core/localization/locales/en-US.json");

console.log("==========================================");
console.log("Localization Integration Tests (simuliert)");
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

const RESOURCES = { "de-DE": deDE, "en-US": enUS };

/**
 * Simuliert die Main-Prozess-Seite: Systemsprachen + persistierte Präferenz.
 */
function createHost({ systemLocales = ["de-DE"], settings = {} } = {}) {
    const storage = { ...settings };
    const windows = [];

    const manager = new LocalizationManager({
        resources: RESOURCES,
        fallbackLocale: "en-US"
    });

    manager.setPreference(types.LANGUAGE_PREFERENCES.includes(storage.language) ? storage.language : "system", systemLocales);

    return {
        manager,
        storage,
        windows,
        getState() {
            const state = manager.getState();
            return {
                ok: true,
                locale: state.locale,
                preference: state.preference,
                systemLocale: state.systemLocale,
                supported: state.supported,
                pluginIds: manager.getPluginIds()
            };
        },
        setLanguage(preference) {
            // Entspricht der Validierung im IPC-Handler.
            if (typeof preference !== "string") return { ok: false, error: "invalid-preference" };
            if (!types.LANGUAGE_PREFERENCES.includes(preference)) return { ok: false, error: "invalid-preference" };

            const result = manager.setPreference(preference, systemLocales);
            if (!result.ok) return { ok: false, error: result.reason };

            storage.language = manager.preference;
            const state = this.getState();
            for (const window of windows) window.receive(state);
            return { ok: true, locale: manager.locale, preference: manager.preference };
        },
        broadcast(state) {
            for (const window of windows) window.receive(state);
        },
        // Entspricht `localization:get-agent-catalogs`: reine Daten.
        getPluginCatalogs(pluginId) {
            return manager.getPluginCatalogSet(pluginId);
        }
    };
}

/**
 * Simuliert einen Renderer: eigener Manager + Broadcast-Empfang.
 */
function createRenderer(host) {
    const manager = new LocalizationManager({
        resources: RESOURCES,
        locale: "en-US",
        preference: "system",
        fallbackLocale: "en-US"
    });

    const renderer = {
        manager,
        received: 0,
        receive(state) {
            renderer.received += 1;
            manager.syncState(state);
            // Entspricht der Renderer-Seite: Plugin-Kataloge gezielt nachladen.
            for (const pluginId of state.pluginIds || []) {
                const catalogs = host.getPluginCatalogs(pluginId);
                if (catalogs) manager.registerPluginTranslations(pluginId, catalogs);
            }
        },
        t: (key, params) => manager.t(key, params)
    };

    host.windows.push(renderer);
    return renderer;
}

// ─────────────────────────────────────────────
// Initialisierung
// ─────────────────────────────────────────────

test("Initialisierung: Systemsprache Deutsch wird übernommen", () => {
    const host = createHost({ systemLocales: ["de-DE"] });
    assert.strictEqual(host.getState().locale, "de-DE");
    assert.strictEqual(host.getState().preference, "system");
});

test("Initialisierung: nicht unterstützte Systemsprache fällt auf Englisch zurück", () => {
    const host = createHost({ systemLocales: ["fr-FR"] });
    assert.strictEqual(host.getState().locale, "en-US");
    assert.strictEqual(host.getState().systemLocale, "fr-FR");
});

test("Initialisierung: gespeicherte Präferenz schlägt die Systemsprache", () => {
    const host = createHost({ systemLocales: ["de-DE"], settings: { language: "en-US" } });
    assert.strictEqual(host.getState().locale, "en-US");
    assert.strictEqual(host.getState().preference, "en-US");
});

test("Initialisierung: ungültiger gespeicherter Wert wird nicht übernommen", () => {
    const host = createHost({ systemLocales: ["de-DE"], settings: { language: "de-AT" } });
    assert.strictEqual(host.getState().preference, "system");
    assert.strictEqual(host.getState().locale, "de-DE");
});

// ─────────────────────────────────────────────
// Manuelle Auswahl und Sprachwechsel
// ─────────────────────────────────────────────

test("Sprachwechsel: Auswahl wirkt sofort im Host", () => {
    const host = createHost({ systemLocales: ["de-DE"] });
    const result = host.setLanguage("en-US");

    assert.strictEqual(result.ok, true);
    assert.strictEqual(host.manager.t("player.stop"), "Stop");
});

test("Sprachwechsel: alle Fenster erhalten denselben Zustand", () => {
    const host = createHost({ systemLocales: ["de-DE"] });
    const main = createRenderer(host);
    const settings = createRenderer(host);

    host.broadcast(host.getState());
    host.setLanguage("en-US");

    assert.strictEqual(main.manager.locale, "en-US");
    assert.strictEqual(settings.manager.locale, "en-US");
    assert.strictEqual(main.manager.t("settings.nav.updates"), "Updates");
    assert.strictEqual(settings.manager.t("settings.nav.updates"), "Updates");
});

test("Sprachwechsel: Rückkehr zu Systemstandard erkennt die Systemsprache", () => {
    const host = createHost({ systemLocales: ["de-DE"], settings: { language: "en-US" } });
    host.setLanguage("system");
    assert.strictEqual(host.manager.locale, "de-DE");
    assert.strictEqual(host.storage.language, "system");
});

test("Sprachwechsel: ungültige Werte werden abgelehnt", () => {
    const host = createHost({ systemLocales: ["de-DE"] });

    for (const invalid of [null, 42, {}, [], "fr-FR", "", "SYSTEM"]) {
        const result = host.setLanguage(invalid);
        assert.strictEqual(result.ok, false, `Wert ${JSON.stringify(invalid)} hätte abgelehnt werden müssen`);
    }

    assert.strictEqual(host.manager.locale, "de-DE");
});

// ─────────────────────────────────────────────
// Persistenz
// ─────────────────────────────────────────────

test("Persistenz: Auswahl übersteht einen simulierten Neustart", () => {
    const first = createHost({ systemLocales: ["de-DE"] });
    first.setLanguage("en-US");
    assert.strictEqual(first.storage.language, "en-US");

    const restarted = createHost({ systemLocales: ["de-DE"], settings: first.storage });
    assert.strictEqual(restarted.manager.locale, "en-US");
    assert.strictEqual(restarted.manager.t("settings.title"), "Settings");
});

test("Persistenz: keine anderen Einstellungen gehen verloren", () => {
    const host = createHost({ systemLocales: ["de-DE"], settings: { theme: "dark", volume: 0.4 } });
    host.setLanguage("en-US");

    assert.strictEqual(host.storage.theme, "dark");
    assert.strictEqual(host.storage.volume, 0.4);
    assert.strictEqual(host.storage.language, "en-US");
});

// ─────────────────────────────────────────────
// Renderer-Vertrag (useSyncExternalStore)
// ─────────────────────────────────────────────

test("Renderer: Store-Vertrag mit stabilem Snapshot", () => {
    const host = createHost({ systemLocales: ["de-DE"] });
    const renderer = createRenderer(host);

    // Erster Abgleich (Systemsprache ergänzen), danach darf ein identischer
    // Broadcast kein weiteres Re-Render auslösen.
    host.broadcast(host.getState());

    let snapshots = 0;
    const unsubscribe = renderer.manager.subscribe(() => { snapshots += 1; });

    const before = renderer.manager.getSnapshot();
    assert.strictEqual(renderer.manager.getSnapshot(), before);

    host.broadcast(host.getState());
    assert.strictEqual(snapshots, 0, "unveränderter Zustand darf kein Re-Render auslösen");

    host.setLanguage("en-US");
    assert.strictEqual(snapshots, 1);
    assert.notStrictEqual(renderer.manager.getSnapshot(), before);

    unsubscribe();
});

test("Renderer: mehrere Konsumenten teilen denselben Sprachzustand", () => {
    const host = createHost({ systemLocales: ["de-DE"] });
    const a = createRenderer(host);
    const b = createRenderer(host);

    host.setLanguage("en-US");
    const localeA = a.manager.getSnapshot().locale;
    const localeB = b.manager.getSnapshot().locale;

    assert.strictEqual(localeA, localeB);
    assert.strictEqual(a.t("home.title"), b.t("home.title"));
});

// ─────────────────────────────────────────────
// Fallback
// ─────────────────────────────────────────────

test("Fallback: fehlender deutscher Schlüssel nutzt Englisch", () => {
    const sparseGerman = JSON.parse(JSON.stringify(deDE));
    delete sparseGerman.settings.diagnostics.crashEmpty;

    const manager = new LocalizationManager({
        resources: { "de-DE": sparseGerman, "en-US": enUS },
        locale: "de-DE",
        preference: "de-DE",
        fallbackLocale: "en-US"
    });

    assert.strictEqual(manager.t("settings.diagnostics.crashEmpty"), "No crash reports available ✓");
});

test("Fallback: in beiden Sprachen fehlender Schlüssel liefert den Schlüssel", () => {
    const manager = new LocalizationManager({
        resources: { "de-DE": {}, "en-US": {} },
        locale: "de-DE",
        preference: "de-DE",
        fallbackLocale: "en-US"
    });

    assert.strictEqual(manager.t("voellig.unbekannt"), "voellig.unbekannt");
});

// ─────────────────────────────────────────────
// Plugin-Übersetzungen im Gesamtfluss
// ─────────────────────────────────────────────

test("Plugin: Registrierung wirkt auf alle Fenster nach Broadcast", () => {
    const host = createHost({ systemLocales: ["de-DE"] });
    const renderer = createRenderer(host);

    const registration = host.manager.registerPluginTranslations("mediahub", {
        "de-DE": { searchPlaceholder: "Auf MediaHub suchen" },
        "en-US": { searchPlaceholder: "Search MediaHub" }
    });
    assert.strictEqual(registration.ok, true);

    host.broadcast(host.getState());
    assert.deepStrictEqual(host.getState().pluginIds, ["mediahub"]);
    assert.strictEqual(renderer.manager.t("plugin.mediahub.searchPlaceholder"), "Auf MediaHub suchen");

    host.setLanguage("en-US");
    assert.strictEqual(renderer.manager.t("plugin.mediahub.searchPlaceholder"), "Search MediaHub");
});

test("Plugin: Anwendungstexte können nicht überschrieben werden", () => {
    const host = createHost({ systemLocales: ["de-DE"] });
    const before = host.manager.t("navigation.radio");

    const result = host.manager.registerPluginTranslations("boese", {
        "de-DE": { plugin: { navigation: { radio: "Gekapert" } } }
    });

    assert.strictEqual(result.ok, false);
    assert.strictEqual(host.manager.t("navigation.radio"), before);
});

// ─────────────────────────────────────────────
// Formatierung über die Sprachgrenze
// ─────────────────────────────────────────────

test("Formatierung: Datum folgt dem Sprachwechsel", () => {
    const host = createHost({ systemLocales: ["de-DE"] });
    const date = new Date(2026, 10, 12);

    const german = host.manager.formatDate(date);
    host.setLanguage("en-US");
    const english = host.manager.formatDate(date);

    assert.notStrictEqual(german, english);
});

test("Formatierung: relative Zeit in beiden Sprachen", () => {
    const host = createHost({ systemLocales: ["de-DE"] });
    assert.strictEqual(host.manager.formatRelativeTime(-2, "hour"), "vor 2 Stunden");

    host.setLanguage("en-US");
    assert.strictEqual(host.manager.formatRelativeTime(-2, "hour"), "2 hours ago");
});

// ─────────────────────────────────────────────
// Abschluss
// ─────────────────────────────────────────────

console.log(`\nErgebnis: ${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) process.exit(1);
