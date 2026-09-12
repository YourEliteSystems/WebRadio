"use strict";

/**
 * RuntimeDetector Tests
 *
 * Testet die Runtime- und Packaging-Erkennung für alle Plattformen.
 */

const assert = require("assert");
const path = require("path");
const RuntimeDetector = require("../../electron/core/platform/RuntimeDetector");

// Mock-Objekte für Dependency Injection
const mockApp = {
    isPackaged: false,
    getAppPath: () => "/mock/path",
    getPath: (key) => "/mock/path"
};

const mockProcess = {
    platform: "linux",
    arch: "x64",
    execPath: "/mock/path",
    resourcesPath: "/mock/resources",
    env: {}
};

const mockFs = {
    existsSync: () => false
};

const mockPath = {
    join: path.join
};

console.log("==========================================");
console.log("RuntimeDetector Tests");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        testsPassed++;
    } catch (err) {
        console.log(`  ❌ ${name}: ${err.message}`);
        testsFailed++;
    }
}

// ─────────────────────────────────────────────────────────────
// 1. Platform Normalization
// ─────────────────────────────────────────────────────────────
console.log("\n[1] Platform Normalization");

test("normalizePlatform: win32 -> windows", () => {
    assert.strictEqual(RuntimeDetector.normalizePlatform("win32"), "windows");
});

test("normalizePlatform: linux -> linux", () => {
    assert.strictEqual(RuntimeDetector.normalizePlatform("linux"), "linux");
});

test("normalizePlatform: darwin -> macos", () => {
    assert.strictEqual(RuntimeDetector.normalizePlatform("darwin"), "macos");
});

test("normalizePlatform: unknown -> unknown", () => {
    assert.strictEqual(RuntimeDetector.normalizePlatform("freebsd"), "unknown");
});

test("normalizePlatform: null -> unknown", () => {
    assert.strictEqual(RuntimeDetector.normalizePlatform(null), "unknown");
});

// ─────────────────────────────────────────────────────────────
// 2. Architecture Normalization
// ─────────────────────────────────────────────────────────────
console.log("\n[2] Architecture Normalization");

test("normalizeArchitecture: x64 -> x64", () => {
    assert.strictEqual(RuntimeDetector.normalizeArchitecture("x64"), "x64");
});

test("normalizeArchitecture: x86_64 -> x64", () => {
    assert.strictEqual(RuntimeDetector.normalizeArchitecture("x86_64"), "x64");
});

test("normalizeArchitecture: amd64 -> x64", () => {
    assert.strictEqual(RuntimeDetector.normalizeArchitecture("amd64"), "x64");
});

test("normalizeArchitecture: arm64 -> arm64", () => {
    assert.strictEqual(RuntimeDetector.normalizeArchitecture("arm64"), "arm64");
});

test("normalizeArchitecture: aarch64 -> arm64", () => {
    assert.strictEqual(RuntimeDetector.normalizeArchitecture("aarch64"), "arm64");
});

test("normalizeArchitecture: arm -> arm", () => {
    assert.strictEqual(RuntimeDetector.normalizeArchitecture("arm"), "arm");
});

test("normalizeArchitecture: ia32 -> ia32", () => {
    assert.strictEqual(RuntimeDetector.normalizeArchitecture("ia32"), "ia32");
});

test("normalizeArchitecture: unknown -> unknown", () => {
    assert.strictEqual(RuntimeDetector.normalizeArchitecture("riscv64"), "unknown");
});

// ─────────────────────────────────────────────────────────────
// 3. Development Detection
// ─────────────────────────────────────────────────────────────
console.log("\n[3] Development Detection");

test("detectDevelopment: app.isPackaged = false -> true", () => {
    assert.strictEqual(RuntimeDetector.detectDevelopment({ isPackaged: false }), true);
});

test("detectDevelopment: app.isPackaged = true -> false", () => {
    assert.strictEqual(RuntimeDetector.detectDevelopment({ isPackaged: true }), false);
});

test("detectDevelopment: null app -> true (fallback)", () => {
    assert.strictEqual(RuntimeDetector.detectDevelopment(null), true);
});

// ─────────────────────────────────────────────────────────────
// 4. Packaged Detection
// ─────────────────────────────────────────────────────────────
console.log("\n[4] Packaged Detection");

test("detectPackaged: app.isPackaged = true -> true", () => {
    assert.strictEqual(RuntimeDetector.detectPackaged({ isPackaged: true }), true);
});

test("detectPackaged: app.isPackaged = false -> false", () => {
    assert.strictEqual(RuntimeDetector.detectPackaged({ isPackaged: false }), false);
});

test("detectPackaged: null app -> false (fallback)", () => {
    assert.strictEqual(RuntimeDetector.detectPackaged(null), false);
});

// ─────────────────────────────────────────────────────────────
// 5. AppImage Detection
// ─────────────────────────────────────────────────────────────
console.log("\n[5] AppImage Detection");

test("detectAppImage: non-Linux platform -> false", () => {
    const result = RuntimeDetector.detectAppImage(
        { isPackaged: true },
        { platform: "win32", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result, false);
});

test("detectAppImage: APPIMAGE env var set and file exists -> true", () => {
    const fsWithExists = { existsSync: () => true };
    const result = RuntimeDetector.detectAppImage(
        { isPackaged: true },
        { platform: "linux", env: { APPIMAGE: "/path/to/WebRadio.AppImage" } },
        fsWithExists,
        mockPath
    );
    assert.strictEqual(result, true);
});

test("detectAppImage: APPIMAGE env var set but file missing -> false", () => {
    const result = RuntimeDetector.detectAppImage(
        { isPackaged: true },
        { platform: "linux", env: { APPIMAGE: "/path/to/WebRadio.AppImage" } },
        mockFs,
        mockPath
    );
    assert.strictEqual(result, false);
});

test("detectAppImage: execPath contains .mount_ -> true", () => {
    const appWithMount = {
        isPackaged: true,
        getAppPath: () => "/tmp/.mount_WebRadio123/usr/bin/webradio"
    };
    const result = RuntimeDetector.detectAppImage(
        appWithMount,
        { platform: "linux", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result, true);
});

test("detectAppImage: no AppImage signals -> false", () => {
    const result = RuntimeDetector.detectAppImage(
        { isPackaged: true, getAppPath: () => "/opt/webradio" },
        { platform: "linux", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result, false);
});

// ─────────────────────────────────────────────────────────────
// 6. Linux Packaging Detection
// ─────────────────────────────────────────────────────────────
console.log("\n[6] Linux Packaging Detection");

test("detectLinuxPackaging: development -> development", () => {
    const result = RuntimeDetector.detectLinuxPackaging(
        { isPackaged: false },
        mockProcess,
        mockFs,
        mockPath
    );
    assert.strictEqual(result, "development");
});

test("detectLinuxPackaging: AppImage detected -> appimage", () => {
    const appWithMount = {
        isPackaged: true,
        getAppPath: () => "/tmp/.mount_WebRadio/usr/bin/webradio"
    };
    const result = RuntimeDetector.detectLinuxPackaging(
        appWithMount,
        { platform: "linux", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result, "appimage");
});

test("detectLinuxPackaging: /opt/webradio path -> deb", () => {
    const appWithOpt = {
        isPackaged: true,
        getAppPath: () => "/opt/webradio"
    };
    const result = RuntimeDetector.detectLinuxPackaging(
        appWithOpt,
        { platform: "linux", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result, "deb");
});

test("detectLinuxPackaging: /usr/webradio path -> deb", () => {
    const appWithUsr = {
        isPackaged: true,
        getAppPath: () => "/usr/webradio"
    };
    const result = RuntimeDetector.detectLinuxPackaging(
        appWithUsr,
        { platform: "linux", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result, "deb");
});

test("detectLinuxPackaging: unknown path -> unknown", () => {
    const result = RuntimeDetector.detectLinuxPackaging(
        { isPackaged: true, getAppPath: () => "/home/user/webradio" },
        { platform: "linux", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result, "unknown");
});

// ─────────────────────────────────────────────────────────────
// 7. Windows Packaging Detection
// ─────────────────────────────────────────────────────────────
console.log("\n[7] Windows Packaging Detection");

test("detectWindowsPackaging: development -> development", () => {
    const result = RuntimeDetector.detectWindowsPackaging(
        { isPackaged: false },
        { platform: "win32", env: {} }
    );
    assert.strictEqual(result, "development");
});

test("detectWindowsPackaging: Program Files path -> windows-installer", () => {
    const appWithProgramFiles = {
        isPackaged: true,
        getAppPath: () => "C:\\Program Files\\WebRadio\\WebRadio.exe"
    };
    const result = RuntimeDetector.detectWindowsPackaging(
        appWithProgramFiles,
        { platform: "win32", env: { ProgramFiles: "C:\\Program Files" } }
    );
    assert.strictEqual(result, "windows-installer");
});

test("detectWindowsPackaging: non-Program Files path -> windows-portable", () => {
    const appWithPortable = {
        isPackaged: true,
        getAppPath: () => "C:\\Users\\User\\Downloads\\WebRadio\\WebRadio.exe"
    };
    const result = RuntimeDetector.detectWindowsPackaging(
        appWithPortable,
        { platform: "win32", env: { ProgramFiles: "C:\\Program Files" } }
    );
    assert.strictEqual(result, "windows-portable");
});

test("detectWindowsPackaging: unknown path -> unknown", () => {
    const result = RuntimeDetector.detectWindowsPackaging(
        { isPackaged: true, getAppPath: () => "/weird/path" },
        { platform: "win32", env: {} }
    );
    assert.strictEqual(result, "unknown");
});

// ─────────────────────────────────────────────────────────────
// 8. Full Runtime Detection Matrix
// ─────────────────────────────────────────────────────────────
console.log("\n[8] Full Runtime Detection Matrix");

test("detectRuntime: Windows Development", () => {
    const result = RuntimeDetector.detectRuntime(
        { isPackaged: false },
        { platform: "win32", arch: "x64", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result.platform, "windows");
    assert.strictEqual(result.architecture, "x64");
    assert.strictEqual(result.packaging, "development");
    assert.strictEqual(result.isDevelopment, true);
    assert.strictEqual(result.isPackaged, false);
    assert.strictEqual(result.isWindows, true);
});

test("detectRuntime: Windows Installer", () => {
    const result = RuntimeDetector.detectRuntime(
        { isPackaged: true, getAppPath: () => "C:\\Program Files\\WebRadio\\WebRadio.exe" },
        { platform: "win32", arch: "x64", env: { ProgramFiles: "C:\\Program Files" } },
        mockFs,
        mockPath
    );
    assert.strictEqual(result.platform, "windows");
    assert.strictEqual(result.architecture, "x64");
    assert.strictEqual(result.packaging, "windows-installer");
    assert.strictEqual(result.isDevelopment, false);
    assert.strictEqual(result.isPackaged, true);
});

test("detectRuntime: Windows Portable", () => {
    const result = RuntimeDetector.detectRuntime(
        { isPackaged: true, getAppPath: () => "C:\\Downloads\\WebRadio\\WebRadio.exe" },
        { platform: "win32", arch: "x64", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result.platform, "windows");
    assert.strictEqual(result.architecture, "x64");
    assert.strictEqual(result.packaging, "windows-portable");
    assert.strictEqual(result.isDevelopment, false);
    assert.strictEqual(result.isPackaged, true);
});

test("detectRuntime: Linux Development", () => {
    const result = RuntimeDetector.detectRuntime(
        { isPackaged: false },
        { platform: "linux", arch: "x64", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result.platform, "linux");
    assert.strictEqual(result.architecture, "x64");
    assert.strictEqual(result.packaging, "development");
    assert.strictEqual(result.isDevelopment, true);
    assert.strictEqual(result.isLinux, true);
});

test("detectRuntime: Linux AppImage", () => {
    const appWithMount = {
        isPackaged: true,
        getAppPath: () => "/tmp/.mount_WebRadio/usr/bin/webradio"
    };
    const result = RuntimeDetector.detectRuntime(
        appWithMount,
        { platform: "linux", arch: "x64", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result.platform, "linux");
    assert.strictEqual(result.architecture, "x64");
    assert.strictEqual(result.packaging, "appimage");
    assert.strictEqual(result.isAppImage, true);
    assert.strictEqual(result.isLinux, true);
});

test("detectRuntime: Linux deb", () => {
    const result = RuntimeDetector.detectRuntime(
        { isPackaged: true, getAppPath: () => "/opt/webradio" },
        { platform: "linux", arch: "x64", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result.platform, "linux");
    assert.strictEqual(result.architecture, "x64");
    assert.strictEqual(result.packaging, "deb");
    assert.strictEqual(result.isAppImage, false);
    assert.strictEqual(result.isLinux, true);
});

test("detectRuntime: macOS Development", () => {
    const result = RuntimeDetector.detectRuntime(
        { isPackaged: false },
        { platform: "darwin", arch: "x64", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result.platform, "macos");
    assert.strictEqual(result.architecture, "x64");
    assert.strictEqual(result.packaging, "development");
    assert.strictEqual(result.isMacOS, true);
});

test("detectRuntime: macOS Production", () => {
    const result = RuntimeDetector.detectRuntime(
        { isPackaged: true },
        { platform: "darwin", arch: "arm64", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result.platform, "macos");
    assert.strictEqual(result.architecture, "arm64");
    assert.strictEqual(result.packaging, "macos");
    assert.strictEqual(result.isMacOS, true);
});

test("detectRuntime: Unknown platform", () => {
    const result = RuntimeDetector.detectRuntime(
        { isPackaged: true },
        { platform: "freebsd", arch: "x64", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result.platform, "unknown");
    assert.strictEqual(result.architecture, "x64");
    assert.strictEqual(result.packaging, "unknown");
});

// ─────────────────────────────────────────────────────────────
// 9. Edge Cases
// ─────────────────────────────────────────────────────────────
console.log("\n[9] Edge Cases");

test("detectRuntime: null app -> safe fallback", () => {
    const result = RuntimeDetector.detectRuntime(
        null,
        { platform: "linux", arch: "x64", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result.platform, "linux");
    assert.strictEqual(result.isDevelopment, true);
});

test("detectRuntime: null process -> safe fallback", () => {
    const result = RuntimeDetector.detectRuntime(
        { isPackaged: false },
        null,
        mockFs,
        mockPath
    );
    assert.strictEqual(result.platform, "unknown");
    assert.strictEqual(result.isDevelopment, true);
});

test("detectRuntime: arm64 architecture", () => {
    const result = RuntimeDetector.detectRuntime(
        { isPackaged: true },
        { platform: "linux", arch: "arm64", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result.architecture, "arm64");
});

test("detectRuntime: ia32 architecture", () => {
    const result = RuntimeDetector.detectRuntime(
        { isPackaged: true },
        { platform: "win32", arch: "ia32", env: {} },
        mockFs,
        mockPath
    );
    assert.strictEqual(result.architecture, "ia32");
});

// ─────────────────────────────────────────────────────────────
// Zusammenfassung
// ─────────────────────────────────────────────────────────────
console.log("\n==========================================");
console.log(
    `Ergebnis: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen.`
);
console.log("==========================================");

if (testsFailed > 0) {
    process.exit(1);
}
