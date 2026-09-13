"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); console.log(`  [OK] ${name}`); pass++; }
    catch (e) { console.error(`  [FAIL] ${name}: ${(e && e.message) || String(e)}`); fail++; }
}

console.log("=== AudioWorklet Vertrags-Tests (statische Checks) ===");
// Hinweis: Echte AudioWorklet-Prozess-Tests sind unter Node/CI nicht möglich.
// Diese Tests wachen über die Verträge der Audio-Kernänderungen (Ruckler-Fix):
// Stille statt wiederholter Blöcke bei Unterlauf, Vorpuffer, Flush bei
// Stream-Wechsel, Bedarfs-Diagnostik und verlustfreier PCM-Versand.

const workletSrc = fs.readFileSync(
    path.join(__dirname, "../../renderer/worklets/pcm-processor.js"), "utf8"
);

test("pcm-processor ist registriert", () => {
    assert.ok(workletSrc.includes('registerProcessor("pcm-processor"'), "registerProcessor vorhanden");
});

test("Unterlauf erzeugt Stille statt wiederholter alter Blöcke", () => {
    assert.ok(workletSrc.includes("writeSilence"), "writeSilence-Methode vorhanden");
    assert.ok(workletSrc.includes("underrunCount"), "Unterlauf-Zähler vorhanden");
});

test("Vorpuffer ist konfiguriert", () => {
    assert.ok(workletSrc.includes("preBufferSamples"), "preBufferSamples definiert");
    const m = workletSrc.match(/preBufferSamples\s*=\s*(\d+)/);
    assert.ok(m && Number(m[1]) >= 9600, `Vorpuffer >= 100ms: ${m ? m[1] : "keine"}`);
});

test("Buffer-Cap gegen Overrun bleibt erhalten", () => {
    assert.ok(workletSrc.includes("MAX_BUFFER_SAMPLES"), "Overrun-Cap vorhanden");
    assert.ok(workletSrc.includes("overrunCount"), "Overrun-Zähler vorhanden");
});

test("Flush-Kontrollnachricht wird beim Stream-Wechsel behandelt", () => {
    assert.ok(workletSrc.includes('data.type === "flush"'), "flush-Handling im Worklet");
    assert.ok(workletSrc.includes('postMessage({ type: "flush" })') === false,
        "Flush wird vom Renderer gesendet (playerService)");
});

test("Stats-Kontrollnachricht meldet Diagnose-Zähler", () => {
    assert.ok(workletSrc.includes('data.type === "stats"'), "stats-Handling im Worklet");
    for (const counter of ["underruns", "overruns", "totalChunks", "bufferSamples", "state"]) {
        assert.ok(workletSrc.includes(counter), `Feld "${counter}"`);
    }
});

// playerService-Vertrag
const psSrc = fs.readFileSync(
    path.join(__dirname, "../../renderer/services/playerService.js"), "utf8"
);

test("playerService reicht PCM immer an den Worklet durch", () => {
    assert.ok(psSrc.includes("workletNode.port.postMessage(chunk)"), "postMessage wird immer aufgerufen");
    assert.ok(!psSrc.includes("if(!(chunk instanceof Float32Array))"),
        "kein stilles Verwerfen bei Float32Array");
});

test("playerService flusht den Worklet-Puffer bei Wechsel/Stop", () => {
    assert.ok(psSrc.includes("flushAudioBuffer"), "flushAudioBuffer exportiert/verwendet");
    assert.ok(psSrc.includes('{ type: "flush" }'), "Flush-Nachricht wird gesendet");
});

test("playerService exponiert Bedarfs-Diagnostik", () => {
    assert.ok(psSrc.includes("__webradioAudioDiagnostics"), "Globaler Diagnose-Hook");
    assert.ok(psSrc.includes("getAudioDiagnostics"), "getAudioDiagnostics vorhanden");
});

// preload / IPC
const preloadSrc = fs.readFileSync(path.join(__dirname, "../../electron/preload.js"), "utf8");
test("preload radioAPI exponiert getAudioDiagnostics", () => {
    assert.ok(preloadSrc.includes("getAudioDiagnostics"), "radioAPI.getAudioDiagnostics");
});

const radioHandlersSrc = fs.readFileSync(path.join(__dirname, "../../electron/core/ipc/radioHandlers.js"), "utf8");
test("radioHandlers registriert radio:getAudioDiagnostics", () => {
    assert.ok(radioHandlersSrc.includes('"radio:getAudioDiagnostics"'), "IPC-Handler vorhanden");
});

// StreamManager: kein Verwerfen von PCM
test("streamManager verwirft keine PCM-Chunks (statisch)", () => {
    const src = fs.readFileSync(
        path.join(__dirname, "../..", "electron", "core", "audio", "streamManager.js"),
        "utf8"
    );
    assert.ok(!src.includes("pcmBufferMaxSize"), "keine pcmBufferMaxSize");
    assert.ok(!src.includes("SendBufferedPCM"), "keine Drop-Send-Schleife");
    assert.ok(src.includes("getDiagnostics"), "getDiagnostics vorhanden");
});

console.log("\n==========================================");
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
console.log("==========================================");

if (fail > 0) process.exit(1);