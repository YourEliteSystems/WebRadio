"use strict";

/**
 * WebRadio – Linux Arch Package Builder
 *
 * Ablauf:
 *   1) Voraussetzungen prüfen (makepkg, fakeroot, AppImage vorhanden).
 *   2) SHA256-Hashes der Quelldateien berechnen.
 *   3) PKGBUILD-Template mit aktuellen Werten aus package.json rendern.
 *   4) Optional: makepkg in einem Arch-Container aufrufen.
 *
 * Standard-Verwendung:
 *   npm run make:linux:appimage   # baut das AppImage (electron-builder)
 *   npm run make:linux:arch       # verpackt es als .pkg.tar.zst
 *   npm run make:linux            # beides hintereinander
 *
 * Aufrufparameter (CLI):
 *   --appimage=<pfad>      Pfad zum AppImage (Default: dist/WebRadio-*-linux-x86_64.AppImage)
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

function findAppImage(explicit) {
    if (explicit && fs.existsSync(explicit)) {
        return explicit;
    }
    const distDir = path.join(ROOT, "dist");
    if (!fs.existsSync(distDir)) {
        return null;
    }
    const candidates = fs
        .readdirSync(distDir)
        .filter(
            (n) =>
                n.toLowerCase().endsWith(".appimage") &&
                (n.includes("linux") || n.includes("x64") || n.includes("x86_64"))
        )
        .sort();
    if (candidates.length === 0) return null;
    return path.join(distDir, candidates[candidates.length - 1]);
}

function sha256(filePath) {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(buf).digest("hex");
}

function renderPkgbuild(template, ctx) {
    return template
        .replace(/__PKGVER__/g, ctx.pkgver)
        .replace(/__APPIMAGE_PATH__/g, ctx.appimage)
        .replace(/__DESKTOP_PATH__/g, ctx.desktop)
        .replace(/__ICON_PATH__/g, ctx.icon)
        .replace(/__APPIMAGE_SHA256__/g, ctx.appimageSha)
        .replace(/__DESKTOP_SHA256__/g, ctx.desktopSha)
        .replace(/__ICON_SHA256__/g, ctx.iconSha);
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
    const pkgver = loadPkgVersion();
    const appimage = findAppImage(args.appimage);

    if (!appimage) {
        console.error(
            "❌ Kein AppImage gefunden. Bitte zuerst `npm run make:linux:appimage` ausführen."
        );
        process.exit(1);
    }

    console.log(`📦 WebRadio v${pkgver}`);
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

    // Symlinks auf Quelldateien, damit PKGBUILD `file://...` nutzen kann.
    const appimageName = `webradio-${pkgver}.AppImage`;
    const linkAppimage = path.join(workDir, appimageName);
    const linkDesktop = path.join(workDir, "webradio.desktop");
    const linkIcon = path.join(workDir, "tray.png");

    for (const [target, src] of [
        [linkAppimage, appimage],
        [linkDesktop, DESKTOP_FILE],
        [linkIcon, ICON_FILE],
    ]) {
        try {
            fs.unlinkSync(target);
        } catch {
            /* ignore */
        }
        fs.copyFileSync(src, target);
        fs.chmodSync(target, 0o644);
    }

    const ctx = {
        pkgver,
        appimage: `./${appimageName}`,
        desktop: `./webradio.desktop`,
        icon: `./tray.png`,
        appimageSha: sha256(appimage),
        desktopSha: sha256(DESKTOP_FILE),
        iconSha: sha256(ICON_FILE),
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

main();
