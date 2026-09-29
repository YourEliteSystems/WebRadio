"use strict";

/**
 * WebRadio – Linux Arch Package Builder
 *
 * Ablauf:
 *   1) Voraussetzungen prüfen (makepkg, fakeroot, AppImage vorhanden).
 *   2) AppImage-Artefakt ermitteln und unverändert ins Build-Verzeichnis kopieren.
 *   3) SHA256-Hashes der Quelldateien berechnen.
 *   4) PKGBUILD-Template mit pkgver, SemVer, Artefaktname und Hashes rendern.
 *   5) Optional: makepkg in einem Arch-Container aufrufen.
 *
 * Versionsbegriffe (strikt getrennt):
 *   SemVer  1.0.7-alpha.5   → Version aus package.json (Artefaktname)
 *   pkgver  1.0.7.alpha.5   → Arch-Paketversion (keine Bindestriche)
 *   AppImage-Namen werden NIEMALS aus einer Version rekonstruiert, sondern
 *   immer aus dem tatsächlich vorhandenen Artefakt übernommen.
 *
 * Standard-Verwendung:
 *   npm run make:linux:appimage   # baut das AppImage (electron-builder)
 *   npm run make:linux:arch       # verpackt es als .pkg.tar.zst
 *   npm run make:linux            # beides hintereinander
 *
 * Aufrufparameter (CLI):
 *   --appimage=<pfad>      Pfad zum AppImage (Default: tatsächliches
 *                          *.AppImage in dist/, bevorzugt zur Version passend)
 *   --no-makepkg           Nur PKGBUILD/SHA256 erzeugen, nicht bauen
 *   --use-docker           Bauen in einem Arch-Linux-Container (lokal)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PKGBUILD_TEMPLATE = path.join(ROOT, "packaging", "arch", "PKGBUILD");
const DESKTOP_FILE = path.join(ROOT, "assets", "webradio.desktop");
const ICON_FILE = path.join(ROOT, "assets", "icons", "tray.png");

function loadPkgVersion() {
    const pkg = JSON.parse(
        fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
    );
    return pkg.version;
}

/**
 * Arch-Paketversion (pkgver).
 *
 * Arch erlaubt keine Bindestriche in pkgver:
 *   1.0.7-alpha.5 (SemVer) → 1.0.7.alpha.5 (pkgver)
 *
 * Das Ergebnis ist AUSSCHLIESSLICH die Paketversion und niemals ein Dateiname.
 *
 * @param {string} semver
 * @returns {string}
 */
function toArchPkgver(semver) {
    return String(semver).trim().replace(/-/g, ".");
}

/**
 * Dateiname des AppImage-Artefakts.
 *
 * Der Name wird direkt aus dem tatsächlich vorhandenen Artefakt übernommen –
 * keine Rekonstruktion aus pkgver/SemVer. Damit bleiben Produktname
 * (WebRadio/webradio), Bindestriche und Groß-/Kleinschreibung erhalten.
 *
 * @param {string} appImagePath
 * @returns {string}
 */
function appImageFileName(appImagePath) {
    return path.basename(appImagePath);
}

/**
 * Wählt das AppImage-Artefakt aus den vorhandenen Kandidaten.
 * Reine Funktion ohne Dateisystemzugriff (dadurch testbar).
 *
 * @param {string[]} candidates  Dateinamen (ohne Pfad)
 * @param {string}   semver      Version aus package.json (z.B. "1.0.7-alpha.5")
 * @returns {string} Dateiname des Artefakts
 * @throws {Error}   wenn das Artefakt nicht eindeutig bestimmbar ist
 */
function selectAppImage(candidates, semver) {
    const list = (candidates || []).slice().sort();
    if (list.length === 0) {
        throw new Error("Kein AppImage-Artefakt gefunden.");
    }
    const matching = semver ? list.filter((n) => n.includes(semver)) : [];
    if (matching.length === 1) {
        return matching[0];
    }
    if (list.length === 1) {
        return list[0];
    }
    throw new Error(
        `AppImage-Artefakt nicht eindeutig (${list.join(", ")}). ` +
            "Bitte mit --appimage=<pfad> das gewünschte Artefakt angeben."
    );
}

/**
 * Ermittelt den Pfad zum AppImage-Artefakt.
 *
 * @param {string|null} explicit
 * @param {string}      semver
 * @returns {string|null}
 * @throws {Error} bei ungültigem/mehrdeutigem Artefakt
 */
function findAppImage(explicit, semver) {
    if (explicit) {
        if (!fs.existsSync(explicit)) {
            throw new Error(`Angegebenes AppImage existiert nicht: ${explicit}`);
        }
        return explicit;
    }
    const distDir = path.join(ROOT, "dist");
    if (!fs.existsSync(distDir)) {
        return null;
    }
    const candidates = fs
        .readdirSync(distDir, { withFileTypes: true })
        .filter(
            (entry) =>
                entry.isFile() && entry.name.toLowerCase().endsWith(".appimage")
        )
        .map((entry) => entry.name);
    if (candidates.length === 0) {
        return null;
    }
    return path.join(distDir, selectAppImage(candidates, semver));
}

function sha256(filePath) {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * Rendert das PKGBUILD-Template.
 *
 * @param {string} template
 * @param {object} ctx  { pkgver, semver, appimageFile, appimageSha, desktopSha, iconSha }
 * @returns {string}
 */
function renderPkgbuild(template, ctx) {
    return template
        .replace(/__PKGVER__/g, ctx.pkgver)
        .replace(/__SEMVER__/g, ctx.semver)
        .replace(/__APPIMAGE_FILE__/g, ctx.appimageFile)
        .replace(/__APPIMAGE_SHA256__/g, ctx.appimageSha)
        .replace(/__DESKTOP_SHA256__/g, ctx.desktopSha)
        .replace(/__ICON_SHA256__/g, ctx.iconSha);
}

/**
 * Kopiert die Quelldateien in das makepkg-Arbeitsverzeichnis.
 *
 * Das AppImage behält dabei seinen tatsächlichen Dateinamen (inklusive
 * Produktname und Schreibweise) – der Name wird nicht aus einer Version
 * gebildet. Liegt die Datei bereits am Zielort, wird sie nicht kopiert.
 *
 * @param {{ appimage: string, workDir: string, desktopFile: string, iconFile: string }} input
 * @returns {{ appimageName: string, appimageSha: string, desktopSha: string, iconSha: string }}
 */
function stageSources({ appimage, workDir, desktopFile, iconFile }) {
    const appimageName = appImageFileName(appimage);

    const staging = [
        [path.join(workDir, appimageName), appimage],
        [path.join(workDir, "webradio.desktop"), desktopFile],
        [path.join(workDir, "tray.png"), iconFile],
    ];

    for (const [target, src] of staging) {
        if (path.resolve(target) === path.resolve(src)) {
            continue; // Datei liegt bereits im Arbeitsverzeichnis
        }
        try {
            fs.unlinkSync(target);
        } catch {
            /* ignore */
        }
        fs.copyFileSync(src, target);
        fs.chmodSync(target, 0o644);
    }

    return {
        appimageName,
        appimageSha: sha256(appimage),
        desktopSha: sha256(desktopFile),
        iconSha: sha256(iconFile),
    };
}

function parseArgs(argv) {
    const out = {
        appimage: null,
        noMakepkg: false,
        useDocker: false,
    };
    for (const arg of argv) {
        if (arg.startsWith("--appimage=")) {
            out.appimage = arg.slice("--appimage=".length);
        } else if (arg === "--no-makepkg") {
            out.noMakepkg = true;
        } else if (arg === "--use-docker") {
            out.useDocker = true;
        }
    }
    return out;
}

function ensurePrereqs() {
    const tools = ["makepkg", "fakeroot", "unsquashfs"];
    const missing = tools.filter((t) => {
        try {
            execSync(`command -v ${t}`, { stdio: "ignore" });
            return false;
        } catch {
            return true;
        }
    });
    if (missing.length === 0) return null;
    return missing;
}

function buildInDocker(workDir, pkgName) {
    const image = "archlinux:latest";
    const cmd = [
        "docker",
        "run",
        "--rm",
        "-v",
        `${workDir}:/work`,
        "-w",
        "/work",
        image,
        "bash",
        "-lc",
        [
            "pacman -Sy --noconfirm",
            "base-devel fakeroot squashfs-tools unzip",
            "&& useradd -m builder",
            "&& chown -R builder:builder /work",
            "&& sudo -u builder makepkg -s --noconfirm",
        ].join(" "),
    ];
    console.log(`🐳 Baue Paket in Docker (${image})…`);
    execSync(cmd.join(" "), { stdio: "inherit" });
}

function main() {
    const args = parseArgs(process.argv.slice(2));

    // ── Versionen strikt trennen ────────────────────────────────
    const semver = loadPkgVersion();          // 1.0.7-alpha.5 (package.json)
    const pkgver = toArchPkgver(semver);      // 1.0.7.alpha.5 (Arch pkgver)

    let appimage;
    try {
        appimage = findAppImage(args.appimage, semver);
    } catch (err) {
        console.error(`❌ ${err.message}`);
        process.exit(1);
    }

    if (!appimage) {
        console.error(
            "❌ Kein AppImage gefunden. Bitte zuerst `npm run make:linux:appimage` ausführen."
        );
        process.exit(1);
    }

    console.log(`📦 WebRadio ${semver}  (Arch pkgver: ${pkgver})`);
    console.log(`   AppImage: ${appimage}`);

    if (!fs.existsSync(PKGBUILD_TEMPLATE)) {
        console.error(`❌ PKGBUILD-Template fehlt: ${PKGBUILD_TEMPLATE}`);
        process.exit(1);
    }

    if (!fs.existsSync(DESKTOP_FILE)) {
        console.error(`❌ .desktop-Datei fehlt: ${DESKTOP_FILE}`);
        process.exit(1);
    }

    if (!fs.existsSync(ICON_FILE)) {
        console.error(`❌ Icon fehlt: ${ICON_FILE}`);
        process.exit(1);
    }

    const workDir = path.join(ROOT, "dist", "arch-build");
    fs.mkdirSync(workDir, { recursive: true });

    // Veraltete AppImage-Artefakte aus früheren Läufen entfernen, damit
    // makepkg ausschließlich das aktuelle Artefakt vorfindet.
    for (const entry of fs.readdirSync(workDir)) {
        if (entry.toLowerCase().endsWith(".appimage")) {
            try {
                fs.unlinkSync(path.join(workDir, entry));
            } catch {
                /* ignore */
            }
        }
    }

    // Quelldateien bereitstellen – das AppImage behält seinen echten Namen.
    const staged = stageSources({
        appimage,
        workDir,
        desktopFile: DESKTOP_FILE,
        iconFile: ICON_FILE,
    });

    console.log(`   Quelle:   ${staged.appimageName} (${staged.appimageSha.slice(0, 12)}…)`);

    const ctx = {
        pkgver,                      // Arch-Paketversion      (1.0.7.alpha.5)
        semver,                      // Original-SemVer        (1.0.7-alpha.5)
        appimageFile: staged.appimageName,   // tatsächlicher Artefaktname
        appimageSha: staged.appimageSha,
        desktopSha: staged.desktopSha,
        iconSha: staged.iconSha,
    };

    const template = fs.readFileSync(PKGBUILD_TEMPLATE, "utf8");
    const rendered = renderPkgbuild(template, ctx);

    fs.writeFileSync(path.join(workDir, "PKGBUILD"), rendered, "utf8");
    console.log(`📝 PKGBUILD geschrieben nach: ${workDir}`);

    if (args.noMakepkg) {
        console.log("ℹ️  --no-makepkg gesetzt – überspringe den Build.");
        return;
    }

    const missing = ensurePrereqs();
    if (!missing && !args.useDocker) {
        console.log("🏗  Baue Paket mit makepkg…");
        try {
            execSync("makepkg -s --noconfirm", {
                cwd: workDir,
                stdio: "inherit",
            });
        } catch (err) {
            console.error("❌ makepkg fehlgeschlagen:", err.message);
            process.exit(1);
        }
    } else if (args.useDocker) {
        try {
            buildInDocker(workDir, "webradio");
        } catch (err) {
            console.error("❌ Docker-Build fehlgeschlagen:", err.message);
            process.exit(1);
        }
    } else {
        console.warn(
            "⚠️  Folgende Arch-Werkzeuge fehlen lokal: " + missing.join(", ")
        );
        console.warn(
            "    Du kannst den Build trotzdem im CI über .github/workflows/build-linux.yml laufen lassen,"
        );
        console.warn(
            "    oder lokal: docker run --rm -v <workdir>:/work archlinux:latest bash -lc '...'"
        );
        console.warn(
            "    oder manuell: cd " + workDir + " && makepkg -s"
        );
    }

    // Ergebnis einsammeln und ins dist/ verschieben.
    const produced = fs
        .readdirSync(workDir)
        .filter((n) => n.endsWith(".pkg.tar.zst") || n.endsWith(".pkg.tar"));
    if (produced.length > 0) {
        for (const f of produced) {
            const src = path.join(workDir, f);
            const dst = path.join(path.join(ROOT, "dist"), f);
            fs.copyFileSync(src, dst);
            console.log(`✅ ${f} → dist/${f}`);
        }
    } else {
        console.log("ℹ️  Kein .pkg.tar.zst erzeugt (makepkg wurde übersprungen).");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exporte für Tests (statische Prüfung der Version-/Artefakt-Trennung)
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
    toArchPkgver,
    appImageFileName,
    selectAppImage,
    findAppImage,
    renderPkgbuild,
    stageSources,
    main,
};

if (require.main === module) {
    main();
}
