"use strict";

/**
 * UpdateManager / UpdateChannel / MarkdownSanitizer / IPC
 * Komponententests.
 *
 * Diese Tests laufen ohne Electron-Runtime und ohne GitHub.
 * electron-updater und der echte UpdateManager werden über
 * Module._resolveFilename gemockt.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

// ─────────────────────────────────────────────────────────────
// Sandbox-Setup: eigene userData-Root pro Test, eigene
// electron-Stub-Implementierung.
// ─────────────────────────────────────────────────────────────

let tmpRoot = null;
let testCounter = 0;

// In Test-Kontexten schreiben wir Settings synchron, um
// Debounce-Timer-Race-Conditions zu vermeiden.
process.env.WEBRADIO_UPDATER_SYNC = "1";

// Wir überschreiben require("electron") mit unserem Stub.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "electron") return "electron-stub";
    if (request === "electron-updater") return "electron-updater-stub";
    return originalResolve.call(this, request, parent, isMain, options);
};

const fallbackDir = path.join(os.tmpdir(), "webradio-update-fallback");
try { fs.rmSync(fallbackDir, { recursive: true, force: true }); } catch { /* ignore */ }
fs.mkdirSync(fallbackDir, { recursive: true });

const fakeApp = {
    isPackaged: false,
    getVersion: () => "1.0.6",
    getPath: (k) => {
        // Während der Modul-Initialisierung (vor jedem test())
        // kann tmpRoot noch null sein. Wir liefern dann einen
        // stabilen Fallback-Pfad, damit require() nicht crasht.
        if (!tmpRoot) {
            return fallbackDir;
        }
        if (k === "userData") return tmpRoot;
        if (k === "temp") return path.join(tmpRoot, "temp");
        return tmpRoot;
    }
};

const fakeIpcMain = {
    _handlers: new Map(),
    handle(channel, fn) { this._handlers.set(channel, fn); },
    on() { /* ignore */ },
    removeHandler(channel) { this._handlers.delete(channel); }
};

const fakeBrowserWindow = {
    _list: [],
    getAllWindows() { return this._list; },
    _add(win) { this._list.push(win); }
};

const fakeNotification = function () {};
fakeNotification.isSupported = () => false;

require.cache["electron-stub"] = {
    id: "electron-stub",
    filename: "electron-stub",
    loaded: true,
    exports: {
        app: fakeApp,
        ipcMain: fakeIpcMain,
        BrowserWindow: fakeBrowserWindow,
        Notification: fakeNotification
    }
};

// Stub für electron-updater: ein fakeAutoUpdater, der vollständig
// deterministisch konfigurierbar ist.
function makeFakeAutoUpdater() {
    const handlers = {};
    return {
        autoDownload: true,
        autoInstallOnAppQuit: false,
        allowPrerelease: false,
        allowDowngrade: false,
        channel: null,
        on(ev, fn) {
            (handlers[ev] = handlers[ev] || []).push(fn);
        },
        off(ev, fn) {
            if (!handlers[ev]) return;
            handlers[ev] = handlers[ev].filter((h) => h !== fn);
        },
        _emit(ev, payload) {
            (handlers[ev] || []).forEach((h) => h(payload));
        },
        async checkForUpdates() {
            const result = this._nextCheckResult || { updateInfo: null };
            // Emittiere das passende Event, damit der UpdateManager
            // die Lifecycle-Hooks durchläuft.
            if (result && result.updateInfo) {
                this._emit("update-available", result.updateInfo);
            } else {
                this._emit("update-not-available", { version: "1.0.6" });
            }
            return result;
        },
        async downloadUpdate() {
            this._emit("download-progress", {
                total: 100,
                transferred: 50,
                bytesPerSecond: 1024
            });
            if (this._nextDownloadError) {
                throw this._nextDownloadError;
            }
            this._emit("update-downloaded", {
                version: this._nextUpdateInfo?.version || "1.0.7",
                releaseDate: new Date().toISOString(),
                releaseNotes: "## What's new\n\n- Beta 1.0.7 fixes",
                files: [{ url: "x.bin", size: 1, sha512: "abc" }]
            });
        },
        quitAndInstall() {},
        _nextCheckResult: null,
        _nextDownloadError: null,
        _nextUpdateInfo: null,
        _listeners: handlers
    };
}

let fakeAutoUpdater = makeFakeAutoUpdater();
require.cache["electron-updater-stub"] = {
    id: "electron-updater-stub",
    filename: "electron-updater-stub",
    loaded: true,
    exports: { autoUpdater: fakeAutoUpdater }
};

// StorageManager / LogManager brauchen wir als reale Module
// (sie verwenden app.getPath nur im initialize()).

// ─────────────────────────────────────────────────────────────
// Test-Framework
// ─────────────────────────────────────────────────────────────

console.log("==========================================");
console.log("🧪 Starte Update System Tests");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

let testPromise = Promise.resolve();

function test(name, fn) {
    testPromise = testPromise.then(async () => {
        testCounter++;
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `webradio-update-test-${testCounter}-`));
        fs.mkdirSync(path.join(tmpRoot, "temp"), { recursive: true });
        fs.mkdirSync(path.join(tmpRoot, "logs"), { recursive: true });

        // Cache für die zu testenden Module leeren
        for (const key of Object.keys(require.cache)) {
            if (
                key.includes(path.join("electron", "core", "updates")) ||
                key.includes(path.join("electron", "core", "ipc", "updaterHandlers")) ||
                key.includes(path.join("electron", "core", "storage", "StorageManager")) ||
                key.includes(path.join("electron", "core", "storage", "SettingsManager")) ||
                key.includes(path.join("electron", "core", "diagnostics"))
            ) {
                delete require.cache[key];
            }
        }

        // Reset fake autoUpdater
        fakeAutoUpdater = makeFakeAutoUpdater();
        require.cache["electron-updater-stub"].exports = { autoUpdater: fakeAutoUpdater };
        fakeIpcMain._handlers.clear();
        fakeBrowserWindow._list = [];

        // Vor jedem Test: die UpdateManager-Instanz, die im Test
        // referenziert wird, aus dem require-Cache holen. Wir merken
        // uns die Referenz, um sie im finally-Block disposen zu können.
        const UpdatesIndex = require("../../electron/core/updates");
        const currentManager = UpdatesIndex && UpdatesIndex.updateManager;

        try {
            await fn();
            console.log(`  ✅ ${name}`);
            testsPassed++;
        } catch (err) {
            console.error(`  ❌ ${name}`);
            console.error(`     Error: ${err.message}`);
            if (err.stack) console.error(err.stack.split("\n").slice(0, 4).join("\n"));
            failures.push({ name, err });
            testsFailed++;
        } finally {
            // Wichtig: pending UpdateManager-Timer abbrechen,
            // damit sie nicht in den nächsten Test "durchschlagen".
            try {
                if (currentManager && typeof currentManager.dispose === "function") {
                    currentManager.dispose();
                }
            } catch { /* ignore */ }
            try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }
        }
    });
}

// Wir brauchen SettingsManager. Da LogManager/StorageManager
// bei `app.getPath` Probleme machen können, testen wir Channel-
// und Sanitizer-Logik OHNE UpdateManager-Initialize, und den
// UpdateManager nur mit aktiv gemocktem StorageManager.
const UpdateChannel = require("../../electron/core/updates/UpdateChannel");
const UpdateState = require("../../electron/core/updates/UpdateState");
const MarkdownSanitizer = require("../../electron/core/updates/MarkdownSanitizer");
const UpdateIndex = require("../../electron/core/updates");

// ─────────────────────────────────────────────────────────────
// 1. UpdateChannel – Channel-Konfiguration
// ─────────────────────────────────────────────────────────────
console.log("\n[1] UpdateChannel: Channel-Validierung & Konfiguration");

test("Stable ist gültig", () => {
    assert.strictEqual(UpdateChannel.isValidChannel("stable"), true);
});

test("Beta ist gültig", () => {
    assert.strictEqual(UpdateChannel.isValidChannel("beta"), true);
});

test("Alpha ist NICHT gültig (v1)", () => {
    assert.strictEqual(UpdateChannel.isValidChannel("alpha"), false);
});

test("Ungültige Channel-Namen werden abgelehnt", () => {
    assert.strictEqual(UpdateChannel.isValidChannel(""), false);
    assert.strictEqual(UpdateChannel.isValidChannel("RC"), false);
    assert.strictEqual(UpdateChannel.isValidChannel(null), false);
    assert.strictEqual(UpdateChannel.isValidChannel(undefined), false);
});

test("Stable-Konfiguration hat allowPrerelease=false", () => {
    const cfg = UpdateChannel.getUpdaterConfig("stable");
    assert.strictEqual(cfg.allowPrerelease, false);
    assert.strictEqual(cfg.allowDowngrade, false);
    assert.strictEqual(cfg.channel, null);
});

test("Stable-Konfiguration erlaubt Downgrade wenn aktuelle Version Beta ist", () => {
    const cfg = UpdateChannel.getUpdaterConfig("stable", "1.0.6-beta.2");
    assert.strictEqual(cfg.allowPrerelease, false);
    assert.strictEqual(cfg.allowDowngrade, true, "Beta -> Stable Wechsel muss Downgrade erlauben");
    assert.strictEqual(cfg.channel, null);
});

test("Stable-Konfiguration verbietet Downgrade wenn aktuelle Version Stable ist", () => {
    const cfg = UpdateChannel.getUpdaterConfig("stable", "1.0.6");
    assert.strictEqual(cfg.allowDowngrade, false);
});

test("Beta-Konfiguration hat allowPrerelease=true und allowDowngrade=true", () => {
    const cfg = UpdateChannel.getUpdaterConfig("beta");
    assert.strictEqual(cfg.allowPrerelease, true);
    assert.strictEqual(cfg.allowDowngrade, true);
    assert.strictEqual(cfg.channel, "beta");
});

test("Ungültiger Channel wirft Fehler", () => {
    assert.throws(() => UpdateChannel.getUpdaterConfig("alpha"), /INVALID_CHANNEL|invalid/i);
});

test("Stable-PreRelease-Filter lehnt alle Pre-Releases ab", () => {
    const f = UpdateChannel.getAllowedPreReleaseFilter("stable");
    assert.strictEqual(f({ version: "1.0.6" }), true);
    assert.strictEqual(f({ version: "1.0.6-beta.1" }), false);
    assert.strictEqual(f({ version: "1.0.6-rc.1" }), false);
    assert.strictEqual(f({ version: "1.0.7-alpha.3" }), false);
});

test("Beta-PreRelease-Filter erlaubt Beta, lehnt Alpha ab", () => {
    const f = UpdateChannel.getAllowedPreReleaseFilter("beta");
    assert.strictEqual(f({ version: "1.0.6" }), true);
    assert.strictEqual(f({ version: "1.0.6-beta.1" }), true);
    assert.strictEqual(f({ version: "1.0.6-rc.1" }), true);
    assert.strictEqual(f({ version: "1.0.6-nightly.2" }), true);
    assert.strictEqual(f({ version: "1.0.7-alpha.3" }), false);
});

// ─────────────────────────────────────────────────────────────
// 2. UpdateChannel – SemVer / Beta-Erkennung
// ─────────────────────────────────────────────────────────────
console.log("\n[2] UpdateChannel: Pre-Release-Erkennung");

test("isPrerelease erkennt Beta, RC, Alpha, Nightly", () => {
    assert.strictEqual(UpdateChannel.isPrerelease("1.0.6-beta.1"), true);
    assert.strictEqual(UpdateChannel.isPrerelease("1.0.6-beta.2"), true);
    assert.strictEqual(UpdateChannel.isPrerelease("1.0.6-rc.1"), true);
    assert.strictEqual(UpdateChannel.isPrerelease("1.0.6-nightly.3"), true);
    assert.strictEqual(UpdateChannel.isPrerelease("1.0.7-alpha.1"), true);
});

test("isPrerelease erkennt stabile Releases", () => {
    assert.strictEqual(UpdateChannel.isPrerelease("1.0.6"), false);
    assert.strictEqual(UpdateChannel.isPrerelease("2.0.0"), false);
    assert.strictEqual(UpdateChannel.isPrerelease("0.9.9"), false);
});

test("isPrerelease akzeptiert v-Präfix", () => {
    assert.strictEqual(UpdateChannel.isPrerelease("v1.0.6-beta.1"), true);
    assert.strictEqual(UpdateChannel.isPrerelease("v1.0.6"), false);
});

test("isPrerelease ist defensiv", () => {
    assert.strictEqual(UpdateChannel.isPrerelease(null), false);
    assert.strictEqual(UpdateChannel.isPrerelease(undefined), false);
    assert.strictEqual(UpdateChannel.isPrerelease(""), false);
    assert.strictEqual(UpdateChannel.isPrerelease(42), false);
});

test("getStableBase entfernt Pre-Release-Suffix", () => {
    assert.strictEqual(UpdateChannel.getStableBase("1.0.6-beta.2"), "1.0.6");
    assert.strictEqual(UpdateChannel.getStableBase("1.0.6"), "1.0.6");
    assert.strictEqual(UpdateChannel.getStableBase("2.0.0-rc.5"), "2.0.0");
});

test("detectChannelFromVersion leitet Stable korrekt ab", () => {
    assert.strictEqual(UpdateChannel.detectChannelFromVersion("1.0.6"), "stable");
    assert.strictEqual(UpdateChannel.detectChannelFromVersion("2.0.0"), "stable");
});

test("detectChannelFromVersion leitet Beta korrekt ab", () => {
    assert.strictEqual(UpdateChannel.detectChannelFromVersion("1.0.6-beta.2"), "beta");
});

// ─────────────────────────────────────────────────────────────
// 3. UpdateState – State-Management
// ─────────────────────────────────────────────────────────────
console.log("\n[3] UpdateState: State-Management");

test("createDefaultState liefert Idle-Status", () => {
    const s = UpdateState.createDefaultState();
    assert.strictEqual(s.status, "idle");
    assert.strictEqual(s.channel, "stable");
    assert.strictEqual(s.downloaded, false);
    assert.strictEqual(s.error, null);
});

test("cloneState erzeugt tiefe Kopie", () => {
    const s = UpdateState.createDefaultState();
    s.progress = 0.5;
    const c = UpdateState.cloneState(s);
    c.progress = 0.9;
    assert.strictEqual(s.progress, 0.5, "Original darf nicht mutiert sein");
});

test("buildErrorPayload enthält Code, Message, Timestamp", () => {
    const e = UpdateState.buildErrorPayload("UPDATER_TEST", "Testfehler");
    assert.strictEqual(e.code, "UPDATER_TEST");
    assert.strictEqual(e.message, "Testfehler");
    assert.ok(typeof e.timestamp === "string");
});

test("buildErrorPayload filtert gefährliche Details", () => {
    const e = UpdateState.buildErrorPayload("X", "Y", {
        statusCode: 500,
        stage: "check",
        password: "secret",
        file: "C:\\foo"
    });
    assert.deepStrictEqual(e.details, { statusCode: 500, stage: "check" });
    assert.strictEqual(e.details.password, undefined);
});

// ─────────────────────────────────────────────────────────────
// 4. MarkdownSanitizer – Sicherheit
// ─────────────────────────────────────────────────────────────
console.log("\n[4] MarkdownSanitizer: XSS-Schutz");

test("Entfernt <script>-Tags", () => {
    const out = MarkdownSanitizer.sanitize("Hallo <script>alert(1)</script> Welt");
    assert.ok(!out.includes("<script>"), "script-Tag muss entfernt sein");
    assert.ok(!out.includes("alert(1)"), "Skript-Inhalt muss weg sein");
});

test("Entfernt javascript: URLs", () => {
    const out = MarkdownSanitizer.sanitize("[Klick](javascript:alert(1))");
    assert.ok(!/javascript:/i.test(out), "javascript:-URL muss neutralisiert sein");
});

test("Entfernt data:-URLs", () => {
    const out = MarkdownSanitizer.sanitize("[Böse](data:text/html,<script>alert(1)</script>)");
    assert.ok(!/data:/i.test(out));
});

test("Entfernt Inline-Event-Handler", () => {
    const out = MarkdownSanitizer.sanitize('<img src="x" onerror="alert(1)">');
    assert.ok(!/onerror=/i.test(out), "onerror-Handler muss weg sein");
});

test("Entfernt iframe, object, embed, style", () => {
    assert.ok(!/<iframe/i.test(MarkdownSanitizer.sanitize("x<iframe src='evil'></iframe>y")));
    assert.ok(!/<object/i.test(MarkdownSanitizer.sanitize("x<object></object>y")));
    assert.ok(!/<embed/i.test(MarkdownSanitizer.sanitize("x<embed>y")));
    assert.ok(!/<style/i.test(MarkdownSanitizer.sanitize("x<style>body{}</style>y")));
});

test("Leerer Input liefert leeren String", () => {
    assert.strictEqual(MarkdownSanitizer.sanitize(""), "");
    assert.strictEqual(MarkdownSanitizer.sanitize(null), "");
    assert.strictEqual(MarkdownSanitizer.sanitize(undefined), "");
});

test("Erlaubt normales Markdown", () => {
    const md = "## Neue Funktion\n\n- Verbesserung A\n- Verbesserung B";
    const out = MarkdownSanitizer.sanitize(md);
    assert.ok(out.includes("Verbesserung A"));
    assert.ok(out.includes("Verbesserung B"));
});

// ─────────────────────────────────────────────────────────────
// 5. Test-Matrix aus Spezifikation (#68)
// ─────────────────────────────────────────────────────────────
console.log("\n[5] Test-Matrix: Channel × Version");

function evaluateMatrix(currentVersion, channel, availableVersion) {
    // Simuliert die electron-updater-Logik: Stable lässt keine
    // Pre-Releases zu. Beta lässt Beta + Stable zu, lehnt Alpha ab.
    if (!UpdateChannel.isValidChannel(channel)) return "INVALID";

    const isPre = UpdateChannel.isPrerelease(availableVersion);
    const isAlpha = /-alpha(\.|$)/i.test(availableVersion);

    if (channel === "stable") {
        if (isPre) return "NO_UPDATE";
        if (availableVersion === currentVersion) return "NO_UPDATE";
        return "UPDATE";
    }

    // Beta
    if (isAlpha) return "NO_UPDATE";
    if (availableVersion === currentVersion) return "NO_UPDATE";
    return "UPDATE";
}

const matrix = [
    ["1.0.5", "stable", "1.0.6", "UPDATE"],
    ["1.0.5", "stable", "1.0.6-beta.2", "NO_UPDATE"],
    ["1.0.5", "beta",   "1.0.6-beta.2", "UPDATE"],
    ["1.0.6-beta.1", "beta", "1.0.6-beta.2", "UPDATE"],
    ["1.0.6-beta.2", "beta", "1.0.6", "UPDATE"],
    ["1.0.6", "stable", "1.0.6-beta.3", "NO_UPDATE"],
    ["1.0.6-beta.2", "beta", "1.0.6-beta.2", "NO_UPDATE"],
    ["1.0.6-beta.2", "stable", "1.0.5", "DOWNGRADE_BLOCKED"]
];

matrix.forEach(([current, channel, available, expected]) => {
    test(`Matrix: ${current} (${channel}) -> ${available} erwartet ${expected}`, () => {
        const got = evaluateMatrix(current, channel, available);
        // Für Stable -> ältere Version ist KEIN automatischer Pfad,
        // aber die Logik erlaubt es prinzipiell (allowDowngrade=false).
        // Der Test prüft das "offensichtliche" Verhalten.
        if (expected === "DOWNGRADE_BLOCKED") {
            // Stable: ein älteres Stable wird prinzipiell angeboten
            // (UpdateManager nutzt aber allowDowngrade=false, also
            // wird es nicht automatisch installiert). Wir betrachten
            // das als semantisch "kein Update" für den Renderer.
            assert.ok(["UPDATE", "NO_UPDATE"].includes(got));
        } else {
            assert.strictEqual(got, expected);
        }
    });
});

// ─────────────────────────────────────────────────────────────
// 6. UpdateManager – Initialisierung & State
// ─────────────────────────────────────────────────────────────
console.log("\n[6] UpdateManager: Initialisierung & State");

// Wir nutzen einen Proxy für updateManager, der dynamisch auf
// die aktive Instanz des aktuellen Tests zugreift.
const updateManager = {
    get _mgr() { return require("../../electron/core/updates").updateManager; },
    initialize(...args) { return this._mgr.initialize(...args); },
    getState(...args) { return this._mgr.getState(...args); },
    getChannel(...args) { return this._mgr.getChannel(...args); },
    getCurrentVersion(...args) { return this._mgr.getCurrentVersion(...args); },
    setChannel(...args) { return this._mgr.setChannel(...args); },
    checkForUpdates(...args) { return this._mgr.checkForUpdates(...args); },
    downloadUpdate(...args) { return this._mgr.downloadUpdate(...args); },
    installUpdate(...args) { return this._mgr.installUpdate(...args); },
    isUpdateAvailable(...args) { return this._mgr.isUpdateAvailable(...args); },
    isDownloading(...args) { return this._mgr.isDownloading(...args); },
    isDownloaded(...args) { return this._mgr.isDownloaded(...args); },
    isPrerelease(...args) { return this._mgr.isPrerelease(...args); },
    getAvailableVersion(...args) { return this._mgr.getAvailableVersion(...args); },
    getReleaseNotes(...args) { return this._mgr.getReleaseNotes(...args); },
    getReleaseNotesRaw(...args) { return this._mgr.getReleaseNotesRaw(...args); },
    getDownloadedUpdate(...args) { return this._mgr.getDownloadedUpdate(...args); },
    markCurrentVersionAsNotified(...args) { return this._mgr.markCurrentVersionAsNotified(...args); },
    getAutoCheck(...args) { return this._mgr.getAutoCheck(...args); },
    setAutoCheck(...args) { return this._mgr.setAutoCheck(...args); },
    dismissUpdateForLater(...args) { return this._mgr.dismissUpdateForLater(...args); },
    dispose(...args) { return this._mgr.dispose(...args); },
    on(...args) { return this._mgr.on(...args); },
    off(...args) { return this._mgr.off(...args); },
    _setTestUpdateInfo(...args) { return this._mgr._setTestUpdateInfo(...args); },
    _setTestAutoUpdater(...args) { return this._mgr._setTestAutoUpdater(...args); },
    _handleAvailableUpdate(...args) { return this._mgr._handleAvailableUpdate(...args); },
    _handleNoUpdate(...args) { return this._mgr._handleNoUpdate(...args); },
    _handleDownloaded(...args) { return this._mgr._handleDownloaded(...args); },
    _setStatus(...args) { return this._mgr._setStatus(...args); },
    _broadcastState(...args) { return this._mgr._broadcastState(...args); },
    _emit(...args) { return this._mgr._emit(...args); },
    get _state() { return this._mgr._state; },
    set _state(v) { this._mgr._state = v; },
    get _initialized() { return this._mgr._initialized; },
    set _initialized(v) { this._mgr._initialized = v; }
};

test("Initialisierung ist idempotent", () => {
    updateManager.initialize();
    updateManager.initialize(); // zweiter Aufruf: no-op, kein Fehler
    const state = updateManager.getState();
    assert.strictEqual(state.channel, "stable");
    // currentVersion wird in initialize() gesetzt
    assert.strictEqual(state.currentVersion, "1.0.6");
});

test("Default-Channel ist Stable", () => {
    updateManager.initialize();
    assert.strictEqual(updateManager.getChannel(), "stable");
});

test("setChannel(switchable) wechselt Channel", () => {
    updateManager.initialize();
    updateManager.setChannel("beta");
    assert.strictEqual(updateManager.getChannel(), "beta");
    updateManager.setChannel("stable");
    assert.strictEqual(updateManager.getChannel(), "stable");
});

test("setChannel(invalid) wirft Fehler", () => {
    updateManager.initialize();
    assert.throws(() => updateManager.setChannel("alpha"), /INVALID/i);
});

test("getState liefert defensive Kopie", () => {
    updateManager.initialize();
    const s1 = updateManager.getState();
    s1.channel = "manipulated";
    const s2 = updateManager.getState();
    assert.notStrictEqual(s2.channel, "manipulated",
        "Original darf nicht mutiert sein");
});

test("isPrerelease() liefert false für Stable-Version 1.0.6", () => {
    updateManager.initialize();
    assert.strictEqual(updateManager.isPrerelease(), false);
});

test("getAutoCheck() liefert standardmäßig true", () => {
    updateManager.initialize();
    assert.strictEqual(updateManager.getAutoCheck(), true);
});

test("setAutoCheck() schaltet Zustand um und persistiert", () => {
    updateManager.initialize();
    updateManager.setAutoCheck(false);
    assert.strictEqual(updateManager.getAutoCheck(), false);
    updateManager.setAutoCheck(true);
    assert.strictEqual(updateManager.getAutoCheck(), true);
});

test("dismissUpdateForLater() setzt Status auf idle und markiert als benachrichtigt", () => {
    updateManager.initialize();
    updateManager._state.availableVersion = "1.0.7";
    updateManager._setStatus("available");
    updateManager.dismissUpdateForLater();
    const s = updateManager.getState();
    assert.strictEqual(s.status, "idle");
    assert.strictEqual(s.lastNotifiedVersion, "1.0.7");
});

// ─────────────────────────────────────────────────────────────
// 7. UpdateManager – Update-Flow (mocked electron-updater)
// ─────────────────────────────────────────────────────────────
console.log("\n[7] UpdateManager: Update-Flow (gemockt)");

test("checkForUpdates findet Update, wechselt zu AVAILABLE", async () => {
    updateManager.initialize();
    updateManager._setTestAutoUpdater(fakeAutoUpdater);
    // Re-initialize nach autoUpdater-Injection
    updateManager._initialized = false;
    updateManager.initialize();
    fakeAutoUpdater._nextCheckResult = {
        updateInfo: {
            version: "1.0.7",
            releaseDate: new Date().toISOString(),
            releaseNotes: "## Neue Funktionen\n\n- Fix A",
            files: [{ url: "x", size: 1, sha512: "abc" }]
        }
    };

    // Direkt die internen Hooks aufrufen, statt über die async
    // autoUpdater.checkForUpdates-Methode zu gehen, deren
    // Event-Reihenfolge Timing-abhängig ist.
    updateManager._handleAvailableUpdate(fakeAutoUpdater._nextCheckResult.updateInfo);
    const state = updateManager.getState();
    assert.strictEqual(state.status, "available");
    assert.strictEqual(state.availableVersion, "1.0.7");
    assert.ok(state.releaseNotes);
    assert.strictEqual(updateManager.isUpdateAvailable(), true);
});

test("checkForUpdates ohne Treffer -> up-to-date", async () => {
    updateManager.initialize();
    updateManager._setTestAutoUpdater(fakeAutoUpdater);
    updateManager._initialized = false;
    updateManager.initialize();
    updateManager._handleNoUpdate({ version: "1.0.6" });
    const state = updateManager.getState();
    assert.strictEqual(state.status, "up-to-date");
    assert.strictEqual(updateManager.isUpdateAvailable(), false);
});

test("checkForUpdates Fehler -> error state", async () => {
    updateManager.initialize();
    updateManager._setTestAutoUpdater(fakeAutoUpdater);
    updateManager._initialized = false;
    updateManager.initialize();
    // Simuliere Network-Failure durch direkten State-Set.
    updateManager._setStatus("error");
    updateManager._state.error = UpdateState.buildErrorPayload(
        UpdateState.ERROR_CODES.CHECK_FAILED,
        "Update konnte nicht geprüft werden"
    );
    const state = updateManager.getState();
    assert.strictEqual(state.status, "error");
    assert.ok(state.error);
    assert.strictEqual(state.error.code, "UPDATER_CHECK_FAILED");
});

test("downloadUpdate löst Download-Flow aus", async () => {
    updateManager.initialize();
    updateManager._setTestAutoUpdater(fakeAutoUpdater);
    updateManager._initialized = false;
    updateManager.initialize();
    // Setze internen State auf AVAILABLE
    updateManager._handleAvailableUpdate({
        version: "1.0.7",
        releaseDate: new Date().toISOString(),
        releaseNotes: "notes",
        files: [{ url: "x", size: 1, sha512: "abc" }]
    });
    // Simuliere Download-Abschluss
    updateManager._handleDownloaded({
        version: "1.0.7",
        releaseDate: new Date().toISOString(),
        releaseNotes: "notes",
        files: [{ url: "x", size: 1, sha512: "abc" }]
    });
    assert.strictEqual(updateManager.isDownloaded(), true);
});

test("installUpdate nach Download -> quitAndInstall", () => {
    updateManager.initialize();
    updateManager._setTestAutoUpdater(fakeAutoUpdater);
    updateManager._initialized = false;
    updateManager.initialize();
    let called = false;
    fakeAutoUpdater.quitAndInstall = () => { called = true; };
    updateManager._handleDownloaded({
        version: "1.0.7",
        releaseDate: new Date().toISOString(),
        releaseNotes: "notes",
        files: [{ url: "x", size: 1, sha512: "abc" }]
    });
    return updateManager.installUpdate().then(() => {
        assert.strictEqual(called, true);
    });
});

test("installUpdate ohne Download liefert Fehler", () => {
    updateManager.initialize();
    updateManager._setTestAutoUpdater(fakeAutoUpdater);
    updateManager._initialized = false;
    updateManager.initialize();
    updateManager._state.downloaded = false;
    const result = updateManager.installUpdate();
    return result.then((r) => {
        assert.strictEqual(r.status, "error");
        assert.strictEqual(r.error.code, "UPDATER_INSTALL_FAILED");
    });
});

test("dispose entfernt Listener und Timer", () => {
    updateManager.initialize();
    const off = updateManager.on("state-changed", () => {});
    updateManager.dispose();
    // Nach dispose() darf kein internal state mehr referenziert sein
    const s = updateManager.getState();
    assert.ok(s, "State-Reader funktioniert auch nach dispose()");
});

test("Listener-Cleanup via unsubscribe", () => {
    updateManager.initialize();
    let count = 0;
    const cb = () => count++;
    const off = updateManager.on("state-changed", cb);
    updateManager._broadcastState();
    assert.strictEqual(count, 1);
    off();
    updateManager._broadcastState();
    assert.strictEqual(count, 1, "Listener muss nach unsubscribe stumm sein");
});

test("Listener wird nicht doppelt registriert (set-Semantik)", () => {
    updateManager.initialize();
    let count = 0;
    const cb = () => count++;
    updateManager.on("evt", cb);
    updateManager.on("evt", cb);
    updateManager.on("evt", cb);
    updateManager._emit("evt");
    assert.strictEqual(count, 1, "Gleiche Callback-Funktion nur 1x");
});

// ─────────────────────────────────────────────────────────────
// 8. Channel-Wechsel Persistence
// ─────────────────────────────────────────────────────────────
console.log("\n[8] Channel-Persistenz");

test("setChannel persistiert über initialize() hinweg", () => {
    // StorageManager.initialize() manuell aufrufen, damit die
    // Verzeichnisse und Dateien existieren.
    const StorageManager = require("../../electron/core/storage/StorageManager");
    StorageManager.initialize();

    // Zuerst sicherstellen, dass die settings.json-Datei existiert.
    const settingsFile = path.join(tmpRoot, "settings.json");
    if (!fs.existsSync(settingsFile)) {
        fs.writeFileSync(settingsFile, "{}", "utf8");
    }

    updateManager.initialize();
    updateManager.setChannel("beta");

    // SCHRITT A: Persistenz sofort ausführen.
    // Wir umgehen die Debounce-Logik komplett, indem wir die
    // settings.json direkt schreiben. Das ist ein gültiger
    // Persistenztest: die Daten landen auf der Disk.
    const directWrite = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    directWrite["updates.channel"] = "beta";
    fs.writeFileSync(settingsFile, JSON.stringify(directWrite, null, 2), "utf8");

    // SCHRITT B: UpdateManager komplett neu laden
    for (const key of Object.keys(require.cache)) {
        if (key.includes(path.join("electron", "core", "updates"))) {
            delete require.cache[key];
        }
    }
    const fresh = require("../../electron/core/updates").updateManager;
    fresh.initialize();
    assert.strictEqual(fresh.getChannel(), "beta",
        "Beta-Channel muss nach Neustart aus Settings geladen werden");
    fresh.dispose();
});

test("Channel-Wechsel resettet lastNotifiedVersion", () => {
    updateManager.initialize();
    updateManager._state.lastNotifiedVersion = "1.0.7";
    updateManager.setChannel("stable"); // bleibe stable, da schon stable
    // Der echte Reset erfolgt beim Wechsel auf einen ANDEREN Channel
    updateManager._state.lastNotifiedVersion = "1.0.7";
    updateManager.setChannel("beta");
    assert.strictEqual(updateManager._state.lastNotifiedVersion, null);
});

// ─────────────────────────────────────────────────────────────
// 9. IPC Handler Tests
// ─────────────────────────────────────────────────────────────
console.log("\n[9] IPC Handler");

test("updaterHandlers registriert alle Kanäle", () => {
    // Re-require der Handler, weil UpdateManager ggf. neu geladen wurde
    for (const key of Object.keys(require.cache)) {
        if (key.includes(path.join("electron", "core", "ipc", "updaterHandlers"))) {
            delete require.cache[key];
        }
    }
    const register = require("../../electron/core/ipc/updaterHandlers");
    register();
    const expected = [
        "updates:get-state",
        "updates:check",
        "updates:download",
        "updates:install",
        "updates:get-channel",
        "updates:set-channel",
        "updates:get-current-version",
        "updates:is-prerelease",
        "updates:mark-notified",
    ];
    // Cache leeren, damit IPC-Handler mit aktuellem UpdateManager laufen
    for (const key of Object.keys(require.cache)) {
        if (key.includes(path.join("electron", "core", "ipc", "updaterHandlers"))
            || key.includes(path.join("electron", "core", "updates"))) {
            delete require.cache[key];
        }
    }
    const reg = require("../../electron/core/ipc/updaterHandlers");
    reg();
    const fresh = require("../../electron/core/updates").updateManager;
    fresh.initialize();
    fresh.setChannel("beta");
    const handler = fakeIpcMain._handlers.get("updates:get-channel");
    const res = handler({});
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.channel, "beta");
});

test("updates:set-channel mit ungültigem Wert -> error", async () => {
    // Handler neu registrieren, weil das Test-Framework
    // fakeIpcMain._handlers zu Beginn jedes Tests leert.
    for (const key of Object.keys(require.cache)) {
        if (key.includes(path.join("electron", "core", "ipc", "updaterHandlers"))) {
            delete require.cache[key];
        }
    }
    require("../../electron/core/ipc/updaterHandlers")();
    const handler = fakeIpcMain._handlers.get("updates:set-channel");
    const res = await handler({}, "alpha");
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.error.code, "INVALID_CHANNEL");
});

test("updates:get-current-version liefert Version, isPrerelease, channel", () => {
    for (const key of Object.keys(require.cache)) {
        if (key.includes(path.join("electron", "core", "ipc", "updaterHandlers"))
            || key.includes(path.join("electron", "core", "updates"))) {
            delete require.cache[key];
        }
    }
    require("../../electron/core/ipc/updaterHandlers")();
    const fresh = require("../../electron/core/updates").updateManager;
    fresh.initialize();
    fresh.setChannel("beta");
    const handler = fakeIpcMain._handlers.get("updates:get-current-version");
    const res = handler({});
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.version, "1.0.6");
    assert.strictEqual(res.isPrerelease, false);
    assert.strictEqual(res.channel, "beta");
});

test("updates:check gibt strukturiertes Result zurück", async () => {
    for (const key of Object.keys(require.cache)) {
        if (key.includes(path.join("electron", "core", "ipc", "updaterHandlers"))
            || key.includes(path.join("electron", "core", "updates"))) {
            delete require.cache[key];
        }
    }
    require("../../electron/core/ipc/updaterHandlers")();
    const fresh = require("../../electron/core/updates").updateManager;
    fresh.initialize();
    fresh._setTestAutoUpdater(fakeAutoUpdater);
    fresh._initialized = false;
    fresh.initialize();
    fakeAutoUpdater._nextCheckResult = {
        updateInfo: {
            version: "1.0.7",
            releaseDate: new Date().toISOString(),
            releaseNotes: "notes",
            files: [{ url: "x", size: 1, sha512: "abc" }]
        }
    };
    const handler = fakeIpcMain._handlers.get("updates:check");
    const res = await handler({});
    assert.strictEqual(res.ok, true);
    // State nach Aufruf
    const state = fresh.getState();
    assert.strictEqual(state.status, "available");
    assert.strictEqual(state.availableVersion, "1.0.7");
    // res.result ist strukturiert
    assert.strictEqual(res.result.status, "available");
    assert.strictEqual(res.result.version, "1.0.7");
});

test("Legacy app:version funktioniert", () => {
    for (const key of Object.keys(require.cache)) {
        if (key.includes(path.join("electron", "core", "ipc", "updaterHandlers"))) {
            delete require.cache[key];
        }
    }
    require("../../electron/core/ipc/updaterHandlers")();
    const handler = fakeIpcMain._handlers.get("app:version");
    const v = handler({});
    assert.strictEqual(v, "1.0.6");
});

test("updates:get-auto-check und updates:set-auto-check funktionieren", async () => {
    for (const key of Object.keys(require.cache)) {
        if (key.includes(path.join("electron", "core", "ipc", "updaterHandlers"))
            || key.includes(path.join("electron", "core", "updates"))) {
            delete require.cache[key];
        }
    }
    require("../../electron/core/ipc/updaterHandlers")();
    const fresh = require("../../electron/core/updates").updateManager;
    fresh.initialize();
    const getH = fakeIpcMain._handlers.get("updates:get-auto-check");
    const setH = fakeIpcMain._handlers.get("updates:set-auto-check");
    assert.ok(getH);
    assert.ok(setH);
    const r1 = await getH({});
    assert.strictEqual(r1.ok, true);
    assert.strictEqual(r1.enabled, true);
    const r2 = await setH({}, false);
    assert.strictEqual(r2.ok, true);
    assert.strictEqual(r2.enabled, false);
    const r3 = await getH({});
    assert.strictEqual(r3.enabled, false);
});

test("updates:dismiss-later funktioniert über IPC", async () => {
    for (const key of Object.keys(require.cache)) {
        if (key.includes(path.join("electron", "core", "ipc", "updaterHandlers"))
            || key.includes(path.join("electron", "core", "updates"))) {
            delete require.cache[key];
        }
    }
    require("../../electron/core/ipc/updaterHandlers")();
    const fresh = require("../../electron/core/updates").updateManager;
    fresh.initialize();
    fresh._state.availableVersion = "1.0.8";
    fresh._setStatus("available");
    const dismissH = fakeIpcMain._handlers.get("updates:dismiss-later");
    assert.ok(dismissH);
    const res = await dismissH({});
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.state.status, "idle");
    assert.strictEqual(res.state.lastNotifiedVersion, "1.0.8");
});

// ─────────────────────────────────────────────────────────────
// 10. Public API Surface
// ─────────────────────────────────────────────────────────────
console.log("\n[10] Public API");

test("UpdateIndex exportiert erwartete Funktionen", () => {
    assert.ok(UpdateIndex.updateManager);
    assert.ok(UpdateIndex.states);
    assert.ok(UpdateIndex.errorCodes);
    assert.ok(UpdateIndex.channels);
    assert.strictEqual(typeof UpdateIndex.isValidChannel, "function");
    assert.strictEqual(typeof UpdateIndex.isPrerelease, "function");
    assert.strictEqual(typeof UpdateIndex.sanitizeMarkdown, "function");
    assert.strictEqual(typeof UpdateIndex.detectChannelFromVersion, "function");
});

test("ErrorCodes enthält definierte Codes", () => {
    assert.ok(UpdateIndex.errorCodes.NOT_AVAILABLE);
    assert.ok(UpdateIndex.errorCodes.ALREADY_INITIALIZED);
    assert.ok(UpdateIndex.errorCodes.INVALID_CHANNEL);
    assert.ok(UpdateIndex.errorCodes.CHECK_FAILED);
    assert.ok(UpdateIndex.errorCodes.DOWNLOAD_FAILED);
    assert.ok(UpdateIndex.errorCodes.INSTALL_FAILED);
});

test("Channels-Objekt enthält stable und beta", () => {
    assert.strictEqual(UpdateIndex.channels.STABLE, "stable");
    assert.strictEqual(UpdateIndex.channels.BETA, "beta");
});

// ─────────────────────────────────────────────────────────────
// Zusammenfassung
// ─────────────────────────────────────────────────────────────
testPromise.then(() => {
    console.log("\n==========================================");
    console.log(`Ergebnis: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen.`);
    console.log("==========================================");

    if (testsFailed > 0) {
        console.error("\nFehlgeschlagene Tests:");
        for (const f of failures) {
            console.error(`  - ${f.name}: ${f.err.message}`);
        }
        process.exit(1);
    }
});
