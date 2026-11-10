"use strict";

/**
 * installation-detector.test.js
 *
 * Unit-Tests für den InstallationDetector.
 *
 * Alle Fälle laufen gegen simulierte Dateisysteme. Das sind KEINE
 * echten Plattformintegrationstests, sondern Logiktests.
 */

const assert = require("assert");
const path = require("path");

const InstallationDetector = require("../../electron/core/platform/InstallationDetector");

const { KINDS, SOURCES, TRUST } = InstallationDetector;

console.log("==========================================");
console.log("InstallationDetector Tests");
console.log("==========================================");

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ ${name}: ${err.message}`);
        failed++;
    }
}

/**
 * Minimales injizierbares Dateisystem.
 */
function createFs({ files = {}, dirs = [], writable = [], readdir = {} } = {}) {
    const fileMap = new Map(Object.entries(files));
    const dirSet = new Set(dirs);
    const writableSet = new Set(writable);

    return {
        constants: { W_OK: 2, X_OK: 1 },
        existsSync: (p) => fileMap.has(p) || dirSet.has(p),
        readFileSync: (p) => {
            if (!fileMap.has(p)) throw new Error(`ENOENT: ${p}`);
            return fileMap.get(p);
        },
        statSync: (p) => {
            if (!fileMap.has(p) && !dirSet.has(p)) throw new Error(`ENOENT: ${p}`);
            const value = fileMap.has(p) ? fileMap.get(p) : "";
            return {
                size: Buffer.byteLength(value),
                mode: 0o755,
                isFile: () => fileMap.has(p),
                isSymbolicLink: () => false
            };
        },
        lstatSync: (p) => {
            if (!fileMap.has(p) && !dirSet.has(p)) throw new Error(`ENOENT: ${p}`);
            return { isSymbolicLink: () => false, mode: 0o755 };
        },
        accessSync: (p) => {
            if (writableSet.has(p)) return;
            throw new Error(`EACCES: ${p}`);
        },
        readdirSync: (p) => readdir[p] || [],
        realpathSync: (p) => p
    };
}

const winPath = { dirname: path.win32.dirname, join: path.win32.join };
const posixPath = { dirname: path.posix.dirname, join: path.posix.join };

function linuxSystem({ id = "arch", family = "arch", packageManager = "pacman", isDevelopment = false } = {}) {
    return {
        status: TRUST.VERIFIED,
        os: { name: "linux", version: "6.8.0", status: TRUST.VERIFIED },
        architecture: { system: "x64", process: "x64", emulated: false, status: TRUST.DETECTED },
        runtime: { runtime: "electron", electron: "44.4.1", node: "26.0.0", status: TRUST.DETECTED },
        linux: {
            distribution: {
                id,
                name: id,
                versionId: "1",
                family,
                packageManager,
                immutable: false,
                status: family === "unknown" ? TRUST.UNKNOWN : TRUST.VERIFIED
            }
        },
        capabilities: { isPackaged: !isDevelopment, isDevelopment, hasPackageManager: !!packageManager, immutableSystem: false }
    };
}

function windowsSystem() {
    return {
        status: TRUST.DETECTED,
        os: { name: "windows", version: "10.0.22631", status: TRUST.DETECTED },
        architecture: { system: "x64", process: "x64", emulated: false, status: TRUST.DETECTED },
        runtime: { runtime: "electron", electron: "44.4.1", node: "26.0.0", status: TRUST.DETECTED },
        linux: null,
        capabilities: { isPackaged: true, isDevelopment: false }
    };
}

function macosSystem() {
    return {
        status: TRUST.DETECTED,
        os: { name: "macos", version: "24.1.0", status: TRUST.DETECTED },
        architecture: { system: "arm64", process: "arm64", emulated: false, status: TRUST.DETECTED },
        runtime: { runtime: "electron", electron: "44.4.1", node: "26.0.0", status: TRUST.DETECTED },
        linux: null,
        capabilities: { isPackaged: true, isDevelopment: false }
    };
}

function appStub({ exe, appPath, userData = "/home/u/.config/WebRadio", temp = "/tmp" }) {
    return {
        isPackaged: true,
        getPath: (key) => {
            if (key === "exe") return exe;
            if (key === "userData") return userData;
            if (key === "temp") return temp;
            return null;
        },
        getAppPath: () => appPath || exe
    };
}

// ─────────────────────────────────────────────────────────────
console.log("\n[1] Windows");

test("NSIS/EXE-Installation unter Program Files", () => {
    const exe = "C:\\Program Files\\WebRadio\\WebRadio.exe";
    const info = InstallationDetector.detect({
        system: windowsSystem(),
        app: appStub({ exe, appPath: "C:\\Program Files\\WebRadio" }),
        processObj: { platform: "win32", arch: "x64", execPath: exe, env: { ProgramFiles: "C:\\Program Files" } },
        pathModule: winPath,
        fsModule: createFs({ dirs: ["C:\\Program Files\\WebRadio"] })
    });

    assert.strictEqual(info.kind, KINDS.WINDOWS_EXE);
    assert.strictEqual(info.format, "nsis");
    assert.strictEqual(info.source, SOURCES.INSTALLER);
    assert.strictEqual(info.status, TRUST.DETECTED);
    assert.strictEqual(info.permissions.installDirectoryWritable, false);
    assert.strictEqual(info.permissions.elevationRequired, true);
});

test("Portable über PORTABLE_EXECUTABLE_DIR", () => {
    const exe = "D:\\Tools\\WebRadio\\WebRadio.exe";
    const info = InstallationDetector.detect({
        system: windowsSystem(),
        app: appStub({ exe, appPath: "D:\\Tools\\WebRadio", userData: "D:\\Tools\\WebRadio\\data" }),
        processObj: {
            platform: "win32",
            arch: "x64",
            execPath: exe,
            env: { PORTABLE_EXECUTABLE_DIR: "D:\\Tools\\WebRadio" }
        },
        pathModule: winPath,
        fsModule: createFs({ dirs: ["D:\\Tools\\WebRadio"], writable: ["D:\\Tools\\WebRadio"] })
    });

    assert.strictEqual(info.kind, KINDS.WINDOWS_PORTABLE);
    assert.strictEqual(info.source, SOURCES.PORTABLE);
    assert.strictEqual(info.status, TRUST.VERIFIED);
    assert.strictEqual(info.permissions.elevationRequired, false);
});

test("MSI-Installation über WEBRADIO_INSTALLER", () => {
    const exe = "C:\\Program Files\\WebRadio\\WebRadio.exe";
    const info = InstallationDetector.detect({
        system: windowsSystem(),
        app: appStub({ exe, appPath: "C:\\Program Files\\WebRadio" }),
        processObj: {
            platform: "win32",
            arch: "x64",
            execPath: exe,
            env: { ProgramFiles: "C:\\Program Files", WEBRADIO_INSTALLER: "msi" }
        },
        pathModule: winPath,
        fsModule: createFs({ dirs: ["C:\\Program Files\\WebRadio"] })
    });

    assert.strictEqual(info.kind, KINDS.WINDOWS_MSI);
    assert.strictEqual(info.format, "msi");
    assert.strictEqual(info.source, SOURCES.INSTALLER);
    assert.strictEqual(info.status, TRUST.VERIFIED);
});

test("ungültiger Windows-Pfad -> UNKNOWN (keine Vermutung)", () => {
    const info = InstallationDetector.detect({
        system: windowsSystem(),
        app: appStub({ exe: "/weird/path", appPath: "/weird/path" }),
        processObj: { platform: "win32", arch: "x64", execPath: "/weird/path", env: {} },
        pathModule: winPath,
        fsModule: createFs({})
    });

    assert.strictEqual(info.kind, KINDS.UNKNOWN);
    assert.strictEqual(info.source, SOURCES.UNKNOWN);
    assert.strictEqual(info.status, TRUST.UNKNOWN);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[2] Linux: AppImage, Portable, unbekannt");

test("AppImage über APPIMAGE-Variable", () => {
    const appImage = "/home/u/Applications/WebRadio-1.0.7.AppImage";
    const info = InstallationDetector.detect({
        system: linuxSystem(),
        app: appStub({ exe: "/tmp/.mount_WebRadio123/webradio", appPath: "/tmp/.mount_WebRadio123/resources/app.asar" }),
        processObj: {
            platform: "linux",
            arch: "x64",
            execPath: "/tmp/.mount_WebRadio123/webradio",
            env: { APPIMAGE: appImage }
        },
        pathModule: posixPath,
        fsModule: createFs({ files: { [appImage]: "elf" }, dirs: ["/home/u/Applications"] })
    });

    assert.strictEqual(info.kind, KINDS.LINUX_APPIMAGE);
    assert.strictEqual(info.format, "appimage");
    assert.strictEqual(info.source, SOURCES.APPIMAGE);
    assert.strictEqual(info.status, TRUST.VERIFIED);
    assert.strictEqual(info.paths.installPath, "/home/u/Applications");
    assert.notStrictEqual(info.paths.installPath, info.paths.userDataPath);
});

test("Portable Installation im Benutzerverzeichnis", () => {
    const exe = "/home/u/WebRadio/webradio";
    const info = InstallationDetector.detect({
        system: linuxSystem(),
        app: appStub({ exe, appPath: "/home/u/WebRadio/resources/app.asar" }),
        processObj: { platform: "linux", arch: "x64", execPath: exe, env: {} },
        pathModule: posixPath,
        fsModule: createFs({
            dirs: ["/home/u/WebRadio", "/home/u/WebRadio/resources"],
            writable: ["/home/u/WebRadio"]
        })
    });

    assert.strictEqual(info.kind, KINDS.LINUX_PORTABLE);
    assert.strictEqual(info.source, SOURCES.PORTABLE);
    assert.strictEqual(info.permissions.installDirectoryWritable, true);
    assert.strictEqual(info.systemManaged, false);
});

test("Systempfad ohne erkennbare Familie -> UNKNOWN", () => {
    const exe = "/opt/webradio/webradio";
    const info = InstallationDetector.detect({
        system: linuxSystem({ id: "custom", family: "unknown", packageManager: null }),
        app: appStub({ exe, appPath: "/opt/webradio/resources/app.asar" }),
        processObj: { platform: "linux", arch: "x64", execPath: exe, env: {} },
        pathModule: posixPath,
        fsModule: createFs({ dirs: ["/opt/webradio"] })
    });

    assert.strictEqual(info.kind, KINDS.UNKNOWN);
    assert.strictEqual(info.status, TRUST.UNKNOWN);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[3] Linux: Paketmanager-Installationen");

test("DEB über dpkg-Status verifiziert", () => {
    const exe = "/opt/webradio/webradio";
    const info = InstallationDetector.detect({
        system: linuxSystem({ id: "ubuntu", family: "debian", packageManager: "apt" }),
        app: appStub({ exe, appPath: "/opt/webradio/resources/app.asar" }),
        processObj: { platform: "linux", arch: "x64", execPath: exe, env: {} },
        pathModule: posixPath,
        fsModule: createFs({
            dirs: ["/opt/webradio"],
            files: { "/var/lib/dpkg/status": "Package: webradio\nStatus: install ok installed\n" }
        })
    });

    assert.strictEqual(info.kind, KINDS.LINUX_DEB);
    assert.strictEqual(info.source, SOURCES.PACKAGE_MANAGER);
    assert.strictEqual(info.status, TRUST.VERIFIED);
    assert.strictEqual(info.systemManaged, true);
    assert.strictEqual(info.permissions.elevationRequired, true);
});

test("Arch-Paket über pacman-Datenbank verifiziert", () => {
    const exe = "/opt/webradio/webradio";
    const info = InstallationDetector.detect({
        system: linuxSystem(),
        app: appStub({ exe, appPath: "/opt/webradio/resources/app.asar" }),
        processObj: { platform: "linux", arch: "x64", execPath: exe, env: {} },
        pathModule: posixPath,
        fsModule: createFs({
            dirs: ["/opt/webradio"],
            readdir: { "/var/lib/pacman/local": ["webradio-1.0.7-1"] }
        })
    });

    assert.strictEqual(info.kind, KINDS.LINUX_ARCH);
    assert.strictEqual(info.source, SOURCES.PACKAGE_MANAGER);
    assert.strictEqual(info.status, TRUST.VERIFIED);
});

test("RPM über RPM-Familie", () => {
    const exe = "/usr/lib/webradio/webradio";
    const info = InstallationDetector.detect({
        system: linuxSystem({ id: "fedora", family: "fedora", packageManager: "dnf" }),
        app: appStub({ exe, appPath: "/usr/lib/webradio/resources/app.asar" }),
        processObj: { platform: "linux", arch: "x64", execPath: exe, env: {} },
        pathModule: posixPath,
        fsModule: createFs({ dirs: ["/usr/lib/webradio"] })
    });

    assert.strictEqual(info.kind, KINDS.LINUX_RPM);
    assert.strictEqual(info.source, SOURCES.PACKAGE_MANAGER);
    assert.strictEqual(info.systemManaged, true);
});

test("unbekannte Familie fällt auf Paketmanager-Signale zurück (pacman)", () => {
    const exe = "/opt/webradio/webradio";
    const info = InstallationDetector.detect({
        system: linuxSystem({ id: "unknown-distro", family: "unknown", packageManager: null }),
        app: appStub({ exe, appPath: "/opt/webradio/resources/app.asar" }),
        processObj: { platform: "linux", arch: "x64", execPath: exe, env: {} },
        pathModule: posixPath,
        fsModule: createFs({
            dirs: ["/opt/webradio", "/usr/bin"],
            files: { "/usr/bin/pacman": "bin" },
            readdir: { "/var/lib/pacman/local": ["webradio-1.0.7-1"] }
        })
    });

    assert.strictEqual(info.kind, KINDS.LINUX_ARCH);
    assert.strictEqual(info.status, TRUST.VERIFIED);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[4] macOS");

test("gemountetes DMG", () => {
    const exe = "/Volumes/WebRadio/WebRadio.app/Contents/MacOS/WebRadio";
    const info = InstallationDetector.detect({
        system: macosSystem(),
        app: appStub({ exe, userData: "/Users/u/Library/Application Support/WebRadio" }),
        processObj: { platform: "darwin", arch: "arm64", execPath: exe, env: {} },
        pathModule: posixPath,
        fsModule: createFs({})
    });

    assert.strictEqual(info.kind, KINDS.MACOS_DMG);
    assert.strictEqual(info.source, SOURCES.INSTALLER);
    assert.strictEqual(info.status, TRUST.VERIFIED);
    assert.strictEqual(info.paths.installPath, "/Volumes/WebRadio/WebRadio.app");
});

test("PKG über Receipt verifiziert", () => {
    const exe = "/Applications/WebRadio.app/Contents/MacOS/WebRadio";
    const info = InstallationDetector.detect({
        system: macosSystem(),
        app: appStub({ exe }),
        processObj: { platform: "darwin", arch: "arm64", execPath: exe, env: {} },
        pathModule: posixPath,
        fsModule: createFs({ readdir: { "/var/db/receipts": ["de.yourelitesystems.webradio.bom"] } })
    });

    assert.strictEqual(info.kind, KINDS.MACOS_PKG);
    assert.strictEqual(info.status, TRUST.VERIFIED);
});

test("/Applications ohne Receipt: Quelle bleibt UNKNOWN (keine Vermutung)", () => {
    const exe = "/Applications/WebRadio.app/Contents/MacOS/WebRadio";
    const info = InstallationDetector.detect({
        system: macosSystem(),
        app: appStub({ exe }),
        processObj: { platform: "darwin", arch: "arm64", execPath: exe, env: {} },
        pathModule: posixPath,
        fsModule: createFs({})
    });

    assert.strictEqual(info.kind, KINDS.MACOS_DMG);
    assert.strictEqual(info.status, TRUST.DETECTED);
    assert.strictEqual(info.source, SOURCES.UNKNOWN);
    assert.strictEqual(info.sourceStatus, TRUST.UNKNOWN);
});

test("ZIP/Portable außerhalb von /Applications", () => {
    const exe = "/Users/u/Apps/WebRadio.app/Contents/MacOS/WebRadio";
    const info = InstallationDetector.detect({
        system: macosSystem(),
        app: appStub({ exe }),
        processObj: { platform: "darwin", arch: "arm64", execPath: exe, env: {} },
        pathModule: posixPath,
        fsModule: createFs({})
    });

    assert.strictEqual(info.kind, KINDS.MACOS_ZIP);
    assert.strictEqual(info.source, SOURCES.PORTABLE);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[5] Pfade, Berechtigungen und Marker");

test("Installations-, Ausführungs- und Datenpfad sind getrennt", () => {
    const exe = "/home/u/WebRadio/webradio";
    const info = InstallationDetector.detect({
        system: linuxSystem(),
        app: appStub({ exe, appPath: "/home/u/WebRadio/resources/app.asar", userData: "/home/u/.config/WebRadio" }),
        processObj: { platform: "linux", arch: "x64", execPath: exe, env: {} },
        pathModule: posixPath,
        fsModule: createFs({ dirs: ["/home/u/WebRadio"], writable: ["/home/u/WebRadio"] })
    });

    assert.strictEqual(info.paths.installPath, "/home/u/WebRadio");
    assert.strictEqual(info.paths.executionPath, exe);
    assert.strictEqual(info.paths.userDataPath, "/home/u/.config/WebRadio");
    assert.strictEqual(info.paths.updatePath, "/home/u/.config/WebRadio/updates");
    assert.strictEqual(info.paths.backupPath, "/home/u/.config/WebRadio/updates/backups");
});

test("Entwicklungsmodus wird erkannt", () => {
    const info = InstallationDetector.detect({
        system: linuxSystem({ isDevelopment: true }),
        app: { isPackaged: false, getAppPath: () => "/project", getPath: () => "/project" },
        processObj: { platform: "linux", arch: "x64", execPath: "/usr/bin/node", env: {} },
        pathModule: posixPath,
        fsModule: createFs({})
    });

    assert.strictEqual(info.kind, KINDS.DEVELOPMENT);
    assert.strictEqual(info.format, "development");
});

test("Marker-Datei deklariert Installationsart explizit", () => {
    const exe = "/home/u/WebRadio/webradio";
    const markerPath = "/home/u/WebRadio/resources/install-source.json";
    const info = InstallationDetector.detect({
        system: linuxSystem(),
        app: appStub({ exe, appPath: "/home/u/WebRadio/resources/app.asar" }),
        processObj: { platform: "linux", arch: "x64", execPath: exe, env: {} },
        pathModule: posixPath,
        fsModule: createFs({
            dirs: ["/home/u/WebRadio"],
            files: { [markerPath]: JSON.stringify({ kind: "linux-portable", source: "portable" }) }
        })
    });

    assert.strictEqual(info.kind, KINDS.LINUX_PORTABLE);
    assert.strictEqual(info.status, TRUST.VERIFIED);
});

test("ungültiger Marker wird ignoriert", () => {
    const exe = "/home/u/WebRadio/webradio";
    const markerPath = "/home/u/WebRadio/resources/install-source.json";
    const info = InstallationDetector.detect({
        system: linuxSystem(),
        app: appStub({ exe, appPath: "/home/u/WebRadio/resources/app.asar" }),
        processObj: { platform: "linux", arch: "x64", execPath: exe, env: {} },
        pathModule: posixPath,
        fsModule: createFs({
            dirs: ["/home/u/WebRadio", "/home/u/WebRadio/resources"],
            files: { [markerPath]: JSON.stringify({ kind: "nonsense", source: "magic" }) },
            writable: ["/home/u/WebRadio"]
        })
    });

    assert.strictEqual(info.kind, KINDS.LINUX_PORTABLE);
    assert.strictEqual(info.status, TRUST.DETECTED);
});

test("fehlende Schreibrechte werden erkannt, nicht angenommen", () => {
    const access = InstallationDetector.checkWriteAccess("/opt/webradio", createFs({ dirs: ["/opt/webradio"] }));
    assert.strictEqual(access.writable, false);
});

console.log("\n==========================================");
console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen.`);
console.log("==========================================");

if (failed > 0) {
    process.exit(1);
}
