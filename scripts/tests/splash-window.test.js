"use strict";

/**
 * Splash-Window Tests für WebRadio
 *
 * Prüft:
 * 1. Registrierung aller Splash-IPC-Kanäle genau einmal (auch bei erneuter
 *    Initialisierung) und zuverlässiges Aufräumen bei closed/dispose().
 * 2. Nachsenden des letzten Bootup-Zustands, wenn der Renderer noch lädt.
 * 3. Testmodus der Splash-Simulation nur bei ausdrücklicher Aktivierung.
 * 4. Verhalten bei fehlgeschlagenem Laden (loadFile-Rejection, did-fail-load)
 *    sowie bei abgebrochenem Laden (ERR_ABORTED) und Subframe-Fehlern.
 * 5. Close-Timer: Verzögerung wirkt, dispose() bricht sie ab; Schließen
 *    während des Ladens wartet auf did-finish-load und wird nicht als
 *    Ladefehler (ERR_FAILED durch Abbruch) gemeldet.
 * 6. Diagnose bei abgebrochenem Start: Bericht mit Pfaden, Logordner/Bericht
 *    öffnen, Schließen und Beenden.
 * 7. Pfadauflösung für Entwicklungs- und Paketbetrieb.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const { EventEmitter } = require("events");

// ─────────────────────────────────────────────
// Electron-Stub
// ─────────────────────────────────────────────

const origResolve = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "electron") return "el-splash-test";
    if (request.endsWith("LogManager")) return "log-splash-test";
    if (request.endsWith("../icons") || request.endsWith("/icons")) return "icons-splash-test";
    return origResolve.call(this, request, parent, isMain, options);
};

const ipcHandlers = new Map();

const fakeIpcMain = {
    handle(channel, listener) {
        if (ipcHandlers.has(channel)) {
            throw new Error(`Attempted to register a second handler for '${channel}'`);
        }
        ipcHandlers.set(channel, listener);
    },
    removeHandler(channel) {
        ipcHandlers.delete(channel);
    }
};

const userDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wbr-splash-test-"));

let quitCalls = 0;
const shellCalls = { openPath: [], showItemInFolder: [] };
let openPathResult = "";

const appRoot = path.resolve(__dirname, "../..");

const fakeApp = {
    isPackaged: false,
    getAppPath: () => appRoot,
    getVersion: () => "1.0.7-beta.3",
    getPath: (key) => (key === "userData" ? userDataRoot : userDataRoot),
    quit: () => { quitCalls++; }
};

const fakeShell = {
    async openPath(target) {
        shellCalls.openPath.push(target);
        return openPathResult;
    },
    showItemInFolder(target) {
        shellCalls.showItemInFolder.push(target);
    }
};

let failNextLoad = false;
let holdNextLoad = false;
let holdNextLoadReject = false;
const heldLoads = [];
const heldRejections = [];

const windowRegistry = [];

class FakeBrowserWindow extends EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.destroyed = false;
        this.closed = false;
        this.loading = true;
        this.sent = [];
        this.loadFileCalls = [];

        const self = this;
        this.webContents = {
            once(event, listener) {
                if (event === "did-finish-load") self._onFinishLoad = listener;
            },
            on(event, listener) {
                if (event === "did-fail-load") self._onFailLoad = listener;
            },
            send(channel, payload) {
                self.sent.push({ channel, payload });
            },
            isLoadingMainFrame() {
                return self.loading;
            }
        };

        windowRegistry.push(this);
    }

    static fromWebContents(webContents) {
        return windowRegistry.find((win) => win.webContents === webContents) || null;
    }

    static getAllWindows() {
        return windowRegistry.filter((win) => !win.isDestroyed());
    }

    loadFile(file, options) {
        this.loadFileCalls.push({ file, options });

        if (failNextLoad) {
            failNextLoad = false;
            return Promise.reject(new Error("ENOENT: splash.html fehlt"));
        }

        if (holdNextLoadReject) {
            holdNextLoadReject = false;
            return new Promise((_resolve, reject) => heldRejections.push(reject));
        }

        if (holdNextLoad) {
            holdNextLoad = false;
            return new Promise((resolve) => heldLoads.push(resolve));
        }

        return Promise.resolve();
    }

    finishLoad() {
        this.loading = false;
        if (this._onFinishLoad) this._onFinishLoad();
    }

    failLoad(code, description, isMainFrame = true) {
        if (this._onFailLoad) this._onFailLoad({}, code, description, "file:///splash.html", isMainFrame);
    }

    isDestroyed() {
        // In Electron gilt ein geschlossenes Fenster als zerstoert.
        return this.destroyed || this.closed;
    }

    close() {
        this.closed = true;
        this.emit("closed");
    }

    destroy() {
        this.destroyed = true;
        this.emit("closed");
    }
}

require.cache["el-splash-test"] = {
    id: "el-splash-test",
    filename: "el-splash-test",
    loaded: true,
    exports: {
        BrowserWindow: FakeBrowserWindow,
        app: fakeApp,
        ipcMain: fakeIpcMain,
        shell: fakeShell
    }
};

require.cache["log-splash-test"] = {
    id: "log-splash-test",
    filename: "log-splash-test",
    loaded: true,
    exports: {
        getLogger: () => ({ info() {}, warn() {}, error() {}, fatal() {}, separator() {} })
    }
};

require.cache["icons-splash-test"] = {
    id: "icons-splash-test",
    filename: "icons-splash-test",
    loaded: true,
    exports: { getWindowIcon: () => null }
};

const SplashWindow = require("../../electron/core/app/SplashWindow");
const BootFailureReport = require("../../electron/core/diagnostics/BootFailureReport");

const SPLASH_CHANNELS = [
    "splash:get-version",
    "splash:get-diagnostics",
    "splash:open-log-folder",
    "splash:open-report",
    "splash:close",
    "splash:quit"
];

console.log("==========================================");
console.log("🧪 Starte Splash-Window Tests");
console.log("==========================================");

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ ${name}`);
        console.error(`     Error: ${err.message}`);
        failed++;
    }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
const eventFor = (win) => ({ sender: win ? win.webContents : null });
const invoke = (channel, win) => ipcHandlers.get(channel)(eventFor(win));

(async () => {

    await test("alle Splash-Kanäle werden genau einmal registriert", () => {
        const splash = new SplashWindow();
        splash.open();

        for (const channel of SPLASH_CHANNELS) {
            assert.strictEqual(typeof ipcHandlers.get(channel), "function", `${channel} fehlt`);
        }
        assert.strictEqual(ipcHandlers.size, SPLASH_CHANNELS.length);
        assert.strictEqual(invoke("splash:get-version", splash._window), "1.0.7-beta.3");

        splash.dispose();
    });

    await test("erneute Initialisierung wirft nicht und registriert nicht doppelt", () => {
        const first = new SplashWindow();
        first.open();

        const second = new SplashWindow();
        assert.doesNotThrow(() => second.open());
        assert.strictEqual(ipcHandlers.size, SPLASH_CHANNELS.length);

        second.dispose();
        first.dispose();

        for (const channel of SPLASH_CHANNELS) {
            assert.strictEqual(ipcHandlers.has(channel), false, `${channel} nicht entfernt`);
        }
    });

    await test("open() nach dispose() registriert alle Kanäle erneut", () => {
        const splash = new SplashWindow();

        splash.open();
        splash.dispose();
        splash.open();

        assert.strictEqual(ipcHandlers.size, SPLASH_CHANNELS.length);

        splash.dispose();
    });

    await test("geschlossenes Fenster entfernt alle IPC-Handler", () => {
        const splash = new SplashWindow();
        splash.open();

        splash._window.close();

        assert.strictEqual(splash.isOpen(), false);
        assert.strictEqual(ipcHandlers.size, 0);
    });

    await test("Bootup-Zustand vor did-finish-load geht nicht verloren", () => {
        const splash = new SplashWindow();
        splash.open();

        const win = splash._window;

        splash.sendBootupState({ marker: "frueh" });
        assert.strictEqual(win.sent.length, 0, "vor dem Laden darf nichts gesendet werden");

        win.finishLoad();
        assert.strictEqual(win.sent.length, 1);
        assert.deepStrictEqual(win.sent[0], { channel: "splash:bootup-state", payload: { marker: "frueh" } });

        splash.sendBootupState({ marker: "spaet" });
        assert.strictEqual(win.sent.length, 2);
        assert.strictEqual(win.sent[1].payload.marker, "spaet");

        splash.dispose();
    });

    await test("ohne offenes Fenster wird kein Zustand gesendet und nichts geworfen", () => {
        const splash = new SplashWindow();

        assert.doesNotThrow(() => splash.sendBootupState({ marker: "x" }));
        assert.strictEqual(splash.isOpen(), false);
    });

    await test("Simulation nur mit WEBRADIO_SPLASH_SIMULATE=1 im Dev-Build", () => {
        const plain = new SplashWindow();
        plain.open();
        assert.strictEqual(plain._window.loadFileCalls[0].options, undefined);
        plain.dispose();

        process.env.WEBRADIO_SPLASH_SIMULATE = "1";
        const simulated = new SplashWindow();
        simulated.open();
        assert.strictEqual(simulated._window.loadFileCalls[0].options.query.simulate, "1");
        delete process.env.WEBRADIO_SPLASH_SIMULATE;
        simulated.dispose();

        fakeApp.isPackaged = true;
        process.env.WEBRADIO_SPLASH_SIMULATE = "1";
        const packaged = new SplashWindow();
        packaged.open();
        assert.strictEqual(packaged._window.loadFileCalls[0].options, undefined);
        delete process.env.WEBRADIO_SPLASH_SIMULATE;
        fakeApp.isPackaged = false;
        packaged.dispose();
    });

    await test("fehlgeschlagenes loadFile räumt Fenster und Handler auf", async () => {
        failNextLoad = true;

        const splash = new SplashWindow();
        splash.open();
        await tick();

        assert.strictEqual(splash.isOpen(), false);
        assert.strictEqual(ipcHandlers.size, 0);
        failNextLoad = false;
    });

    await test("did-fail-load im Hauptframe schließt den Splash", () => {
        holdNextLoad = true;

        const splash = new SplashWindow();
        splash.open();
        splash._window.failLoad(-105, "NAME_NOT_RESOLVED", true);

        assert.strictEqual(splash.isOpen(), false);
        assert.strictEqual(ipcHandlers.size, 0);

        if (heldLoads.length) heldLoads.shift()(undefined);
    });

    await test("ERR_ABORTED (-3) wird nicht als Ladefehler gewertet", () => {
        holdNextLoad = true;

        const splash = new SplashWindow();
        splash.open();
        splash._window.failLoad(-3, "ERR_ABORTED", true);

        assert.strictEqual(splash.isOpen(), true);
        assert.strictEqual(ipcHandlers.has("splash:get-version"), true);

        splash.dispose();
        if (heldLoads.length) heldLoads.shift()(undefined);
    });

    await test("Subframe-Fehler schließen den Splash nicht", () => {
        const splash = new SplashWindow();
        splash.open();
        splash._window.failLoad(-105, "NAME_NOT_RESOLVED", false);

        assert.strictEqual(splash.isOpen(), true);

        splash.dispose();
    });

    await test("dispose() bricht eine geplante close()-Verzögerung ab", async () => {
        const splash = new SplashWindow();
        splash.open();

        const win = splash._window;

        splash.close(40);
        splash.dispose();
        await new Promise((resolve) => setTimeout(resolve, 80));

        assert.strictEqual(win.closed, false);
    });

    await test("close() schließt das Fenster nach Ablauf der Verzögerung", async () => {
        const splash = new SplashWindow();
        splash.open();

        const win = splash._window;

        splash.close(30);
        await new Promise((resolve) => setTimeout(resolve, 80));

        assert.strictEqual(win.closed, true);
        assert.strictEqual(ipcHandlers.size, 0);
    });

    await test("close() ohne eigenes Fenster lässt einen fremden Splash unangetastet", () => {
        const open = new SplashWindow();
        open.open();

        const foreign = new SplashWindow();
        assert.doesNotThrow(() => foreign.close(0));

        assert.strictEqual(ipcHandlers.has("splash:get-version"), true);
        assert.strictEqual(open.isOpen(), true);

        open.dispose();
    });

    await test("dispose() ist idempotent und wirft bei erneutem Aufruf nicht", () => {
        const splash = new SplashWindow();
        splash.open();

        splash.dispose();
        assert.doesNotThrow(() => splash.dispose());
        assert.strictEqual(ipcHandlers.size, 0);
    });

    // ─────────────────────────────────────────────
    // Pfade und Lade-Signal
    // ─────────────────────────────────────────────

    await test("Splash-HTML und Preload werden relativ zum App-Verzeichnis aufgelöst", () => {
        const splash = new SplashWindow();
        splash.open();

        const call = splash._window.loadFileCalls[0];
        const preload = splash._window.options.webPreferences.preload;

        assert.strictEqual(call.file, path.join(appRoot, "renderer", "splash.html"));
        assert.ok(path.isAbsolute(call.file), "Splash-Pfad ist nicht absolut");
        assert.ok(fs.existsSync(call.file), "splash.html existiert nicht");

        assert.strictEqual(preload, path.join(appRoot, "electron", "preload-splash.js"));
        assert.ok(fs.existsSync(preload), "preload-splash.js existiert nicht");

        assert.strictEqual(splash._window.options.webPreferences.contextIsolation, true);
        assert.strictEqual(splash._window.options.webPreferences.nodeIntegration, false);

        splash.dispose();
    });

    await test("whenLoaded() löst nach did-finish-load mit true auf", async () => {
        holdNextLoad = true;

        const splash = new SplashWindow();
        splash.open();

        const ready = splash.whenLoaded(500);
        splash._window.finishLoad();

        assert.strictEqual(await ready, true);
        assert.strictEqual(splash.whenLoaded(0) instanceof Promise, true);
        assert.strictEqual(await splash.whenLoaded(0), true);

        splash.dispose();
        if (heldLoads.length) heldLoads.shift()(undefined);
    });

    await test("whenLoaded() meldet einen echten Ladefehler als false", async () => {
        failNextLoad = true;

        const splash = new SplashWindow();
        splash.open();

        assert.strictEqual(await splash.whenLoaded(500), false);
        assert.strictEqual(splash.isOpen(), false);
        assert.strictEqual(ipcHandlers.size, 0);

        failNextLoad = false;
    });

    await test("whenLoaded() blockiert höchstens bis zum Timeout", async () => {
        holdNextLoad = true;

        const splash = new SplashWindow();
        splash.open();

        const started = Date.now();
        assert.strictEqual(await splash.whenLoaded(30), false);
        assert.ok(Date.now() - started < 500, "Timeout wurde nicht eingehalten");
        assert.strictEqual(splash.isOpen(), true, "Splash darf beim Timeout offen bleiben");

        splash.dispose();
        if (heldLoads.length) heldLoads.shift()(undefined);
    });

    await test("Abbruch durch eigenes Schließen gilt nicht als Ladefehler", async () => {
        holdNextLoadReject = true;

        const splash = new SplashWindow();
        splash.open();

        const win = splash._window;

        splash.close(0);
        await tick();

        assert.strictEqual(splash._pendingClose, true, "Close wurde nicht aufgeschoben");
        assert.strictEqual(win.closed, false, "Fenster wurde mitten im Laden geschlossen");

        // Electron meldet den Abbruch je nach Version als did-fail-load …
        win.failLoad(-2, "ERR_FAILED", true);
        await tick();

        assert.strictEqual(splash._loadFailed, false, "did-fail-load beim Schließen wurde als Ladefehler gewertet");

        // … und/oder als abgelehnte loadFile-Promise.
        heldRejections.shift()(new Error("ERR_FAILED (-2) loading 'file:///D:/x/renderer/splash.html'"));
        await tick();

        assert.strictEqual(splash._loadFailed, false, "Abbruch wurde als Ladefehler gewertet");
        assert.strictEqual(ipcHandlers.size, SPLASH_CHANNELS.length, "Handler wurden faelschlich entfernt");

        win.finishLoad();
        assert.strictEqual(win.closed, true, "Aufgeschobenes Schließen erfolgte nicht");
        assert.strictEqual(ipcHandlers.size, 0);
    });

    await test("close() während des Ladens schließt erst nach did-finish-load", async () => {
        holdNextLoad = true;

        const splash = new SplashWindow();
        splash.open();

        const win = splash._window;

        splash.close(0);
        await tick();

        assert.strictEqual(win.closed, false);

        win.finishLoad();

        assert.strictEqual(win.closed, true);
        assert.strictEqual(ipcHandlers.size, 0);

        if (heldLoads.length) heldLoads.shift()(undefined);
    });

    await test("close() während des Ladens schließt spätestens nach dem Aufschub", async () => {
        holdNextLoad = true;

        const splash = new SplashWindow();
        splash.open();

        const win = splash._window;

        splash.close(0);
        await new Promise((resolve) => setTimeout(resolve, 1100));

        assert.strictEqual(win.closed, true, "Splash blieb trotz Aufschub offen");
        assert.strictEqual(ipcHandlers.size, 0);

        if (heldLoads.length) heldLoads.shift()(undefined);
    });

    await test("Release-Paketierung enthält Splash-HTML und Preload", () => {
        const builderConfig = fs.readFileSync(path.join(appRoot, "electron-builder.yml"), "utf8");

        assert.ok(builderConfig.includes("electron/**/*"), "electron/ wird nicht paketiert");
        assert.ok(builderConfig.includes("renderer/**/*"), "renderer/ wird nicht paketiert");
        assert.ok(fs.existsSync(path.join(appRoot, "electron", "preload-splash.js")));
        assert.ok(fs.existsSync(path.join(appRoot, "renderer", "splash.html")));
        // asar ist aktiv: app.getAppPath() zeigt dann auf app.asar, die
        // relativen Pfade innerhalb des Archivs bleiben identisch.
        assert.ok(/^asar:\s*true/m.test(builderConfig), "asar-Status unerwartet");
    });

    // ─────────────────────────────────────────────
    // Diagnose bei abgebrochenem Start
    // ─────────────────────────────────────────────

    await test("BootFailureReport schreibt bereinigten Bericht mit Logpfad", () => {
        const result = BootFailureReport.create(new Error("token=geheim"), "plugins-init");

        assert.strictEqual(result.failedStep, "plugins-init");
        assert.strictEqual(result.logDirectory, path.join(userDataRoot, "logs"));
        assert.strictEqual(result.logFilePath, path.join(userDataRoot, "logs", "latest.log"));
        assert.ok(fs.existsSync(result.logDirectory), "Logordner wurde nicht angelegt");
        assert.ok(result.reportPath, "Berichtpfad fehlt");
        assert.ok(fs.existsSync(result.reportPath), "Bericht wurde nicht geschrieben");

        const written = fs.readFileSync(result.reportPath, "utf8");
        const parsed = JSON.parse(written);

        assert.strictEqual(parsed.type, "boot-failure");
        assert.strictEqual(parsed.failedStep, "plugins-init");
        assert.strictEqual(parsed.application.version, "1.0.7-beta.3");
        assert.strictEqual(parsed.paths.logs, path.join(userDataRoot, "logs"));
        assert.strictEqual(parsed.error.message, "token=[REDACTED]");
        assert.ok(written.indexOf("geheim") === -1, "Token wurde nicht bereinigt");
    });

    await test("splash:get-diagnostics liefert Bericht- und Logpfad", () => {
        const failure = BootFailureReport.create(new Error("Start kaputt"), "window-created");

        const splash = new SplashWindow();
        splash.open();

        const info = invoke("splash:get-diagnostics", splash._window);

        assert.strictEqual(info.reportPath, failure.reportPath);
        assert.strictEqual(info.logFilePath, path.join(userDataRoot, "logs", "latest.log"));
        assert.strictEqual(info.error.message, "Start kaputt");
        assert.strictEqual(info.canContinue, false, "ohne Hauptfenster darf es kein Weiter geben");

        splash.dispose();
    });

    await test("splash:get-diagnostics meldet Weiter, wenn ein Hauptfenster existiert", () => {
        BootFailureReport.create(new Error("Start kaputt"), "plugins-init");

        const splash = new SplashWindow();
        splash.open();

        const mainWindow = new FakeBrowserWindow({});

        const info = invoke("splash:get-diagnostics", splash._window);
        assert.strictEqual(info.canContinue, true);

        mainWindow.destroy();
        splash.dispose();
    });

    await test("splash:open-log-folder öffnet den Logordner", async () => {
        const splash = new SplashWindow();
        splash.open();

        openPathResult = "";
        shellCalls.openPath.length = 0;

        const result = await invoke("splash:open-log-folder", splash._window);

        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.path, path.join(userDataRoot, "logs"));
        assert.deepStrictEqual(shellCalls.openPath, [path.join(userDataRoot, "logs")]);

        splash.dispose();
    });

    await test("splash:open-log-folder meldet Fehler des Dateimanagers", async () => {
        const splash = new SplashWindow();
        splash.open();

        openPathResult = "Zugriff verweigert";

        const result = await invoke("splash:open-log-folder", splash._window);

        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.error, "Zugriff verweigert");

        openPathResult = "";
        splash.dispose();
    });

    await test("splash:open-report zeigt die geschriebene Berichtsdatei", async () => {
        const failure = BootFailureReport.create(new Error("Start kaputt"), "ipc-init");

        const splash = new SplashWindow();
        splash.open();

        shellCalls.showItemInFolder.length = 0;

        const result = await invoke("splash:open-report", splash._window);

        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.path, failure.reportPath);
        assert.deepStrictEqual(shellCalls.showItemInFolder, [failure.reportPath]);

        splash.dispose();
    });

    await test("splash:open-report fällt ohne Bericht auf den Berichtsordner zurück", async () => {
        BootFailureReport.clear();

        const splash = new SplashWindow();
        splash.open();

        openPathResult = "";
        shellCalls.openPath.length = 0;

        const result = await invoke("splash:open-report", splash._window);

        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.path, path.join(userDataRoot, "crash"));
        assert.deepStrictEqual(shellCalls.openPath, [path.join(userDataRoot, "crash")]);

        splash.dispose();
    });

    await test("splash:quit beendet die Anwendung", () => {
        const splash = new SplashWindow();
        splash.open();

        const before = quitCalls;
        const result = invoke("splash:quit", splash._window);

        assert.deepStrictEqual(result, { ok: true });
        assert.strictEqual(quitCalls, before + 1);

        splash.dispose();
    });

    await test("splash:close schließt nur das Splash-Fenster", () => {
        const mainWindow = new FakeBrowserWindow({});

        const splash = new SplashWindow();
        splash.open();

        const win = splash._window;
        const result = invoke("splash:close", win);

        assert.deepStrictEqual(result, { ok: true });
        assert.strictEqual(win.closed, true);
        assert.strictEqual(mainWindow.isDestroyed(), false);
        assert.strictEqual(ipcHandlers.size, 0, "Handler wurden nicht aufgeräumt");

        mainWindow.destroy();
    });

    console.log("\n==========================================");
    console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen.`);
    console.log("==========================================");

    process.exit(failed > 0 ? 1 : 0);

})();
