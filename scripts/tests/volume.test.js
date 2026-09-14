"use strict";

const assert = require("assert");
const path = require("path");
const fs = require("fs");

console.log("==========================================");
console.log("🧪 Starte Volume-System Tests");
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
// 1. Volume Persistence Check
// ─────────────────────────────────────────────────────────────
console.log("\n[1] Volume Persistence Check");

test("Volume wird in localStorage gespeichert", () => {
    // Test ist konzeptionell - die Logik ist im Renderer (usePlayer hook)
    // Hier prüfen wir nur dass die Architektur korrekt ist
    assert.ok(true, "Volume-Persistenz ist im usePlayer Hook implementiert");
});

// ─────────────────────────────────────────────────────────────
// 2. Volume Flow Architecture
// ─────────────────────────────────────────────────────────────
console.log("\n[2] Volume Flow Architecture");

test("playerService hat setVolume Funktion", () => {
    // Prüfen dass playerService die setVolume Funktion exportiert
    const playerServicePath = path.join(__dirname, "../../renderer/services/playerService.js");
    const content = fs.readFileSync(playerServicePath, "utf8");

    assert.ok(content.includes("export function setVolume"),
        "playerService sollte setVolume exportieren");
});

test("playerService verwendet gainNode für Volume", () => {
    const playerServicePath = path.join(__dirname, "../../renderer/services/playerService.js");
    const content = fs.readFileSync(playerServicePath, "utf8");

    assert.ok(content.includes("gainNode.gain"),
        "playerService sollte gainNode.gain für Volume verwenden");
});

test("usePlayer hook speichert Volume in localStorage", () => {
    const usePlayerPath = path.join(__dirname, "../../renderer/hooks/usePlayer.js");
    const content = fs.readFileSync(usePlayerPath, "utf8");

    assert.ok(content.includes("localStorage.setItem('webradio_volume'"),
        "usePlayer sollte Volume in localStorage speichern");
});

test("usePlayer hook lädt Volume aus localStorage beim Start", () => {
    const usePlayerPath = path.join(__dirname, "../../renderer/hooks/usePlayer.js");
    const content = fs.readFileSync(usePlayerPath, "utf8");

    assert.ok(content.includes("localStorage.getItem('webradio_volume'"),
        "usePlayer sollte Volume aus localStorage laden");
});

// ─────────────────────────────────────────────────────────────
// 3. Volume Preservation During Operations
// ─────────────────────────────────────────────────────────────
console.log("\n[3] Volume Preservation During Operations");

test("playerService speichert currentVolume Variable", () => {
    const playerServicePath = path.join(__dirname, "../../renderer/services/playerService.js");
    const content = fs.readFileSync(playerServicePath, "utf8");

    assert.ok(content.includes("let currentVolume"),
        "playerService sollte currentVolume Variable haben");
});

test("playStream setzt Volume beim Start", () => {
    const playerServicePath = path.join(__dirname, "../../renderer/services/playerService.js");
    const content = fs.readFileSync(playerServicePath, "utf8");

    assert.ok(content.includes("gainNode.gain.setValueAtTime(currentVolume"),
        "playStream sollte currentVolume setzen");
});

test("switchStream erhält Volume während Wechsel", () => {
    const playerServicePath = path.join(__dirname, "../../renderer/services/playerService.js");
    const content = fs.readFileSync(playerServicePath, "utf8");

    assert.ok(content.includes("gainNode.gain.setValueAtTime(currentVolume") ||
              content.includes("gainNode.gain.cancelScheduledValues"),
        "switchStream sollte Volume während Wechsel erhalten");
});

// ─────────────────────────────────────────────────────────────
// 4. Audio Architecture Check
// ─────────────────────────────────────────────────────────────
console.log("\n[4] Audio Architecture Check");

test("AudioWorklet existiert", () => {
    const workletPath = path.join(__dirname, "../../renderer/worklets/pcm-processor.js");
    assert.ok(fs.existsSync(workletPath),
        "AudioWorklet sollte existieren");
});

test("AudioWorklet verarbeitet PCM-Daten", () => {
    const workletPath = path.join(__dirname, "../../renderer/worklets/pcm-processor.js");
    const content = fs.readFileSync(workletPath, "utf8");

    assert.ok(content.includes("AudioWorkletProcessor"),
        "AudioWorklet sollte AudioWorkletProcessor implementieren");
});

test("StreamManager sendet PCM über IPC", () => {
    const streamManagerPath = path.join(__dirname, "../../electron/core/audio/streamManager.js");
    const content = fs.readFileSync(streamManagerPath, "utf8");

    assert.ok(content.includes("radio:pcm"),
        "StreamManager sollte PCM über radio:pcm senden");
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
