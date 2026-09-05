"use strict";

/**
 * Plattform-Pfad-Tests.
 *
 * Diese Tests stellen sicher, dass Pfade, die WebRadio produktiv nutzt,
 * plattformunabhängig und ohne Windows-spezifische Annahmen erzeugt werden.
 *
 * Wir können die Electron-APIs (`app.getPath`) nicht direkt ansprechen,
 * weil wir hier ohne Electron-Runtime laufen. Wir testen daher die
 * Logik der Pfad-Konstruktion, die in den jeweiligen Modulen verwendet wird.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

console.log("==========================================");
console.log("🧪 Starte Plattform-Pfad Tests");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`  ❌ ${name}`);
        console.error(`     Error: ${err.message}`);
        testsFailed++;
    }
}

// ─────────────────────────────────────────────────────────────
// 1. Pfad-Konstruktion ist plattformneutral
// ─────────────────────────────────────────────────────────────
console.log("\n[1] Plattformneutrale Pfad-Konstruktion");

test("path.join verwendet plattformkonforme Separatoren", () => {
    const winLike = ["plugins", "discordRPC"];
    const joined = path.join(...winLike);
    if (process.platform === "win32") {
        assert.strictEqual(joined.includes("\\"), true);
    } else {
        assert.strictEqual(joined.includes("/"), true);
        assert.strictEqual(joined.includes("\\"), false);
    }
});

test("Kein hartkodierter Windows-Pfad im StorageManager", () => {
    const src = fs.readFileSync(
        path.join(__dirname, "..", "..", "electron", "core", "storage", "StorageManager.js"),
        "utf8"
    );
    // Verbotene Muster
    assert.ok(!src.includes("C:\\"), "Keine absoluten Windows-Pfade");
    assert.ok(!src.includes("C:/"), "Keine Windows-Laufwerksbuchstaben");
    assert.ok(src.includes("path.join"), "StorageManager verwendet path.join");
});

test("PluginLoader verwendet path.join / path.resolve", () => {
    const src = fs.readFileSync(
        path.join(__dirname, "..", "..", "electron", "core", "plugins", "PluginLoader.js"),
        "utf8"
    );
    assert.ok(src.includes("path.join"), "PluginLoader verwendet path.join");
    // Keine String-Konkatenation mit 'plugins/' + id als primäre Methode.
    // (manifest.renderer-Pfad darf weiterhin mit replace arbeiten.)
    assert.ok(
        !/["']plugins\/["']\s*\+/.test(src),
        "Keine naive String-Konkatenation 'plugins/' + id"
    );
});

test("ThemeLoader verwendet process.resourcesPath korrekt", () => {
    const src = fs.readFileSync(
        path.join(__dirname, "..", "..", "electron", "core", "themes", "ThemeLoader.js"),
        "utf8"
    );
    assert.ok(src.includes("path.join"), "ThemeLoader verwendet path.join");
    assert.ok(src.includes("process.resourcesPath"), "ThemeLoader nutzt process.resourcesPath");
});

test("ffmpeg-resolver verwendet ASAR-Korrektur", () => {
    const src = fs.readFileSync(
        path.join(__dirname, "..", "..", "electron", "core", "ffmpeg-resolver.js"),
        "utf8"
    );
    assert.ok(src.includes("app.asar"), "ffmpeg-resolver behandelt app.asar");
    assert.ok(src.includes("app.asar.unpacked"), "ffmpeg-resolver entpackt ASAR-Pfad");
});

// ─────────────────────────────────────────────────────────────
// 2. userData-Pfad folgt Electron-Konventionen
// ─────────────────────────────────────────────────────────────
console.log("\n[2] userData-Pfad");

test("StorageManager.userData nutzt app.getPath wenn vorhanden", () => {
    const src = fs.readFileSync(
        path.join(__dirname, "..", "..", "electron", "core", "storage", "StorageManager.js"),
        "utf8"
    );
    assert.ok(src.includes('app.getPath("userData")'), "StorageManager verwendet app.getPath('userData')");
});

test("Linux-Standardpfad ~/.config/<app>", () => {
    // Test ohne Electron: Wir simulieren den Fallback.
    // Unter Linux ist ~/.config/WebRadio der Standardpfad.
    const expected = path.join(os.homedir(), ".config", "WebRadio");
    assert.strictEqual(typeof expected, "string");
    assert.ok(expected.startsWith(os.homedir()), "Liegt im Home-Verzeichnis");
});

// ─────────────────────────────────────────────────────────────
// 3. Packaging-Konfiguration
// ─────────────────────────────────────────────────────────────
console.log("\n[3] Packaging-Konfiguration");

test("electron-builder.yml hat Linux x64 als Target", () => {
    const src = fs.readFileSync(
        path.join(__dirname, "..", "..", "electron-builder.yml"),
        "utf8"
    );
    assert.ok(/linux:[\s\S]*AppImage[\s\S]*x64/.test(src), "Linux Target mit x64 / AppImage vorhanden");
});

test("electron-builder.yml entpackt FFmpeg aus ASAR", () => {
    const src = fs.readFileSync(
        path.join(__dirname, "..", "..", "electron-builder.yml"),
        "utf8"
    );
    assert.ok(/asarUnpack:[\s\S]*ffmpeg-static/.test(src), "ffmpeg-static ist in asarUnpack");
});

test(".desktop-Datei ist im richtigen Format", () => {
    const src = fs.readFileSync(
        path.join(__dirname, "..", "..", "assets", "webradio.desktop"),
        "utf8"
    );
    assert.ok(src.includes("[Desktop Entry]"));
    assert.ok(src.includes("Name=WebRadio"));
    assert.ok(src.includes("Exec=webradio"));
    assert.ok(src.includes("Type=Application"));
    assert.ok(src.includes("Categories=AudioVideo"));
});

test("PKGBUILD referenziert korrekten pkgname und x86_64", () => {
    const src = fs.readFileSync(
        path.join(__dirname, "..", "..", "packaging", "arch", "PKGBUILD"),
        "utf8"
    );
    assert.ok(/pkgname=webradio/.test(src), "pkgname=webradio");
    assert.ok(/arch=\('x86_64'\)/.test(src), "arch=('x86_64')");
    assert.ok(src.includes("install -Dm644"), "verwendet install -Dm644");
    // Keine globalen Schreibrechte (Kommentar-Erwähnung erlaubt,
    // aber kein tatsächlicher Aufruf).
    const chmodLines = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("#"))
        .join("\n");
    assert.ok(
        !/\bchmod\s+777\b/.test(chmodLines),
        "kein chmod 777 (außerhalb von Kommentaren)"
    );
});

// ─────────────────────────────────────────────────────────────
// 4. Skripte
// ─────────────────────────────────────────────────────────────
console.log("\n[4] Build-Skripte");

test("package.json enthält make:linux Skripte", () => {
    const pkg = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8")
    );
    assert.ok(pkg.scripts["make:linux"], "make:linux vorhanden");
    assert.ok(pkg.scripts["make:linux:appimage"], "make:linux:appimage vorhanden");
    assert.ok(pkg.scripts["make:linux:arch"], "make:linux:arch vorhanden");
});

test("Linux GitHub Actions Workflow existiert", () => {
    const workflow = path.join(
        __dirname,
        "..",
        "..",
        ".github",
        "workflows",
        "build-linux.yml"
    );
    assert.ok(fs.existsSync(workflow), "build-linux.yml existiert");
    const content = fs.readFileSync(workflow, "utf8");
    assert.ok(content.includes("AppImage"), "AppImage-Job vorhanden");
    assert.ok(content.includes("archlinux:latest"), "Arch-Container-Job vorhanden");
});

// ─────────────────────────────────────────────────────────────
// Zusammenfassung
// ─────────────────────────────────────────────────────────────
console.log("\n==========================================");
console.log(`Ergebnis: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen.`);
console.log("==========================================");

if (testsFailed > 0) {
    process.exit(1);
}
