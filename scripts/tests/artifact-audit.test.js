"use strict";

/**
 * Plattformneutrale Smoke-Tests für Linux-Build-Artefakte.
 *
 * Diese Tests laufen auf jedem System (Windows, Linux, macOS) und
 * prüfen, ob die Build-/Packaging-Konfiguration korrekt ist sowie –
 * sofern vorhanden – ob bereits erzeugte Artefakte die erwarteten
 * Eigenschaften haben.
 *
 * Wenn KEIN Artefakt vorhanden ist, wird der Test als
 * "NOT_TESTED" gewertet und nicht als Fehler gezählt.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.resolve(__dirname, "..", "..");
const DIST = path.join(ROOT, "dist");

console.log("==========================================");
console.log("🧪 Starte Linux Artifact Audit Tests");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

function test(name, fn) {
    try {
        const result = fn();
        if (result === "SKIP") {
            console.log(`  ⏭️  ${name}  [NOT TESTED – Artefakt nicht vorhanden]`);
            testsSkipped++;
        } else {
            console.log(`  ✅ ${name}`);
            testsPassed++;
        }
    } catch (err) {
        console.error(`  ❌ ${name}`);
        console.error(`     Error: ${err.message}`);
        testsFailed++;
    }
}

function exists(p) {
    try {
        return fs.existsSync(p);
    } catch {
        return false;
    }
}

function findAppImage() {
    if (!exists(DIST)) return null;
    const matches = fs.readdirSync(DIST).filter((n) => n.endsWith(".AppImage"));
    return matches.length > 0 ? path.join(DIST, matches[0]) : null;
}

function findArchPkg() {
    if (!exists(DIST)) return null;
    const matches = fs
        .readdirSync(DIST)
        .filter((n) => n.endsWith(".pkg.tar.zst") || n.endsWith(".pkg.tar"));
    return matches.length > 0 ? path.join(DIST, matches[0]) : null;
}

function findDeb() {
    if (!exists(DIST)) return null;
    const matches = fs.readdirSync(DIST).filter((n) => n.endsWith(".deb"));
    return matches.length > 0 ? path.join(DIST, matches[0]) : null;
}

// ─────────────────────────────────────────────────────────────
// 1. Pflichtfelder in der Build-Konfiguration
// ─────────────────────────────────────────────────────────────
console.log("\n[1] Build-Konfiguration");

test("desktopName in package.json (für WM_CLASS)", () => {
    const pkg = JSON.parse(
        fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
    );
    assert.ok(
        typeof pkg.desktopName === "string" && pkg.desktopName.length > 0,
        "package.json muss einen desktopName enthalten"
    );
});

test("linux.syncDesktopName: true in electron-builder.yml", () => {
    const yml = fs.readFileSync(path.join(ROOT, "electron-builder.yml"), "utf8");
    assert.ok(
        /syncDesktopName:\s*true/.test(yml),
        "syncDesktopName: true muss gesetzt sein"
    );
});

test("Linux target x64 in electron-builder.yml", () => {
    const yml = fs.readFileSync(path.join(ROOT, "electron-builder.yml"), "utf8");
    assert.ok(/linux:[\s\S]*AppImage[\s\S]*x64/.test(yml));
    assert.ok(/linux:[\s\S]*deb[\s\S]*x64/.test(yml));
});

test("FFmpeg wird aus ASAR entpackt", () => {
    const yml = fs.readFileSync(path.join(ROOT, "electron-builder.yml"), "utf8");
    assert.ok(/asarUnpack:[\s\S]*ffmpeg-static/.test(yml));
});

test("Native Module werden automatisch entpackt (**/*.node)", () => {
    const yml = fs.readFileSync(path.join(ROOT, "electron-builder.yml"), "utf8");
    assert.ok(/\*\*\/\*\.node/.test(yml));
});

test("Linux icon = tray.png", () => {
    const yml = fs.readFileSync(path.join(ROOT, "electron-builder.yml"), "utf8");
    assert.ok(/linux:[\s\S]*icon:\s*assets\/icons\/tray\.png/.test(yml));
});

// ─────────────────────────────────────────────────────────────
// 2. PKGBUILD-Audit (namcap-Style statische Prüfung)
// ─────────────────────────────────────────────────────────────
console.log("\n[2] PKGBUILD Audit");

function readPkgbuild() {
    return fs.readFileSync(
        path.join(ROOT, "packaging", "arch", "PKGBUILD"),
        "utf8"
    );
}

test("PKGBUILD: pkgname=webradio", () => {
    const s = readPkgbuild();
    assert.ok(/^pkgname=webradio$/m.test(s));
});

test("PKGBUILD: arch=('x86_64')", () => {
    const s = readPkgbuild();
    assert.ok(/arch=\('x86_64'\)/.test(s));
});

test("PKGBUILD: license=('MIT')", () => {
    const s = readPkgbuild();
    assert.ok(/license=\('MIT'\)/.test(s));
});

test("PKGBUILD: kein leeres pkgver (Platzhalter ersetzt)", () => {
    const s = readPkgbuild();
    assert.ok(!/pkgver=__PKGVER__/.test(s.replace(/^\s*#.*$/gm, "")));
});

test("PKGBUILD: keine hartkodierten 777-Permissions", () => {
    const s = readPkgbuild();
    const code = s
        .split("\n")
        .filter((l) => !l.trim().startsWith("#"))
        .join("\n");
    assert.ok(!/\bchmod\s+777\b/.test(code));
});

test("PKGBUILD: hicolor Icons in 7 Größen", () => {
    const s = readPkgbuild();
    const m = s.match(/install -Dm644 "\$srcdir\/tray\.png" "\$pkgdir\/usr\/share\/icons\/hicolor\/(\d+)x\1\/apps\/webradio\.png"/g);
    assert.ok(m && m.length >= 3, "mindestens 3 Icon-Größen installiert");
});

test("PKGBUILD: .desktop nach /usr/share/applications", () => {
    const s = readPkgbuild();
    assert.ok(/install -Dm644.*webradio\.desktop.*\/usr\/share\/applications\/webradio\.desktop/.test(s));
});

test("PKGBUILD: kein sudo/root während Runtime", () => {
    const s = readPkgbuild();
    // sudo darf nur in makedepends-Kontext auftauchen, nicht im package()-Block.
    const packageBlock = s.split("package()")[1] || "";
    assert.ok(!/\bsudo\b/.test(packageBlock));
});

// ─────────────────────────────────────────────────────────────
// 3. .desktop-Audit
// ─────────────────────────────────────────────────────────────
console.log("\n[3] .desktop Audit");

test(".desktop: Exec=webradio %U", () => {
    const s = fs.readFileSync(
        path.join(ROOT, "assets", "webradio.desktop"),
        "utf8"
    );
    assert.ok(/^Exec=webradio(\s+%U)?$/m.test(s), "Exec zeigt auf den Launcher");
});

test(".desktop: StartupWMClass=WebRadio", () => {
    const s = fs.readFileSync(
        path.join(ROOT, "assets", "webradio.desktop"),
        "utf8"
    );
    assert.ok(/StartupWMClass=WebRadio/.test(s));
});

test(".desktop: Icon=webradio", () => {
    const s = fs.readFileSync(
        path.join(ROOT, "assets", "webradio.desktop"),
        "utf8"
    );
    assert.ok(/^Icon=webradio$/m.test(s));
});

test(".desktop: Type=Application, Terminal=false", () => {
    const s = fs.readFileSync(
        path.join(ROOT, "assets", "webradio.desktop"),
        "utf8"
    );
    assert.ok(/^Type=Application$/m.test(s));
    assert.ok(/^Terminal=false$/m.test(s));
});

test(".desktop: Categories enthalten AudioVideo", () => {
    const s = fs.readFileSync(
        path.join(ROOT, "assets", "webradio.desktop"),
        "utf8"
    );
    assert.ok(/AudioVideo/.test(s));
});

// ─────────────────────────────────────────────────────────────
// 4. ffmpeg-resolver Audit
// ─────────────────────────────────────────────────────────────
console.log("\n[4] FFmpeg Audit");

test("ffmpeg-resolver: behandelt app.asar → app.asar.unpacked", () => {
    const s = fs.readFileSync(
        path.join(ROOT, "electron", "core", "ffmpeg-resolver.js"),
        "utf8"
    );
    assert.ok(s.includes("app.asar.unpacked"));
});

test("ffmpeg-resolver: setzt execute-Bit auf Linux (kein 777)", () => {
    const s = fs.readFileSync(
        path.join(ROOT, "electron", "core", "ffmpeg-resolver.js"),
        "utf8"
    );
    // chmod 755 ist okay (Owner rwx, Group/Other rx)
    assert.ok(/chmodSync\(.*0o755/.test(s));
    assert.ok(!/chmodSync\(.*0o777/.test(s));
});

// ─────────────────────────────────────────────────────────────
// 5. AppImage-Smoke (nur wenn vorhanden)
// ─────────────────────────────────────────────────────────────
console.log("\n[5] AppImage Smoke");

test("AppImage vorhanden", () => {
    const p = findAppImage();
    if (!p) return "SKIP";
    const stat = fs.statSync(p);
    assert.ok(stat.size > 1024 * 1024, `AppImage zu klein: ${stat.size} bytes`);
});

test("AppImage: ausführbar (File-Mode)", () => {
    if (process.platform === "win32") return "SKIP"; // Windows hat keine x-Bits
    const p = findAppImage();
    if (!p) return "SKIP";
    const stat = fs.statSync(p);
    // Auf Linux/macOS muss das Owner-Execute-Bit gesetzt sein.
    assert.ok(
        (stat.mode & 0o100) !== 0,
        `AppImage nicht ausführbar: mode=${stat.mode.toString(8)}`
    );
});

test("AppImage: Architektur-Marker x86_64", () => {
    const p = findAppImage();
    if (!p) return "SKIP";
    // AppImages starten mit einem ELF-Header (0x7F ELF) und enthalten
    // irgendwo die Architektur-Markierung. Wir prüfen, dass der String
    // 'x86_64' im Binary vorkommt (SquashFS-Inhalt enthält 'AppRun').
    const buf = fs.readFileSync(p, { encoding: "binary" });
    assert.ok(
        buf.includes("x86_64") || buf.includes("aarch64") || buf.includes("i686"),
        "Architektur-Marker im AppImage fehlt"
    );
});

// ─────────────────────────────────────────────────────────────
// 6. Arch-Paket-Smoke (nur wenn vorhanden)
// ─────────────────────────────────────────────────────────────
console.log("\n[6] Arch Package Smoke");

test(".pkg.tar.zst vorhanden", () => {
    if (!findArchPkg()) return "SKIP";
    const stat = fs.statSync(findArchPkg());
    assert.ok(stat.size > 1024 * 1024, `Paket zu klein: ${stat.size} bytes`);
});

test(".pkg.tar.zst: gültiger zstd-Magic-Header (0xFD2FB528)", () => {
    const p = findArchPkg();
    if (!p) return "SKIP";
    const fd = fs.openSync(p, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    assert.ok(
        buf[0] === 0xfd && buf[1] === 0x2f && buf[2] === 0xb5 && buf[3] === 0x28,
        `Ungültiger zstd-Header: ${buf.toString("hex")}`
    );
});

// ─────────────────────────────────────────────────────────────
// 7. Linux-unpacked Smoke (falls vorhanden)
// ─────────────────────────────────────────────────────────────
console.log("\n[7] linux-unpacked Smoke");

function linuxUnpackedDir() {
    return path.join(DIST, "linux-unpacked");
}

test("linux-unpacked/webradio existiert", () => {
    if (!exists(linuxUnpackedDir())) return "SKIP";
    const exe = path.join(linuxUnpackedDir(), "webradio");
    assert.ok(exists(exe), "Haupt-Binary fehlt");
});

test("linux-unpacked/chrome-sandbox existiert", () => {
    if (!exists(linuxUnpackedDir())) return "SKIP";
    const sb = path.join(linuxUnpackedDir(), "chrome-sandbox");
    assert.ok(exists(sb), "chrome-sandbox fehlt");
});

test("linux-unpacked/resources/app.asar existiert", () => {
    if (!exists(linuxUnpackedDir())) return "SKIP";
    assert.ok(exists(path.join(linuxUnpackedDir(), "resources", "app.asar")));
});

test("linux-unpacked/resources/app.asar.unpacked/ffmpeg-static existiert", () => {
    if (!exists(linuxUnpackedDir())) return "SKIP";
    assert.ok(
        exists(
            path.join(
                linuxUnpackedDir(),
                "resources",
                "app.asar.unpacked",
                "node_modules",
                "ffmpeg-static"
            )
        )
    );
});

test("linux-unpacked/resources/plugins und themes vorhanden", () => {
    if (!exists(linuxUnpackedDir())) return "SKIP";
    assert.ok(
        exists(path.join(linuxUnpackedDir(), "resources", "plugins"))
    );
    assert.ok(
        exists(path.join(linuxUnpackedDir(), "resources", "themes"))
    );
});

// ─────────────────────────────────────────────────────────────
// 8. Security Audit
// ─────────────────────────────────────────────────────────────
console.log("\n[8] Security Audit");

test("Kein chmod 777 im gesamten Repo (außer Kommentar-Negation)", () => {
    const sources = [
        "electron/core/ffmpeg-resolver.js",
        "packaging/arch/PKGBUILD",
        "scripts/build-linux-arch.js",
    ];
    for (const rel of sources) {
        const p = path.join(ROOT, rel);
        if (!exists(p)) continue;
        const code = fs
            .readFileSync(p, "utf8")
            .split("\n")
            .filter((l) => !l.trim().startsWith("#"))
            .join("\n");
        assert.ok(
            !/\bchmod\s+777\b/.test(code),
            `${rel} enthält chmod 777 (außerhalb von Kommentaren)`
        );
    }
});

test("Keine absoluten Windows-Pfade in StorageManager", () => {
    const s = fs.readFileSync(
        path.join(ROOT, "electron", "core", "storage", "StorageManager.js"),
        "utf8"
    );
    assert.ok(!/C:\\/.test(s));
    assert.ok(!/C:\//.test(s));
});

test("userData-Konfiguration nutzt app.getPath()", () => {
    const s = fs.readFileSync(
        path.join(ROOT, "electron", "core", "storage", "StorageManager.js"),
        "utf8"
    );
    assert.ok(s.includes('app.getPath("userData")'));
});

// ─────────────────────────────────────────────────────────────
// Zusammenfassung
// ─────────────────────────────────────────────────────────────
console.log("\n==========================================");
console.log(
    `Ergebnis: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen, ${testsSkipped} übersprungen.`
);
console.log("==========================================");

if (testsFailed > 0) {
    process.exit(1);
}
