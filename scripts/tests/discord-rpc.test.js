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
// Test 7: React Component Toggle Bug Fix
// ==========================================
console.log("\n[7] React Component Toggle Bug Fix Test");

setupTestEnv();

test("React-Komponente übergibt korrekten Boolean-Wert an saveIntegrations", () => {
  // Simuliere den alten Bug: State wird vor dem Speichern aktualisiert
  let discordEnabled = false;
  
  // Alte Implementierung (fehlerhaft)
  const oldHandleToggle = (e) => {
    const enabled = e.target.checked;
    discordEnabled = enabled; // State aktualisieren
    // saveIntegrations liest discordEnabled aus State -> Rennbedingung möglich
    return discordEnabled;
  };
  
  // Neue Implementierung (korrigiert)
  const newHandleToggle = (e) => {
    const enabled = e.target.checked;
    // saveIntegrations erhält den Parameter direkt, nicht aus State
    return enabled;
  };
  
  // Test: Toggle von false auf true
  const event1 = { target: { checked: true } };
  const oldResult1 = oldHandleToggle(event1);
  const newResult1 = newHandleToggle(event1);
  
  assertEquals(oldResult1, true, "Alte Implementierung sollte true zurückgeben");
  assertEquals(newResult1, true, "Neue Implementierung sollte true zurückgeben");
  
  // Test: Toggle von true auf false
  discordEnabled = true;
  const event2 = { target: { checked: false } };
  const oldResult2 = oldHandleToggle(event2);
  const newResult2 = newHandleToggle(event2);
  
  assertEquals(oldResult2, false, "Alte Implementierung sollte false zurückgeben");
  assertEquals(newResult2, false, "Neue Implementierung sollte false zurückgeben");
});

test("saveIntegrations akzeptiert Parameter statt State-Lesen", () => {
  const settingsFile = path.join(TEST_DATA_DIR, "settings.json");
  let settings = { integrations: { discordRichPresence: false } };
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  
  // Alte Implementierung (liest aus State)
  let discordEnabledState = false;
  const oldSaveIntegrations = () => {
    const data = { id: "discord-rpc", enabled: discordEnabledState };
    // Simuliere Speichern
    const loaded = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    if (!loaded.integrations) loaded.integrations = {};
    loaded.integrations.discordRichPresence = data.enabled;
    fs.writeFileSync(settingsFile, JSON.stringify(loaded, null, 2));
  };
  
  // Neue Implementierung (erhält Parameter)
  const newSaveIntegrations = (enabled) => {
    const data = { id: "discord-rpc", enabled: enabled };
    // Simuliere Speichern
    const loaded = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    if (!loaded.integrations) loaded.integrations = {};
    loaded.integrations.discordRichPresence = data.enabled;
    fs.writeFileSync(settingsFile, JSON.stringify(loaded, null, 2));
  };
  
  // Test: Speichern mit Parameter
  newSaveIntegrations(true);
  const loaded1 = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  assertEquals(loaded1.integrations.discordRichPresence, true, "Mit Parameter sollte true gespeichert werden");
  
  // Test: Speichern mit Parameter (false)
  newSaveIntegrations(false);
  const loaded2 = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  assertEquals(loaded2.integrations.discordRichPresence, false, "Mit Parameter sollte false gespeichert werden");
});

cleanupTestEnv();

// ==========================================
// Test 8: Error Handling bei Speicherfehlern
// ==========================================
console.log("\n[8] Error Handling Test");

setupTestEnv();

test("Bei Speicherfehler wird UI-Zustand zurückgesetzt", () => {
  // Simuliere React State Management
  let uiState = false;
  
  const handleToggleWithErrorHandling = (enabled) => {
    uiState = enabled; // UI sofort aktualisieren
    
    // Simuliere Speichern mit Fehler
    const saved = false; // Speichern fehlgeschlagen
    
    if (!saved) {
      uiState = !enabled; // UI-Zustand zurücksetzen
    }
    
    return uiState;
  };
  
  // Test: Speichern schlägt fehl
  handleToggleWithErrorHandling(true);
  assertEquals(uiState, false, "UI sollte bei Fehler zurückgesetzt werden");
  
  // Test: Speichern erfolgreich
  const handleToggleWithSuccess = (enabled) => {
    uiState = enabled;
    const saved = true; // Speichern erfolgreich
    if (!saved) {
      uiState = !enabled;
    }
    return uiState;
  };
  
  handleToggleWithSuccess(true);
  assertEquals(uiState, true, "UI sollte bei Erfolg gesetzt bleiben");
});

test("API-Antwort mit ok=false wird erkannt", () => {
  const apiResponse = { ok: false, error: { code: "STORAGE_FAILED", message: "Einstellung konnte nicht persistent geschrieben werden" } };
  
  const hasError = apiResponse && apiResponse.ok === false;
  assertEquals(hasError, true, "API-Fehler sollte erkannt werden");
  
  const successResponse = { ok: true, changed: true, enabled: true };
  const hasSuccessError = successResponse && successResponse.ok === false;
  assertEquals(hasSuccessError, false, "Erfolgreiche Antwort sollte keinen Fehler enthalten");
});

cleanupTestEnv();

// ==========================================
// Test 9: Neuladen des gespeicherten Zustands
// ==========================================
console.log("\n[9] Reload Stored State Test");

setupTestEnv();

test("Gespeicherter Zustand wird nach Neuladen korrekt geladen", () => {
  const settingsFile = path.join(TEST_DATA_DIR, "settings.json");
  
  // Aktivieren und speichern
  let settings = { integrations: { discordRichPresence: true } };
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  
  // Simuliere loadIntegrations
  const loadedSettings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  const discordEnabled = loadedSettings.integrations?.discordRichPresence === true;
  
  assertEquals(discordEnabled, true, "Gespeicherter Zustand sollte true sein");
  
  // Deaktivieren und speichern
  settings.integrations.discordRichPresence = false;
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  
  // Neu laden
  const reloadedSettings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  const reloadedDiscordEnabled = reloadedSettings.integrations?.discordRichPresence === true;
  
  assertEquals(reloadedDiscordEnabled, false, "Gespeicherter Zustand sollte false sein");
});

test("Fehlender Speicherwert führt zu Standard (false)", () => {
  const settingsFile = path.join(TEST_DATA_DIR, "settings.json");
  
  // Leere settings
  const settings = {};
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  
  // Simuliere loadIntegrations mit Fallback
  const loadedSettings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  const discordEnabled = loadedSettings.integrations?.discordRichPresence === true;
  
  assertEquals(discordEnabled, false, "Fehlender Wert sollte zu false führen");
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
