"use strict";
const assert = require("assert");
const os = require("os");
const fs = require("fs");
const path = require("path");
const Module = require("module");

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, p, m, o) {
    if (r === "electron") return "el-pp";
    return origResolve.call(this, r, p, m, o);
};

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wbrb-pp-test-"));
const logsDir = path.join(tmpRoot, "logs");
const tempDir = path.join(tmpRoot, "temp");
const pluginsDir = path.join(tmpRoot, "plugins");
fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });
fs.mkdirSync(pluginsDir, { recursive: true });

const fakeApp = {
    isPackaged: true,
    getVersion: () => "1.0.6-beta.4",
    getPath: (k) => {
        if (k === "userData") return tmpRoot;
        if (k === "temp") return tempDir;
        return tmpRoot;
    }
};

require.cache["el-pp"] = { id: "el-pp", filename: "el-pp", loaded: true, exports: { app: fakeApp } };

require("../../electron/core/storage/StorageManager").initialize();
const LogManager = require("../../electron/core/diagnostics/logging/LogManager");
LogManager.initialize({ transports: ["console"] });

let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); console.log(`  [OK] ${name}`); pass++; }
    catch (e) { console.error(`  [FAIL] ${name}: ${(e && e.message) || String(e)}`); fail++; }
}

// Mock Plugin-Verzeichnisstruktur
function createMockPlugin(id, name) {
    const pluginPath = path.join(pluginsDir, id);
    fs.mkdirSync(pluginPath, { recursive: true });
    fs.writeFileSync(
        path.join(pluginPath, "manifest.json"),
        JSON.stringify({ id, name, version: "1.0.0", main: "main.js" }, null, 2)
    );
    fs.writeFileSync(
        path.join(pluginPath, "main.js"),
        `module.exports = { init: () => {}, destroy: () => {} };`
    );
}

function cleanup() {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {
        // Ignore cleanup errors
    }
}

console.log("=== Plugin-Persistenz Tests (Enable/Disable/Uninstall) ===");

(async () => {
    // Test 1: Plugin installieren → enabled=true → plugins.json enthält Plugin
    await (async () => {
        createMockPlugin("test-plugin-1", "Test Plugin 1");
        
        const PluginManager = require("../../electron/core/plugins/PluginManager");
        PluginManager.initialize();
        
        // Nach initialize() ist das Plugin in this.plugins, aber noch nicht in config
        assert.ok(PluginManager.hasPlugin("test-plugin-1"), "Plugin in this.plugins Map");
        
        // Nach togglePlugin() ist es in config
        PluginManager.togglePlugin("test-plugin-1", true);
        const config = PluginManager.readConfig();
        assert.ok(config.plugins["test-plugin-1"], "Plugin in config vorhanden nach togglePlugin");
        assert.strictEqual(config.plugins["test-plugin-1"].enabled, true, "Plugin enabled=true");
        
        PluginManager.shutdown();
        delete require.cache[require.resolve("../../electron/core/plugins/PluginManager")];
        console.log("  [OK] Plugin installieren und enabled=true in config");
        pass++;
    })();

    // Test 2: Plugin deaktivieren → enabled=false → Plugin bleibt in config
    await (async () => {
        createMockPlugin("test-plugin-2", "Test Plugin 2");
        
        const PluginManager = require("../../electron/core/plugins/PluginManager");
        PluginManager.initialize();
        
        PluginManager.togglePlugin("test-plugin-2", false);
        
        const config = PluginManager.readConfig();
        assert.ok(config.plugins["test-plugin-2"], "Plugin weiterhin in config");
        assert.strictEqual(config.plugins["test-plugin-2"].enabled, false, "Plugin enabled=false");
        
        PluginManager.shutdown();
        delete require.cache[require.resolve("../../electron/core/plugins/PluginManager")];
        console.log("  [OK] Plugin deaktivieren bleibt in config mit enabled=false");
        pass++;
    })();

    // Test 3: App/Core neu initialisieren → Plugin bleibt disabled
    await (async () => {
        createMockPlugin("test-plugin-3", "Test Plugin 3");
        
        const PluginManager = require("../../electron/core/plugins/PluginManager");
        PluginManager.initialize();
        PluginManager.togglePlugin("test-plugin-3", false);
        PluginManager.shutdown();
        
        delete require.cache[require.resolve("../../electron/core/plugins/PluginManager")];
        const PluginManager2 = require("../../electron/core/plugins/PluginManager");
        PluginManager2.initialize();
        
        const config = PluginManager2.readConfig();
        assert.ok(config.plugins["test-plugin-3"], "Plugin in config nach Reinit");
        assert.strictEqual(config.plugins["test-plugin-3"].enabled, false, "Plugin weiterhin disabled");
        
        PluginManager2.shutdown();
        delete require.cache[require.resolve("../../electron/core/plugins/PluginManager")];
        console.log("  [OK] Neu-Initialisierung behält disabled-Status");
        pass++;
    })();

    // Test 4: Plugin wieder aktivieren → enabled=true
    await (async () => {
        createMockPlugin("test-plugin-4", "Test Plugin 4");
        
        const PluginManager = require("../../electron/core/plugins/PluginManager");
        PluginManager.initialize();
        PluginManager.togglePlugin("test-plugin-4", false);
        PluginManager.togglePlugin("test-plugin-4", true);
        
        const config = PluginManager.readConfig();
        assert.strictEqual(config.plugins["test-plugin-4"].enabled, true, "Plugin wieder enabled=true");
        
        PluginManager.shutdown();
        delete require.cache[require.resolve("../../electron/core/plugins/PluginManager")];
        console.log("  [OK] Disabled Plugin wieder aktivieren");
        pass++;
    })();

    // Test 5: getPlugins() zeigt auch deaktivierte Plugins
    await (async () => {
        createMockPlugin("test-plugin-5", "Test Plugin 5");
        
        const PluginManager = require("../../electron/core/plugins/PluginManager");
        PluginManager.initialize();
        PluginManager.togglePlugin("test-plugin-5", false);
        
        const plugins = PluginManager.getPlugins();
        const testPlugin = plugins.find(p => p.id === "test-plugin-5");
        assert.ok(testPlugin, "Plugin in getPlugins() Liste");
        assert.strictEqual(testPlugin.enabled, false, "Plugin als disabled angezeigt");
        
        PluginManager.shutdown();
        delete require.cache[require.resolve("../../electron/core/plugins/PluginManager")];
        console.log("  [OK] getPlugins() zeigt auch deaktivierte Plugins");
        pass++;
    })();

    // Test 6: Disable löscht keine Plugin-Daten
    await (async () => {
        createMockPlugin("test-plugin-6", "Test Plugin 6");
        const pluginPath = path.join(pluginsDir, "test-plugin-6");
        
        const PluginManager = require("../../electron/core/plugins/PluginManager");
        PluginManager.initialize();
        PluginManager.togglePlugin("test-plugin-6", false);
        
        assert.ok(fs.existsSync(pluginPath), "Plugin-Verzeichnis noch vorhanden");
        assert.ok(fs.existsSync(path.join(pluginPath, "manifest.json")), "manifest.json noch vorhanden");
        
        PluginManager.shutdown();
        delete require.cache[require.resolve("../../electron/core/plugins/PluginManager")];
        console.log("  [OK] Disable löscht keine Plugin-Daten aus Dateisystem");
        pass++;
    })();

    // Test 7: Enable/Disable mehrfach hintereinander
    await (async () => {
        createMockPlugin("test-plugin-7", "Test Plugin 7");
        
        const PluginManager = require("../../electron/core/plugins/PluginManager");
        PluginManager.initialize();
        
        PluginManager.togglePlugin("test-plugin-7", false);
        PluginManager.togglePlugin("test-plugin-7", true);
        PluginManager.togglePlugin("test-plugin-7", false);
        PluginManager.togglePlugin("test-plugin-7", true);
        
        const config = PluginManager.readConfig();
        assert.ok(config.plugins["test-plugin-7"], "Plugin in config");
        assert.strictEqual(config.plugins["test-plugin-7"].enabled, true, "Finaler Status enabled=true");
        
        const plugins = PluginManager.getPlugins();
        const testPluginCount = plugins.filter(p => p.id === "test-plugin-7").length;
        assert.strictEqual(testPluginCount, 1, "Keine Duplikate in getPlugins()");
        
        PluginManager.shutdown();
        delete require.cache[require.resolve("../../electron/core/plugins/PluginManager")];
        console.log("  [OK] Enable/Disable mehrfach hintereinander ohne Duplikate");
        pass++;
    })();

    // Test 8: reloadPlugins() behält disabled-Status
    await (async () => {
        createMockPlugin("test-plugin-8", "Test Plugin 8");
        
        const PluginManager = require("../../electron/core/plugins/PluginManager");
        PluginManager.initialize();
        PluginManager.togglePlugin("test-plugin-8", false);
        
        PluginManager.reloadPlugins();
        
        const config = PluginManager.readConfig();
        assert.strictEqual(config.plugins["test-plugin-8"].enabled, false, "Plugin nach reloadPlugins noch disabled");
        
        PluginManager.shutdown();
        delete require.cache[require.resolve("../../electron/core/plugins/PluginManager")];
        console.log("  [OK] reloadPlugins() behält disabled-Status");
        pass++;
    })();

    // Test 9: this.plugins Map enthält auch deaktivierte Plugins
    await (async () => {
        createMockPlugin("test-plugin-9", "Test Plugin 9");
        
        const PluginManager = require("../../electron/core/plugins/PluginManager");
        PluginManager.initialize();
        PluginManager.togglePlugin("test-plugin-9", false);
        
        assert.ok(PluginManager.hasPlugin("test-plugin-9"), "Plugin in this.plugins Map");
        
        PluginManager.shutdown();
        delete require.cache[require.resolve("../../electron/core/plugins/PluginManager")];
        console.log("  [OK] this.plugins Map enthält auch deaktivierte Plugins");
        pass++;
    })();

    // Test 10: Disable vs Uninstall Semantik
    await (async () => {
        createMockPlugin("test-plugin-10", "Test Plugin 10");
        
        const PluginManager = require("../../electron/core/plugins/PluginManager");
        PluginManager.initialize();
        
        PluginManager.togglePlugin("test-plugin-10", false);
        assert.ok(PluginManager.hasPlugin("test-plugin-10"), "Plugin nach Disable noch in Map");
        
        const config = PluginManager.readConfig();
        assert.ok(config.plugins["test-plugin-10"], "Plugin nach Disable noch in config");
        
        fs.rmSync(path.join(pluginsDir, "test-plugin-10"), { recursive: true, force: true });
        
        const result = PluginManager.reloadPlugins();
        assert.ok(result.removed.includes("test-plugin-10"), "Plugin nach Dateisystem-Entfernung als removed markiert");
        assert.ok(!PluginManager.hasPlugin("test-plugin-10"), "Plugin nach Uninstall nicht mehr in Map");
        
        PluginManager.shutdown();
        delete require.cache[require.resolve("../../electron/core/plugins/PluginManager")];
        console.log("  [OK] Disable != Uninstall - Disable behält Plugin, Uninstall entfernt");
        pass++;
    })();

    console.log("\n==========================================");
    console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
    console.log("==========================================");
    
    cleanup();
    
    if (fail > 0) process.exit(1);
})();
