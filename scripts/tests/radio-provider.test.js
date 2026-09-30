"use strict";
// radio-provider.test.js – Unified Player API / RadioProvider-Regressionen.
// Deckt vor allem zwei Fehler ab:
//   1. play() ohne URL (player:play / player:toggle) muss die zuletzt
//      verwendete Quelle wieder aufnehmen – ohne erfundene Default-URL.
//   2. _handlePlay darf play() nicht erneut aufrufen (endlose Rekursion
//      über den synchronen eventBus).

const assert = require("assert");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");
const Module = require("module");

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, p, m, o) {
  if (r === "electron") return "el-rp";
  if (r === "ffmpeg-static") return "ffs-rp";
  if (r === "fluent-ffmpeg") return "ffm-rp";
  return origResolve.call(this, r, p, m, o);
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wbrp-"));
fs.mkdirSync(path.join(tmp, "temp"), { recursive: true });
fs.mkdirSync(path.join(tmp, "logs"), { recursive: true });

const fakeApp = {
  isPackaged: true,
  getVersion: () => "1.0.7-alpha.3",
  getPath: (k) => (k === "userData" ? tmp : k === "temp" ? path.join(tmp, "temp") : tmp)
};

const logs = [];
const commands = [];

function makeCommand(url) {
  const cmd = new EventEmitter();
  cmd.url = url;
  cmd.kills = [];
  cmd.kill = (sig) => { if (!cmd.ffmpegProc) return cmd; cmd.kills.push(sig); return cmd; };
  cmd.inputOptions = () => cmd;
  cmd.audioChannels = () => cmd;
  cmd.audioFrequency = () => cmd;
  cmd.format = () => cmd;
  cmd.pipe = () => {
    const s = new EventEmitter();
    s.destroy = () => { s.destroyed = true; };
    cmd._stream = s;
    return s;
  };
  commands.push(cmd);
  return cmd;
}

const fakeFfmpeg = (u) => makeCommand(u);
fakeFfmpeg.setFfmpegPath = () => {};

require.cache["el-rp"] = { id: "el-rp", filename: "el-rp", loaded: true, exports: { app: fakeApp } };
require.cache["ffs-rp"] = { id: "ffs-rp", filename: "ffs-rp", loaded: true, exports: "/mock/ffmpeg" };
require.cache["ffm-rp"] = { id: "ffm-rp", filename: "ffm-rp", loaded: true, exports: fakeFfmpeg };

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
const playerManager = require("../../electron/core/player/PlayerManager");
const { RadioProvider } = require("../../electron/core/player/RadioProvider");

console.log("=== RadioProvider Tests ===");
let pass = 0;
let fail = 0;
let chain = Promise.resolve();

function test(name, fn) {
  chain = chain
    .then(() => Promise.resolve().then(() => fn()))
    .then(() => { console.log(`  [OK] ${name}`); pass++; })
    .catch((e) => { console.error(`  [FAIL] ${name}: ${(e && e.message) || e}`); fail++; });
}

const hasLog = (needle) => logs.some((l) => l.msg.includes(needle));
const last = (arr) => arr[arr.length - 1];

/** Frischer Provider, als aktiver Player registriert. */
function freshProvider() {
  logs.length = 0;
  const p = new RadioProvider();
  playerManager.registerProvider("radio", p);
  playerManager.setActiveProvider("radio");
  p.activate();
  return p;
}

test("play() ohne URL und ohne Quelle → MISSING_URL mit Diagnose, kein FFmpeg", async () => {
  const p = freshProvider();
  const before = commands.length;

  const res = await p.play();

  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error.code, "MISSING_URL");
  assert.strictEqual(commands.length, before, "kein FFmpeg-Start ohne Quelle");
  assert.ok(hasLog("play() ohne URL aufgerufen"), "Warnung geloggt");
  assert.ok(hasLog("commandId=1"), "Command-ID in der Diagnose");
  assert.ok(hasLog("providerId=radio"), "Provider-ID in der Diagnose");
  assert.ok(hasLog("sessionId="), "Session-ID in der Diagnose");
  p.deactivate();
});

test("play() ohne URL nimmt die zuletzt verwendete Quelle wieder auf", async () => {
  const p = freshProvider();
  await p.play("http://station/stream1", { name: "S1" });
  const started = commands.length;
  assert.ok(started > 0);

  // Simuliert player:play / player:toggle: kein Argument.
  const res = await p.play();

  assert.strictEqual(res.success, true);
  assert.strictEqual(commands.length, started + 1, "genau ein Neustart");
  assert.strictEqual(last(commands).url, "http://station/stream1", "echte Wiederherstellung");
  assert.ok(!hasLog("play() ohne URL"), "keine MISSING_URL-Warnung");
  p.deactivate();
});

test("kein Rekursion: play() löst genau EINEN FFmpeg-Start aus", async () => {
  const p = freshProvider();
  const before = commands.length;

  await p.play("http://station/recursion");

  assert.strictEqual(commands.length, before + 1, "genau ein Start – kein Start im Handler");
  p.deactivate();
});

test("radio:start (eventBus) merkt sich die URL für den player:play-Pfad", async () => {
  const p = freshProvider();
  const before = commands.length;

  // So liefert radio:start die Quelle an: streamManager.start() emittiert.
  eventBus.emit("play", { url: "http://station/via-ipc", station: { name: "IPC" } });
  assert.strictEqual(commands.length, before, "Handler startet nicht selbst");
  assert.strictEqual(p.getState().source.url, "http://station/via-ipc");
  assert.strictEqual(p.getState().state, "playing");

  const res = await p.play();
  assert.strictEqual(res.success, true);
  assert.strictEqual(commands.length, before + 1);
  assert.strictEqual(last(commands).url, "http://station/via-ipc");
  p.deactivate();
});

test("_commandId inkrementiert pro Versuch", async () => {
  const p = freshProvider();
  const id0 = p._commandId;
  await p.play();
  const id1 = p._commandId;
  await p.play();
  const id2 = p._commandId;

  assert.strictEqual(id1, id0 + 1);
  assert.strictEqual(id2, id1 + 1);
  p.deactivate();
});

test("stop erhält Quelle und Station für einen erneuten Start", async () => {
  const p = freshProvider();
  await p.play("http://station/keep", { name: "Keep", favicon: "i.png" });

  eventBus.emit("stop");
  assert.strictEqual(p.getState().source.url, "http://station/keep", "URL bleibt");
  assert.strictEqual(p.getState().state, "stopped");

  const before = commands.length;
  const res = await p.play();
  assert.strictEqual(res.success, true);
  assert.strictEqual(commands.length, before + 1);
  assert.strictEqual(last(commands).url, "http://station/keep");
  assert.strictEqual(p.getState().artwork, "i.png", "Station wiederhergestellt");
  p.deactivate();
});

test("player:play ohne Argumente startet die erinnerte Quelle", async () => {
  const p = freshProvider();
  eventBus.emit("play", { url: "http://station/pm", station: { name: "PM" } });
  const before = commands.length;

  const res = await playerManager.play();

  assert.strictEqual(res.success, true);
  assert.strictEqual(commands.length, before + 1, "genau ein FFmpeg-Start");
  assert.strictEqual(last(commands).url, "http://station/pm");
  p.deactivate();
});

test("player:play ohne Quelle startet gar nichts (Diagnose bleibt im Log)", async () => {
  const p = freshProvider();
  const before = commands.length;

  const res = await playerManager.play();

  assert.strictEqual(res.success, true, "PlayerManager-Vertrag (Rückgabe wird nicht verändert)");
  assert.strictEqual(commands.length, before, "kein FFmpeg ohne Quelle");
  assert.ok(hasLog("play() ohne URL aufgerufen"), "Diagnose geloggt");
  p.deactivate();
});

test("ungültige URL erreicht FFmpeg nicht", async () => {
  const p = freshProvider();
  await p.play("http://station/valid");
  const before = commands.length;

  const res = await p.play("kein-url-ohne-schema");

  assert.strictEqual(res.success, true, "Provider prüft nur Leerwerte");
  assert.strictEqual(commands.length, before, "StreamManager lehnt die URL ab");
  assert.ok(hasLog("ohne gültige Stream-URL"), "Diagnose im Log");
  p.deactivate();
});

(async () => {
  await chain;
  console.log("==========================================");
  console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  console.log("==========================================");
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(fail > 0 ? 1 : 0);
})();
