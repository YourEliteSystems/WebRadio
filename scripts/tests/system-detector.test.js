"use strict";

/**
 * system-detector.test.js
 *
 * Unit-Tests für den SystemDetector.
 *
 * Hinweis: Diese Tests sind simulierte Plattformtests. Sie prüfen die
 * Erkennungslogik für Windows, Linux und macOS, ersetzen aber keine
 * echten Plattformintegrationstests.
 */

const assert = require("assert");
const SystemDetector = require("../../electron/core/platform/SystemDetector");

const TRUST = SystemDetector.TRUST;

console.log("==========================================");
console.log("SystemDetector Tests");
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
 * Baut ein injizierbares Dateisystem mit einer os-release-Datei.
 */
function fsWithOsRelease(text, pathName = "/etc/os-release") {
    const files = { [pathName]: text };
    return {
        existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p),
        readFileSync: (p) => {
            if (!Object.prototype.hasOwnProperty.call(files, p)) {
                throw new Error(`ENOENT: ${p}`);
            }
            return files[p];
        }
    };
}

function osStub({ arch = "x64", release = "6.8.0-test" } = {}) {
    return {
        arch: () => arch,
        release: () => release
    };
}

const ARCH_RELEASE = [
    "NAME=\"Arch Linux\"",
    "ID=arch",
    "ID_LIKE=archlinux",
    "PRETTY_NAME=\"Arch Linux\"",
    "VERSION_ID=rolling"
].join("\n");

const CACHY_RELEASE = [
    "NAME=\"CachyOS Linux\"",
    "ID=cachyos",
    "ID_LIKE=arch",
    "VERSION_ID=rolling"
].join("\n");

const UBUNTU_RELEASE = [
    "NAME=\"Ubuntu\"",
    "ID=ubuntu",
    "ID_LIKE=debian",
    "VERSION_ID=\"24.04\"",
    "PRETTY_NAME=\"Ubuntu 24.04 LTS\""
].join("\n");

const MINT_RELEASE = [
    "NAME=\"Linux Mint\"",
    "ID=linuxmint",
    "ID_LIKE=\"ubuntu debian\"",
    "VERSION_ID=\"22\""
].join("\n");

const FEDORA_RELEASE = [
    "NAME=\"Fedora Linux\"",
    "ID=fedora",
    "VERSION_ID=41"
].join("\n");

const TUMBLEWEED_RELEASE = [
    "NAME=\"openSUSE Tumbleweed\"",
    "ID=\"opensuse-tumbleweed\"",
    "ID_LIKE=\"opensuse suse\"",
    "VERSION_ID=\"20260101\""
].join("\n");

// ─────────────────────────────────────────────────────────────
console.log("\n[1] os-release Parsing");

test("liest Schlüssel/Wert-Paare ohne Anführungszeichen", () => {
    const parsed = SystemDetector.parseOsRelease(UBUNTU_RELEASE);
    assert.strictEqual(parsed.ID, "ubuntu");
    assert.strictEqual(parsed.NAME, "Ubuntu");
    assert.strictEqual(parsed.VERSION_ID, "24.04");
});

test("ignoriert Kommentare und Leerzeilen", () => {
    const parsed = SystemDetector.parseOsRelease("# Kommentar\n\nID=debian\n");
    assert.deepStrictEqual(parsed, { ID: "debian" });
});

test("leerer/ungültiger Inhalt liefert null", () => {
    assert.strictEqual(SystemDetector.parseOsRelease(""), null);
    assert.strictEqual(SystemDetector.parseOsRelease(null), null);
    assert.strictEqual(SystemDetector.parseOsRelease("# nur Kommentar"), null);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[2] Distributionsfamilien");

test("Arch Linux -> arch/pacman", () => {
    const distro = SystemDetector.resolveDistribution(SystemDetector.parseOsRelease(ARCH_RELEASE));
    assert.strictEqual(distro.family, "arch");
    assert.strictEqual(distro.packageManager, "pacman");
    assert.strictEqual(distro.status, TRUST.VERIFIED);
});

test("CachyOS -> arch/pacman (über ID_LIKE)", () => {
    const distro = SystemDetector.resolveDistribution(SystemDetector.parseOsRelease(CACHY_RELEASE));
    assert.strictEqual(distro.family, "arch");
    assert.strictEqual(distro.packageManager, "pacman");
});

test("Debian -> debian/apt", () => {
    const distro = SystemDetector.resolveDistribution(
        SystemDetector.parseOsRelease("ID=debian\nVERSION_ID=\"12\"\n")
    );
    assert.strictEqual(distro.family, "debian");
    assert.strictEqual(distro.packageManager, "apt");
});

test("Ubuntu -> debian/apt", () => {
    const distro = SystemDetector.resolveDistribution(SystemDetector.parseOsRelease(UBUNTU_RELEASE));
    assert.strictEqual(distro.family, "debian");
    assert.strictEqual(distro.packageManager, "apt");
    assert.strictEqual(distro.versionId, "24.04");
});

test("Linux Mint -> debian/apt (über ID_LIKE)", () => {
    const distro = SystemDetector.resolveDistribution(SystemDetector.parseOsRelease(MINT_RELEASE));
    assert.strictEqual(distro.family, "debian");
    assert.strictEqual(distro.packageManager, "apt");
});

test("Fedora -> fedora/dnf", () => {
    const distro = SystemDetector.resolveDistribution(SystemDetector.parseOsRelease(FEDORA_RELEASE));
    assert.strictEqual(distro.family, "fedora");
    assert.strictEqual(distro.packageManager, "dnf");
});

test("openSUSE Tumbleweed -> suse/zypper", () => {
    const distro = SystemDetector.resolveDistribution(SystemDetector.parseOsRelease(TUMBLEWEED_RELEASE));
    assert.strictEqual(distro.family, "suse");
    assert.strictEqual(distro.packageManager, "zypper");
});

test("unbekannte Distribution fällt auf generische Linux-Funktionen zurück", () => {
    const distro = SystemDetector.resolveDistribution(
        SystemDetector.parseOsRelease("NAME=\"Arch Linux\"\nID=someunknown\nVERSION_ID=1\n")
    );
    assert.strictEqual(distro.family, "unknown");
    assert.strictEqual(distro.packageManager, null);
    assert.strictEqual(distro.status, TRUST.UNKNOWN);
});

test("Name allein begründet KEINE Kompatibilität", () => {
    const distro = SystemDetector.resolveDistribution(
        SystemDetector.parseOsRelease("NAME=\"Ubuntu\"\nID=mycustom-distro\n")
    );
    assert.strictEqual(distro.family, "unknown");
    assert.strictEqual(distro.packageManager, null);
});

test("NixOS wird als UNSUPPORTED markiert", () => {
    const distro = SystemDetector.resolveDistribution(
        SystemDetector.parseOsRelease("NAME=\"NixOS\"\nID=nixos\n")
    );
    assert.strictEqual(distro.immutable, true);
    assert.strictEqual(distro.status, TRUST.UNSUPPORTED);
});

test("ohne os-release ist die Distribution UNKNOWN", () => {
    const distro = SystemDetector.resolveDistribution(null);
    assert.strictEqual(distro.family, "unknown");
    assert.strictEqual(distro.status, TRUST.UNKNOWN);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[3] Linux-Erkennung (simuliert)");

test("detect(): Linux mit Arch-Distribution", () => {
    const info = SystemDetector.detect({
        platform: "linux",
        arch: "x64",
        processObj: { platform: "linux", arch: "x64", env: {} },
        osModule: osStub(),
        fsModule: fsWithOsRelease(ARCH_RELEASE),
        packaged: true
    });

    assert.strictEqual(info.os.name, "linux");
    assert.strictEqual(info.os.version, "rolling");
    assert.strictEqual(info.os.status, TRUST.VERIFIED);
    assert.strictEqual(info.linux.distribution.id, "arch");
    assert.strictEqual(info.linux.distribution.family, "arch");
    assert.strictEqual(info.capabilities.hasPackageManager, true);
});

test("detect(): unbekannte Distribution -> UNKNOWN, keine geratenen Werte", () => {
    const info = SystemDetector.detect({
        platform: "linux",
        arch: "x64",
        processObj: { platform: "linux", arch: "x64", env: {} },
        osModule: osStub(),
        fsModule: fsWithOsRelease("ID=unknown-distro\n"),
        packaged: true
    });

    assert.strictEqual(info.linux.distribution.family, "unknown");
    assert.strictEqual(info.linux.distribution.packageManager, null);
    assert.strictEqual(info.capabilities.hasPackageManager, false);
});

test("injiziertes fs ohne readFileSync liest NICHT das echte System", () => {
    const info = SystemDetector.detect({
        platform: "linux",
        arch: "x64",
        processObj: { platform: "linux", arch: "x64", env: {} },
        osModule: osStub(),
        fsModule: { existsSync: () => false },
        packaged: true
    });

    assert.strictEqual(info.linux.distribution.id, null);
    assert.strictEqual(info.linux.osReleasePath, null);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[4] Windows und macOS (simuliert)");

test("detect(): Windows-Version stammt aus os.release()", () => {
    const info = SystemDetector.detect({
        platform: "win32",
        arch: "x64",
        processObj: { platform: "win32", arch: "x64", env: {} },
        osModule: osStub({ release: "10.0.22631" }),
        packaged: true
    });

    assert.strictEqual(info.os.name, "windows");
    assert.strictEqual(info.os.version, "10.0.22631");
    assert.strictEqual(info.os.status, TRUST.DETECTED);
    assert.strictEqual(info.linux, null);
});

test("detect(): macOS erkennt Darwin-Version und Architektur", () => {
    const info = SystemDetector.detect({
        platform: "darwin",
        arch: "arm64",
        processObj: { platform: "darwin", arch: "arm64", env: {} },
        osModule: osStub({ arch: "arm64", release: "24.1.0" }),
        packaged: true
    });

    assert.strictEqual(info.os.name, "macos");
    assert.strictEqual(info.os.version, "24.1.0");
    assert.strictEqual(info.architecture.system, "arm64");
    assert.strictEqual(info.architecture.emulated, false);
});

test("detect(): Prozessarchitektur weicht von Systemarchitektur ab -> emulated", () => {
    const info = SystemDetector.detect({
        platform: "darwin",
        arch: "x64",
        processObj: { platform: "darwin", arch: "x64", env: {} },
        osModule: osStub({ arch: "arm64" }),
        packaged: true
    });

    assert.strictEqual(info.architecture.system, "arm64");
    assert.strictEqual(info.architecture.process, "x64");
    assert.strictEqual(info.architecture.emulated, true);
});

test("detect(): unbekannte Plattform liefert UNKNOWN", () => {
    const info = SystemDetector.detect({
        platform: "freebsd",
        arch: "x64",
        processObj: { platform: "freebsd", arch: "x64", env: {} },
        osModule: osStub(),
        packaged: true
    });

    assert.strictEqual(info.os.name, "unknown");
    assert.strictEqual(info.status, TRUST.UNKNOWN);
});

test("detect(): Laufzeitumgebung wird aus process.versions erkannt", () => {
    const info = SystemDetector.detect({
        platform: "linux",
        arch: "x64",
        processObj: { platform: "linux", arch: "x64", env: {} },
        osModule: osStub(),
        fsModule: fsWithOsRelease(ARCH_RELEASE),
        versions: { electron: "44.4.1", node: "26.0.0", chrome: "140.0.0.0" },
        packaged: true
    });

    assert.strictEqual(info.runtime.runtime, "electron");
    assert.strictEqual(info.runtime.electron, "44.4.1");
});

test("detect(): Entwicklungsmodus wird aus isPackaged abgeleitet", () => {
    const info = SystemDetector.detect({
        platform: "linux",
        arch: "x64",
        processObj: { platform: "linux", arch: "x64", env: {} },
        osModule: osStub(),
        fsModule: fsWithOsRelease(ARCH_RELEASE),
        app: { isPackaged: false }
    });

    assert.strictEqual(info.capabilities.isDevelopment, true);
    assert.strictEqual(info.capabilities.isPackaged, false);
});

console.log("\n==========================================");
console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen.`);
console.log("==========================================");

if (failed > 0) {
    process.exit(1);
}
