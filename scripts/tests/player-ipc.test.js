// Player API v1 – IPC Handler Tests
// Testet die IPC-Schicht zwischen Renderer und Main-Prozess (§36: IPC-Tests)
"use strict";

const assert = require("assert");
const Module = require("module");
const origResolve = Module._resolveFilename;

// ─── Electron-Stub ────────────────────────────────────────────────────────────
Module._resolveFilename = function (r, p, m, o) {
  if (r === "electron") return "el-ipc-test";
  return origResolve.call(this, r, p, m, o);
};

const fakeIpcMain = {
  _handlers: new Map(),
  handle(channel, fn) { this._handlers.set(channel, fn); },
  removeHandler(channel) { this._handlers.delete(channel); },
  on() {}
};

require.cache["el-ipc-test"] = {
  id: "el-ipc-test", filename: "el-ipc-test", loaded: true,
  exports: {
    ipcMain: fakeIpcMain,
    app: { isPackaged: true, getPath: () => require("os").tmpdir() }
  }
};

// ─── LogManager initialisieren ────────────────────────────────────────────────
const LogManager = require("../../electron/core/diagnostics/logging/LogManager");
LogManager.reset();
LogManager.initialize({ transports: [] });

console.log("==========================================");
console.log("🧪 Starte Player API v1 IPC-Tests");
console.log("==========================================");

let pass = 0, fail = 0;
let chain = Promise.resolve();

function test(name, fn) {
  chain = chain
    .then(() => Promise.resolve().then(() => fn()))
    .then(() => { console.log(`  ✅ ${name}`); pass++; })
    .catch(e => { console.error(`  ❌ ${name}: ${(e && e.message) || String(e)}`); fail++; });
}

async function callHandler(channel, ...args) {
  const handler = fakeIpcMain._handlers.get(channel);
  assert.ok(handler, `Handler fuer Channel "${channel}" nicht registriert`);
  return handler({}, ...args);
}

const mockWindow = {
  isDestroyed: () => false,
  webContents: { send: () => {}, isDestroyed: () => false }
};
const mockWindowManager = { getMainWindow: () => mockWindow };

// ─── Handler registrieren ─────────────────────────────────────────────────────
const registerPlayerHandlers = require("../../electron/core/ipc/playerHandlers");
const { PLAYER_CHANNELS } = registerPlayerHandlers;
registerPlayerHandlers(mockWindowManager);
const pm = require("../../electron/core/player/PlayerManager");

// ─── Tests ────────────────────────────────────────────────────────────────────

test("Alle IPC-Channels sind registriert", () => {
  const expected = [
    PLAYER_CHANNELS.GET_STATE, PLAYER_CHANNELS.PLAY, PLAYER_CHANNELS.PAUSE,
    PLAYER_CHANNELS.STOP, PLAYER_CHANNELS.TOGGLE, PLAYER_CHANNELS.SET_VOLUME,
    PLAYER_CHANNELS.GET_VOLUME, PLAYER_CHANNELS.SET_MUTED, PLAYER_CHANNELS.TOGGLE_MUTE,
    PLAYER_CHANNELS.GET_CAPABILITIES, PLAYER_CHANNELS.SET_ACTIVE_PROVIDER,
    PLAYER_CHANNELS.REGISTER_PROVIDER, PLAYER_CHANNELS.UNREGISTER_PROVIDER,
    PLAYER_CHANNELS.REPORT_PROVIDER_STATE
  ];
  for (const ch of expected) {
    assert.ok(fakeIpcMain._handlers.has(ch), `Channel fehlt: ${ch}`);
  }
});

test("getState liefert vollstaendiges v1-State-Schema (§5)", async () => {
  const state = await callHandler("player:getState");
  for (const f of ["state","title","artist","artwork","volume","muted","capabilities","position","duration","error"]) {
    assert.ok(f in state, `Feld fehlt: ${f}`);
  }
  assert.strictEqual(state.state, "idle");
});

test("play() ohne Provider => { success:false, code:NO_ACTIVE_PROVIDER }", async () => {
  const r = await callHandler("player:play");
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.error.code, "NO_ACTIVE_PROVIDER");
});

test("pause() ohne Provider => NO_ACTIVE_PROVIDER", async () => {
  const r = await callHandler("player:pause");
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.error.code, "NO_ACTIVE_PROVIDER");
});

test("stop() ohne Provider => NO_ACTIVE_PROVIDER", async () => {
  const r = await callHandler("player:stop");
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.error.code, "NO_ACTIVE_PROVIDER");
});

test("toggle() ohne Provider => NO_ACTIVE_PROVIDER", async () => {
  const r = await callHandler("player:toggle");
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.error.code, "NO_ACTIVE_PROVIDER");
});

test("setVolume ungueltig => INVALID_VOLUME", async () => {
  assert.strictEqual((await callHandler("player:setVolume","abc")).error.code, "INVALID_VOLUME");
  assert.strictEqual((await callHandler("player:setVolume",1.5)).error.code, "INVALID_VOLUME");
  assert.strictEqual((await callHandler("player:setVolume",-0.1)).error.code, "INVALID_VOLUME");
});

test("setVolume gueltig => { success:true }", async () => {
  const r = await callHandler("player:setVolume", 0.42);
  assert.strictEqual(r.success, true);
  assert.strictEqual(await callHandler("player:getVolume"), 0.42);
});

test("getCapabilities liefert alle Standard-Felder", async () => {
  const caps = await callHandler("player:getCapabilities");
  for (const k of ["play","pause","stop","volume","mute","seek","next","previous"]) {
    assert.ok(k in caps, `Capability fehlt: ${k}`);
  }
});

test("registerProvider mit gueltiger ID => { success:true }", async () => {
  const prov = {
    id: "test.ipc", name: "Test IPC", type: "test",
    play: async () => {}, pause: async () => {}, stop: async () => {}, setVolume: async () => {},
    getCapabilities: () => ({ play:true, pause:true, stop:true, volume:true, mute:true, seek:false, next:false, previous:false })
  };
  const r = await callHandler("player:registerProvider", "test.ipc", prov);
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.providerId, "test.ipc");
});

test("registerProvider mit fehlender ID => INVALID_ARGUMENT", async () => {
  const r = await callHandler("player:registerProvider", "", {});
  assert.strictEqual(r.error.code, "INVALID_ARGUMENT");
});

test("setActiveProvider bekannte ID => { ok:true }", async () => {
  const r = await callHandler("player:setActiveProvider", "test.ipc");
  assert.strictEqual(r.ok, true);
});

test("setActiveProvider unbekannte ID => PROVIDER_NOT_FOUND", async () => {
  const r = await callHandler("player:setActiveProvider", "does.not.exist");
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error.code, "PROVIDER_NOT_FOUND");
});

test("play() mit aktivem Provider => { success:true }", async () => {
  const r = await callHandler("player:play");
  assert.strictEqual(r.success, true);
});

test("getState enthaelt provider-Objekt mit id/name/type (§5, §19)", async () => {
  const state = await callHandler("player:getState");
  assert.ok(state.provider, "provider fehlt im State");
  assert.strictEqual(state.provider.id, "test.ipc");
  assert.ok(state.provider.name);
  assert.ok(state.provider.type);
});

test("toggle() bei loading => kein zweiter play (§3.4)", async () => {
  pm.updateProviderState("test.ipc", { state: "loading" });
  let playCalled = false;
  const prov = pm.providers.get("test.ipc");
  const orig = prov.play; prov.play = async () => { playCalled = true; };
  const r = await callHandler("player:toggle");
  prov.play = orig;
  assert.strictEqual(r.success, true);
  assert.strictEqual(playCalled, false, "play darf bei loading nicht gerufen werden");
});

test("PLAYER_CHANNELS.STATE_CHANGED = 'player:stateChanged'", () => {
  assert.strictEqual(PLAYER_CHANNELS.STATE_CHANGED, "player:stateChanged");
});

test("commandId muss im COMMAND_CHANNEL gesetzt sein", () => {
  const { COMMAND_CHANNEL } = require("../../electron/core/player/MediaHubProvider");
  assert.strictEqual(COMMAND_CHANNEL, "player:command");
});

test("unregisterProvider entfernt Provider", async () => {
  const r = await callHandler("player:unregisterProvider", "test.ipc");
  assert.strictEqual(r.success, true);
});

chain.then(() => {
  console.log("\n==========================================");
  console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  console.log("==========================================");
  if (fail > 0) process.exit(1);
});
