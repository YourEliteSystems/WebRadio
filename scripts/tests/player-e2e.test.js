// Player API v1 – End-to-End-Test
// Verifiziert die vollstaendige Player-Kette:
// UI → window.playerAPI → Preload → IPC → PlayerManager → Provider → State-Push → UI
// (§36: End-to-End-Test, §37: Definition of Done)
"use strict";

const assert = require("assert");
const Module = require("module");
const origResolve = Module._resolveFilename;

// ─── Electron-Stubs ───────────────────────────────────────────────────────────
Module._resolveFilename = function (r, p, m, o) {
  if (r === "electron") return "el-e2e-test";
  return origResolve.call(this, r, p, m, o);
};

const ipcHandlers = new Map();
const ipcPushListeners = new Map(); // push-Kanal → Callback

const fakeIpcMain = {
  handle(ch, fn) { ipcHandlers.set(ch, fn); },
  on() {}
};

// Simuliertes webContents: speichert push-Events
const pushEvents = [];
const fakeWindow = {
  isDestroyed: () => false,
  webContents: {
    isDestroyed: () => false,
    send(channel, data) { pushEvents.push({ channel, data }); }
  }
};

require.cache["el-e2e-test"] = {
  id: "el-e2e-test", filename: "el-e2e-test", loaded: true,
  exports: {
    ipcMain: fakeIpcMain,
    app: { isPackaged: true, getPath: () => require("os").tmpdir() }
  }
};

const LogManager = require("../../electron/core/diagnostics/logging/LogManager");
LogManager.reset();
LogManager.initialize({ transports: [] });

// ─── Module laden ─────────────────────────────────────────────────────────────
const playerManager = require("../../electron/core/player/PlayerManager");
const { PLAYER_STATES } = playerManager;
const registerPlayerHandlers = require("../../electron/core/ipc/playerHandlers");

const windowManager = { getMainWindow: () => fakeWindow };
registerPlayerHandlers(windowManager);

// Simulierter Renderer-Aufruf via IPC (entspricht window.playerAPI.X() über preload)
async function rendererCall(channel, ...args) {
  const handler = ipcHandlers.get(channel);
  assert.ok(handler, `Kein Handler: ${channel}`);
  return handler({}, ...args);
}

console.log("==========================================");
console.log("🧪 Starte Player API v1 End-to-End-Tests");
console.log("==========================================");

let pass = 0, fail = 0;
let chain = Promise.resolve();

function test(name, fn) {
  chain = chain
    .then(() => Promise.resolve().then(() => fn()))
    .then(() => { console.log(`  ✅ ${name}`); pass++; })
    .catch(e => { console.error(`  ❌ ${name}: ${(e && e.message) || String(e)}`); fail++; });
}

// ─── E2E: Vollstaendige Kette mit einem Test-Provider ─────────────────────────

// Repräsentiert eine Provider-Implementation (z.B. Radio)
// Ohne Core-Änderungen registrierbar → §21, §36
const thirdPartyProvider = {
  id: "e2e.test.provider",
  name: "E2E Test Provider",
  type: "test-stream",

  capabilities: {
    play: true, pause: true, stop: true,
    volume: true, mute: true,
    seek: false, next: false, previous: false
  },

  _state: "idle",
  _volume: 1.0,
  _calls: [],

  getCapabilities() {
    return { ...this.capabilities };
  },

  async play(url) {
    this._calls.push({ method: "play", url });
    this._state = "playing";
    // Provider meldet State an PlayerManager (wie RadioProvider via eventBus)
    playerManager.updateProviderState(this.id, {
      state: "playing",
      title: "E2E Test Song",
      artist: "E2E Artist",
      artwork: null,
      source: { id: url || "test-url", type: "test-stream", url: url || null }
    });
  },

  async pause() {
    this._calls.push({ method: "pause" });
    this._state = "paused";
    playerManager.updateProviderState(this.id, { state: "paused" });
  },

  async stop() {
    this._calls.push({ method: "stop" });
    this._state = "stopped";
    playerManager.updateProviderState(this.id, { state: "stopped" });
  },

  async setVolume(v) {
    this._calls.push({ method: "setVolume", v });
    this._volume = v;
  }
};

test("E2E: Dritter Provider ohne Core-Aenderung registrierbar (§21, §36)", async () => {
  const r = await rendererCall("player:registerProvider", thirdPartyProvider.id, thirdPartyProvider);
  assert.strictEqual(r.success, true, `Registrierung fehlgeschlagen: ${JSON.stringify(r)}`);
});

test("E2E: setActiveProvider setzt provider-Objekt im State (§19)", async () => {
  pushEvents.length = 0;
  const r = await rendererCall("player:setActiveProvider", thirdPartyProvider.id);
  assert.strictEqual(r.ok, true);

  const state = await rendererCall("player:getState");
  assert.ok(state.provider, "provider fehlt im State");
  assert.strictEqual(state.provider.id, thirdPartyProvider.id);
  assert.strictEqual(state.provider.name, "E2E Test Provider");
  assert.strictEqual(state.provider.type, "test-stream");
});

test("E2E: State-Push nach setActiveProvider an Renderer (player:stateChanged)", () => {
  const stateChangedEvents = pushEvents.filter(e => e.channel === "player:stateChanged");
  assert.ok(stateChangedEvents.length >= 1, `Kein player:stateChanged Push: ${JSON.stringify(pushEvents)}`);
});

test("E2E: play() → Provider.play() → State-Push 'playing' (§37)", async () => {
  pushEvents.length = 0;
  thirdPartyProvider._calls = [];

  const r = await rendererCall("player:play", "http://test-stream.example.com");
  assert.strictEqual(r.success, true);

  // Provider wurde aufgerufen
  assert.ok(thirdPartyProvider._calls.some(c => c.method === "play"), "play() nicht gerufen");

  // State ist playing
  const state = await rendererCall("player:getState");
  assert.strictEqual(state.state, "playing");
  assert.strictEqual(state.title, "E2E Test Song");

  // Push wurde gesendet
  const playing = pushEvents.filter(e => e.channel === "player:stateChanged" && e.data.state === "playing");
  assert.ok(playing.length >= 1, "Kein playing-State-Push gefunden");
});

test("E2E: Capabilities des Providers im State korrekt (§14)", async () => {
  const state = await rendererCall("player:getState");
  assert.ok(state.capabilities, "capabilities fehlt");
  assert.strictEqual(state.capabilities.seek, false);
  assert.strictEqual(state.capabilities.play, true);
});

test("E2E: pause() → Provider.pause() → State 'paused' (§3.2)", async () => {
  pushEvents.length = 0;
  const r = await rendererCall("player:pause");
  assert.strictEqual(r.success, true);
  const state = await rendererCall("player:getState");
  assert.strictEqual(state.state, "paused");
});

test("E2E: toggle() bei paused → play (§3.4)", async () => {
  thirdPartyProvider._calls = [];
  const r = await rendererCall("player:toggle");
  assert.strictEqual(r.success, true);
  assert.ok(thirdPartyProvider._calls.some(c => c.method === "play"), "toggle() hat play nicht aufgerufen");
});

test("E2E: toggle() bei loading → kein play (§3.4)", async () => {
  playerManager.updateProviderState(thirdPartyProvider.id, { state: "loading" });
  thirdPartyProvider._calls = [];
  const r = await rendererCall("player:toggle");
  assert.strictEqual(r.success, true);
  assert.strictEqual(thirdPartyProvider._calls.filter(c => c.method === "play").length, 0,
    "toggle() darf bei loading kein play rufen");
});

test("E2E: setVolume(0.42) → Provider.setVolume → getVolume() = 0.42 (§4)", async () => {
  const r = await rendererCall("player:setVolume", 0.42);
  assert.strictEqual(r.success, true);
  const vol = await rendererCall("player:getVolume");
  assert.strictEqual(vol, 0.42);
  assert.ok(thirdPartyProvider._calls.some(c => c.method === "setVolume" && c.v === 0.42));
});

test("E2E: setVolume(1.5) → INVALID_VOLUME (§4.1)", async () => {
  const r = await rendererCall("player:setVolume", 1.5);
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.error.code, "INVALID_VOLUME");
});

test("E2E: setMuted(true) → muted im State true (§4.3)", async () => {
  await rendererCall("player:setMuted", true);
  const state = await rendererCall("player:getState");
  assert.strictEqual(state.muted, true);
});

test("E2E: toggleMute → muted umgeschaltet (§4.4)", async () => {
  const before = (await rendererCall("player:getState")).muted;
  await rendererCall("player:toggleMute");
  const after = (await rendererCall("player:getState")).muted;
  assert.strictEqual(after, !before);
});

test("E2E: stop() → Provider.stop() → State 'stopped' (§3.3)", async () => {
  const r = await rendererCall("player:stop");
  assert.strictEqual(r.success, true);
  const state = await rendererCall("player:getState");
  assert.strictEqual(state.state, "stopped");
});

test("E2E: subscribe() liefert initialen State (§8, §9)", () => {
  const received = [];
  const unsub = playerManager.subscribe(s => received.push(s));
  assert.ok(received.length >= 1, "Kein initialer State-Callback");
  unsub();
  const before = received.length;
  playerManager._notifySubscribers(playerManager.currentState);
  assert.strictEqual(received.length, before, "Nach unsubscribe() darf kein Event kommen");
});

test("E2E: Inaktiver Provider kann State nicht ueberschreiben (§20)", () => {
  const stateBefore = playerManager.getState().state;
  playerManager.updateProviderState("some.other.provider", { state: "playing", title: "Hack" });
  const stateAfter = playerManager.getState().state;
  assert.strictEqual(stateAfter, stateBefore, "Inaktiver Provider hat State veraendert");
});

test("E2E: unregisterProvider bereinigt Subscriptions (§18)", async () => {
  const r = await rendererCall("player:unregisterProvider", thirdPartyProvider.id);
  assert.strictEqual(r.success, true);

  // Nach Entfernen: kein aktiver Provider mehr → State idle
  const state = await rendererCall("player:getState");
  assert.strictEqual(state.state, "idle");
  assert.strictEqual(state.provider, null);
});

chain.then(() => {
  console.log("\n==========================================");
  console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  console.log("==========================================");
  if (fail > 0) process.exit(1);
});
