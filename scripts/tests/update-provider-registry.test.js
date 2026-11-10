"use strict";

/**
 * update-provider-registry.test.js
 *
 * Unit-Tests für die UpdateProviderRegistry (Provider-Auswahl).
 *
 * Simulierte Plattformtests – keine echten Installationsläufe.
 */

const assert = require("assert");

const registry = require("../../electron/core/updates/UpdateProviderRegistry");

console.log("==========================================");
console.log("UpdateProviderRegistry Tests");
console.log("==========================================");

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ ${err.message}`);
        failed++;
    }
}

function system(platform, distro = null) {
    return {
        os: { name: platform, version: "1.0", status: "DETECTED" },
        architecture: { system: "x64", process: "x64", emulated: false, status: "DETECTED" },
        runtime: { runtime: "electron", status: "DETECTED" },
        linux: distro ? { distribution: distro } : null,
        capabilities: { isPackaged: true, isDevelopment: false }
    };
}

function installation(format, { writable = true, systemManaged = false, source = "installer" } = {}) {
    return {
        status: "DETECTED",
        kind: format === "nsis" ? "windows-exe" : format,
        format,
        source,
        systemManaged,
        permissionStatus: "VERIFIED",
        permissions: {
            installDirectoryWritable: writable,
            executableWritable: writable,
            elevationRequired: !writable,
            status: writable ? "VERIFIED" : "DETECTED"
        }
    };
}

const distroArch = { id: "arch", family: "arch", packageManager: "pacman", status: "VERIFIED" };
const distroDebian = { id: "ubuntu", family: "debian", packageManager: "apt", status: "VERIFIED" };

// ─────────────────────────────────────────────────────────────
console.log("\n[1] Automatische Provider");

test("Windows NSIS -> windows-nsis, automatisch", () => {
    const sel = registry.select({ system: system("windows"), installation: installation("nsis") });
    assert.strictEqual(sel.key, "windows-nsis");
    assert.strictEqual(sel.providerType, "electron-updater");
    assert.strictEqual(sel.automatic, true);
});

test("Windows Portable -> windows-portable, automatisch im Anwendungsverzeichnis", () => {
    const sel = registry.select({ system: system("windows"), installation: installation("portable") });
    assert.strictEqual(sel.key, "windows-portable");
    assert.strictEqual(sel.automatic, true);
    assert.strictEqual(sel.mechanism, "in-app-portable");
});

test("Linux AppImage -> linux-appimage, atomarer Dateiaustausch", () => {
    const sel = registry.select({ system: system("linux", distroArch), installation: installation("appimage", { source: "appimage" }) });
    assert.strictEqual(sel.key, "linux-appimage");
    assert.strictEqual(sel.automatic, true);
    assert.strictEqual(sel.mechanism, "atomic-file-replace");
});

// ─────────────────────────────────────────────────────────────
console.log("\n[2] Paketmanager: nie automatisch überschreiben");

for (const [format, expectedKey] of [["deb", "linux-deb"], ["rpm", "linux-rpm"], ["arch", "linux-arch"]]) {
    test(`${format} -> ${expectedKey}, nicht automatisch`, () => {
        const sel = registry.select({
            system: system("linux", distroDebian),
            installation: installation(format, { writable: false, systemManaged: true, source: "package-manager" })
        });
        assert.strictEqual(sel.key, expectedKey);
        assert.strictEqual(sel.automatic, false);
        assert.strictEqual(sel.providerType, "unsupported");
        assert.strictEqual(sel.mechanism, "package-manager");
        assert.ok(sel.reason && sel.reason.length > 0, "Begründung vorhanden");
        assert.ok(sel.suggestion && sel.suggestion.length > 0, "manueller Weg vorhanden");
    });
}

test("DEB-Vorschlag nennt apt", () => {
    const sel = registry.select({ system: system("linux", distroDebian), installation: installation("deb", { writable: false }) });
    assert.ok(/apt/.test(sel.suggestion));
});

test("Arch-Vorschlag nennt pacman", () => {
    const sel = registry.select({ system: system("linux", distroArch), installation: installation("arch", { writable: false }) });
    assert.ok(/pacman/.test(sel.suggestion));
});

test("RPM-Vorschlag nutzt zypper auf SUSE", () => {
    const suse = { id: "opensuse-tumbleweed", family: "suse", packageManager: "zypper", status: "VERIFIED" };
    const sel = registry.select({ system: system("linux", suse), installation: installation("rpm", { writable: false }) });
    assert.ok(/zypper/.test(sel.suggestion));
});

test("Paketmanager-Provider meldet Systemverwaltung im Grund", () => {
    const sel = registry.select({ system: system("linux", distroArch), installation: installation("arch", { writable: false }) });
    const provider = registry.createProvider(sel, {});
    assert.strictEqual(provider.getProviderType(), "unsupported");
    assert.ok(/pacman/.test(provider.getReason()));
});

// ─────────────────────────────────────────────────────────────
console.log("\n[3] Nicht automatisch: MSI, macOS, Portable-Linux, unbekannt");

test("Windows MSI -> manueller MSI-Weg", () => {
    const sel = registry.select({ system: system("windows"), installation: installation("msi", { writable: false }) });
    assert.strictEqual(sel.key, "windows-msi");
    assert.strictEqual(sel.automatic, false);
    assert.strictEqual(sel.mechanism, "manual-msi");
});

for (const format of ["dmg", "pkg", "zip"]) {
    test(`macOS ${format} -> manuell`, () => {
        const sel = registry.select({
            system: system("macos"),
            installation: installation(format, { source: format === "zip" ? "portable" : "installer" })
        });
        assert.strictEqual(sel.automatic, false);
        assert.ok(sel.key.startsWith("macos-"));
    });
}

test("Linux Portable -> kein automatisches Überschreiben", () => {
    const sel = registry.select({ system: system("linux", distroArch), installation: installation("portable", { source: "portable" }) });
    assert.strictEqual(sel.key, "linux-portable");
    assert.strictEqual(sel.automatic, false);
});

test("unbekannte Installationsart -> nie automatisch", () => {
    const sel = registry.select({ system: system("linux", distroArch), installation: installation("unknown", { source: "unknown" }) });
    assert.strictEqual(sel.key, "unsupported");
    assert.strictEqual(sel.automatic, false);
    assert.strictEqual(sel.providerType, "unsupported");
    assert.ok(sel.manualUpdate && sel.manualUpdate.url, "manueller Download-Link vorhanden");
});

test("unbekannte Plattform -> unsupported", () => {
    const sel = registry.select({ system: system("unknown"), installation: installation("nsis") });
    assert.strictEqual(sel.key, "unsupported");
    assert.strictEqual(sel.automatic, false);
});

test("Entwicklungsmodus -> kein automatisches Update", () => {
    const sel = registry.select({ system: system("linux", distroArch), installation: installation("development") });
    assert.strictEqual(sel.key, "development");
    assert.strictEqual(sel.automatic, false);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[4] Kanalunabhängigkeit");

test("Provider-Auswahl ist für stable/beta/alpha identisch", () => {
    const keys = ["stable", "beta", "alpha"].map((channel) => {
        const sel = registry.select({
            system: system("linux", distroArch),
            installation: installation("appimage", { source: "appimage" }),
            channel
        });
        assert.strictEqual(sel.channel, channel, "Kanal wird unverändert übernommen");
        assert.strictEqual(sel.channelIndependent, true);
        return sel.key;
    });

    assert.deepStrictEqual(keys, ["linux-appimage", "linux-appimage", "linux-appimage"]);
});

test("ungültiger Kanal fällt auf stable zurück, ohne die Auswahl zu ändern", () => {
    const sel = registry.select({
        system: system("windows"),
        installation: installation("nsis"),
        channel: "nightly"
    });
    assert.strictEqual(sel.channel, "stable");
    assert.strictEqual(sel.key, "windows-nsis");
});

// ─────────────────────────────────────────────────────────────
console.log("\n[5] Berechtigungen und Erstellbarkeit");

test("requiresElevation wird aus fehlenden Schreibrechten abgeleitet", () => {
    const readOnly = registry.select({
        system: system("windows"),
        installation: installation("nsis", { writable: false })
    });
    assert.strictEqual(readOnly.requiresElevation, true);

    const userWritable = registry.select({
        system: system("linux"),
        installation: installation("appimage", { writable: true, source: "appimage" })
    });
    assert.strictEqual(userWritable.requiresElevation, false);
});

test("createProvider liefert die erwarteten Provider-Typen", () => {
    const stubUpdater = { on() {}, off() {} };

    const win = registry.createProvider(
        registry.select({ system: system("windows"), installation: installation("nsis") }),
        { autoUpdater: stubUpdater }
    );
    assert.strictEqual(win.getProviderType(), "electron-updater");

    const appImage = registry.createProvider(
        registry.select({ system: system("linux"), installation: installation("appimage", { source: "appimage" }) }),
        { autoUpdater: stubUpdater, app: null }
    );
    assert.strictEqual(appImage.getProviderType(), "appimage-github-fallback");

    const deb = registry.createProvider(
        registry.select({ system: system("linux", distroDebian), installation: installation("deb") }),
        {}
    );
    assert.strictEqual(deb.getProviderType(), "unsupported");
});

test("createProvider ohne Auswahl liefert sicheren Fallback", () => {
    const provider = registry.createProvider(null, {});
    assert.strictEqual(provider.getProviderType(), "unsupported");
});

test("Registry ist erweiterbar (register/list)", () => {
    const { UpdateProviderRegistry } = registry;
    const custom = new UpdateProviderRegistry();

    custom.register({
        key: "test-format",
        platform: "any",
        formats: ["test"],
        label: "Testformat",
        providerType: "unsupported",
        mechanism: "none",
        automatic: false,
        requiresElevation: false,
        reason: "Test"
    });

    const sel = custom.select({ system: system("linux"), installation: installation("test") });
    assert.strictEqual(sel.key, "test-format");

    const keys = custom.list().map((entry) => entry.key);
    assert.ok(keys.includes("test-format"));
    assert.ok(keys.includes("linux-appimage"), "Standarddefinitionen bleiben erhalten");
});

console.log("\n==========================================");
console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen.`);
console.log("==========================================");

if (failed > 0) {
    process.exit(1);
}
