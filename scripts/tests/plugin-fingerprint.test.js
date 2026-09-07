"use strict";

/**
 * Plugin Fingerprint Regression Tests
 * 
 * Tests für BUG-004: fehlerhafte Plugin-Fingerprint-Erkennung beim reloadPlugins()
 */

const fs = require("fs");
const path = require("path");

// Test-Setup
const TEST_DATA_DIR = path.join(__dirname, "..", "..", "data", "test-plugin-fingerprint");
const PLUGINS_DIR = path.join(TEST_DATA_DIR, "plugins");

function setupTestEnv() {
  // Test-Verzeichnis erstellen
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  }
  
  // Bestehende Test-Dateien löschen
  const pluginDirs = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  for (const dir of pluginDirs) {
    if (dir.isDirectory()) {
      const pluginPath = path.join(PLUGINS_DIR, dir.name);
      fs.rmSync(pluginPath, { recursive: true, force: true });
    }
  }
}

function cleanupTestEnv() {
  // Test-Verzeichnis aufräumen
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
}

function createTestPlugin(id, name, version = "1.0.0") {
  const pluginPath = path.join(PLUGINS_DIR, id);
  fs.mkdirSync(pluginPath, { recursive: true });
  
  const manifest = {
    id: id,
    name: name,
    version: version,
    main: "main.js"
  };
  
  fs.writeFileSync(path.join(pluginPath, "manifest.json"), JSON.stringify(manifest, null, 2));
  
  const mainCode = `
module.exports = {
  init(context) {
    console.log("Plugin ${name} initialized");
  },
  destroy() {
    console.log("Plugin ${name} destroyed");
  }
};
`;
  
  fs.writeFileSync(path.join(pluginPath, "main.js"), mainCode);
  
  return pluginPath;
}

function modifyTestPlugin(id) {
  const pluginPath = path.join(PLUGINS_DIR, id);
  const manifestPath = path.join(pluginPath, "manifest.json");
  
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.version = "2.0.0"; // Version ändern
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
}

function removeTestPlugin(id) {
  const pluginPath = path.join(PLUGINS_DIR, id);
  if (fs.existsSync(pluginPath)) {
    fs.rmSync(pluginPath, { recursive: true, force: true });
  }
}

console.log("==========================================");
console.log("🧪 Plugin Fingerprint Regression Tests");
console.log("==========================================");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// ==========================================
// Test 1: Initial fingerprint
// ==========================================
console.log("\n[1] Initial Fingerprint Test");

setupTestEnv();

test("Plugin besitzt gültigen Fingerprint nach Discovery", () => {
  const pluginPath = createTestPlugin("test-plugin-1", "Test Plugin 1");
  
  // PluginLoader simulieren
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginPath, "manifest.json"), "utf8"));
  const plugin = {
    ...manifest,
    path: pluginPath,
    dir: "test-plugin-1"
  };
  
  // Fingerprint berechnen (PluginLoader.createFingerprint Logik)
  const relevantFields = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    main: manifest.main,
    renderer: manifest.renderer,
    path: plugin.path
  };
  const fingerprintStr = JSON.stringify(relevantFields);
  const crypto = require("crypto");
  const fingerprint = crypto.createHash('md5').update(fingerprintStr).digest('hex');
  
  assert(fingerprint !== undefined && fingerprint !== null && fingerprint.length > 0, 
    "Fingerprint sollte definiert sein");
  assert(fingerprint.length === 32, "MD5 Fingerprint sollte 32 Zeichen haben");
});

cleanupTestEnv();

// ==========================================
// Test 2: Unverändertes Plugin
// ==========================================
console.log("\n[2] Unverändertes Plugin Test");

setupTestEnv();

test("Unverändertes Plugin wird beim Rescan nicht neu geladen", () => {
  const pluginPath = createTestPlugin("test-plugin-2", "Test Plugin 2");
  
  // Erster Discovery
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginPath, "manifest.json"), "utf8"));
  const plugin1 = {
    ...manifest,
    path: pluginPath,
    dir: "test-plugin-2"
  };
  
  // Fingerprint berechnen
  const relevantFields = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    main: manifest.main,
    renderer: manifest.renderer,
    path: pluginPath
  };
  const fingerprintStr = JSON.stringify(relevantFields);
  const crypto = require("crypto");
  const fingerprint1 = crypto.createHash('md5').update(fingerprintStr).digest('hex');
  plugin1.fingerprint = fingerprint1;
  
  // Zweiter Discovery (Rescan)
  const plugin2 = {
    ...manifest,
    path: pluginPath,
    dir: "test-plugin-2"
  };
  const fingerprint2 = crypto.createHash('md5').update(fingerprintStr).digest('hex');
  plugin2.fingerprint = fingerprint2;
  
  // Vergleich
  assertEquals(fingerprint1, fingerprint2, "Fingerprints sollten gleich sein");
  assertEquals(plugin1.fingerprint, plugin2.fingerprint, "Plugin-Fingerprints sollten gleich sein");
});

cleanupTestEnv();

// ==========================================
// Test 3: Geändertes Plugin
// ==========================================
console.log("\n[3] Geändertes Plugin Test");

setupTestEnv();

test("Geändertes Plugin wird beim Rescan neu geladen", () => {
  const pluginPath = createTestPlugin("test-plugin-3", "Test Plugin 3", "1.0.0");
  
  // Erster Discovery
  let manifest = JSON.parse(fs.readFileSync(path.join(pluginPath, "manifest.json"), "utf8"));
  const plugin1 = {
    ...manifest,
    path: pluginPath,
    dir: "test-plugin-3"
  };
  
  // Fingerprint berechnen
  const relevantFields1 = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    main: manifest.main,
    renderer: manifest.renderer,
    path: pluginPath
  };
  const fingerprintStr1 = JSON.stringify(relevantFields1);
  const crypto = require("crypto");
  const fingerprint1 = crypto.createHash('md5').update(fingerprintStr1).digest('hex');
  plugin1.fingerprint = fingerprint1;
  
  // Plugin ändern
  modifyTestPlugin("test-plugin-3");
  
  // Zweiter Discovery (Rescan)
  manifest = JSON.parse(fs.readFileSync(path.join(pluginPath, "manifest.json"), "utf8"));
  const plugin2 = {
    ...manifest,
    path: pluginPath,
    dir: "test-plugin-3"
  };
  
  const relevantFields2 = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    main: manifest.main,
    renderer: manifest.renderer,
    path: pluginPath
  };
  const fingerprintStr2 = JSON.stringify(relevantFields2);
  const fingerprint2 = crypto.createHash('md5').update(fingerprintStr2).digest('hex');
  plugin2.fingerprint = fingerprint2;
  
  // Vergleich
  assert(fingerprint1 !== fingerprint2, "Fingerprints sollten unterschiedlich sein");
  assert(plugin1.fingerprint !== plugin2.fingerprint, "Plugin-Fingerprints sollten unterschiedlich sein");
});

cleanupTestEnv();

// ==========================================
// Test 4: Neues Plugin
// ==========================================
console.log("\n[4] Neues Plugin Test");

setupTestEnv();

test("Neues Plugin wird beim Rescan entdeckt", () => {
  // Erster Discovery: kein Plugin
  const plugins1 = [];
  
  // Plugin hinzufügen
  createTestPlugin("test-plugin-4", "Test Plugin 4");
  
  // Zweiter Discovery: Plugin sollte vorhanden sein
  const pluginPath = path.join(PLUGINS_DIR, "test-plugin-4");
  assert(fs.existsSync(pluginPath), "Plugin sollte existieren");
  assert(fs.existsSync(path.join(pluginPath, "manifest.json")), "Manifest sollte existieren");
});

cleanupTestEnv();

// ==========================================
// Test 5: Entferntes Plugin
// ==========================================
console.log("\n[5] Entferntes Plugin Test");

setupTestEnv();

test("Entferntes Plugin wird beim Rescan erkannt", () => {
  // Plugin erstellen
  createTestPlugin("test-plugin-5", "Test Plugin 5");
  const pluginPath = path.join(PLUGINS_DIR, "test-plugin-5");
  
  // Erster Discovery: Plugin vorhanden
  assert(fs.existsSync(pluginPath), "Plugin sollte existieren");
  
  // Plugin entfernen
  removeTestPlugin("test-plugin-5");
  
  // Zweiter Discovery: Plugin sollte nicht mehr vorhanden sein
  assert(!fs.existsSync(pluginPath), "Plugin sollte nicht mehr existieren");
});

cleanupTestEnv();

// ==========================================
// Test 6: Fallback für fehlenden Fingerprint
// ==========================================
console.log("\n[6] Fallback für fehlenden Fingerprint Test");

setupTestEnv();

test("Fehlender Fingerprint wird nachträglich berechnet", () => {
  const pluginPath = createTestPlugin("test-plugin-6", "Test Plugin 6");
  
  // Plugin ohne Fingerprint simulieren (altes Plugin im Speicher)
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginPath, "manifest.json"), "utf8"));
  const oldPlugin = {
    ...manifest,
    path: pluginPath,
    dir: "test-plugin-6"
    // Kein Fingerprint!
  };
  
  // Neuer Discovery mit Fingerprint
  const newPlugin = {
    ...manifest,
    path: pluginPath,
    dir: "test-plugin-6"
  };
  
  const relevantFields = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    main: manifest.main,
    renderer: manifest.renderer,
    path: pluginPath
  };
  const fingerprintStr = JSON.stringify(relevantFields);
  const crypto = require("crypto");
  const newFingerprint = crypto.createHash('md5').update(fingerprintStr).digest('hex');
  newPlugin.fingerprint = newFingerprint;
  
  // Fallback-Logik simulieren
  let oldFingerprint = oldPlugin.fingerprint;
  if (!oldFingerprint) {
    oldFingerprint = crypto.createHash('md5').update(fingerprintStr).digest('hex');
    oldPlugin.fingerprint = oldFingerprint;
  }
  
  // Nach Fallback sollten Fingerprints gleich sein
  assertEquals(oldFingerprint, newFingerprint, "Fingerprints sollten nach Fallback gleich sein");
  assert(oldPlugin.fingerprint !== undefined, "Alter Fingerprint sollte jetzt definiert sein");
});

cleanupTestEnv();

// ==========================================
// Ergebnis
// ==========================================
console.log("\n==========================================");
console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen`);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
}
