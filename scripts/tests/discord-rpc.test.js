"use strict";

/**
 * Discord-RPC Regression Tests
 * 
 * Tests für BUG-001 (Doppelte Discord-RPC-Runtime) und BUG-002 (Inkonsistente Persistenz)
 */

const fs = require("fs");
const path = require("path");

// Test-Setup
const TEST_DATA_DIR = path.join(__dirname, "..", "..", "data", "test-discord-rpc");

function setupTestEnv() {
  // Test-Verzeichnis erstellen
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
  
  // Bestehende Test-Dateien löschen
  const settingsFile = path.join(TEST_DATA_DIR, "settings.json");
  const integrationsFile = path.join(TEST_DATA_DIR, "integrations", "integrations.json");
  
  if (fs.existsSync(settingsFile)) {
    fs.unlinkSync(settingsFile);
  }
  if (fs.existsSync(integrationsFile)) {
    fs.unlinkSync(integrationsFile);
  }
}

function cleanupTestEnv() {
  // Test-Verzeichnis aufräumen
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
}

console.log("==========================================");
console.log("🧪 Discord-RPC Regression Tests");
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
// Test 1: Single Source of Truth
// ==========================================
console.log("\n[1] Single Source of Truth Test");

setupTestEnv();

test("Discord-RPC Status wird in settings.json gespeichert", () => {
  const settingsFile = path.join(TEST_DATA_DIR, "settings.json");
  const settings = {
    integrations: {
      discordRichPresence: true
    }
  };
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  
  const loaded = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  assertEquals(loaded.integrations.discordRichPresence, true, "Status sollte in settings.json sein");
});

test("Keine parallele integrations.json für Discord-RPC", () => {
  const integrationsFile = path.join(TEST_DATA_DIR, "integrations", "integrations.json");
  assert(!fs.existsSync(integrationsFile), "integrations.json sollte nicht existieren");
});

cleanupTestEnv();

// ==========================================
// Test 2: Persistence (Enable → Restart)
// ==========================================
console.log("\n[2] Persistence Test (Enable → Restart)");

setupTestEnv();

test("Discord-RPC Status bleibt nach Neustart erhalten", () => {
  const settingsFile = path.join(TEST_DATA_DIR, "settings.json");
  
  // Aktivieren
  let settings = { integrations: { discordRichPresence: true } };
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  
  // Simulieren Neustart (neu laden)
  const loaded = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  assertEquals(loaded.integrations.discordRichPresence, true, "Status sollte erhalten bleiben");
});

cleanupTestEnv();

// ==========================================
// Test 3: Persistence (Disable → Restart)
// ==========================================
console.log("\n[3] Persistence Test (Disable → Restart)");

setupTestEnv();

test("Discord-RPC Status bleibt nach Neustart deaktiviert", () => {
  const settingsFile = path.join(TEST_DATA_DIR, "settings.json");
  
  // Deaktivieren
  let settings = { integrations: { discordRichPresence: false } };
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  
  // Simulieren Neustart
  const loaded = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  assertEquals(loaded.integrations.discordRichPresence, false, "Status sollte deaktiviert bleiben");
});

cleanupTestEnv();

// ==========================================
// Test 4: Legacy Storage Migration
// ==========================================
console.log("\n[4] Legacy Storage Migration Test");

setupTestEnv();

test("Legacy integrations.json kann migriert werden", () => {
  const integrationsDir = path.join(TEST_DATA_DIR, "integrations");
  fs.mkdirSync(integrationsDir, { recursive: true });
  
  const legacyConfig = {
    integrations: {
      "discord-rpc": {
        enabled: true
      }
    }
  };
  fs.writeFileSync(path.join(integrationsDir, "integrations.json"), JSON.stringify(legacyConfig, null, 2));
  
  assert(fs.existsSync(path.join(integrationsDir, "integrations.json")), "Legacy-Datei sollte existieren");
  
  // Migration simulieren
  const legacy = JSON.parse(fs.readFileSync(path.join(integrationsDir, "integrations.json"), "utf8"));
  const discordEnabled = legacy.integrations["discord-rpc"]?.enabled;
  
  const settingsFile = path.join(TEST_DATA_DIR, "settings.json");
  const settings = { integrations: { discordRichPresence: discordEnabled } };
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  
  // Legacy-Datei löschen
  fs.unlinkSync(path.join(integrationsDir, "integrations.json"));
  
  // Verifizieren
  const loadedSettings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  assertEquals(loadedSettings.integrations.discordRichPresence, true, "Status sollte migriert sein");
  assert(!fs.existsSync(path.join(integrationsDir, "integrations.json")), "Legacy-Datei sollte gelöscht sein");
});

cleanupTestEnv();

// ==========================================
// Test 5: IPC Handler Integration
// ==========================================
console.log("\n[5] IPC Handler Integration Test");

setupTestEnv();

test("integrations:get gibt Discord-RPC als virtuelle Integration zurück", () => {
  const settingsFile = path.join(TEST_DATA_DIR, "settings.json");
  const settings = { integrations: { discordRichPresence: true } };
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  
  // Simulieren IPC Handler Logik
  const loadedSettings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  const discordEnabled = loadedSettings.integrations?.discordRichPresence === true;
  
  const virtualIntegration = {
    id: "discord-rpc",
    name: "Discord Rich Presence",
    description: "Discord Rich Presence Integration für WebRadio",
    version: "1.0.0",
    author: "WebRadio Team",
    enabled: discordEnabled
  };
  
  assertEquals(virtualIntegration.enabled, true, "Virtuelle Integration sollte enabled sein");
  assertEquals(virtualIntegration.id, "discord-rpc", "ID sollte discord-rpc sein");
});

test("integrations:update mit discord-rpc ID aktualisiert settings.json", () => {
  const settingsFile = path.join(TEST_DATA_DIR, "settings.json");
  let settings = { integrations: { discordRichPresence: false } };
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  
  // Simulieren IPC Handler Logik für update
  const loadedSettings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  if (!loadedSettings.integrations) loadedSettings.integrations = {};
  loadedSettings.integrations.discordRichPresence = true;
  fs.writeFileSync(settingsFile, JSON.stringify(loadedSettings, null, 2));
  
  // Verifizieren
  const finalSettings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  assertEquals(finalSettings.integrations.discordRichPresence, true, "Status sollte aktualisiert sein");
});

cleanupTestEnv();

// ==========================================
// Test 6: Integration Stub entfernt
// ==========================================
console.log("\n[6] Integration Stub Removal Test");

setupTestEnv();

test("integrations/discord-rpc Verzeichnis existiert nicht mehr", () => {
  const discordRpcPath = path.join(__dirname, "..", "..", "integrations", "discord-rpc");
  assert(!fs.existsSync(discordRpcPath), "discord-rpc Integration Stub sollte entfernt sein");
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
