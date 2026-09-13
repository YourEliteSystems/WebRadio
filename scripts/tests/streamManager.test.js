"use strict";
// streamManager.test.js – Beta 4. Mockt fluent-ffmpeg/electron. Keine echten Prozesse.
// Prüft auch: Application.shutdown() ruft streamManager.stop() (Beta-3-Regression).
const assert = require("assert");
const os = require("os"); const fs = require("fs"); const path = require("path");
const Module = require("module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, p, m, o) {
    if (r === "electron") return "el-sm"; if (r === "ffmpeg-static") return "ffs-sm"; if (r === "fluent-ffmpeg") return "ffm-sm";
    return origResolve.call(this, r, p, m, o);
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wbsm-")); fs.mkdirSync(path.join(tmp,"temp"),{recursive:true}); fs.mkdirSync(path.join(tmp,"logs"),{recursive:true});
const fakeApp = { isPackaged: true, getVersion: () => "1.0.6-beta.4", getPath: (k) => k === "userData" ? tmp : (k === "temp" ? path.join(tmp, "temp") : tmp) };
let kKill = 0, kRALL = 0, kPipe = 0, kDestroy = 0, kSRALL = 0, emits = [];
function chainable() {
    return {
        on() { return this; }, inputOptions() { return this; },
        audioChannels() { return this; }, audioFrequency() { return this; },
        format() { return this; },
        removeAllListeners(e) { kRALL++; return this; },
        kill() { kKill++; },
        pipe() {
            kPipe++;
            return {
                on() { return this; },
                removeAllListeners() { kSRALL++; return this; },
                destroy() { kDestroy++; }
            };
        }
    };
}
const fakeFfmpeg = (u) => { void u; return chainable(); }; fakeFfmpeg.setFfmpegPath = () => {};
require.cache["el-sm"] = { id: "el-sm", filename: "el-sm", loaded: true, exports: { app: fakeApp } };
require.cache["ffs-sm"] = { id: "ffs-sm", filename: "ffs-sm", loaded: true, exports: "/mock/ffmpeg" };
require.cache["ffm-sm"] = { id: "ffm-sm", filename: "ffm-sm", loaded: true, exports: fakeFfmpeg };
require("../../electron/core/storage/StorageManager").initialize();
require("../../electron/core/diagnostics/logging/LogManager").initialize();
const eventBus = require("../../electron/core/eventBus"); const oe = eventBus.emit.bind(eventBus);
eventBus.emit = (e, d) => { emits.push({ e, d }); return oe(e, d); };
const SM = require("../../electron/core/audio/streamManager");
console.log("=== StreamManager Tests ===");
let pass = 0, fail = 0;
function test(n, fn) { try { fn(); console.log(`  [OK] ${n}`); pass++; } catch (e) { console.error(`  [FAIL] ${n}: ${e.message}`); fail++; } }
function reset() { kKill = kRALL = kPipe = kDestroy = kSRALL = 0; emits = []; }
const win = { isDestroyed: () => false, webContents: { send: () => {} } };

console.log("[1] Start/Stop");
test("start erzeugt ffmpegCommand+pipe", () => { reset(); const s = new SM.StreamManager(); s.setMainWindow(win); s.start("http://x/s", { name: "T" }); assert.ok(s.ffmpegCommand); assert.ok(s.ffmpegStream); assert.strictEqual(kPipe, 1); assert.strictEqual(s.currentStation.name, "T"); assert.strictEqual(emits.filter(e=>e.e==="play").length, 1); s.stop(); });
test("stop killt ffmpeg+stream", () => { reset(); const s = new SM.StreamManager(); s.setMainWindow(win); s.start("http://x/s"); assert.ok(s.ffmpegCommand && s.ffmpegStream, "vor stop: Refs gesetzt"); const stopsBefore = emits.filter(e=>e.e==="stop").length; s.stop(); assert.strictEqual(s.ffmpegCommand, null); assert.strictEqual(s.ffmpegStream, null); assert.ok(kKill >= 1, "kill aufgerufen"); assert.ok(kDestroy >= 1, "stream destroy aufgerufen"); assert.ok(emits.filter(e=>e.e==="stop").length >= stopsBefore + 1, "stop-Event emittiert"); });

console.log("[2] Restart/Station");
test("neuer Start stoppt vorherigen", () => { reset(); const s = new SM.StreamManager(); s.setMainWindow(win); s.start("http://x/s1",{name:"S1"}); const f = s.ffmpegStream; s.start("http://x/s2",{name:"S2"}); assert.notStrictEqual(s.ffmpegStream, f); assert.strictEqual(s.currentStation.name, "S2"); assert.ok(kKill >= 1); });
test("Stationwechsel resettet lastTitle", () => { reset(); const s = new SM.StreamManager(); s.handleMetadata("StreamTitle='A - B'"); assert.strictEqual(s.lastTitle, "A - B"); s.start("http://x/s2"); assert.strictEqual(s.lastTitle, null); });

console.log("[3] Fehler");
test("doppeltes Stoppen sicher", () => { reset(); const s = new SM.StreamManager(); s.setMainWindow(win); s.start("http://x/s"); s.stop(); s.stop(); assert.strictEqual(s.ffmpegCommand, null); assert.strictEqual(s.ffmpegStream, null); });

console.log("[4] Metadata");
test("parst StreamTitle", () => { reset(); const s = new SM.StreamManager(); s.setMainWindow(win); s.handleMetadata("foo"); s.handleMetadata("StreamTitle='Artist - Song';"); assert.strictEqual(s.lastTitle, "Artist - Song"); const m = emits.filter(e=>e.e==="metadata"); assert.strictEqual(m.length,1); assert.strictEqual(m[0].d.Artist,"Artist"); assert.strictEqual(m[0].d.Song,"Song"); });
test("doppelte Titel nur einmal", () => { reset(); const s = new SM.StreamManager(); s.setMainWindow(win); s.handleMetadata("StreamTitle='S - T';"); s.handleMetadata("StreamTitle='S - T';"); assert.strictEqual(emits.filter(e=>e.e==="metadata").length, 1); });
test("sendet an webContents", () => { reset(); let sent=null; const w={isDestroyed:()=>false,webContents:{send:(c,d)=>{sent={c,d};}}}; const s=new SM.StreamManager(); s.setMainWindow(w); s.handleMetadata("StreamTitle='A - B';"); assert.ok(sent); assert.strictEqual(sent.c, "radio:metadata"); });

console.log("[5] Cleanup");
test("stop ruft removeAllListeners auf", () => { reset(); const s = new SM.StreamManager(); s.setMainWindow(win); s.start("http://x/s"); s.stop(); assert.ok(kRALL >= 1); assert.ok(kSRALL >= 1); });

console.log("[6] Shutdown-Regression");
test("Application.shutdown() ruft streamManager.stop()", () => { const src = fs.readFileSync(path.join(__dirname,"..","..","electron","core","Application.js"),"utf8"); assert.ok(/streamManager\s*\.\s*stop\s*\(/.test(src)); });

console.log("==========================================");
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
console.log("==========================================");
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
if (fail > 0) process.exit(1);