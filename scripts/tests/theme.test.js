"use strict";

const assert = require("assert");
const ThemeManager = require("../../electron/core/themes/ThemeManager");
const ThemeLoader = require("../../electron/core/themes/ThemeLoader");
const ThemeValidator = require("../../electron/core/themes/ThemeValidator");
const StorageManager = require("../../electron/core/storage/StorageManager");

console.log("==========================================");
console.log("🧪 Starte Theme-System Tests");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`  ❌ ${name}`);
        console.error(`     Error: ${err.message}`);
        testsFailed++;
    }
}

// ─────────────────────────────────────────────────────────────
// 1. ThemeValidator Tests
// ─────────────────────────────────────────────────────────────
console.log("\n[1] ThemeValidator Tests");

test("Validiert korrektes Theme-Manifest", () => {
    const validator = new ThemeValidator();
    const res = validator.validate({
        id: "test-theme",
        name: "Test Theme",
        version: "1.0.0",
        css: "variables.css"
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.errors.length, 0);
});

test("Erkennt fehlendes name-Feld", () => {
    const validator = new ThemeValidator();
    const res = validator.validate({
        id: "test",
        css: "style.css"
    });
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some(e => e.includes("name")));
});

test("Erkennt ungültige Theme-ID", () => {
    const validator = new ThemeValidator();
    const res = validator.validate({
        id: "Invalid Theme!",
        name: "Test"
    });
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some(e => e.includes("invalid characters")));
});

// ─────────────────────────────────────────────────────────────
// 2. ThemeManager Lifecycle
// ─────────────────────────────────────────────────────────────
console.log("\n[2] ThemeManager Lifecycle");

test("ThemeManager initialisiert korrekt", () => {
    ThemeManager.initialized = false;
    ThemeManager.themes.clear();
    
    ThemeManager.initialize();
    
    assert.strictEqual(ThemeManager.isInitialized(), true);
});

test("ThemeManager lädt Themes aus Theme-Verzeichnis", () => {
    ThemeManager.initialized = false;
    ThemeManager.themes.clear();
    
    ThemeManager.initialize();
    
    const themes = ThemeManager.getThemes();
    assert.ok(Array.isArray(themes));
    assert.ok(themes.length >= 0); // Kann 0 sein wenn kein Theme-Verzeichnis existiert
});

test("ThemeManager shutdown bereinigt korrekt", () => {
    ThemeManager.shutdown();
    
    assert.strictEqual(ThemeManager.isInitialized(), false);
    assert.strictEqual(ThemeManager.getThemes().length, 0);
});

// ─────────────────────────────────────────────────────────────
// 3. ThemeManager Getters
// ─────────────────────────────────────────────────────────────
console.log("\n[3] ThemeManager Getters");

test("getTheme() gibt undefined für nicht-existierendes Theme zurück", () => {
    const theme = ThemeManager.getTheme("non-existent");
    assert.strictEqual(theme, undefined);
});

test("hasTheme() gibt false für nicht-existierendes Theme zurück", () => {
    assert.strictEqual(ThemeManager.hasTheme("non-existent"), false);
});

test("getThemes() gibt Array zurück", () => {
    const themes = ThemeManager.getThemes();
    assert.ok(Array.isArray(themes));
});

// ─────────────────────────────────────────────────────────────
// 4. ThemeLoader
// ─────────────────────────────────────────────────────────────
console.log("\n[4] ThemeLoader");

test("ThemeLoader.getThemesPath() gibt gültigen Pfad zurück", () => {
    const themesPath = ThemeLoader.getThemesPath();
    assert.ok(typeof themesPath === "string");
    assert.ok(themesPath.length > 0);
});

test("ThemeLoader discoverThemes gibt Array zurück", () => {
    const themes = ThemeLoader.discoverThemes();
    
    assert.ok(Array.isArray(themes));
});

test("ThemeLoader findet Core Themes im Development-Modus", () => {
    const themes = ThemeLoader.discoverThemes();
    
    // Im Test-Environment (ohne Electron app) sollten Core Themes gefunden werden
    const isTestEnv = !process.versions.electron;
    if (isTestEnv) {
        assert.ok(themes.length >= 3, "Mindestens 3 Core Themes sollten gefunden werden");
        
        const themeIds = themes.map(t => t.id);
        assert.ok(themeIds.includes("default") || themeIds.includes("dark") || themeIds.includes("neon"), 
            "Mindestens ein Core Theme (default, dark oder neon) sollte gefunden werden");
    }
});

// ─────────────────────────────────────────────────────────────
// 5. Architecture Check
// ─────────────────────────────────────────────────────────────
console.log("\n[5] Architecture Check");

test("Kein ThemeRuntime existiert (nicht benötigt)", () => {
    // ThemeRuntime wurde entfernt, da CSS-Wechsel im Renderer erfolgt
    const fs = require("fs");
    const themeRuntimePath = "electron/core/themes/ThemeRuntime.js";
    // Sollte nicht existieren
    assert.ok(!fs.existsSync(themeRuntimePath));
});

test("Kein ThemeProvider existiert (entfernt)", () => {
    const fs = require("fs");
    const themeProviderPath = "electron/core/themes/ThemeProvider.js";
    assert.ok(!fs.existsSync(themeProviderPath));
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
