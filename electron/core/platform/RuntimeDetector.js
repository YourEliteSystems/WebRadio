"use strict";

/**
 * RuntimeDetector.js
 *
 * Zentrale Runtime- und Packaging-Erkennung für WebRadio.
 *
 * Aufgaben:
 *  - Erkennung des aktuellen Betriebssystems (Windows/Linux/macOS)
 *  - Erkennung der CPU-Architektur (x64/arm64/arm/ia32)
 *  - Erkennung des Packaging-Typs (Development/AppImage/deb/Arch/Installer/Portable)
 *  - Robuste AppImage-Erkennung über mehrere Runtime-Signale
 *  - Bereitstellung von Helper-Booleans für einfache Abfragen
 *
 * Designprinzipien:
 *  - Reine Funktion, keine Seiteneffekte
 *  - Keine I/O außer notwendigen Pfad-Prüfungen
 *  - Keine Annahmen – bei Unsicherheit 'unknown' zurückgeben
 *  - Testbar durch Dependency Injection (app, process, fs, path)
 */

/**
 * Normalisiert process.platform auf konsistente Werte.
 */
function normalizePlatform(platform) {
    if (!platform || typeof platform !== "string") return "unknown";
    const p = platform.toLowerCase();
    if (p === "win32") return "windows";
    if (p === "linux") return "linux";
    if (p === "darwin") return "macos";
    return "unknown";
}

/**
 * Normalisiert process.arch auf konsistente Werte.
 */
function normalizeArchitecture(arch) {
    if (!arch || typeof arch !== "string") return "unknown";
    const a = arch.toLowerCase();
    if (a === "x64" || a === "x86_64" || a === "amd64") return "x64";
    if (a === "arm64" || a === "aarch64") return "arm64";
    if (a === "arm") return "arm";
    if (a === "ia32" || a === "x86") return "ia32";
    return "unknown";
}

/**
 * Prüft, ob die Anwendung im Development-Modus läuft.
 */
function detectDevelopment(app) {
    if (!app) return true;
    // app.isPackaged ist false in Development
    return !app.isPackaged;
}

/**
 * Prüft, ob die Anwendung gepackt ist.
 */
function detectPackaged(app) {
    if (!app) return false;
    return !!app.isPackaged;
}

/**
 * Robuste AppImage-Erkennung.
 *
 * Prüft mehrere Runtime-Signale:
 * 1. APPIMAGE Umgebungsvariable (gesetzt vom AppImage-Runtime)
 * 2. process.env.APPIMAGE (Pfad zur AppImage-Datei)
 * 3. Executable-Path enthält typische AppImage-Muster
 * 4. Resources-Path enthält AppImage-Muster
 */
function detectAppImage(app, processObj, fsObj, pathObj) {
    if (!app || !processObj) return false;

    const platform = normalizePlatform(processObj.platform);
    if (platform !== "linux") return false;

    // Signal 1: APPIMAGE Umgebungsvariable
    const appImageEnv = processObj.env.APPIMAGE;
    if (appImageEnv && typeof appImageEnv === "string" && appImageEnv.length > 0) {
        // Prüfen ob die Datei tatsächlich existiert
        try {
            if (fsObj.existsSync(appImageEnv)) {
                return true;
            }
        } catch {
            // ignore
        }
    }

    // Signal 2: Executable-Path Analyse
    try {
        const execPath = app.getAppPath ? app.getAppPath() : processObj.execPath;
        if (execPath && typeof execPath === "string") {
            // AppImage executables sind oft gemountet unter /tmp/.mount_*
            if (execPath.includes(".mount_") || execPath.includes("/tmp/")) {
                return true;
            }
        }
    } catch {
        // ignore
    }

    // Signal 3: Resources-Path Analyse
    try {
        const resourcesPath = app.getPath ? app.getPath("exe") : processObj.resourcesPath;
        if (resourcesPath && typeof resourcesPath === "string") {
            // AppImage resources sind oft unter /tmp/.mount_*/usr/bin
            if (resourcesPath.includes(".mount_") || resourcesPath.includes("/tmp/")) {
                return true;
            }
        }
    } catch {
        // ignore
    }

    return false;
}

/**
 * Erkennung des Linux-Packaging-Typs.
 *
 * Unterscheidet zwischen:
 * - AppImage (über robuste Erkennung)
 * - deb (über dpkg-Prüfung oder Pfad-Muster)
 * - arch (über pacman-Prüfung oder Pfad-Muster)
 * - development (nicht gepackt)
 * - unknown (keine eindeutige Erkennung möglich)
 */
function detectLinuxPackaging(app, processObj, fsObj, pathObj) {
    if (!app) return "unknown";

    const isDev = detectDevelopment(app);
    if (isDev) return "development";

    const isAppImage = detectAppImage(app, processObj, fsObj, pathObj);
    if (isAppImage) return "appimage";

    // deb Erkennung
    try {
        const execPath = app.getAppPath ? app.getAppPath() : processObj.execPath;
        if (execPath && typeof execPath === "string") {
            // deb-Pakete installieren typischerweise unter /opt/ oder /usr/
            if (execPath.startsWith("/opt/") || execPath.startsWith("/usr/")) {
                // Zusätzliche Prüfung: dpkg-query
                try {
                    const dpkgCheck = processObj.platform === "linux" && 
                        fsObj.existsSync("/usr/bin/dpkg-query");
                    if (dpkgCheck) {
                        return "deb";
                    }
                } catch {
                    // ignore
                }
                // Fallback auf Pfad-Muster
                if (execPath.includes("/opt/webradio") || execPath.includes("/usr/webradio")) {
                    return "deb";
                }
            }
        }
    } catch {
        // ignore
    }

    // Arch Erkennung
    try {
        const execPath = app.getAppPath ? app.getAppPath() : processObj.execPath;
        if (execPath && typeof execPath === "string") {
            // Arch-Pakete installieren unter /opt/webradio oder /usr/
            if (execPath.includes("/opt/webradio")) {
                // Zusätzliche Prüfung: pacman
                try {
                    const pacmanCheck = processObj.platform === "linux" && 
                        fsObj.existsSync("/usr/bin/pacman");
                    if (pacmanCheck) {
                        return "arch";
                    }
                } catch {
                    // ignore
                }
                // Fallback auf Pfad-Muster
                return "arch";
            }
        }
    } catch {
        // ignore
    }

    return "unknown";
}

/**
 * Erkennung des Windows-Packaging-Typs.
 *
 * Unterscheidet zwischen:
 * - windows-installer (NSIS)
 * - windows-portable
 * - development
 * - unknown
 */
function detectWindowsPackaging(app, processObj) {
    if (!app) return "unknown";

    const isDev = detectDevelopment(app);
    if (isDev) return "development";

    try {
        const execPath = app.getAppPath ? app.getAppPath() : processObj.execPath;
        if (execPath && typeof execPath === "string") {
            // Prüfen ob es überhaupt ein Windows-Pfad ist
            if (!execPath.includes(":") && !execPath.startsWith("\\")) {
                // Unix-style path auf Windows -> unknown
                return "unknown";
            }
            // Portable Builds sind typischerweise einzelne .exe ohne Installationspfad
            // NSIS-Installer installieren unter Program Files
            const programFiles = processObj.env.ProgramFiles || processObj.env["PROGRAMFILES(X86)"];
            if (programFiles && execPath.toLowerCase().startsWith(programFiles.toLowerCase())) {
                return "windows-installer";
            }
            // Portable Builds oft im Benutzer-Verzeichnis oder direkt aus einem Ordner
            if (!execPath.includes("Program Files") && !execPath.includes("Program Files (x86)")) {
                return "windows-portable";
            }
        }
    } catch {
        // ignore
    }

    return "unknown";
}

/**
 * Hauptfunktion: Erkennt den Packaging-Typ basierend auf Platform.
 */
function detectPackaging(app, processObj, fsObj, pathObj) {
    const platform = normalizePlatform(processObj ? processObj.platform : null);

    switch (platform) {
        case "linux":
            return detectLinuxPackaging(app, processObj, fsObj, pathObj);
        case "windows":
            return detectWindowsPackaging(app, processObj);
        case "macos": {
            const isDev = detectDevelopment(app);
            return isDev ? "development" : "macos";
        }
        default:
            return "unknown";
    }
}

/**
 * Hauptfunktion: Liefert das vollständige Runtime-Info-Objekt.
 */
function detectRuntime(app, processObj, fsObj, pathObj) {
    const platform = normalizePlatform(processObj ? processObj.platform : null);
    const architecture = normalizeArchitecture(processObj ? processObj.arch : null);
    const isDev = detectDevelopment(app);
    const isPackaged = detectPackaged(app);
    const packaging = detectPackaging(app, processObj, fsObj, pathObj);
    const isAppImage = packaging === "appimage";

    return {
        platform,
        architecture,
        packaging,
        isDevelopment: isDev,
        isPackaged,
        isAppImage,
        isLinux: platform === "linux",
        isWindows: platform === "windows",
        isMacOS: platform === "macos"
    };
}

module.exports = {
    detectRuntime,
    detectPackaging,
    detectAppImage,
    detectLinuxPackaging,
    detectWindowsPackaging,
    normalizePlatform,
    normalizeArchitecture,
    detectDevelopment,
    detectPackaged
};
