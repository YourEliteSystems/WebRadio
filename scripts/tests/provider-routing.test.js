"use strict";

/**
 * provider-routing.test.js – Beta 4
 * Verifiziert das Provider-Routing (RuntimeDetector + ProviderFactory)
 * sowie das Unsupported-Gate im UpdateManager.
 */

const assert = require("assert");
const os = require("os");
const fs = require("fs");
const path = require("path");

// ─────────────────────────────────────────────────────────
// Module-Resolver stubben, damit electron + electron-updater
// im Test durch Fakes ersetzt werden (wie updater.test.js).
// ─────────────────────────────────────────────────────────
const Module = require("module");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "electron") return "electron-stub-pr";
    if (request === "electron-updater") return "electron-updater-stub-pr";
    return originalResolve.call(this, request, parent, isMain, options);
};

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "webradio-pr-test-"));
fs.mkdirSync(path.join(tmpRoot, "temp"), { recursive: true });
fs.mkdirSync(path.join(tmpRoot, "logs"), { recursive: true });

const fakeApp = {
    isPackaged: true,
    getVersion: () => "1.0.6",
    getPath: (k) => {
        if (k === "userData") return tmpRoot;
        if (k === "temp") return path.join(tmpRoot, "temp");
        return tmpRoot;
    }
};
const fakeIpcMain = { _handlers: new Map(), handle(c, fn) { this._handlers.set(c, fn); }, on() {}, removeHandler(c) { this._handlers.delete(c); } };
const fakeBrowserWindow = { _list: [], getAllWindows() { return this._list; }, _add(w) { this._list.push(w); } };
const fakeNotification = function () {};
fakeNotification.isSupported = () => false;

const fakeAutoUpdater = {
    autoDownload: false, autoInstallOnAppQuit: false,
    allowPrerelease: false, allowDowngrade: false, channel: null,
    _downloaded: false,
    on() {}, off() {},
    isUpdateDownloaded() { return this._downloaded; },
    async checkForUpdates() { return { updateInfo: null }; },
    async downloadUpdate() { this._downloaded = true; },
    quitAndInstall() {}
};

require.cache["electron-stub-pr"] = { id: "electron-stub-pr", filename: "electron-stub-pr", loaded: true,
    exports: { app: fakeApp, ipcMain: fakeIpcMain, BrowserWindow: fakeBrowserWindow, Notification: fakeNotification } };
require.cache["electron-updater-stub-pr"] = { id: "electron-updater-stub-pr", filename: "electron-updater-stub-pr", loaded: true,
    exports: { autoUpdater: fakeAutoUpdater } };

// LogManager + StorageManager initialisieren, damit FileTransport
// sauber in tmpRoot/logs schreibt (verhindert ENOENT-Fehler).
const StorageManager = require("../../electron/core/storage/StorageManager");
const LogManager = require("../../electron/core/diagnostics/logging/LogManager");
StorageManager.initialize();
LogManager.initialize();

const RuntimeDetector = require("../../electron/core/platform/RuntimeDetector");
const ProviderFactory = require("../../electron/core/updates/providers/ProviderFactory");
const WindowsUpdateProvider = require("../../electron/core/updates/providers/WindowsUpdateProvider");
const LinuxAppImageUpdateProvider = require("../../electron/core/updates/providers/LinuxAppImageUpdateProvider");
const UnsupportedUpdateProvider = require("../../electron/core/updates/providers/UnsupportedUpdateProvider");

// UpdateManager als frische Singleton-Instanz laden.
function loadUpdateManager() {
    for (const key of Object.keys(require.cache)) {
        if (key.includes(path.join("electron", "core", "updates")) && !key.includes("providers")) {
            delete require.cache[key];
        }
        if (key.includes(path.join("electron", "core", "platform"))) delete require.cache[key];
    }
    const mod = require("../../electron/core/updates");
    return mod.updateManager;
}

console.log("==========================================");
console.log("Starte Provider-Routing Tests");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); testsPassed++; }
    catch (err) { console.error(`  ❌ ${name}: ${err.message}`); testsFailed++; }
}

const RT = {
    win:   { platform: "windows", architecture: "x64", packaging: "windows-installer", isDevelopment: false, isPackaged: true,  isAppImage: false, isLinux: false, isWindows: true,  isMacOS: false },
    appImg:{ platform: "linux",   architecture: "x64", packaging: "appimage",         isDevelopment: false, isPackaged: true,  isAppImage: true,  isLinux: true,  isWindows: false, isMacOS: false },
    deb:   { platform: "linux",   architecture: "x64", packaging: "deb",              isAppImage: false },
    arch:  { platform: "linux",   architecture: "x64", packaging: "arch",             isAppImage: false },
    mac:   { platform: "macos",   architecture: "arm64", packaging: "macos",           isAppImage: false },
    unkn:  { platform: "linux",   architecture: "x64", packaging: "unknown",          isAppImage: false }
};

// [1] Windows -> WindowsUpdateProvider
console.log("\n[1] Windows Routing");
test("Windows waehlt WindowsUpdateProvider", () => {
    const p = new WindowsUpdateProvider({});
    assert.strictEqual(p.getProviderType(), "electron-updater");
    assert.strictEqual(p.isSuitableForRuntime(RT.win), true);
    assert.strictEqual(p.isSuitableForRuntime(RT.appImg), false);
});

// [2] Linux AppImage -> LinuxAppImageUpdateProvider
console.log("\n[2] Linux AppImage Routing");
test("Linux AppImage waehlt LinuxAppImageUpdateProvider", () => {
    const p = new LinuxAppImageUpdateProvider({});
    assert.strictEqual(p.getProviderType(), "appimage-github-fallback");
    assert.strictEqual(p.isSuitableForRuntime(RT.appImg), true);
    assert.strictEqual(p.isSuitableForRuntime(RT.win), false);
});
test("Factory liefert Provider zurueck", () => {
    const p = ProviderFactory.createProvider({ isPackaged: true }, {}, require("fs"), require("path"));
    assert.ok(p);
    assert.strictEqual(typeof p.getProviderType, "function");
});

// [3] Unsupported: deb/arch/macOS/unknown
console.log("\n[3] Unsupported Routing");
test("UnsupportedProvider fuer deb/arch/macOS/unknown", () => {
    for (const p of [
        new UnsupportedUpdateProvider("apt"),
        new UnsupportedUpdateProvider("pacman"),
        new UnsupportedUpdateProvider("macOS"),
        new UnsupportedUpdateProvider("unknown")
    ]) assert.strictEqual(p.getProviderType(), "unsupported");
    assert.strictEqual(new UnsupportedUpdateProvider("x").isSuitableForRuntime(RT.deb), true);
    assert.strictEqual(new UnsupportedUpdateProvider("x").isSuitableForRuntime(RT.arch), true);
    assert.strictEqual(new UnsupportedUpdateProvider("x").isSuitableForRuntime(RT.mac), true);
});
test("UnsupportedProvider.getReason", () => {
    assert.strictEqual(new UnsupportedUpdateProvider("apt").getReason(), "apt");
});

// [4] AppImage-Provider schliesst deb/arch aus
console.log("\n[4] AppImage-Provider schliesst deb/arch aus");
test("LinuxAppImageUpdateProvider NICHT fuer deb/arch/macOS/unknown", () => {
    const p = new LinuxAppImageUpdateProvider({});
    assert.strictEqual(p.isSuitableForRuntime(RT.deb), false);
    assert.strictEqual(p.isSuitableForRuntime(RT.arch), false);
    assert.strictEqual(p.isSuitableForRuntime(RT.mac), false);
    assert.strictEqual(p.isSuitableForRuntime(RT.unkn), false);
    assert.strictEqual(p.isSuitableForRuntime(RT.appImg), true);
});

// [5] RuntimeDetector Ergebnis-Struktur
console.log("\n[5] RuntimeDetector Ergebnis-Struktur");
test("detectRuntime liefert alle Felder", () => {
    const r = RuntimeDetector.detectRuntime(
        { isPackaged: true },
        { platform: "linux", arch: "x64", execPath: "/tmp/.mount_x/AppRun", env: {} },
        require("fs"), require("path")
    );
    for (const k of ["platform","architecture","packaging","isDevelopment","isPackaged","isAppImage","isLinux","isWindows","isMacOS"])
        assert.ok(k in r, `Fehlendes Feld: ${k}`);
});

// ─────────────────────────────────────────────────────────
// [6] UpdateManager-Integration: Unsupported-Gate
// Simuliert unsupported-Runtime, um das Gate ohne echte
// Linux-Laufzeit zu verifizieren.
// ─────────────────────────────────────────────────────────
console.log("\n[6] UpdateManager Unsupported-Gate (Integration)");

test("getProviderInfo liefert Objekt mit Typ und Runtime (Windows-Runtime im Test)", () => {
    const um = loadUpdateManager();
    um.initialize();
    const info = um.getProviderInfo();
    assert.ok(info, "getProviderInfo liefert Objekt");
    assert.ok(typeof info.type === "string" && info.type.length > 0, `Provider-Typ gesetzt: ${info.type}`);
    assert.ok(info.runtime, "Runtime-Info vorhanden");
    assert.ok(["electron-updater", "appimage-github-fallback", "unsupported"].includes(info.type),
        `Bekannter Provider-Typ: ${info.type}`);
    um.dispose();
});

test("Unsupported-Gate: checkForUpdates ruft electron-updater NICHT auf", async () => {
    const um = loadUpdateManager();
    um.initialize();
    um._provider = new UnsupportedUpdateProvider("Debian/Ubuntu -> apt/dpkg");
    um._runtimeInfo = RT.deb;
    assert.strictEqual(um._isUnsupported(), true, "DEB als unsupported erkannt");
    let updaterCalled = false;
    const orig = fakeAutoUpdater.checkForUpdates;
    fakeAutoUpdater.checkForUpdates = async () => { updaterCalled = true; return { updateInfo: null }; };
    const result = await um.checkForUpdates();
    fakeAutoUpdater.checkForUpdates = orig;
    assert.strictEqual(updaterCalled, false, "electron-updater darf bei unsupported nicht aufgerufen werden");
    assert.strictEqual(result.status, "unsupported", "Ergebnis ist unsupported");
    assert.ok(result.suggestion, "Vorschlag fuer Nutzer enthalten");
    um.dispose();
});

test("Download/Install bei unsupported liefern unsupported", async () => {
    const um = loadUpdateManager();
    um.initialize();
    um._provider = new UnsupportedUpdateProvider("Arch Linux -> pacman");
    um._runtimeInfo = RT.arch;
    assert.strictEqual((await um.downloadUpdate()).status, "unsupported", "Download -> unsupported");
    assert.strictEqual((await um.installUpdate()).status, "unsupported", "Install -> unsupported");
    um.dispose();
});

console.log("\n==========================================");
console.log(`Ergebnis: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen.`);
console.log("==========================================");
try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }
if (testsFailed > 0) process.exit(1);