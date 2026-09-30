"use strict";
// stream-lifecycle.test.js – FFmpeg-Lifecycle-Regressionen (SIGTERM/SIGKILL).
// Mockt fluent-ffmpeg mit einem echten EventEmitter, damit Start-/Exit-
// Ereignisse realistisch ausgelöst werden können. Es laufen keine Prozesse.

const assert = require("assert");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");
const Module = require("module");

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, p, m, o) {
  if (r === "electron") return "el-slt";
  if (r === "ffmpeg-static") return "ffs-slt";
  if (r === "fluent-ffmpeg") return "ffm-slt";
  return origResolve.call(this, r, p, m, o);
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wbslt-"));
fs.mkdirSync(path.join(tmp, "temp"), { recursive: true });
fs.mkdirSync(path.join(tmp, "logs"), { recursive: true });

const fakeApp = {
  isPackaged: true,
  getVersion: () => "1.0.7-alpha.3",
  getPath: (k) => (k === "userData" ? tmp : k === "temp" ? path.join(tmp, "temp") : tmp)
};

const logs = [];
const commands = [];
const streams = [];

function makeCommand(url) {
  const cmd = new EventEmitter();
  cmd.url = url;
  cmd.kills = [];
  cmd.kill = (sig) => {
    // Verhält sich wie fluent-ffmpeg: Ohne laufenden Prozess wird kein
    // Signal versendet (fluent-ffmpeg protokolliert das intern).
    if (!cmd.ffmpegProc) return cmd;
    cmd.kills.push(sig);
    return cmd;
  };
  cmd.inputOptions = () => cmd;
  cmd.audioChannels = () => cmd;
  cmd.audioFrequency = () => cmd;
  cmd.format = () => cmd;
  cmd.pipe = () => {
    const s = new EventEmitter();
    s.destroy = () => { s.destroyed = true; };
    cmd._stream = s;
    streams.push(s);
    return s;
  };
  commands.push(cmd);
  return cmd;
}

const fakeFfmpeg = (u) => makeCommand(u);
fakeFfmpeg.setFfmpegPath = () => {};

require.cache["el-slt"] = { id: "el-slt", filename: "el-slt", loaded: true, exports: { app: fakeApp } };
require.cache["ffs-slt"] = { id: "ffs-slt", filename: "ffs-slt", loaded: true, exports: "/mock/ffmpeg" };
require.cache["ffm-slt"] = { id: "ffm-slt", filename: "ffm-slt", loaded: true, exports: fakeFfmpeg };

require("../../electron/core/storage/StorageManager").initialize();
const LogManager = require("../../electron/core/diagnostics/logging/LogManager");
LogManager.reset();
LogManager.initialize({ transports: [] });
LogManager.getLogger = () => ({
  info: (m) => logs.push({ level: "info", msg: String(m) }),
  warn: (m) => logs.push({ level: "warn", msg: String(m) }),
  error: (m) => logs.push({ level: "error", msg: String(m) }),
  debug: () => {}
});

const eventBus = require("../../electron/core/eventBus");
const emits = [];
const originalEmit = eventBus.emit.bind(eventBus);
eventBus.emit = (e, d) => { emits.push({ e, d }); return originalEmit(e, d); };

const SM = require("../../electron/core/audio/streamManager");

// ── Prozess-Liveness vollständig in der Hand des Tests ──────────────────────
const originalKill = process.kill;
const livePids = new Set();
process.kill = (pid, sig) => {
  if (sig === 0) {
    if (!livePids.has(pid)) {
      const err = new Error(`kill ESRCH: ${pid}`);
      err.code = "ESRCH";
      throw err;
    }
    return true;
  }
  livePids.add(pid);
  return true;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const win = { isDestroyed: () => false, webContents: { send: () => {} } };
const hasLog = (needle) => logs.some((l) => l.msg.includes(needle));
const last = (arr) => arr[arr.length - 1];

console.log("=== StreamManager Lifecycle Tests ===");
let pass = 0;
let fail = 0;
let chain = Promise.resolve();

function test(name, fn) {
  chain = chain
    .then(() => Promise.resolve().then(() => fn()))
    .then(() => { console.log(`  [OK] ${name}`); pass++; })
    .catch((e) => { console.error(`  [FAIL] ${name}: ${(e && e.message) || e}`); fail++; });
}

function fresh() {
  logs.length = 0;
  const s = new SM.StreamManager();
  s.setMainWindow(win);
  s.killTimeoutMs = 30;
  return s;
}

/** Start + Spawn in einem Zug. */
async function startSpawned(s, url, pid) {
  await s.start(url);
  const cmd = last(commands);
  cmd.ffmpegProc = { pid };
  livePids.add(pid);
  cmd.emit("start", "ffmpeg " + url);
  return cmd;
}

/** Prozessende wie fluent-ffmpeg: ffmpegProc löschen, dann end ODER error. */
function finish(cmd, err) {
  delete cmd.ffmpegProc;
  if (err) cmd.emit("error", err, "", "");
  else cmd.emit("end", "", "");
}

test("ungültige/leere URL: kein FFmpeg, kein play-Event, Diagnose", async () => {
  const s = fresh();
  const before = commands.length;
  for (const bad of [null, undefined, "", "   ", "kein-url", "http://", "javascript:alert(1)"]) {
    const res = await s.start(bad);
    assert.strictEqual(res.success, false, `payload: ${String(bad)}`);
    assert.strictEqual(res.error.code, "MISSING_URL", `payload: ${String(bad)}`);
  }
  assert.strictEqual(commands.length, before, "kein Kommando erzeugt");
  assert.strictEqual(emits.filter((x) => x.e === "play").length, 0, "kein play-Event");
  assert.ok(hasLog("ohne gültige Stream-URL"), "Diagnose geloggt");
  assert.ok(hasLog("sessionId="), "Session-ID im Log");
});

test("SIGTERM wird gesendet und der Eskalationstimer danach aufgelöst (end)", async () => {
  const s = fresh();
  const cmd = await startSpawned(s, "http://a/one", 1001);
  s.stop();
  assert.deepStrictEqual(cmd.kills, ["SIGTERM"]);
  assert.ok(s._killTimer != null, "Eskalationstimer läuft");
  finish(cmd, null);
  assert.strictEqual(s._killTimer, null, "Timer bei sauberem Ende aufgelöst");
  await sleep(80);
  assert.deepStrictEqual(cmd.kills, ["SIGTERM"], "kein SIGKILL nach sauberem Ende");
});

test("SIGTERM wird gesendet und der Eskalationstimer nach 'error' aufgelöst", async () => {
  const s = fresh();
  const cmd = await startSpawned(s, "http://a/two", 1002);
  s.stop();
  assert.deepStrictEqual(cmd.kills, ["SIGTERM"]);
  assert.ok(s._killTimer != null);
  // fluent-ffmpeg emittiert bei einem gekillten Prozess "error", NICHT "end".
  finish(cmd, new Error("ffmpeg was killed with signal SIGTERM"));
  assert.strictEqual(s._killTimer, null, "Timer auch bei 'error' aufgelöst");
  await sleep(80);
  assert.deepStrictEqual(cmd.kills, ["SIGTERM"], "kein SIGKILL nach beendetem Prozess");
});

test("lebendiger Prozess nach Timeout → Warnung + SIGKILL", async () => {
  const s = fresh();
  const cmd = await startSpawned(s, "http://a/three", 1003);
  s.stop();
  assert.deepStrictEqual(cmd.kills, ["SIGTERM"]);
  await sleep(90);
  assert.deepStrictEqual(cmd.kills, ["SIGTERM", "SIGKILL"], "Eskalation greift");
  assert.ok(hasLog("nicht auf SIGTERM reagiert"), "Warnung geloggt");
});

test("toter Prozess nach Timeout → kein SIGKILL, keine Warnung", async () => {
  const s = fresh();
  const cmd = await startSpawned(s, "http://a/four", 1004);
  s.stop();
  livePids.delete(1004); // Prozess beendet sich zwischen SIGTERM und Timeout
  await sleep(90);
  assert.deepStrictEqual(cmd.kills, ["SIGTERM"], "kein SIGKILL auf toten Prozess");
  assert.ok(!hasLog("nicht auf SIGTERM reagiert"), "keine Warnung");
});

test("kein nachweisbarer Prozess mehr: Eskalation bleibt ohne Aktion", async () => {
  const s = fresh();
  const cmd = await startSpawned(s, "http://a/five", 1005);
  s.stop();
  // fluent-ffmpeg hat aufgeräumt, ohne dass wir end/error mitgekriegt haben.
  delete cmd.ffmpegProc;
  await sleep(90);
  assert.strictEqual(s._killTimer, null, "Timer aufgelöst");
  assert.ok(!cmd.kills.includes("SIGKILL"), "kein SIGKILL ohne Prozess");
});

test("bereits beendeter Prozess: gar kein Signalversand", async () => {
  const s = fresh();
  await s.start("http://a/six");
  const cmd = last(commands);
  cmd.ffmpegProc = { pid: 1006 };
  // PID existiert nicht
  cmd.emit("start", "ffmpeg");
  s.stop();
  assert.strictEqual(cmd.kills.length, 0, "kein SIGTERM auf toten Prozess");
  assert.ok(hasLog("ist bereits beendet"), "Info-Log vorhanden");
  assert.strictEqual(s._killTimer, null, "keine Eskalation für toten Prozess");
});

test("doppelte Stop-Aufrufe senden genau ein Signal", async () => {
  const s = fresh();
  const cmd = await startSpawned(s, "http://a/seven", 1007);
  s.stop();
  s.stop();
  s.stop();
  assert.deepStrictEqual(cmd.kills, ["SIGTERM"], "Idempotenz");
  assert.strictEqual(s.ffmpegCommand, null);
  assert.strictEqual(s.ffmpegStream, null);
});

test("schneller Senderwechsel: der neue Prozess wird NICHT gekillt", async () => {
  const s = fresh();
  const c1 = await startSpawned(s, "http://a/old", 2001);
  await s.start("http://a/new");
  const c2 = last(commands);
  c2.ffmpegProc = { pid: 2002 };
  livePids.add(2002);
  c2.emit("start", "ffmpeg new");

  assert.deepStrictEqual(c1.kills, ["SIGTERM"], "alter Prozess: SIGTERM");
  assert.strictEqual(c2.kills.length, 0, "neuer Prozess: kein Kill");

  await sleep(120); // > killTimeoutMs beider Läufe
  assert.deepStrictEqual(c1.kills, ["SIGTERM", "SIGKILL"], "Eskalation greift nur beim alten Prozess");
  assert.deepStrictEqual(c2.kills, [], "SIGKILL des alten Laufs trifft den neuen Prozess nicht");
  assert.strictEqual(s.ffmpegCommand, c2, "neues Kommando bleibt referenziert");
});

test("Events eines veralteten Kommandos werden ignoriert", async () => {
  const s = fresh();
  const c1 = await startSpawned(s, "http://a/stale", 3001);
  await s.start("http://a/current");
  logs.length = 0;
  c1.emit("error", new Error("ffmpeg exited with code 1"), "", "");
  c1.emit("end", "", "");
  assert.strictEqual(logs.filter((l) => l.level === "error").length, 0, "kein Fehlerlog des alten Laufs");
});

test("Stop vor dem Spawn: keine Eskalation ohne Prozess, 'start' armiert danach", async () => {
  const s = fresh();
  await s.start("http://a/early");
  const cmd = last(commands);
  s.stop();
  assert.strictEqual(cmd.kills.length, 0, "vor dem Spawn ist nichts zu töten");
  assert.strictEqual(s._killTimer, null, "keine Eskalation ohne Prozess");
  assert.strictEqual(s.ffmpegPid, null);

  cmd.ffmpegProc = { pid: 4001 };
  livePids.add(4001);
  cmd.emit("start", "ffmpeg");
  assert.deepStrictEqual(cmd.kills, ["SIGTERM"], "Spawn nach dem Stop wird beendet");
  assert.ok(s._killTimer != null, "Eskalation folgt erst mit dem Prozess");
  await sleep(90);
  assert.deepStrictEqual(cmd.kills, ["SIGTERM", "SIGKILL"], "Eskalation greift trotz Spawn-Rennen");
});

test("veralteter PCM-Stream liefert keine Daten mehr an den Renderer", async () => {
  const s = fresh();
  let sent = 0;
  s.setMainWindow({ isDestroyed: () => false, webContents: { send: () => { sent++; } } });
  await s.start("http://a/pcm");
  const oldStream = s.ffmpegStream;
  await s.start("http://a/pcm2");
  sent = 0;
  const chunk = Buffer.alloc(8);
  oldStream.emit("data", chunk);
  assert.strictEqual(sent, 0, "kein IPC vom gestoppten Stream");
  s.ffmpegStream.emit("data", chunk);
  assert.strictEqual(sent, 1, "aktueller Stream liefert weiter");
});

test("Prozess endet von selbst: PID wird freigegeben (kein PID-Reuse-Risiko)", async () => {
  const s = fresh();
  const cmd = await startSpawned(s, "http://a/selfexit", 6001);
  assert.strictEqual(s.ffmpegPid, 6001);
  finish(cmd, new Error("ffmpeg exited with code 1"));
  assert.strictEqual(s.ffmpegPid, null, "beendete PID nicht mehr referenzieren");
  assert.strictEqual(s._killTimer, null);
});

test("stop() räumt Zustand und Stream auf (Shutdown-Regression)", async () => {
  const s = fresh();
  const cmd = await startSpawned(s, "http://a/shutdown", 5001);
  const stream = s.ffmpegStream;
  s.stop();
  assert.strictEqual(s.ffmpegCommand, null);
  assert.strictEqual(s.ffmpegStream, null);
  assert.strictEqual(s.ffmpegPid, null);
  assert.strictEqual(stream.destroyed, true, "Stream zerstört");
  assert.deepStrictEqual(cmd.kills, ["SIGTERM"]);
  s.stop(); // zweiter Aufruf beim App-Shutdown
  assert.deepStrictEqual(cmd.kills, ["SIGTERM"], "kein zweites Signal");
});

(async () => {
  await chain;
  console.log("==========================================");
  console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  console.log("==========================================");
  process.kill = originalKill;
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(fail > 0 ? 1 : 0);
})();
