"use strict";
const assert = require("assert");
const os = require("os");
const fs = require("fs");
const path = require("path");
const Module = require("module");

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, p, m, o) {
    if (r === "electron") return "el-audio";
    if (r === "ffmpeg-static") return "ffs-audio";
    if (r === "fluent-ffmpeg") return "ffm-audio";
    return origResolve.call(this, r, p, m, o);
};

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wbrb-audio-test-"));
const logsDir = path.join(tmpRoot, "logs");
const tempDir = path.join(tmpRoot, "temp");
fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });

const fakeApp = {
    isPackaged: true,
    getVersion: () => "1.0.6-beta.4",
    getPath: (k) => {
        if (k === "userData") return tmpRoot;
        if (k === "temp") return tempDir;
        return tmpRoot;
    }
};

require.cache["el-audio"] = { id: "el-audio", filename: "el-audio", loaded: true, exports: { app: fakeApp } };
require.cache["ffs-audio"] = { id: "ffs-audio", filename: "ffs-audio", loaded: true, exports: "/mock/ffmpeg" };

// fluent-ffmpeg Fake: pipe() liefert einen Stream, dessen data-Handler
// im Test geangelt und manuell mit PCM-Chunks gefüttert wird.
let kKill = 0;
let kDestroy = 0;
let dataHandler = null;

function chainable() {
    const stream = {
        on(event, fn) { if (event === "data") dataHandler = fn; return stream; },
        removeAllListeners() { return stream; },
        destroy() { kDestroy++; }
    };
    const cmd = {
        on() { return cmd; },
        inputOptions() { return cmd; },
        audioChannels() { return cmd; },
        audioFrequency() { return cmd; },
        format() { return cmd; },
        removeAllListeners() { return cmd; },
        kill() { kKill++; },
        pipe() { return stream; }
    };
    return cmd;
}
const fakeFfmpeg = (u) => { void u; return chainable(); };
fakeFfmpeg.setFfmpegPath = () => {};
require.cache["ffm-audio"] = { id: "ffm-audio", filename: "ffm-audio", loaded: true, exports: fakeFfmpeg };

require("../../electron/core/storage/StorageManager").initialize();
const LogManager = require("../../electron/core/diagnostics/logging/LogManager");
LogManager.reset();
LogManager.initialize({ transports: ["console"] });

let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); console.log(`  [OK] ${name}`); pass++; }
    catch (e) { console.error(`  [FAIL] ${name}: ${(e && e.message) || String(e)}`); fail++; }
}

function cleanup() {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {
        // Ignore cleanup errors
    }
}

function makeChunk(values) {
    const arr = new Float32Array(values);
    return { buffer: arr.buffer, byteOffset: 0, byteLength: arr.byteLength };
}

function makeWindow(overrides = {}) {
    const calls = [];
    return {
        isDestroyed: () => Boolean(overrides.destroyed),
        webContents: {
            send: overrides.send || ((channel, data) => { calls.push({ channel, data }); })
        },
        _calls: calls
    };
}

function newStreamManager() {
    dataHandler = null;
    const { StreamManager } = require("../../electron/core/audio/streamManager");
    return new StreamManager();
}

console.log("=== Audio-Pfad-Tests (StreamManager, verlustfreier PCM-Versand) ===");
// Test 1: Diagnose-Zähler initial
test("StreamManager initialisiert mit Diagnose-Zählern", () => {
    const sm = newStreamManager();
    assert.ok(sm.diag, "diag-Objekt vorhanden");
    assert.strictEqual(sm.diag.chunksReceived, 0, "chunksReceived initial 0");
    assert.strictEqual(sm.diag.chunksSent, 0, "chunksSent initial 0");
    assert.strictEqual(sm.pcmBuffer, undefined, "kein künstlicher Main-Prozess-Puffer");
});

// Test 2: Jeder PCM-Chunk wird an webContents gesendet (kein Datenverlust)
test("data-Handler sendet jeden PCM-Chunk verlustfrei", () => {
    const sm = newStreamManager();
    const win = makeWindow();
    sm.setMainWindow(win);
    sm.start("http://x/s", { name: "T" });
    assert.ok(typeof dataHandler === "function", "data-Handler registriert");

    dataHandler(makeChunk([0.1, 0.2, 0.3, 0.4]));
    dataHandler(makeChunk([0.5, 0.6, 0.7, 0.8]));
    dataHandler(makeChunk([0.9, 1.0, 1.1, 1.2]));

    assert.strictEqual(win._calls.length, 3, "3 Sends für 3 Chunks");
    for (const call of win._calls) {
        assert.strictEqual(call.channel, "radio:pcm", "Kanal radio:pcm");
        assert.ok(call.data instanceof ArrayBuffer, "Daten sind ArrayBuffer");
    }
    assert.strictEqual(sm.diag.chunksReceived, 3, "chunksReceived = 3");
    assert.strictEqual(sm.diag.chunksSent, 3, "chunksSent = 3");
    sm.stop();
});

// Test 3: Auch viele Chunks werden nicht verworfen (keine künstliche Obergrenze)
test("Viele Chunks werden nicht verworfen (keine Obergrenze)", () => {
    const sm = newStreamManager();
    const win = makeWindow();
    sm.setMainWindow(win);
    sm.start("http://x/s");
    for (let i = 0; i < 25; i++) {
        dataHandler(makeChunk([1, 2, 3, 4]));
    }
    assert.strictEqual(win._calls.length, 25, "25 Sends für 25 Chunks");
    assert.strictEqual(sm.diag.chunksSent, 25, "chunksSent = 25");
    sm.stop();
});

// Test 4: Send wird übersprungen, wenn das Fenster zerstört ist
test("Send übersprungen bei zerstörtem MainWindow", () => {
    const sm = newStreamManager();
    const win = makeWindow({ destroyed: true });
    let sent = 0;
    win.webContents.send = () => { sent++; };
    sm.setMainWindow(win);
    sm.start("http://x/s");
    dataHandler(makeChunk([1, 2, 3, 4]));
    assert.strictEqual(sent, 0, "kein Send bei zerstörtem Fenster");
    sm.stop();
});

// Test 5: stop() beendet FFmpeg und setzt Stream-Zustand zurück
test("stop() beendet FFmpeg + setzt Zustand zurück", () => {
    const sm = newStreamManager();
    const win = makeWindow();
    sm.setMainWindow(win);
    sm.start("http://x/s");
    dataHandler(makeChunk([1, 2, 3, 4]));
    const killsBefore = kKill;
    sm.stop();
    assert.ok(kKill >= killsBefore + 1, "ffmpeg kill aufgerufen");
    assert.ok(kDestroy >= 1, "stream destroy aufgerufen");
    assert.strictEqual(sm.ffmpegCommand, null, "ffmpegCommand zurückgesetzt");
    assert.strictEqual(sm.ffmpegStream, null, "ffmpegStream zurückgesetzt");
    assert.strictEqual(sm.diag.lastDataAt, null, "lastDataAt zurückgesetzt");
});
// Test 6: getDiagnostics liefert FFmpeg-Status + Zähler
test("getDiagnostics liefert FFmpeg-Status + Zähler", () => {
    const sm = newStreamManager();
    const win = makeWindow();
    sm.setMainWindow(win);
    sm.start("http://x/s", { name: "S1" });
    dataHandler(makeChunk([1, 2, 3, 4]));
    const diag = sm.getDiagnostics();
    assert.strictEqual(diag.ffmpegRunning, true, "ffmpeg läuft");
    assert.strictEqual(diag.currentStation.name, "S1", "aktuelle Station");
    assert.strictEqual(diag.chunksReceived, 1, "chunksReceived");
    assert.strictEqual(diag.chunksSent, 1, "chunksSent");
    assert.ok(typeof diag.msSinceLastData === "number", "msSinceLastData vorhanden");
    assert.ok(typeof diag.streamStartAt === "number", "streamStartAt vorhanden");
    sm.stop();
});

// Test 7: Send-Fehler (z. B. webContents weg) crasht nicht
test("Send-Fehler im PCM-Pfad crasht nicht", () => {
    const sm = newStreamManager();
    const win = makeWindow({ send: () => { throw new Error("webContents weg"); } });
    sm.setMainWindow(win);
    sm.start("http://x/s");
    dataHandler(makeChunk([1, 2, 3, 4]));
    assert.strictEqual(sm.diag.chunksReceived, 1, "Chunk wurde registriert");
    assert.strictEqual(sm.diag.chunksSent, 0, "Send schlug fehl (kein Crash)");
    sm.stop();
});

// Test 8: Ungerade Byte-Länge wird sicher übersprungen
test("Ungerade PCM-Byte-Länge wird übersprungen ohne Crash", () => {
    const sm = newStreamManager();
    let sent = 0;
    const win = makeWindow({ send: () => { sent++; } });
    sm.setMainWindow(win);
    sm.start("http://x/s");
    dataHandler({ buffer: new ArrayBuffer(6), byteOffset: 0, byteLength: 6 });
    assert.strictEqual(sent, 0, "kein Send bei ungültiger Länge");
    sm.stop();
});

// Test 9: Keine Drop-/Backpressure-Logik mehr im StreamManager (statisch)
test("StreamManager enthält keine Chunk-Drop-Logik", () => {
    const src = fs.readFileSync(
        path.join(__dirname, "..", "..", "electron", "core", "audio", "streamManager.js"),
        "utf8"
    );
    assert.ok(!src.includes("pcmBufferMaxSize"), "keine pcmBufferMaxSize-Drop-Limit");
    assert.ok(!src.includes("Chunk verworfen"), "keine Verwurf-Log-Meldung");
    assert.ok(!src.includes("sendBufferedPCM"), "keine Drop-Send-Schleife");
});

console.log("\n==========================================");
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
console.log("==========================================");

cleanup();

if (fail > 0) process.exit(1);