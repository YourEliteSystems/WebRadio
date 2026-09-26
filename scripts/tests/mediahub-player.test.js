// MediaHub Player IPC-Brücke Tests
// Main → Renderer: mainWindow.webContents.send("mediahub:command", …)
// → Preload window.mediaHubPlayerAPI.onCommand() → YouTube-Plugin
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");

// ─── Electron-Modul für den Main-Prozess mocken ───────────────────────────────
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, p, m, o) {
    if (r === "electron") return "el-mhp";
    return origResolve.call(this, r, p, m, o);
};

require.cache["el-mhp"] = {
    id: "el-mhp",
    filename: "el-mhp",
    loaded: true,
    exports: { app: { isPackaged: true, getPath: () => require("os").tmpdir() } }
};

const LogManager = require("../../electron/core/diagnostics/logging/LogManager");
LogManager.reset();
LogManager.initialize({ transports: [] });

const playerManager = require("../../electron/core/player/PlayerManager");
const { PlayerManager, PLAYER_STATES } = playerManager;
const mediaHubProvider = require("../../electron/core/player/MediaHubProvider");
const { COMMAND_EVENTS, COMMAND_CHANNEL, MediaHubProvider } = mediaHubProvider;

const PRELOAD_PATH = path.join(__dirname, "../../electron/preload.js");
const PROVIDER_PATH = path.join(__dirname, "../../electron/core/player/MediaHubProvider.js");
const RENDERER_PATH = path.join(__dirname, "../../plugins/youtube/renderer.js");
const APP_PATH = path.join(__dirname, "../../renderer/App.jsx");
const PLAYERBAR_PATH = path.join(__dirname, "../../renderer/components/PlayerBar.jsx");
const USE_PLAYER_PATH = path.join(__dirname, "../../renderer/hooks/usePlayer.js");

let pass = 0, fail = 0;
let chain = Promise.resolve();

function test(name, fn) {
    chain = chain
        .then(() => Promise.resolve().then(() => fn()))
        .then(() => { console.log(`  [OK] ${name}`); pass++; })
        .catch((e) => {
            console.error(`  [FAIL] ${name}: ${(e && e.message) || String(e)}`);
            fail++;
        });
}

function report() {
    console.log("\n==========================================");
    console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
    console.log("==========================================");
    if (fail > 0) process.exit(1);
}

// ─── Test-Helfer: Mock-Fenster ────────────────────────────────────────────────
function createWindowMock(options = {}) {
    const sent = [];
    const win = {
        isDestroyed: () => Boolean(options.destroyed),
        webContents: {
            isDestroyed: () => Boolean(options.webContentsDestroyed),
            send: (channel, message) => {
                if (options.throwOnSend) throw new Error("webContents is gone");
                sent.push({ channel, message });
            }
        }
    };
    return {
        sent,
        windowManager: {
            getMainWindow: () => (options.missing ? null : win)
        }
    };
}

function createFreshProvider(windowManager) {
    const provider = new MediaHubProvider();
    provider.setWindowManager(windowManager);
    return provider;
}

// ─── Preload in einer Sandbox laden (Mock-ipcRenderer + contextBridge) ────────
function loadPreload() {
    const listeners = new Map();

    const ipcRenderer = {
        on(channel, handler) {
            if (!listeners.has(channel)) listeners.set(channel, new Set());
            listeners.get(channel).add(handler);
            return ipcRenderer;
        },
        removeListener(channel, handler) {
            const set = listeners.get(channel);
            if (set) set.delete(handler);
            return ipcRenderer;
        },
        send() {},
        invoke: async () => undefined
    };

    const exposed = {};
    const contextBridge = {
        exposeInMainWorld: (name, api) => { exposed[name] = api; }
    };

    const src = fs.readFileSync(PRELOAD_PATH, "utf8");
    const factory = new Function("require", "module", "exports", src);
    factory(() => ({ contextBridge, ipcRenderer }), { exports: {} }, {});

    const dispatch = (channel, message) => {
        const set = listeners.get(channel);
        if (!set) return 0;
        for (const handler of Array.from(set)) handler({}, message);
        return set.size;
    };

    return { exposed, listeners, dispatch };
}

// ─── YouTube-Renderer in einer Sandbox laden ──────────────────────────────────
function createMockElement(tag) {
    const el = {
        tagName: tag,
        id: "",
        style: {},
        children: [],
        innerHTML: "",
        parentNode: null,
        setAttribute() {},
        removeEventListener() {},
        addEventListener() {},
        appendChild(child) {
            this.children.push(child);
            child.parentNode = this;
            return child;
        },
        querySelector() { return createMockElement("div"); },
        remove() {}
    };
    return el;
}

function loadYouTubeRenderer() {
    const elements = new Map();
    const warns = [];
    const reports = [];
    const commandCallbacks = [];
    const hooks = new Map();
    const playerCalls = [];

    const body = createMockElement("body");
    body.appendChild = (child) => {
        if (child.id) elements.set(child.id, child);
        body.children.push(child);
        child.parentNode = body;
        return child;
    };

    const documentMock = {
        createElement: createMockElement,
        getElementsByTagName: () => [{ parentNode: { insertBefore() {} } }],
        getElementById: (id) => elements.get(id) || null,
        body
    };

    const consoleMock = {
        log() {},
        error() {},
        info() {},
        warn: (...args) => warns.push(args.join(" "))
    };

    function MockPlayer(containerId, options) {
        this.containerId = containerId;
        this.options = options;
        this.playVideo = () => playerCalls.push("play");
        this.pauseVideo = () => playerCalls.push("pause");
        this.stopVideo = () => playerCalls.push("stop");
        this.setVolume = (v) => playerCalls.push(`volume:${v}`);
        this.cueVideoById = () => playerCalls.push("cue");
        this.seekTo = () => {};
        this.destroy = () => {};
        this.getVideoData = () => ({ title: "Test", video_id: "mock" });
        this.getCurrentTime = () => 0;
        this.getDuration = () => 0;
    }

    const YTMock = {
        Player: MockPlayer,
        PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 }
    };

    const windowMock = {
        mediaHubPlayerAPI: {
            onCommand: (cb) => {
                commandCallbacks.push(cb);
                return () => {
                    const idx = commandCallbacks.indexOf(cb);
                    if (idx >= 0) commandCallbacks.splice(idx, 1);
                };
            }
        },
        registerPluginRenderer: (id, hook) => { hooks.set(id, hook); },
        playerAPI: {
            reportProviderState: (providerId, state) => {
                reports.push({ providerId, state });
                return Promise.resolve();
            }
        }
    };

    const src = fs.readFileSync(RENDERER_PATH, "utf8");
    const factory = new Function("window", "document", "console", "YT", src);
    factory(windowMock, documentMock, consoleMock, YTMock);

    const dispatch = (message) => {
        for (const cb of Array.from(commandCallbacks)) cb(message);
    };

    const msg = (overrides = {}) => Object.assign({
        channel: COMMAND_EVENTS.PLAY,
        commandId: 1,
        videoId: "dQw4w9WgXcQ",
        timestamp: Date.now()
    }, overrides);

    return {
        windowMock, warns, reports, playerCalls, hooks, commandCallbacks, dispatch, msg
    };
}

// ─── Provider-Setup (entspricht Application.initializePlayer) ─────────────────
const windowMock = createWindowMock();
playerManager.registerProvider("mediahub", mediaHubProvider);
playerManager.setActiveProvider("mediahub");
mediaHubProvider.setWindowManager(windowMock.windowManager);

console.log("=== MediaHub Player IPC Tests ===\n");

// [1] Main-Prozess verwendet kein ipcRenderer
test("[1] Main-Prozess verwendet kein ipcRenderer", () => {
    const raw = fs.readFileSync(PROVIDER_PATH, "utf8");
    // Kommentare entfernen, damit nur tatsächlicher Code geprüft wird
    const src = raw
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!/ipcRenderer/.test(src), "MediaHubProvider darf kein ipcRenderer verwenden");
    assert.ok(!/require\(["']electron["']\)/.test(src), "MediaHubProvider darf electron nicht direkt requiren");
    assert.ok(/webContents\.send/.test(src), "Versand über webContents.send()");
    assert.ok(/mediaHubPlayerAPI/.test(raw), "Doku/Vertrag nennt den Preload-Kanal (Kommentar)");
});

// [2] _sendCommand sendet über mainWindow.webContents.send
test("[2] _sendCommand sendet über mainWindow.webContents.send", () => {
    const mock = createWindowMock();
    const provider = createFreshProvider(mock.windowManager);

    const sent = provider._sendCommand(COMMAND_EVENTS.PLAY, { commandId: 42, videoId: "abcdefghijk" });

    assert.strictEqual(sent, true, "Senden muss true zurückgeben");
    assert.strictEqual(mock.sent.length, 1, "Genau eine Nachricht gesendet");
    assert.strictEqual(mock.sent[0].channel, COMMAND_CHANNEL);
    assert.strictEqual(mock.sent[0].message.channel, COMMAND_EVENTS.PLAY);
    assert.strictEqual(mock.sent[0].message.commandId, 42);
    assert.strictEqual(mock.sent[0].message.videoId, "abcdefghijk");
});

// [3] Fehlendes oder zerstörtes Fenster wird sicher behandelt
test("[3] Fehlendes oder zerstörtes Fenster wird sicher behandelt", () => {
    const cases = [
        createWindowMock({ missing: true }),
        createWindowMock({ destroyed: true }),
        createWindowMock({ webContentsDestroyed: true }),
        createWindowMock({ throwOnSend: true })
    ];

    for (const mock of cases) {
        const provider = createFreshProvider(mock.windowManager);
        assert.strictEqual(provider._sendCommand(COMMAND_EVENTS.STOP, { commandId: 1 }), false,
            "Bei fehlendem/zerstörtem Fenster muss false zurückgegeben werden");
        assert.strictEqual(mock.sent.length, 0, "Es darf nichts gesendet worden sein");
    }

    const noManager = createFreshProvider(null);
    assert.strictEqual(noManager._sendCommand(COMMAND_EVENTS.STOP, { commandId: 1 }), false,
        "Ohne windowManager muss false zurückgegeben werden");

    const unknown = createFreshProvider(createWindowMock().windowManager);
    assert.strictEqual(unknown._sendCommand("player:command:hacks", { commandId: 1 }), false,
        "Unbekannte Kanäle müssen abgelehnt werden");
});

// [4] Alle vier Kommandos nutzen das vereinbarte Nachrichtenformat
test("[4] Alle vier Kommandos nutzen das vereinbarte Nachrichtenformat", () => {
    const mock = createWindowMock();
    const provider = createFreshProvider(mock.windowManager);

    provider._sendCommand(COMMAND_EVENTS.PLAY, { commandId: 1, videoId: "abcdefghijk" });
    provider._sendCommand(COMMAND_EVENTS.PAUSE, { commandId: 2 });
    provider._sendCommand(COMMAND_EVENTS.STOP, { commandId: 3, videoId: null });
    provider._sendCommand(COMMAND_EVENTS.SET_VOLUME, { commandId: 4, volume: 0.5 });

    assert.strictEqual(mock.sent.length, 4, "Vier Kommandos gesendet");

    const expected = [
        COMMAND_EVENTS.PLAY,
        COMMAND_EVENTS.PAUSE,
        COMMAND_EVENTS.STOP,
        COMMAND_EVENTS.SET_VOLUME
    ];

    mock.sent.forEach((entry, i) => {
        const m = entry.message;
        assert.strictEqual(entry.channel, COMMAND_CHANNEL, `Kanal #${i}`);
        assert.strictEqual(m.channel, expected[i], `message.channel #${i}`);
        assert.strictEqual(typeof m.commandId, "number", `commandId #${i}`);
        assert.strictEqual(m.sessionId, "mediahub", `sessionId #${i}`);
        assert.strictEqual(typeof m.timestamp, "number", `timestamp #${i}`);
        assert.ok(Date.now() - m.timestamp < 5000, `timestamp ist aktuell #${i}`);
        assert.ok("videoId" in m, `videoId-Key vorhanden #${i}`);
        assert.ok("source" in m && m.source && m.source.id === "mediahub", `source #${i}`);
    });

    assert.strictEqual(mock.sent[3].message.volume, 0.5, "volume nur beim setVolume-Kommando");
    assert.ok(!("volume" in mock.sent[0].message), "play ohne volume-Feld");
});

// [5] setVolume wird als 0..1-Wert übergeben (Konvertierung genau einmal)
test("[5] setVolume wird als 0..1-Wert übergeben (Konvertierung genau einmal)", () => {
    const mock = createWindowMock();
    const provider = createFreshProvider(mock.windowManager);

    provider.setVolume(0.75);
    provider.setVolume(5);
    provider.setVolume(-0.25);

    const volumes = mock.sent.map(e => e.message.volume);
    assert.deepStrictEqual(volumes, [0.75, 1, 0], `Erwartet [0.75, 1, 0], bekam ${JSON.stringify(volumes)}`);
    volumes.forEach(v => assert.ok(v >= 0 && v <= 1, "Wert muss im Bereich 0..1 liegen"));

    const mainSrc = fs.readFileSync(PROVIDER_PATH, "utf8");
    const rendererSrc = fs.readFileSync(RENDERER_PATH, "utf8");
    assert.ok(!/volume\s*\*\s*100/.test(mainSrc), "Main darf nicht nach 0..100 umrechnen");
    assert.ok(/volume\s*\*\s*100/.test(rendererSrc), "Renderer rechnet exakt einmal in 0..100 um");
});

// [6] Preload exponiert mediaHubPlayerAPI.onCommand
test("[6] Preload exponiert mediaHubPlayerAPI.onCommand", () => {
    const { exposed } = loadPreload();

    assert.ok(exposed.mediaHubPlayerAPI, "mediaHubPlayerAPI wird exponiert");
    assert.strictEqual(typeof exposed.mediaHubPlayerAPI.onCommand, "function", "onCommand ist eine Funktion");
    assert.strictEqual(Object.keys(exposed.mediaHubPlayerAPI).length, 1,
        "Nur onCommand – kein generisches send/invoke");

    const src = fs.readFileSync(PRELOAD_PATH, "utf8");
    const match = src.match(/exposeInMainWorld\("mediaHubPlayerAPI",[\s\S]*?\n\}\);/);
    assert.ok(match, "mediaHubPlayerAPI-Block gefunden");
    const block = match[0];
    assert.ok(!/\.send\(/.test(block), "Kein send() in der mediaHubPlayerAPI");
    assert.ok(!/\.invoke\(/.test(block), "Kein invoke() in der mediaHubPlayerAPI");
    assert.ok(/mediahub:command/.test(block), "Kanal mediahub:command wird abonniert");
});

// [7] onCommand gibt eine funktionierende Unsubscribe-Funktion zurück
test("[7] onCommand gibt eine funktionierende Unsubscribe-Funktion zurück", async () => {
    const { exposed, listeners, dispatch } = loadPreload();

    const received = [];
    const unsub = exposed.mediaHubPlayerAPI.onCommand((m) => received.push(m));

    assert.strictEqual(typeof unsub, "function", "Rückgabe muss eine Funktion sein");
    assert.strictEqual(listeners.get(COMMAND_CHANNEL).size, 1, "Ein Listener registriert");

    dispatch(COMMAND_CHANNEL, { channel: COMMAND_EVENTS.PLAY, commandId: 1 });
    assert.strictEqual(received.length, 1, "Nachricht wird zugestellt");
    assert.strictEqual(received[0].channel, COMMAND_EVENTS.PLAY, "Nur die Payload wird übergeben (kein Event)");

    unsub();
    assert.strictEqual(listeners.get(COMMAND_CHANNEL).size, 0, "Listener entfernt");
    dispatch(COMMAND_CHANNEL, { channel: COMMAND_EVENTS.PLAY, commandId: 2 });
    assert.strictEqual(received.length, 1, "Keine Zustellung nach Unsubscribe");
});

// [8] Unsubscribe entfernt nur den eigenen Listener
test("[8] Unsubscribe entfernt nur den eigenen Listener", () => {
    const { exposed, listeners, dispatch } = loadPreload();

    const a = [];
    const b = [];
    const unsubA = exposed.mediaHubPlayerAPI.onCommand((m) => a.push(m));
    exposed.mediaHubPlayerAPI.onCommand((m) => b.push(m));

    assert.strictEqual(listeners.get(COMMAND_CHANNEL).size, 2, "Zwei Listener registriert");

    unsubA();
    assert.strictEqual(listeners.get(COMMAND_CHANNEL).size, 1, "Nur eigener Listener entfernt");

    dispatch(COMMAND_CHANNEL, { channel: COMMAND_EVENTS.PAUSE, commandId: 9 });
    assert.strictEqual(a.length, 0, "Abgemeldeter Listener wird nicht aufgerufen");
    assert.strictEqual(b.length, 1, "Anderer Listener bleibt aktiv");

    assert.throws(() => exposed.mediaHubPlayerAPI.onCommand("not-a-function"),
        TypeError, "onCommand muss Nicht-Funktionen ablehnen");
});

// [9] Ungültige, veraltete und unbekannte Kommandos werden ignoriert
test("[9] Ungültige, veraltete und unbekannte Kommandos werden ignoriert", () => {
    const ctx = loadYouTubeRenderer();
    ctx.windowMock.onYouTubeIframeAPIReady();

    ctx.dispatch(null);
    ctx.dispatch({});
    ctx.dispatch({ channel: COMMAND_EVENTS.PLAY });                       // ohne commandId
    ctx.dispatch({ channel: COMMAND_EVENTS.PLAY, commandId: 1, videoId: "", timestamp: Date.now() - 60000 });
    ctx.dispatch({ channel: "player:command:hack", commandId: 1, timestamp: Date.now() });

    assert.strictEqual(ctx.playerCalls.length, 0, "Kein Player-Aufruf bei ungültigen Kommandos");
    assert.strictEqual(ctx.reports.length, 0, "Kein erfundener Status bei ungültigen Kommandos");
    assert.ok(ctx.warns.length > 0, "Ungültige Kommandos werden protokolliert");
});

// [10] MediaHub-Renderer führt die passenden Player-Befehle aus
test("[10] MediaHub-Renderer führt die passenden Player-Befehle aus", async () => {
    const ctx = loadYouTubeRenderer();

    // Kommando vor IFrame-Bereitschaft → Queue, dann Flush
    ctx.dispatch(ctx.msg({ commandId: 1 }));
    assert.strictEqual(ctx.playerCalls.length, 0, "Vor ytReady wird noch nicht gespielt");

    ctx.windowMock.onYouTubeIframeAPIReady();
    assert.ok(ctx.playerCalls.includes("play"), "play führt zu ytPlayer.playVideo()");
    assert.ok(ctx.reports.some(r => r.state && r.state.state === "playing"),
        "Renderer meldet den tatsächlich ausgeführten Zustand");

    ctx.dispatch(ctx.msg({ channel: COMMAND_EVENTS.PAUSE, commandId: 2 }));
    assert.ok(ctx.playerCalls.includes("pause"), "pause führt zu ytPlayer.pauseVideo()");

    ctx.dispatch(ctx.msg({ channel: COMMAND_EVENTS.STOP, commandId: 3 }));
    assert.ok(ctx.playerCalls.includes("stop"), "stop führt zu ytPlayer.stopVideo()");

    ctx.dispatch(ctx.msg({ channel: COMMAND_EVENTS.SET_VOLUME, commandId: 4, volume: 0.5 }));
    assert.ok(ctx.playerCalls.includes("volume:50"), "0.5 wird exakt einmal in 50 (0..100) umgerechnet");

    assert.ok(ctx.reports.every(r => r.providerId === "mediahub"),
        "Statusrückmeldungen erfolgen nur am mediahub-Provider");
    assert.ok(!ctx.reports.some(r => r.state.state === "volume-changed"),
        "Ungültiger Zustand 'volume-changed' wird nicht gemeldet");
});

// [11] Globale Controls steuern bei aktivem MediaHub nicht den Radio-Provider
test("[11] Globale Controls steuern bei aktivem MediaHub nicht den Radio-Provider", () => {
    const appSrc = fs.readFileSync(APP_PATH, "utf8");
    const playerBarSrc = fs.readFileSync(PLAYERBAR_PATH, "utf8");
    const usePlayerSrc = fs.readFileSync(USE_PLAYER_PATH, "utf8");

    // Medientasten-Stop: Unified API zuerst, Legacy-Radio-Stop nur bei Radio
    const stopIdx = appSrc.indexOf("window.media.onStop");
    assert.ok(stopIdx > 0, "Medientasten-Stop ist registriert");
    const stopBlock = appSrc.slice(stopIdx, stopIdx + 900);
    assert.ok(/!window\.playerAPI \|\| !window\.playerAPI\.stop/.test(stopBlock),
        "Stop läuft über die Unified Player API");
    assert.ok(/radioActive/.test(stopBlock), "Legacy-Radio-Stop ist an den aktiven Provider geknüpft");
    assert.ok(/source\.id === 'radio'/.test(stopBlock), "Radio-Aktivität wird geprüft");

    // PlayerBar: Radio-Gain nur, wenn MediaHub nicht aktiv ist
    const volumeIdx = playerBarSrc.indexOf("const handleVolumeChange");
    const volumeBlock = playerBarSrc.slice(volumeIdx, volumeIdx + 900);
    assert.ok(/mediahubActive/.test(volumeBlock), "Volume-Handler kennt den MediaHub-Aktiv-Zustand");
    assert.ok(/if \(!mediahubActive\) \{\s*\n\s*legacyOnVolumeChange/.test(volumeBlock),
        "Radio-Gain wird bei aktivem MediaHub nicht angesprochen");
    assert.ok(/setUnifiedVolume\(clamped\)/.test(volumeBlock),
        "Lautstärke läuft weiter über die Unified Player API");

    // Medientasten-Lautstärke: Gain nur bei Radio, Unified immer
    assert.ok(/activeSourceId\.current !== 'mediahub'/.test(usePlayerSrc),
        "Medientasten-Lautstärke umgeht den Radio-Gain bei aktivem MediaHub");
    assert.ok(/window\.playerAPI\?\.setVolume/.test(usePlayerSrc),
        "Medientasten-Lautstärke erreicht den aktiven Provider");
});

// [12] Provider-Wechsel leitet Kommandos nicht mehr an den vorherigen Provider
test("[12] Provider-Wechsel leitet Kommandos nicht mehr an den vorherigen Provider", async () => {
    const pm = new PlayerManager();
    const calls = [];

    const radio = {
        play: () => calls.push("radio.play"),
        pause: () => calls.push("radio.pause"),
        stop: () => calls.push("radio.stop"),
        setVolume: (v) => calls.push(`radio.vol:${v}`),
        getState: () => ({ state: PLAYER_STATES.IDLE })
    };
    const hub = {
        play: () => calls.push("hub.play"),
        pause: () => calls.push("hub.pause"),
        stop: () => calls.push("hub.stop"),
        setVolume: (v) => calls.push(`hub.vol:${v}`),
        getState: () => ({ state: PLAYER_STATES.IDLE })
    };

    pm.registerProvider("radio", radio);
    pm.registerProvider("mediahub", hub);
    pm.setActiveProvider("radio");

    await pm.setVolume(0.5);
    assert.ok(calls.includes("radio.vol:0.5"), "Vor dem Wechsel steuert der Radio-Provider");

    calls.length = 0;
    pm.setActiveProvider("mediahub");
    assert.ok(calls.includes("radio.stop"), "Vorheriger Provider wird gestoppt");

    calls.length = 0;
    await pm.setVolume(0.25);
    await pm.stop();
    assert.ok(calls.includes("hub.vol:0.25"), "Lautstärke geht an den MediaHub-Provider");
    assert.ok(calls.includes("hub.stop"), "Stop geht an den MediaHub-Provider");
    assert.ok(!calls.some(c => c.startsWith("radio.")),
        "Keine Kommandos mehr an den vorherigen Provider");

    // Und zurück: MediaHub erhält nichts mehr
    pm.setActiveProvider("radio");
    calls.length = 0;
    await pm.setVolume(1);
    assert.ok(calls.includes("radio.vol:1"), "Zurück beim Radio-Provider");
    assert.ok(!calls.some(c => c.startsWith("hub.")), "MediaHub erhält keine Kommandos mehr");
});

// [13] Plugin-Teardown entfernt den Kommando-Listener
test("[13] Plugin-Teardown entfernt den Kommando-Listener", () => {
    // Preload-Seite: Unsubscribe hinterlässt keinen Listener
    const pre = loadPreload();
    const unsub = pre.exposed.mediaHubPlayerAPI.onCommand(() => {});
    assert.strictEqual(pre.listeners.get(COMMAND_CHANNEL).size, 1, "Listener registriert");
    unsub();
    assert.strictEqual(pre.listeners.get(COMMAND_CHANNEL).size, 0, "Kein Listener nach Teardown");

    // Renderer-Seite: destroy()-Hook des Plugin-Lebenszyklus meldet ab
    const ctx = loadYouTubeRenderer();
    assert.strictEqual(ctx.commandCallbacks.length, 1, "Renderer hat den Kanal abonniert");

    const pluginHook = ctx.hooks.get("youtube");
    assert.ok(pluginHook, "Teardown-Hook über registerPluginRenderer('youtube') registriert");
    assert.strictEqual(typeof pluginHook.destroy, "function", "destroy() ist vorhanden");

    pluginHook.destroy();
    assert.strictEqual(ctx.commandCallbacks.length, 0, "Kein Listener nach destroy()");

    // Erneutes Laden (Reaktivierung) abonniert wieder
    const ctx2 = loadYouTubeRenderer();
    assert.strictEqual(ctx2.commandCallbacks.length, 1, "Reaktivierung abonniert erneut");
    ctx2.hooks.get("youtube").destroy();
    assert.strictEqual(ctx2.commandCallbacks.length, 0, "Auch danach kein Listener");
});

chain.then(report);
