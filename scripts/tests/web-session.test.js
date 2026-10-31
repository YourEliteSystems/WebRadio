"use strict";

/**
 * Tests für die Web-Session-Integration (MediaHub-Referenz).
 *
 * Abgedeckt:
 *  - Manifest-Validierung (Origins, Web-Session-Capabilities)
 *  - Capability-Auflösung inkl. nicht verfügbarer `encrypted-media`
 *  - PluginAPI-Zugriffsschutz (`web-session`, `web-session-media`)
 *  - Session-Isolation, Partition, Event-Lifecycle und Fehlerfälle
 *  - Fingerprint-Änderung bei geänderten Capabilities
 *
 * Electron wird durch einen Stub ersetzt; es werden keine echten Fenster,
 * Netzwerkzugriffe oder Cookies erzeugt.
 */

const assert = require("assert");
const { EventEmitter } = require("events");
const Module = require("module");
const path = require("path");

// ─── Electron-Stub ──────────────────────────────────────────────────────────
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "electron") return "electron-stub";
  return origResolve.call(this, request, parent, isMain, options);
};

const fakeSessions = new Map();

function createFakeSession(partition) {
  const ses = {
    partition,
    requestFilter: null,
    permissionRequestHandler: null,
    permissionCheckHandler: null,
    downloadHandler: null,
    setPermissionRequestHandler(fn) { this.permissionRequestHandler = fn; },
    setPermissionCheckHandler(fn) { this.permissionCheckHandler = fn; },
    on(event, handler) {
      if (event === "will-download") this.downloadHandler = handler;
    },
    webRequest: {
      onBeforeRequest(filter, callback) {
        ses.requestFilter = { filter, callback };
      }
    }
  };
  return ses;
}

class FakeWebContents extends EventEmitter {
  constructor() {
    super();
    this.url = "";
    this.destroyed = false;
    this.executedScripts = [];
    this.reloadCount = 0;
    this.executor = async () => ({ success: true });
  }

  async loadURL(url) {
    this.url = url;
    this.emit("did-navigate", {}, url);
    return {};
  }

  getURL() { return this.url; }
  reload() { this.reloadCount += 1; }
  isDestroyed() { return this.destroyed; }

  close() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.emit("destroyed");
  }

  async executeJavaScript(script) {
    this.executedScripts.push(script);
    return this.executor(script);
  }
}

class FakeWebContentsView {
  constructor(options = {}) {
    this.options = options;
    this.webContents = new FakeWebContents();
    this.bounds = null;
    FakeWebContentsView.instances.push(this);
  }

  setBounds(bounds) { this.bounds = bounds; }
}
FakeWebContentsView.instances = [];

const fakeWindow = {
  destroyed: false,
  isDestroyed() { return this.destroyed; },
  getContentSize() { return [1200, 800]; },
  contentView: {
    children: new Set(),
    addChildView(view) { this.children.add(view); },
    removeChildView(view) { this.children.delete(view); }
  }
};

require.cache["electron-stub"] = {
  id: "electron-stub",
  filename: "electron-stub",
  loaded: true,
  exports: {
    app: {
      getPath: () => path.join(process.cwd(), "data", "test-web-session"),
      getVersion: () => "1.0.7-beta.3"
    },
    session: {
      fromPartition(partition) {
        if (!fakeSessions.has(partition)) fakeSessions.set(partition, createFakeSession(partition));
        return fakeSessions.get(partition);
      }
    },
    WebContentsView: FakeWebContentsView
  }
};

const PluginAPI = require("../../electron/core/plugins/PluginAPI");
const PluginWebSessionManager = require("../../electron/core/plugins/PluginWebSessionManager");
const PluginPermissions = require("../../electron/core/plugins/PluginPermissions");
const CapabilityRegistry = require("../../electron/core/plugins/CapabilityRegistry");
const PackageValidator = require("../../electron/core/packages/PackageValidator");
const PluginLoader = require("../../electron/core/plugins/PluginLoader");

const manager = PluginWebSessionManager;
const ORIGINS = ["https://music.youtube.com", "https://accounts.google.com"];
const PLUGIN_ID = "mediahub";
const SESSION_ID = "youtube-music";

console.log("==========================================");
console.log("🧪 Starte Web-Session API Tests");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;
const queue = [];

function test(name, fn) {
  queue.push([name, fn]);
}

function lastView() {
  return FakeWebContentsView.instances[FakeWebContentsView.instances.length - 1];
}

function authorizedApi(overrides = {}) {
  return PluginAPI.create({
    id: PLUGIN_ID,
    name: "MediaHub",
    version: "0.14.0",
    permissions: [],
    capabilities: ["web-session", "web-session-media"],
    webSessionOrigins: ORIGINS,
    ...overrides
  });
}

function reset() {
  manager.shutdown();
  fakeSessions.clear();
  fakeWindow.contentView.children.clear();
  FakeWebContentsView.instances.length = 0;
}

// ─────────────────────────────────────────────────────────────
// 1. Capabilities & Manifest
// ─────────────────────────────────────────────────────────────
console.log("\n[1] Capabilities & Manifest");

test("web-session-Capabilities sind bekannt und geschützt", () => {
  for (const id of ["web-session", "web-session-media", "encrypted-media"]) {
    assert.strictEqual(CapabilityRegistry.isKnown(id), true, `${id} muss bekannt sein`);
  }
  assert.strictEqual(CapabilityRegistry.isProtected("web-session"), true);
  assert.strictEqual(CapabilityRegistry.isProtected("web-session-media"), true);
});

test("web-session-media löst web-session als Voraussetzung mit auf", () => {
  const result = PluginPermissions.validateCapabilities(["web-session-media"], []);
  assert.deepStrictEqual(result.granted, ["web-session", "web-session-media"]);
  assert.strictEqual(result.valid, true);
});

test("encrypted-media ist bekannt, wird aber nie gewährt", () => {
  const result = PluginPermissions.validateCapabilities(["encrypted-media"], []);
  assert.ok(result.granted.includes("web-session"));
  assert.ok(result.denied.includes("encrypted-media"));
  assert.strictEqual(result.reasons["encrypted-media"], "Capability unavailable: encrypted-media");
  assert.deepStrictEqual(CapabilityRegistry.canGrant("encrypted-media", []), {
    granted: false,
    reason: "Capability unavailable: encrypted-media"
  });
});

test("Unbekannte Capability bleibt abgelehnt", () => {
  const result = PluginPermissions.validateCapabilities(["web-session", "made-up"], []);
  assert.ok(result.denied.includes("made-up"));
  assert.strictEqual(result.valid, false);
});

test("webSessionOrigins sind Pflicht und müssen exakte HTTPS-Origins sein", () => {
  const validate = PluginWebSessionManager.validateManifest;

  assert.strictEqual(validate({ capabilities: ["web-session"] }).valid, false);
  assert.strictEqual(validate({ capabilities: [] }).valid, true, "Legacy-Manifeste bleiben gültig");
  assert.strictEqual(validate({ capabilities: ["web-session"], webSessionOrigins: [] }).valid, false);

  const invalidOrigins = [
    "http://music.youtube.com",
    "https://music.youtube.com/",
    "https://music.youtube.com/watch",
    "https://*.youtube.com",
    "https://user:pass@music.youtube.com",
    "music.youtube.com",
    null,
    42
  ];
  for (const origin of invalidOrigins) {
    const result = validate({ capabilities: ["web-session"], webSessionOrigins: [origin] });
    assert.strictEqual(result.valid, false, `${origin} darf nicht akzeptiert werden`);
  }

  const valid = validate({
    capabilities: ["web-session", "web-session-media"],
    webSessionOrigins: ["https://music.youtube.com", "https://accounts.google.com"]
  });
  assert.deepStrictEqual(valid, { valid: true, errors: [] });
});

test("PackageValidator akzeptiert Web-Session-Manifeste und lehnt sie ohne Origins ab", () => {
  const base = {
    id: "web-session-plugin", name: "Web Session", version: "1.0.0",
    type: "plugin", main: "main.js",
    permissions: [], capabilities: ["web-session", "web-session-media"],
    webSessionOrigins: ["https://music.youtube.com"]
  };

  const valid = PackageValidator.validate(base, "plugin");
  assert.strictEqual(valid.valid, true, valid.errors.join("; "));

  const missing = PackageValidator.validate({ ...base, webSessionOrigins: [] }, "plugin");
  assert.strictEqual(missing.valid, false);
  assert.ok(missing.errors.some((error) => /webSessionOrigins/.test(error)));

  const insecure = PackageValidator.validate({ ...base, webSessionOrigins: ["http://music.youtube.com"] }, "plugin");
  assert.strictEqual(insecure.valid, false);

  // `encrypted-media` ist eine optionale Anforderung und darf ein installierbares
  // Manifest nicht unbrauchbar machen, obwohl die Capability nie gewährt wird.
  const optionalDrm = PackageValidator.validate({
    ...base, capabilities: ["web-session", "web-session-media", "encrypted-media"]
  }, "plugin");
  assert.strictEqual(optionalDrm.valid, true, optionalDrm.errors.join("; "));
});

test("Capability-Änderungen fließen in den Plugin-Fingerprint ein", () => {
  const base = {
    id: "mediahub", name: "MediaHub", version: "0.14.0",
    main: "main.js", renderer: "renderer.js",
    path: path.join(process.cwd(), "plugins", "mediahub"),
    permissions: [],
    capabilities: ["web-session"],
    webSessionOrigins: ["https://music.youtube.com"]
  };

  const unchanged = PluginLoader.createFingerprint(base);
  assert.strictEqual(unchanged, PluginLoader.createFingerprint({ ...base }));

  const changedCapabilities = PluginLoader.createFingerprint({ ...base, capabilities: ["web-session", "web-session-media"] });
  const changedOrigins = PluginLoader.createFingerprint({ ...base, webSessionOrigins: ["https://accounts.google.com"] });

  assert.notStrictEqual(unchanged, changedCapabilities);
  assert.notStrictEqual(unchanged, changedOrigins);
});

// ─────────────────────────────────────────────────────────────
// 2. Session-Manager
// ─────────────────────────────────────────────────────────────
console.log("\n[2] Session-Manager");

test("Partitionen sind plugin-/session-spezifisch und kollisionsfrei", () => {
  const first = PluginWebSessionManager.partitionFor("a-b", "c");
  const second = PluginWebSessionManager.partitionFor("a", "b-c");
  assert.notStrictEqual(first, second);
  assert.ok(first.startsWith("persist:"));
  assert.strictEqual(first, PluginWebSessionManager.partitionFor("a-b", "c"));
});

test("create lehnt fremde Origins, ungültige IDs und Partition-Overrides ab", () => {
  reset();
  const create = (options) => manager.create(PLUGIN_ID, ORIGINS, { pluginId: PLUGIN_ID, ...options });

  assert.throws(() => create({ sessionId: SESSION_ID, origin: "https://evil.example" }), /nicht im Plugin-Manifest/);
  assert.throws(() => create({ sessionId: "bad id!", origin: "https://music.youtube.com" }), /ungültig/);
  assert.throws(() => create({ sessionId: SESSION_ID, origin: "https://music.youtube.com", partition: "persist:shared" }), /Partition/);
  assert.throws(() => create({ sessionId: SESSION_ID, origin: "https://music.youtube.com", pluginId: "other" }), /genau diesem Plugin/);
  assert.throws(() => manager.create(PLUGIN_ID, ["https://music.youtube.com"], {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com", extra: true
  }), /nur dokumentierte Felder/);
});

test("create erstellt eine isolierte Ansicht mit sicheren webPreferences", () => {
  reset();
  const before = FakeWebContentsView.instances.length;
  const state = manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });

  assert.strictEqual(FakeWebContentsView.instances.length, before + 1);
  const view = lastView();
  assert.strictEqual(view.options.webPreferences.contextIsolation, true);
  assert.strictEqual(view.options.webPreferences.nodeIntegration, false);
  assert.strictEqual(view.options.webPreferences.sandbox, true);
  assert.strictEqual(view.options.webPreferences.webSecurity, true);
  assert.strictEqual(view.options.webPreferences.allowRunningInsecureContent, false);
  assert.strictEqual(view.options.webPreferences.partition, PluginWebSessionManager.partitionFor(PLUGIN_ID, SESSION_ID));

  assert.deepStrictEqual(Object.keys(state).sort(), [
    "album", "artist", "artwork", "audible", "duration", "position", "state", "title", "volume"
  ]);
  assert.strictEqual(state.state, "idle");
});

test("create ist für dieselbe Session idempotent", () => {
  reset();
  const options = { pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com" };
  manager.create(PLUGIN_ID, ORIGINS, options);
  const count = FakeWebContentsView.instances.length;
  manager.create(PLUGIN_ID, ORIGINS, options);
  assert.strictEqual(FakeWebContentsView.instances.length, count);
});

test("request-Filter erlaubt nur HTTPS/WSS/Data/Blob und sperrt Dateizugriff", () => {
  reset();
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });
  const filter = fakeSessions.get(PluginWebSessionManager.partitionFor(PLUGIN_ID, SESSION_ID)).requestFilter;
  assert.ok(filter, "onBeforeRequest muss registriert sein");
  assert.deepStrictEqual(filter.filter.urls, ["<all_urls>"]);

  const decide = (url) => {
    let cancelled = null;
    filter.callback({ url }, (result) => { cancelled = result.cancel; });
    return cancelled;
  };

  assert.strictEqual(decide("https://music.youtube.com/watch?v=1"), false);
  assert.strictEqual(decide("wss://music.youtube.com/socket"), false);
  assert.strictEqual(decide("data:text/plain,hello"), false);
  assert.strictEqual(decide("blob:https://music.youtube.com/uuid"), false);
  assert.strictEqual(decide("file:///C:/Windows/win.ini"), true);
  assert.strictEqual(decide("http://music.youtube.com/"), true);
  assert.strictEqual(decide("custom-scheme://payload"), true);
  assert.strictEqual(decide("not a url"), true);
});

test("Zustandsabonnements liefern initialen Snapshot und lassen sich abbestellen", () => {
  reset();
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });
  const view = lastView();
  const received = [];
  const unsubscribe = manager.onState(PLUGIN_ID, SESSION_ID, (state) => received.push(state));

  assert.strictEqual(received.length, 1);
  assert.strictEqual(received[0].state, "idle");
  assert.ok(!("url" in received[0]), "keine URL im Plugin-Snapshot");

  view.webContents.emit("media-started-playing");
  assert.strictEqual(received[received.length - 1].state, "playing");
  assert.strictEqual(received[received.length - 1].audible, true);

  unsubscribe();
  const lengthAfterUnsubscribe = received.length;
  view.webContents.emit("media-paused");
  assert.strictEqual(received.length, lengthAfterUnsubscribe, "nach unsubscribe keine weiteren Events");

  assert.throws(() => manager.onState(PLUGIN_ID, SESSION_ID, "kein-callback"), /Funktion/);
});

test("Doppelte Zustände werden nicht erneut gemeldet", () => {
  reset();
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });
  const view = lastView();
  const received = [];
  manager.onState(PLUGIN_ID, SESSION_ID, (state) => received.push(state.state));

  view.webContents.emit("media-started-playing");
  view.webContents.emit("media-started-playing");
  assert.deepStrictEqual(received, ["idle", "playing"]);
});

test("Medienbefehle validieren Argumente und melden Fehler strukturiert", async () => {
  reset();
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });
  const view = lastView();

  await assert.rejects(manager.command(PLUGIN_ID, SESSION_ID, null), /Ungültiger Medienbefehl/);
  await assert.rejects(manager.command(PLUGIN_ID, SESSION_ID, { type: "launch" }), /Ungültiger Medienbefehl/);
  await assert.rejects(manager.command(PLUGIN_ID, SESSION_ID, { type: "play", volume: 1 }), /keine zusätzlichen Felder/);

  const seek = await manager.command(PLUGIN_ID, SESSION_ID, { type: "seek" });
  assert.strictEqual(seek.success, false);
  assert.strictEqual(seek.error.code, "COMMAND_ARGUMENTS_UNSPECIFIED");

  view.webContents.executor = async () => ({ success: true });
  assert.deepStrictEqual(await manager.command(PLUGIN_ID, SESSION_ID, { type: "play" }), { success: true });

  view.webContents.executor = async () => ({ success: false, code: "PLAY_REJECTED" });
  const rejected = await manager.command(PLUGIN_ID, SESSION_ID, { type: "play" });
  assert.strictEqual(rejected.success, false);
  assert.strictEqual(rejected.error.code, "PLAY_REJECTED");

  view.webContents.executor = async () => ({ success: false, code: "NO_MEDIA" });
  const missing = await manager.command(PLUGIN_ID, SESSION_ID, { type: "pause" });
  assert.strictEqual(missing.error.code, "NO_MEDIA");

  view.webContents.executor = async () => { throw new Error("renderer gone"); };
  const failed = await manager.command(PLUGIN_ID, SESSION_ID, { type: "stop" });
  assert.strictEqual(failed.error.code, "COMMAND_FAILED");

  // Der Core führt ausschließlich feste Skripte aus; Plugin-Eingaben werden
  // nicht interpoliert.
  assert.ok(view.webContents.executedScripts.every((script) => !script.includes("launch")));
});

test("load und openLogin bleiben auf deklarierte Origins beschränkt", async () => {
  reset();
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });
  const view = lastView();

  await assert.rejects(manager.load(PLUGIN_ID, SESSION_ID, "https://evil.example/watch?v=1"), /keine freigegebene HTTPS-Origin/);
  await assert.rejects(manager.load(PLUGIN_ID, SESSION_ID, "http://music.youtube.com/"), /keine freigegebene HTTPS-Origin/);
  await assert.rejects(manager.load(PLUGIN_ID, SESSION_ID, "https://user:pass@music.youtube.com/"), /keine freigegebene HTTPS-Origin/);

  assert.deepStrictEqual(await manager.load(PLUGIN_ID, SESSION_ID, "https://music.youtube.com/watch?v=abc"), { success: true });
  assert.strictEqual(view.webContents.getURL(), "https://music.youtube.com/watch?v=abc");

  assert.deepStrictEqual(await manager.openLogin(PLUGIN_ID, SESSION_ID), { success: true });
});

test("show/hide bindet nur eine Session gleichzeitig ein und pausiert die vorherige", async () => {
  reset();
  manager.setWindowManager({ getMainWindow: () => fakeWindow });

  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: "session-a", origin: "https://music.youtube.com"
  });
  const firstView = lastView();
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: "session-b", origin: "https://accounts.google.com"
  });
  const secondView = lastView();

  const pauseCalls = [];
  firstView.webContents.executor = async (script) => {
    if (script.includes("pause")) pauseCalls.push(script);
    return { success: true };
  };

  assert.deepStrictEqual(await manager.show(PLUGIN_ID, "session-a", { x: 0, y: 0, width: 800, height: 600 }), { success: true });
  assert.strictEqual(fakeWindow.contentView.children.has(firstView), true);

  assert.deepStrictEqual(await manager.show(PLUGIN_ID, "session-b", { x: 10, y: 20, width: 700, height: 500 }), { success: true });
  await new Promise((resolve) => setImmediate(resolve));

  assert.strictEqual(fakeWindow.contentView.children.has(firstView), false);
  assert.strictEqual(fakeWindow.contentView.children.has(secondView), true);
  assert.ok(pauseCalls.length >= 1, "vorherige Session muss pausiert werden");

  manager.hide(PLUGIN_ID, "session-b");
  assert.strictEqual(fakeWindow.contentView.children.has(secondView), false);
});

test("show validiert Bounds und die Verfügbarkeit des Hauptfensters", async () => {
  reset();
  manager.setWindowManager({ getMainWindow: () => fakeWindow });
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });

  await assert.rejects(manager.show(PLUGIN_ID, SESSION_ID, null), /x\/y\/width\/height/);
  await assert.rejects(manager.show(PLUGIN_ID, SESSION_ID, { x: 0, y: 0, width: 0, height: 10 }), /gültige x\/y\/width\/height/);
  await assert.rejects(manager.show(PLUGIN_ID, SESSION_ID, { x: 5000, y: 0, width: 10, height: 10 }), /außerhalb/);
  await assert.rejects(manager.show(PLUGIN_ID, SESSION_ID, { x: 0, y: 0, width: 100, height: 100, extra: 1 }), /ausschließlich/);

  manager.setWindowManager(null);
  await assert.rejects(manager.show(PLUGIN_ID, SESSION_ID, { x: 0, y: 0, width: 100, height: 100 }), /Hauptfenster/);
  manager.setWindowManager({ getMainWindow: () => fakeWindow });
});

test("Sessions sind pro Plugin getrennt", async () => {
  reset();
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });

  assert.throws(() => manager.getState("other-plugin", SESSION_ID), /existiert nicht/);
  await assert.rejects(manager.command("other-plugin", SESSION_ID, { type: "pause" }), /existiert nicht/);

  const other = manager.create("other-plugin", ["https://music.youtube.com"], {
    pluginId: "other-plugin", sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });
  assert.strictEqual(other.state, "idle");
  assert.notStrictEqual(
    manager.sessions.get(`${PLUGIN_ID}\u0000${SESSION_ID}`),
    manager.sessions.get(`other-plugin\u0000${SESSION_ID}`)
  );
});

test("hidePlugin pausiert, blendet aus und räumt Listener auf – auch nach Destroy", async () => {
  reset();
  manager.setWindowManager({ getMainWindow: () => fakeWindow });
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });
  const view = lastView();
  const received = [];
  manager.onState(PLUGIN_ID, SESSION_ID, (state) => received.push(state));
  await manager.show(PLUGIN_ID, SESSION_ID, { x: 0, y: 0, width: 400, height: 300 });

  let pauses = 0;
  view.webContents.executor = async () => { pauses += 1; return { success: true }; };

  manager.hidePlugin(PLUGIN_ID);
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(pauses >= 1);
  assert.strictEqual(fakeWindow.contentView.children.size, 0);

  const lengthAfterHide = received.length;
  view.webContents.emit("media-started-playing");
  assert.strictEqual(received.length, lengthAfterHide);

  // Ein unerwartet zerstörtes WebContents darf hidePlugin nicht zum Absturz bringen.
  view.webContents.close();
  assert.doesNotThrow(() => manager.hidePlugin(PLUGIN_ID));
});

test("shutdown entsorgt Ansichten, Timer und Abonnements", () => {
  reset();
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });
  const view = lastView();
  manager.onState(PLUGIN_ID, SESSION_ID, () => {});

  manager.shutdown();
  assert.strictEqual(view.webContents.isDestroyed(), true);
  assert.strictEqual(manager.sessions.size, 0);
  assert.strictEqual(manager.visibleKey, null);
});

test("destroy schließt die Ansicht, behält aber dieselbe persistente Partition", () => {
  reset();
  const partition = PluginWebSessionManager.partitionFor(PLUGIN_ID, SESSION_ID);
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });
  const firstView = lastView();

  assert.deepStrictEqual(manager.destroy(PLUGIN_ID, SESSION_ID), { success: true });
  assert.strictEqual(firstView.webContents.isDestroyed(), true);
  assert.strictEqual(manager.sessions.has(`${PLUGIN_ID}\u0000${SESSION_ID}`), false);

  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });
  assert.strictEqual(lastView().options.webPreferences.partition, partition, "Cookies bleiben an dieselbe Partition gebunden");
});

// ─────────────────────────────────────────────────────────────
// 3. PluginAPI
// ─────────────────────────────────────────────────────────────
console.log("\n[3] PluginAPI");

test("Ohne web-session-Capability wird jeder Zugriff verweigert", () => {
  reset();
  const api = PluginAPI.create({ id: "no-session", permissions: [], capabilities: [] });

  const denied = (fn) => assert.throws(fn, (error) => error.code === "CAPABILITY_DENIED");
  denied(() => api.webSession.create({ pluginId: "no-session", sessionId: "s", origin: "https://music.youtube.com" }));
  denied(() => api.webSession.getCapabilities());
  denied(() => api.webSession.openLogin("s"));
  denied(() => api.webSession.getState("s"));
  denied(() => api.webSession.onState("s", () => {}));
  denied(() => api.webSession.show("s", { x: 0, y: 0, width: 10, height: 10 }));
  denied(() => api.webSession.destroy("s"));
});

test("web-session ohne web-session-media darf verwalten, aber keine Medien lesen/steuern", async () => {
  reset();
  const api = PluginAPI.create({
    id: "session-only",
    permissions: [],
    capabilities: ["web-session"],
    webSessionOrigins: ["https://music.youtube.com"]
  });

  const state = api.webSession.create({
    pluginId: "session-only", sessionId: "main", origin: "https://music.youtube.com"
  });
  assert.deepStrictEqual(state, { sessionId: "main", state: "idle" }, "ohne web-session-media keine Metadaten");
  assert.deepStrictEqual(api.webSession.getCapabilities(), {
    commands: { play: true, pause: true, stop: true, seek: false, setVolume: false },
    capabilities: ["web-session"],
    encryptedMedia: false,
    origins: ["https://music.youtube.com"]
  });

  assert.throws(() => api.webSession.getState("main"), (error) => error.code === "CAPABILITY_DENIED");
  assert.throws(() => api.webSession.command("main", { type: "pause" }), (error) => error.code === "CAPABILITY_DENIED");
  assert.throws(() => api.webSession.onState("main", () => {}), (error) => error.code === "CAPABILITY_DENIED");

  assert.deepStrictEqual(api.webSession.destroy("main"), { success: true });
});

test("Plugin kann keine fremde Plugin-ID oder Session-Identität übernehmen", () => {
  reset();
  const api = authorizedApi();

  api.webSession.create({ pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com" });

  assert.throws(
    () => api.webSession.create({ pluginId: "other-plugin", sessionId: "stolen", origin: "https://music.youtube.com" }),
    (error) => error.code === "INVALID_ARGUMENT"
  );
  assert.throws(
    () => api.webSession.create({ pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com" }),
    (error) => error.code === "SESSION_EXISTS"
  );

  const other = PluginAPI.create({
    id: "other-plugin",
    permissions: [],
    capabilities: ["web-session", "web-session-media"],
    webSessionOrigins: ["https://music.youtube.com"]
  });
  assert.throws(() => other.webSession.getState(SESSION_ID), (error) => error.code === "SESSION_NOT_FOUND");
});

test("Autorisierte Plugins erhalten nur bereinigte Zustände und können abbestellen", async () => {
  reset();
  const api = authorizedApi();
  const state = api.webSession.create({
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });
  assert.strictEqual(state.state, "idle");

  const view = lastView();
  const received = [];
  const unsubscribe = api.webSession.onState(SESSION_ID, (next) => received.push(next));

  assert.strictEqual(received.length, 1);
  assert.ok(!("url" in received[0]));
  assert.ok(!("cookies" in received[0]));
  assert.ok(!("session" in received[0]));

  view.webContents.emit("media-started-playing");
  assert.strictEqual(received[received.length - 1].state, "playing");

  unsubscribe();
  view.webContents.emit("media-paused");
  assert.strictEqual(received.length, 2);
});

test("dispose entfernt Abonnements und pausiert offene Sitzungen", async () => {
  reset();
  const api = authorizedApi();
  api.webSession.create({ pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com" });
  const view = lastView();
  let pauses = 0;
  view.webContents.executor = async () => { pauses += 1; return { success: true }; };

  api.webSession.onState(SESSION_ID, () => {});
  api.webSession.onError(SESSION_ID, () => {});
  api.webSession.onNavigationRequired(SESSION_ID, () => {});
  const entry = manager.sessions.get(`${PLUGIN_ID}\u0000${SESSION_ID}`);
  assert.strictEqual(entry.onState.size, 1);

  api.dispose();
  await new Promise((resolve) => setImmediate(resolve));

  assert.ok(pauses >= 1);
  assert.strictEqual(entry.onState.size, 0);
  assert.strictEqual(entry.onError.size, 0);
  assert.strictEqual(entry.onNavigationRequired.size, 0);
});

test("Ungültige Optionen und unbekannte Befehle werden kontrolliert abgelehnt", async () => {
  reset();
  const api = authorizedApi();
  api.webSession.create({ pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com" });

  assert.throws(() => api.webSession.create("kein-objekt"), /erwartet ein Objekt/);
  await assert.rejects(api.webSession.load(SESSION_ID, "https://evil.example/"), /keine freigegebene HTTPS-Origin/);
  await assert.rejects(api.webSession.command(SESSION_ID, { type: "launch" }), /Ungültiger Medienbefehl/);

  const seek = await api.webSession.command(SESSION_ID, { type: "seek" });
  assert.strictEqual(seek.success, false);
  assert.strictEqual(seek.error.code, "COMMAND_ARGUMENTS_UNSPECIFIED");
});

// ─────────────────────────────────────────────────────────────
// 4. will-frame-navigate Event-Signaturen (Electron-44 Kompatibilität)
// ─────────────────────────────────────────────────────────────
console.log("\n[4] will-frame-navigate Event-Signaturen");

test("will-frame-navigate akzeptiert URL als String (Electron-44)", () => {
  reset();
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://accounts.google.com"
  });
  const view = lastView();
  const errors = [];
  manager.onError(PLUGIN_ID, SESSION_ID, (error) => errors.push(error));

  const event = { preventDefault: () => {} };
  const preventDefaultCalls = [];
  event.preventDefault = () => preventDefaultCalls.push(true);

  // String-Signatur: URL direkt als String
  view.webContents.emit("will-frame-navigate", event, "https://accounts.google.com/signin");

  assert.strictEqual(preventDefaultCalls.length, 0, "Erlaubte Google-Origin darf nicht blockiert werden");
  assert.strictEqual(errors.length, 0, "Kein Fehler ausgelöst");
});

test("will-frame-navigate akzeptiert URL als Objekt mit url-Eigenschaft", () => {
  reset();
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://accounts.google.com"
  });
  const view = lastView();
  const errors = [];
  manager.onError(PLUGIN_ID, SESSION_ID, (error) => errors.push(error));

  const event = { preventDefault: () => {} };
  const preventDefaultCalls = [];
  event.preventDefault = () => preventDefaultCalls.push(true);

  // Objekt-Signatur: URL als details.url
  view.webContents.emit("will-frame-navigate", event, { url: "https://accounts.google.com/signin" });

  assert.strictEqual(preventDefaultCalls.length, 0, "Erlaubte Google-Origin darf nicht blockiert werden");
  assert.strictEqual(errors.length, 0, "Kein Fehler ausgelöst");
});

test("will-frame-navigate blockiert nicht erlaubte Origins", () => {
  reset();
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });
  const view = lastView();
  const errors = [];
  manager.onError(PLUGIN_ID, SESSION_ID, (error) => errors.push(error));

  const event = { preventDefault: () => {} };
  const preventDefaultCalls = [];
  event.preventDefault = () => preventDefaultCalls.push(true);

  // Nicht erlaubte Origin (String-Signatur)
  view.webContents.emit("will-frame-navigate", event, "https://evil.example/track");

  assert.strictEqual(preventDefaultCalls.length, 1, "Nicht erlaubte Origin muss blockiert werden");
  assert.strictEqual(errors.length, 1, "Fehler NAVIGATION_BLOCKED muss ausgelöst werden");
  assert.strictEqual(errors[0].code, "NAVIGATION_BLOCKED");
});

test("will-frame-navigate blockiert ungültige Eingaben sicher", () => {
  reset();
  manager.create(PLUGIN_ID, ORIGINS, {
    pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: "https://music.youtube.com"
  });
  const view = lastView();
  const errors = [];
  manager.onError(PLUGIN_ID, SESSION_ID, (error) => errors.push(error));

  const event = { preventDefault: () => {} };
  const preventDefaultCalls = [];
  event.preventDefault = () => preventDefaultCalls.push(true);

  // Ungültige Eingaben: undefined, null, leerer String
  const invalidInputs = [undefined, null, "", "not-a-url"];

  for (const input of invalidInputs) {
    preventDefaultCalls.length = 0;
    errors.length = 0;
    view.webContents.emit("will-frame-navigate", event, input);
    assert.strictEqual(preventDefaultCalls.length, 1, `Ungültige Eingabe ${input} muss blockiert werden`);
    assert.strictEqual(errors.length, 1, `Fehler bei ungültiger Eingabe ${input} muss ausgelöst werden`);
  }
});

test("Erlaubte MediaHub-Origins bleiben erhalten und funktionieren", () => {
  reset();
  const mediaHubOrigins = [
    "https://accounts.google.com",
    "https://accounts.youtube.com",
    "https://music.youtube.com",
    "https://consent.youtube.com"
  ];

  for (const origin of mediaHubOrigins) {
    reset();
    manager.create(PLUGIN_ID, mediaHubOrigins, {
      pluginId: PLUGIN_ID, sessionId: SESSION_ID, origin: origin
    });
    const view = lastView();
    const errors = [];
    manager.onError(PLUGIN_ID, SESSION_ID, (error) => errors.push(error));

    const event = { preventDefault: () => {} };
    const preventDefaultCalls = [];
    event.preventDefault = () => preventDefaultCalls.push(true);

    // Test mit String-Signatur
    view.webContents.emit("will-frame-navigate", event, `${origin}/path`);

    assert.strictEqual(preventDefaultCalls.length, 0, `${origin} darf nicht blockiert werden (String)`);
    assert.strictEqual(errors.length, 0, `Kein Fehler für ${origin} (String)`);

    // Test mit Objekt-Signatur
    preventDefaultCalls.length = 0;
    errors.length = 0;
    view.webContents.emit("will-frame-navigate", event, { url: `${origin}/path` });

    assert.strictEqual(preventDefaultCalls.length, 0, `${origin} darf nicht blockiert werden (Objekt)`);
    assert.strictEqual(errors.length, 0, `Kein Fehler für ${origin} (Objekt)`);
  }
});

(async () => {
  for (const [name, fn] of queue) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      testsPassed++;
    } catch (error) {
      console.error(`  ❌ ${name}`);
      console.error(`     ${error.message}`);
      testsFailed++;
    }
  }

  manager.shutdown();

  console.log("\n==========================================");
  console.log(`Tests abgeschlossen: ${testsPassed} ✅, ${testsFailed} ❌`);
  console.log("==========================================");

  if (testsFailed > 0) process.exit(1);
})();
