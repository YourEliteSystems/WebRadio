"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

// ─────────────────────────────────────────────────────────────
// Electron Stub Setup
// ─────────────────────────────────────────────────────────────
// PluginManager liest das Plugin-Verzeichnis via `app.getPath('userData')`.
// Wir liefern eine Sandbox in einem temporären Verzeichnis. Pro Test
// wird ein neuer Sandbox-Pfad verwendet, damit require.cache keine
// stale Module-Instanzen zwischen Tests teilt.

let tmpRoot = null;
let testCounter = 0;

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "electron") return "electron-stub";
    return originalResolve.call(this, request, parent, isMain, options);
};

const fakeApp = {
    getPath: () => tmpRoot
};
require.cache["electron-stub"] = {
    id: "electron-stub",
    filename: "electron-stub",
    loaded: true,
    exports: { app: fakeApp }
};

// ─────────────────────────────────────────────────────────────
// Test-Framework
// ─────────────────────────────────────────────────────────────

console.log("==========================================");
console.log("🧪 Starte PluginManager Rescan Tests");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    testCounter++;
    // Frische Sandbox (neuer Pfad) pro Test
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `webradio-plugin-test-${testCounter}-`));

    // Vor jedem Test: alle gecachten Module löschen, die mit dem
    // Plugin-System zusammenhängen, damit ein neuer PluginManager-
    // Singleton mit dem neuen Sandbox-Pfad verwendet wird.
    // Wichtig: Den "electron-stub"-Eintrag nicht entfernen!
    for (const key of Object.keys(require.cache)) {
        if (
            key.includes(path.join("electron", "core", "plugins")) ||
            key.includes(path.join("electron", "core", "navigation")) ||
            key.includes(path.join("electron", "core", "storage")) ||
            key.includes(path.join("electron", "core", "diagnostics")) ||
            key.includes(path.join("electron", "core", "ui")) ||
            key.includes(path.join("electron", "core", "eventBus"))
        ) {
            delete require.cache[key];
        }
    }

    try {
        fn();
        console.log(`  ✅ ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`  ❌ ${name}`);
        console.error(`     Error: ${err.message}`);
        if (err.stack) console.error(err.stack.split("\n").slice(0, 5).join("\n"));
        testsFailed++;
    } finally {
        // Sandbox aufräumen
        try {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        } catch (e) {
            // Cleanup-Fehler sind unkritisch
        }
    }
}

function loadPluginManager() {
    return require("../../electron/core/plugins/PluginManager");
}

function loadNavigationRegistry() {
    return require("../../electron/core/navigation/NavigationRegistry");
}

function pluginsDir() {
    return path.join(tmpRoot, "plugins");
}

function configPath() {
    return path.join(tmpRoot, "plugins", "plugins.json");
}

function makePluginFolder(id, name, version, mainBody, options = {}) {
    const dir = path.join(pluginsDir(), id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({
        id,
        name,
        version,
        main: "main.js",
        renderer: options.renderer || null,
        permissions: options.permissions || []
    }));
    fs.writeFileSync(path.join(dir, "main.js"), mainBody);
    return dir;
}

function removePluginFolder(id) {
    const dir = path.join(pluginsDir(), id);
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function setEnabled(id, enabled) {
    fs.mkdirSync(pluginsDir(), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify({
        plugins: { [id]: { enabled } }
    }, null, 2));
}

const mainBodyA = `
module.exports = {
    init: () => {},
    destroy: () => {}
};
`;

const mainBodyFailing = `
throw new Error("Plugin-Start absichtlich fehlgeschlagen");
module.exports = {};
`;

const mainBodyWithNavigation = `
module.exports = {
    init: (ctx) => {
        ctx.navigation.registerSection({ id: "test-nav-section", label: "Test Section" });
    },
    destroy: () => {}
};
`;

// ─────────────────────────────────────────────────────────────
// 1. Neues Plugin wird beim Rescan erkannt und geladen
// ─────────────────────────────────────────────────────────────
console.log("\n[1] Neues Plugin wird erkannt");

test("Test 1 – neues Plugin wird hinzugefügt und gestartet", () => {
    const PluginManager = loadPluginManager();
    makePluginFolder("plugin-a", "Plugin A", "1.0.0", mainBodyA);
    setEnabled("plugin-a", true);

    const result = PluginManager.reloadPlugins();

    assert.strictEqual(result.success, true, "Rescan muss erfolgreich sein");
    assert.ok(result.added.includes("plugin-a"), "plugin-a muss in added sein");
    assert.strictEqual(PluginManager.hasPlugin("plugin-a"), true);
    assert.strictEqual(PluginManager.getPlugin("plugin-a").loaded, true);
});

// ─────────────────────────────────────────────────────────────
// 2. Entferntes Plugin wird gestoppt und aus Map entfernt
// ─────────────────────────────────────────────────────────────
console.log("\n[2] Entferntes Plugin");

test("Test 2 – entferntes Plugin wird gestoppt", () => {
    const PluginManager = loadPluginManager();
    makePluginFolder("plugin-a", "Plugin A", "1.0.0", mainBodyA);
    setEnabled("plugin-a", true);

    PluginManager.reloadPlugins();
    assert.strictEqual(PluginManager.hasPlugin("plugin-a"), true);

    removePluginFolder("plugin-a");

    const result = PluginManager.reloadPlugins();
    assert.ok(result.removed.includes("plugin-a"), "plugin-a muss in removed sein");
    assert.strictEqual(PluginManager.hasPlugin("plugin-a"), false);
});

// ─────────────────────────────────────────────────────────────
// 3. Unverändertes Plugin wird nicht neu gestartet
// ─────────────────────────────────────────────────────────────
console.log("\n[3] Unverändertes Plugin");

test("Test 3 – unverändertes Plugin wird nicht neu gestartet", () => {
    const PluginManager = loadPluginManager();
    makePluginFolder("plugin-a", "Plugin A", "1.0.0", mainBodyA);
    setEnabled("plugin-a", true);

    PluginManager.reloadPlugins();
    const instanceBefore = PluginManager.getPlugin("plugin-a").instance;

    const result = PluginManager.reloadPlugins();
    const instanceAfter = PluginManager.getPlugin("plugin-a").instance;

    assert.ok(result.unchanged.includes("plugin-a"));
    assert.strictEqual(instanceBefore, instanceAfter,
        "Instanz darf nicht neu erzeugt worden sein");
});

// ─────────────────────────────────────────────────────────────
// 4. Geändertes Plugin wird sauber neu geladen
// ─────────────────────────────────────────────────────────────
console.log("\n[4] Geändertes Plugin");

test("Test 4 – geändertes Plugin wird gestoppt und neu geladen", () => {
    const PluginManager = loadPluginManager();
    makePluginFolder("plugin-a", "Plugin A", "1.0.0", mainBodyA);
    setEnabled("plugin-a", true);

    PluginManager.reloadPlugins();
    const oldPlugin = PluginManager.getPlugin("plugin-a");

    // Manifest-Änderung simulieren
    fs.writeFileSync(path.join(pluginsDir(), "plugin-a", "manifest.json"),
        JSON.stringify({ id: "plugin-a", name: "Plugin A", version: "1.1.0", main: "main.js" }));

    const result = PluginManager.reloadPlugins();
    const newPlugin = PluginManager.getPlugin("plugin-a");

    assert.ok(result.changed.includes("plugin-a"), "plugin-a muss in changed sein");
    assert.ok(newPlugin.instance, "neue Plugin-Instanz muss existieren");
    assert.notStrictEqual(newPlugin.instance, oldPlugin.instance,
        "Plugin-Instanz muss neu sein");
});

// ─────────────────────────────────────────────────────────────
// 5. Deaktiviertes Plugin bleibt entladen
// ─────────────────────────────────────────────────────────────
console.log("\n[5] Deaktiviertes Plugin");

test("Test 5 – enabled=false bleibt entladen", () => {
    const PluginManager = loadPluginManager();
    makePluginFolder("plugin-a", "Plugin A", "1.0.0", mainBodyA);
    setEnabled("plugin-a", false);

    const result = PluginManager.reloadPlugins();

    assert.strictEqual(PluginManager.hasPlugin("plugin-a"), false);
    assert.ok(!result.added.includes("plugin-a"));
});

// ─────────────────────────────────────────────────────────────
// 6. Deaktivierung zur Laufzeit
// ─────────────────────────────────────────────────────────────
console.log("\n[6] Plugin zur Laufzeit deaktiviert");

test("Test 6 – laufendes Plugin wird nach enabled=false gestoppt", () => {
    const PluginManager = loadPluginManager();
    makePluginFolder("plugin-a", "Plugin A", "1.0.0", mainBodyA);
    setEnabled("plugin-a", true);

    PluginManager.reloadPlugins();
    assert.strictEqual(PluginManager.hasPlugin("plugin-a"), true);

    setEnabled("plugin-a", false);

    const result = PluginManager.reloadPlugins();
    assert.strictEqual(PluginManager.hasPlugin("plugin-a"), false);
    assert.ok(result.disabled.includes("plugin-a") ||
        result.removed.includes("plugin-a"),
        "plugin-a muss als removed oder disabled gemeldet sein");
});

// ─────────────────────────────────────────────────────────────
// 7. Fehlerhaftes Plugin bricht Rescan nicht ab
// ─────────────────────────────────────────────────────────────
console.log("\n[7] Fehlerhaftes Plugin");

test("Test 7 – einzelner Plugin-Fehler bricht Rescan nicht ab", () => {
    const PluginManager = loadPluginManager();
    makePluginFolder("plugin-a", "Plugin A", "1.0.0", mainBodyA);
    makePluginFolder("plugin-b", "Plugin B", "1.0.0", mainBodyFailing);
    makePluginFolder("plugin-c", "Plugin C", "1.0.0", `
module.exports = {
    init: () => {},
    destroy: () => {}
};
`);
    setEnabled("plugin-a", true);
    setEnabled("plugin-b", true);
    setEnabled("plugin-c", true);

    const result = PluginManager.reloadPlugins();

    assert.strictEqual(PluginManager.hasPlugin("plugin-a"), true,
        "Plugin A muss trotz Fehler in B geladen sein");
    assert.strictEqual(PluginManager.hasPlugin("plugin-c"), true,
        "Plugin C muss trotz Fehler in B geladen sein");
    assert.ok(result.errors.length >= 1, "Fehler müssen geloggt sein");
});

// ─────────────────────────────────────────────────────────────
// 8. Navigation wird beim Stop entfernt
// ─────────────────────────────────────────────────────────────
console.log("\n[8] Navigation Cleanup");

test("Test 8 – Navigation eines entfernten Plugins verschwindet", () => {
    const PluginManager = loadPluginManager();
    const NavigationRegistry = loadNavigationRegistry();

    makePluginFolder("plugin-a", "Plugin A", "1.0.0", mainBodyWithNavigation, {
        permissions: ["navigation"]
    });
    setEnabled("plugin-a", true);

    PluginManager.reloadPlugins();

    assert.notStrictEqual(NavigationRegistry.getSection("test-nav-section"), null,
        "Section muss nach Start registriert sein");

    removePluginFolder("plugin-a");
    PluginManager.reloadPlugins();

    assert.strictEqual(NavigationRegistry.getSection("test-nav-section"), null,
        "Section muss nach Plugin-Stop entfernt sein");
});

// ─────────────────────────────────────────────────────────────
// 9. Neues Plugin mit Navigation
// ─────────────────────────────────────────────────────────────
console.log("\n[9] Neues Plugin mit Navigation");

test("Test 9 – neues Plugin registriert Navigation beim Start", () => {
    const PluginManager = loadPluginManager();
    const NavigationRegistry = loadNavigationRegistry();

    makePluginFolder("plugin-a", "Plugin A", "1.0.0", mainBodyWithNavigation, {
        permissions: ["navigation"]
    });
    setEnabled("plugin-a", true);

    const result = PluginManager.reloadPlugins();

    assert.ok(result.added.includes("plugin-a"));
    assert.notStrictEqual(NavigationRegistry.getSection("test-nav-section"), null,
        "Section muss nach Plugin-Start existieren");
});

// ─────────────────────────────────────────────────────────────
// 10. Strukturiertes Resultat für IPC
// ─────────────────────────────────────────────────────────────
console.log("\n[10] Strukturiertes Resultat für IPC");

test("Test 10 – reloadPlugins liefert strukturiertes Resultat", () => {
    const PluginManager = loadPluginManager();
    makePluginFolder("plugin-a", "Plugin A", "1.0.0", mainBodyA);
    setEnabled("plugin-a", true);

    const result = PluginManager.reloadPlugins();

    assert.ok("added" in result, "added muss vorhanden sein");
    assert.ok("removed" in result, "removed muss vorhanden sein");
    assert.ok("changed" in result, "changed muss vorhanden sein");
    assert.ok("unchanged" in result, "unchanged muss vorhanden sein");
    assert.ok("disabled" in result, "disabled muss vorhanden sein");
    assert.ok("errors" in result, "errors muss vorhanden sein");
    assert.strictEqual(typeof result.success, "boolean", "success muss boolean sein");
});

// ─────────────────────────────────────────────────────────────
// Zusammenfassung
// ─────────────────────────────────────────────────────────────
console.log("\n==========================================");
console.log(`Ergebnis: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen.`);
console.log("==========================================");

if (testsFailed > 0) {
    process.exit(1);
}
