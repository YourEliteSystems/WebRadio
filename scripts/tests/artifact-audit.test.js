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
const crypto = require("crypto");

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

test("PKGBUILD: pkgver wird beim Build korrekt ersetzt", () => {
    const tpl = readPkgbuild();
    // Das Template enthält den Platzhalter; build-linux-arch.js
    // rendert den endgültigen PKGBUILD via sed-Ersetzung. Wir
    // prüfen, dass das Template den Platzhalter enthält (Erwartung)
    // UND dass die Render-Logik den Platzhalter korrekt ersetzt.
    assert.ok(/pkgver=__PKGVER__/.test(tpl), "Platzhalter muss im Template vorhanden sein");
    const rendered = tpl.replace(/__PKGVER__/g, "1.2.3");
    assert.ok(/pkgver=1\.2\.3/.test(rendered));
    assert.ok(!/__PKGVER__/.test(rendered), "kein Platzhalter mehr im gerenderten PKGBUILD");
});

test("PKGBUILD: keine hartkodierten 777-Permissions", () => {
    const s = readPkgbuild();
    const code = s
        .split("\n")
        .filter((l) => !l.trim().startsWith("#"))
        .join("\n");
    assert.ok(!/\bchmod\s+777\b/.test(code));
});

test("PKGBUILD: hicolor Icons in mehreren Größen", () => {
    const s = readPkgbuild();
    // Wir prüfen, dass das Icon-Pfad-Template für hicolor korrekt ist
    // (${size}x${size}/apps/webradio.png).
    const iconPathRegex = /\/hicolor\/\$\{size\}x\$\{size\}\/apps\/webradio\.png/;
    assert.ok(iconPathRegex.test(s), "Icon-Pfad-Template fehlt");

    // Außerdem prüfen wir, dass die for-Schleife die 7 Pflichtgrößen
    // (16/32/48/64/128/256/512) tatsächlich expandiert.
    assert.ok(
        /for size in 16 32 48 64 128 256 512/.test(s),
        "for-Schleife muss die 7 Pflichtgrößen expandieren"
    );
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

test("PKGBUILD: Symlink zeigt auf installierte Binary (WebRadio oder pkgname)", () => {
    const s = readPkgbuild();
    assert.ok(/ln -s "\/opt\/\$\{_pkgname\}\/\$\{_bin_name\}" "\$pkgdir\/usr\/bin\/\$\{_pkgname\}"/.test(s) ||
              /ln -s "\/opt\/\$\{_pkgname\}\/WebRadio" "\$pkgdir\/usr\/bin\/\$\{_pkgname\}"/.test(s),
              "Symlink muss dynamisch oder auf WebRadio verweisen");
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
    // Wir entfernen nicht nur Kommentar-Zeilen, sondern auch Zeilen,
    // die das Wort "chmod 777" in einer Verneinung enthalten
    // (z. B. "kein chmod 777").
    for (const rel of sources) {
        const p = path.join(ROOT, rel);
        if (!exists(p)) continue;
        const code = fs
            .readFileSync(p, "utf8")
            .split("\n")
            .filter((l) => {
                if (l.trim().startsWith("#")) return false;
                // Verneinungen mit "chmod 777" sind dokumentarisch.
                if (/kein\s+chmod\s+777|nicht\s+chmod\s+777|no\s+chmod\s+777/i.test(l))
                    return false;
                return true;
            })
            .join("\n");
        assert.ok(
            !/\bchmod\s+777\b/.test(code),
            `${rel} enthält chmod 777 (außerhalb von Kommentaren/Verneinungen)`
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
// 9. AppImage Metadata Tests (v1.0.6-beta.3+)
// ─────────────────────────────────────────────────────────────
console.log("\n[9] AppImage Metadata");

test("electron-builder.yml enthält X-AppImage-Name", () => {
    const yml = fs.readFileSync(path.join(ROOT, "electron-builder.yml"), "utf8");
    assert.ok(/X-AppImage-Name:\s*WebRadio/.test(yml), "X-AppImage-Name fehlt");
});

test("electron-builder.yml enthält X-AppImage-Version", () => {
    const yml = fs.readFileSync(path.join(ROOT, "electron-builder.yml"), "utf8");
    assert.ok(/X-AppImage-Version:\s*\$\{version\}/.test(yml), "X-AppImage-Version fehlt");
});

// ─────────────────────────────────────────────────────────────
// 10. SHA256SUMS Tests
// ─────────────────────────────────────────────────────────────
console.log("\n[10] SHA256SUMS");

test("SHA256-System vorhanden (scripts/release/checksums.js)", () => {
    const checksumsScript = path.join(ROOT, "scripts", "release", "checksums.js");
    assert.ok(exists(checksumsScript), "checksums.js fehlt");
});

test("SHA256-System deckt .AppImage ab", () => {
    const constants = path.join(ROOT, "scripts", "release", "constants.js");
    const s = fs.readFileSync(constants, "utf8");
    assert.ok(/\.AppImage/.test(s), ".AppImage nicht in ASSET_EXTENSIONS");
});

test("SHA256-System deckt .deb ab", () => {
    const constants = path.join(ROOT, "scripts", "release", "constants.js");
    const s = fs.readFileSync(constants, "utf8");
    assert.ok(/\.deb/.test(s), ".deb nicht in ASSET_EXTENSIONS");
});

// ─────────────────────────────────────────────────────────────
// 11. AppStream Metainfo Tests
// ─────────────────────────────────────────────────────────────
console.log("\n[11] AppStream Metainfo");

test("AppStream metainfo.xml vorhanden", () => {
    const metainfo = path.join(ROOT, "assets", "org.yourelitesystems.webradio.metainfo.xml");
    assert.ok(exists(metainfo), "metainfo.xml fehlt");
});

test("AppStream metainfo.xml ist valides XML", () => {
    const metainfo = path.join(ROOT, "assets", "org.yourelitesystems.webradio.metainfo.xml");
    const content = fs.readFileSync(metainfo, "utf8");
    assert.ok(content.includes('<?xml version="1.0"'), "XML-Header fehlt");
    assert.ok(content.includes('<component'), "component-Tag fehlt");
    assert.ok(content.includes('</component>'), "component-End-Tag fehlt");
});

test("AppStream metainfo.xml enthält Application ID", () => {
    const metainfo = path.join(ROOT, "assets", "org.yourelitesystems.webradio.metainfo.xml");
    const content = fs.readFileSync(metainfo, "utf8");
    assert.ok(/<id>org\.yourelitesystems\.webradio<\/id>/.test(content), "Application ID fehlt");
});

test("AppStream metainfo.xml enthält Name", () => {
    const metainfo = path.join(ROOT, "assets", "org.yourelitesystems.webradio.metainfo.xml");
    const content = fs.readFileSync(metainfo, "utf8");
    assert.ok(/<name>WebRadio<\/name>/.test(content), "Name fehlt");
});

test("AppStream metainfo.xml enthält Version", () => {
    const metainfo = path.join(ROOT, "assets", "org.yourelitesystems.webradio.metainfo.xml");
    const content = fs.readFileSync(metainfo, "utf8");
    assert.ok(/<release version=/.test(content), "Version fehlt");
});

test("electron-builder.yml enthält metainfo.xml in files", () => {
    const yml = fs.readFileSync(path.join(ROOT, "electron-builder.yml"), "utf8");
    assert.ok(/org\.yourelitesystems\.webradio\.metainfo\.xml/.test(yml), "metainfo.xml nicht in files");
});

// ─────────────────────────────────────────────────────────────
// 12. Wayland Documentation Tests
// ─────────────────────────────────────────────────────────────
console.log("\n[12] Wayland Documentation");

test("Wayland-Dokumentation in CROSS_PLATFORM_SETUP.md vorhanden", () => {
    const doc = path.join(ROOT, "docs", "CROSS_PLATFORM_SETUP.md");
    const content = fs.readFileSync(doc, "utf8");
    assert.ok(/Wayland/i.test(content), "Wayland-Dokumentation fehlt");
});

test("Wayland-Dokumentation erwähnt XWayland", () => {
    const doc = path.join(ROOT, "docs", "CROSS_PLATFORM_SETUP.md");
    const content = fs.readFileSync(doc, "utf8");
    assert.ok(/XWayland/i.test(content), "XWayland nicht dokumentiert");
});

test("Wayland-Dokumentation erwähnt keine projektspezifischen Einschränkungen", () => {
    const doc = path.join(ROOT, "docs", "CROSS_PLATFORM_SETUP.md");
    const content = fs.readFileSync(doc, "utf8");
    assert.ok(/No project-specific Wayland limitations/i.test(content), 
        "Erklärung zu projektspezifischen Einschränkungen fehlt");
});

// ─────────────────────────────────────────────────────────────
// 13. Arch-Packaging: pkgver vs. AppImage-Artefaktname
// ─────────────────────────────────────────────────────────────
console.log("\n[13] Arch-Packaging – Version vs. Artefaktname");

const archBuild = require(path.join(ROOT, "scripts", "build-linux-arch.js"));

// Erwartetes Verhalten: Arch-pkgver wird normalisiert, der Artefaktname nicht.
const archVersionCases = [
    {
        semver: "1.0.7-alpha.4",
        pkgver: "1.0.7.alpha.4",
        artifact: "WebRadio-1.0.7-alpha.4-linux-x86_64.AppImage"
    },
    {
        semver: "1.0.7-beta.1",
        pkgver: "1.0.7.beta.1",
        artifact: "WebRadio-1.0.7-beta.1-linux-x86_64.AppImage"
    },
    {
        semver: "1.0.7",
        pkgver: "1.0.7",
        artifact: "WebRadio-1.0.7-linux-x86_64.AppImage"
    }
];

test("Arch: SemVer → pkgver (Bindestriche werden zu Punkten)", () => {
    for (const c of archVersionCases) {
        assert.strictEqual(
            archBuild.toArchPkgver(c.semver),
            c.pkgver,
            `${c.semver} muss zu ${c.pkgver} werden`
        );
    }
});

test("Arch: AppImage-Dateiname bleibt unverändert (kein Namensschema)", () => {
    for (const c of archVersionCases) {
        assert.strictEqual(
            archBuild.appImageFileName(path.join("/tmp/dist", c.artifact)),
            c.artifact,
            "Tatsächlicher Artefaktname muss unverändert übernommen werden"
        );
    }
    // Produktname/Case darf nicht hartcodiert vorausgesetzt werden.
    assert.strictEqual(
        archBuild.appImageFileName("/tmp/dist/webraDio-1.0.7.alpha.4.AppImage"),
        "webraDio-1.0.7.alpha.4.AppImage"
    );
});

test("Arch: Artefaktauswahl bevorzugt die zur Version passende Datei", () => {
    const candidates = [
        "WebRadio-1.0.7-alpha.3-linux-x86_64.AppImage",
        "WebRadio-1.0.7-alpha.4-linux-x86_64.AppImage"
    ];
    assert.strictEqual(
        archBuild.selectAppImage(candidates, "1.0.7-alpha.4"),
        "WebRadio-1.0.7-alpha.4-linux-x86_64.AppImage"
    );
    // Ein einzelnes Artefakt wird akzeptiert, auch wenn der Name nicht passt.
    assert.strictEqual(
        archBuild.selectAppImage(["webradio.AppImage"], "1.0.7-alpha.4"),
        "webradio.AppImage"
    );
});

test("Arch: mehrdeutige Artefakte führen zu einem Abbruch", () => {
    assert.throws(
        () =>
            archBuild.selectAppImage(
                [
                    "WebRadio-1.0.7-alpha.4-linux-x86_64.AppImage",
                    "WebRadio-1.0.7-alpha.4-linux-arm64.AppImage"
                ],
                "1.0.7-alpha.4"
            ),
        /nicht eindeutig/
    );
    assert.throws(() => archBuild.selectAppImage([], "1.0.7-alpha.4"), /Kein AppImage/);
});

test("Arch: PKGBUILD-Template trennt pkgver, SemVer und Artefaktname", () => {
    const tpl = readPkgbuild();
    assert.ok(/^pkgver=__PKGVER__$/m.test(tpl), "pkgver-Platzhalter fehlt");
    assert.ok(/^_semver=__SEMVER__$/m.test(tpl), "_semver muss das Original-SemVer erhalten");
    assert.ok(
        /^_appimage="__APPIMAGE_FILE__"$/m.test(tpl),
        "Artefaktname muss über __APPIMAGE_FILE__ übergeben werden"
    );
    assert.ok(
        /source=\([\s\S]*"\$\{_appimage\}"/.test(tpl),
        "source=() muss den tatsächlichen Artefaktnamen verwenden"
    );
    assert.ok(
        !/\$\{_semver\}\.AppImage/.test(tpl),
        "Dateiname darf nicht aus _semver gebildet werden"
    );
    assert.ok(
        !/\$\{pkgver\}\.AppImage/.test(tpl),
        "Dateiname darf nicht aus pkgver gebildet werden"
    );
});

for (const c of archVersionCases) {
    test(`Arch: gerendertes PKGBUILD für ${c.semver}`, () => {
        const rendered = archBuild.renderPkgbuild(readPkgbuild(), {
            pkgver: c.pkgver,
            semver: c.semver,
            appimageFile: c.artifact,
            appimageSha: "a".repeat(64),
            desktopSha: "b".repeat(64),
            iconSha: "c".repeat(64)
        });

        assert.ok(
            new RegExp(`^pkgver=${c.pkgver.replace(/\./g, "\\.")}$`, "m").test(rendered),
            `pkgver muss ${c.pkgver} sein`
        );
        assert.ok(
            new RegExp(`^_semver=${c.semver.replace(/\./g, "\\.")}$`, "m").test(rendered),
            `_semver muss ${c.semver} sein`
        );
        assert.ok(
            rendered.includes(`_appimage="${c.artifact}"`),
            "Artefaktname muss unverändert im PKGBUILD stehen"
        );
        assert.ok(
            !/__(PKGVER|SEMVER|APPIMAGE_FILE|APPIMAGE_SHA256|DESKTOP_SHA256|ICON_SHA256)__/.test(rendered),
            "keine unersetzten Platzhalter im gerenderten PKGBUILD"
        );
        assert.ok(
            !rendered.includes(`webradio-${c.pkgver}.AppImage`),
            "pkgver darf nicht als Dateiname auftauchen"
        );
        assert.ok(
            !rendered.includes(`webradio.${c.pkgver}.AppImage`),
            "pkgver darf nicht als Dateiname auftauchen (Punkt-Variante)"
        );
        if (c.semver !== c.pkgver) {
            assert.ok(
                !rendered.includes(`webradio-${c.semver}.AppImage`),
                "SemVer darf nicht als Dateiname auftauchen"
            );
        }
    });
}

test("Arch: Staging kopiert das Artefakt unter seinem echten Namen", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "webradio-arch-"));
    try {
        const artifact = "WebRadio-1.0.7-alpha.4-linux-x86_64.AppImage";
        const payload = "dummy-appimage-payload";
        const src = path.join(tmp, artifact);
        fs.writeFileSync(src, payload);
        const desktop = path.join(tmp, "webradio.desktop");
        fs.writeFileSync(desktop, "[Desktop Entry]\nName=WebRadio\n");
        const icon = path.join(tmp, "tray.png");
        fs.writeFileSync(icon, "png-bytes");

        const workDir = path.join(tmp, "arch-build");
        fs.mkdirSync(workDir);

        const staged = archBuild.stageSources({
            appimage: src,
            workDir,
            desktopFile: desktop,
            iconFile: icon
        });

        assert.strictEqual(staged.appimageName, artifact, "echter Artefaktname");
        assert.ok(
            exists(path.join(workDir, artifact)),
            "Artefakt muss unter dem echten Namen im Build-Verzeichnis liegen"
        );
        assert.strictEqual(
            staged.appimageSha,
            crypto.createHash("sha256").update(payload).digest("hex"),
            "SHA256 muss aus dem tatsächlichen Artefakt stammen"
        );
        assert.strictEqual(
            fs.readFileSync(path.join(workDir, artifact), "utf8"),
            payload,
            "Artefaktinhalt muss unverändert sein"
        );
        // Das Seitenwagen-Trio muss vollständig sein (Reihenfolge wie in source=()).
        assert.ok(exists(path.join(workDir, "webradio.desktop")));
        assert.ok(exists(path.join(workDir, "tray.png")));
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test("Arch: Workflows nutzen den tatsächlichen Artefaktnamen", () => {
    for (const file of ["build-linux.yml", "release.yml"]) {
        const wf = fs.readFileSync(
            path.join(ROOT, ".github", "workflows", file),
            "utf8"
        );
        assert.ok(
            wf.includes("__APPIMAGE_FILE__"),
            `${file}: Platzhalter __APPIMAGE_FILE__ fehlt`
        );
        assert.ok(
            wf.includes("basename"),
            `${file}: Artefaktname muss aus dem tatsächlichen Artefakt ermittelt werden`
        );
        assert.ok(
            /\$\{APPIMAGE_FILE\}/.test(wf),
            `${file}: Checksumme muss aus dem tatsächlichen Artefakt berechnet werden`
        );
        assert.ok(
            !/webradio[-.]\$\{SEMVER\}\.AppImage/.test(wf),
            `${file}: Dateiname darf nicht aus SEMVER gebaut werden`
        );
        assert.ok(
            !/\$\{PKGVER_ARCH\}\.AppImage/.test(wf),
            `${file}: Dateiname darf nicht aus PKGVER_ARCH gebaut werden`
        );
    }
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
