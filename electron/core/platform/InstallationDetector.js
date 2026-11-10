"use strict";

/**
 * InstallationDetector.js
 *
 * Erkennt, WIE und WO WebRadio installiert ist.
 *
 * Unterscheidet ausdrücklich:
 *  - Installationspfad (installPath)
 *  - Ausführungspfad (executionPath)
 *  - Pfad der ausführbaren Datei (executablePath)
 *  - Anwendungsverzeichnis (appDirectory)
 *  - Benutzerbezogenes Datenverzeichnis (userDataPath)
 *  - Update-/Temporär-/Backup-Verzeichnis
 *
 * Grundregeln:
 *  - Eine unbekannte Installationsquelle wird NICHT durch eine Vermutung
 *    ersetzt. Sie bleibt "unknown".
 *  - Ein erkannter Pfad bedeutet nicht automatisch Schreibrechte.
 *  - Vertrauensstufen: DETECTED / VERIFIED / UNKNOWN / UNSUPPORTED.
 *
 * Alle Prüfungen sind über Dependency Injection testbar.
 */

const defaultFs = require("fs");
const defaultPath = require("path");
const defaultOs = require("os");

const SystemDetector = require("./SystemDetector");
const RuntimeDetector = require("./RuntimeDetector");

const TRUST = SystemDetector.TRUST;

/** Unterstützte Installationsarten. */
const KINDS = Object.freeze({
    WINDOWS_EXE: "windows-exe",
    WINDOWS_MSI: "windows-msi",
    WINDOWS_PORTABLE: "windows-portable",
    LINUX_APPIMAGE: "linux-appimage",
    LINUX_DEB: "linux-deb",
    LINUX_RPM: "linux-rpm",
    LINUX_ARCH: "linux-arch",
    LINUX_PORTABLE: "linux-portable",
    MACOS_DMG: "macos-dmg",
    MACOS_PKG: "macos-pkg",
    MACOS_ZIP: "macos-zip",
    DEVELOPMENT: "development",
    UNKNOWN: "unknown"
});

/** Installationsquellen. */
const SOURCES = Object.freeze({
    INSTALLER: "installer",
    PACKAGE_MANAGER: "package-manager",
    APPIMAGE: "appimage",
    PORTABLE: "portable",
    MANUAL: "manual",
    UNKNOWN: "unknown"
});

const FORMAT_BY_KIND = Object.freeze({
    [KINDS.WINDOWS_EXE]: "nsis",
    [KINDS.WINDOWS_MSI]: "msi",
    [KINDS.WINDOWS_PORTABLE]: "portable",
    [KINDS.LINUX_APPIMAGE]: "appimage",
    [KINDS.LINUX_DEB]: "deb",
    [KINDS.LINUX_RPM]: "rpm",
    [KINDS.LINUX_ARCH]: "arch",
    [KINDS.LINUX_PORTABLE]: "portable",
    [KINDS.MACOS_DMG]: "dmg",
    [KINDS.MACOS_PKG]: "pkg",
    [KINDS.MACOS_ZIP]: "zip",
    [KINDS.DEVELOPMENT]: "development",
    [KINDS.UNKNOWN]: "unknown"
});

const ALLOWED_KINDS = new Set(Object.values(KINDS));
const ALLOWED_SOURCES = new Set(Object.values(SOURCES));

/** Systemverwaltete Installationsorte, die nie überschrieben werden dürfen. */
const SYSTEM_INSTALL_ROOTS = Object.freeze([
    "/opt/webradio",
    "/opt/WebRadio",
    "/usr/lib/webradio",
    "/usr/lib/WebRadio",
    "/usr/share/webradio",
    "/usr/share/WebRadio"
]);

const PACKAGE_NAMES = Object.freeze(["webradio"]);

/**
 * Erkennt den Paketmanager anhand generischer Linux-Signale.
 *
 * Wird verwendet, wenn die Distributionsfamilie aus /etc/os-release
 * nicht bestimmbar ist (z. B. unbekannte oder abgeleitete Distribution).
 * Damit fällt die Erkennung auf generische Linux-Funktionen zurück,
 * statt eine Familie zu raten.
 *
 * @param {object} fsModule
 * @returns {string|null} "pacman" | "apt" | "dnf" | "zypper" | null
 */
function detectLinuxPackageManager(fsModule = defaultFs) {
    const exists = (target) => {
        try {
            return typeof fsModule.existsSync === "function" && !!fsModule.existsSync(target);
        } catch {
            return false;
        }
    };

    if (exists("/usr/bin/pacman") || exists("/etc/arch-release") || exists("/var/lib/pacman/local")) {
        return "pacman";
    }
    if (exists("/usr/bin/dpkg") || exists("/usr/bin/dpkg-query") || exists("/etc/debian_version") || exists("/var/lib/dpkg/status")) {
        return "apt";
    }
    if (exists("/usr/bin/zypper")) {
        return "zypper";
    }
    if (exists("/usr/bin/dnf") || exists("/usr/bin/rpm")) {
        return "dnf";
    }
    return null;
}

/**
 * Bildet einen erkannten Paketmanager auf eine Distributionsfamilie ab.
 */
function familyFromPackageManager(packageManager) {
    if (packageManager === "pacman") return "arch";
    if (packageManager === "apt") return "debian";
    if (packageManager === "dnf") return "fedora";
    if (packageManager === "zypper") return "suse";
    return "unknown";
}

/**
 * Liest eine optionale Installationsmarker-Datei.
 * Packager können damit die Installationsart explizit deklarieren,
 * statt sie erraten zu lassen.
 *
 * @param {object} options
 * @returns {{ kind: string, source: string, path: string }|null}
 */
function readInstallMarker({ fsModule = defaultFs, pathModule = defaultPath, candidates = [] } = {}) {
    for (const candidate of candidates) {
        if (!candidate) continue;
        try {
            if (typeof fsModule.existsSync === "function" && !fsModule.existsSync(candidate)) {
                continue;
            }
            const readFn = fsModule.readFileSync
                ? fsModule.readFileSync.bind(fsModule)
                : defaultFs.readFileSync.bind(defaultFs);
            const raw = JSON.parse(readFn(candidate, "utf8"));
            if (!raw || typeof raw !== "object") continue;

            const kind = typeof raw.kind === "string" ? raw.kind : null;
            const source = typeof raw.source === "string" ? raw.source : SOURCES.UNKNOWN;

            if (!kind || !ALLOWED_KINDS.has(kind)) continue;
            if (!ALLOWED_SOURCES.has(source)) continue;

            return { kind, source, path: candidate };
        } catch {
            // Datei fehlt/ungültig -> nächster Kandidat
        }
    }
    return null;
}

/**
 * Prüft, ob ein Verzeichnis für den aktuellen Benutzer beschreibbar ist.
 *
 * @param {string|null} directory
 * @param {object} fsModule
 * @returns {{ writable: boolean|null, status: string }}
 */
function checkWriteAccess(directory, fsModule = defaultFs) {
    if (!directory || typeof directory !== "string") {
        return { writable: null, status: TRUST.UNKNOWN };
    }

    try {
        if (typeof fsModule.accessSync !== "function") {
            return { writable: null, status: TRUST.UNKNOWN };
        }
        const writeFlag = fsModule.constants && fsModule.constants.W_OK !== undefined
            ? fsModule.constants.W_OK
            : 2;
        fsModule.accessSync(directory, writeFlag);
        return { writable: true, status: TRUST.VERIFIED };
    } catch {
        return { writable: false, status: TRUST.DETECTED };
    }
}

/**
 * Normalisiert einen Pfad und löst symbolische Links auf, sofern möglich.
 *
 * @param {string|null} inputPath
 * @param {object} fsModule
 * @returns {string|null}
 */
function resolveRealPath(inputPath, fsModule = defaultFs) {
    if (!inputPath || typeof inputPath !== "string") return null;
    try {
        if (typeof fsModule.lstatSync === "function" && typeof fsModule.realpathSync === "function") {
            const stat = fsModule.lstatSync(inputPath);
            if (stat && typeof stat.isSymbolicLink === "function" && stat.isSymbolicLink()) {
                return fsModule.realpathSync(inputPath);
            }
        }
    } catch {
        // Pfad nicht auflösbar -> unverändert zurückgeben
    }
    return inputPath;
}

/**
 * Ermittelt Installationsart unter Windows.
 */
function detectWindowsKind({ processObj = {}, execPath, marker }) {
    if (marker) {
        return {
            kind: marker.kind,
            source: marker.source,
            status: TRUST.VERIFIED,
            evidence: `Installationsmarker: ${marker.path}`
        };
    }

    const env = (processObj && processObj.env) || {};

    // electron-builder setzt diese Variable für Portable-Builds.
    if (typeof env.PORTABLE_EXECUTABLE_DIR === "string" && env.PORTABLE_EXECUTABLE_DIR.length > 0) {
        return {
            kind: KINDS.WINDOWS_PORTABLE,
            source: SOURCES.PORTABLE,
            status: TRUST.VERIFIED,
            evidence: "PORTABLE_EXECUTABLE_DIR gesetzt"
        };
    }

    // Explizite Deklaration durch den Installer.
    if (typeof env.WEBRADIO_INSTALLER === "string") {
        const declared = env.WEBRADIO_INSTALLER.toLowerCase();
        if (declared === "msi") {
            return {
                kind: KINDS.WINDOWS_MSI,
                source: SOURCES.INSTALLER,
                status: TRUST.VERIFIED,
                evidence: "WEBRADIO_INSTALLER=msi"
            };
        }
        if (declared === "nsis" || declared === "exe") {
            return {
                kind: KINDS.WINDOWS_EXE,
                source: SOURCES.INSTALLER,
                status: TRUST.VERIFIED,
                evidence: "WEBRADIO_INSTALLER=nsis"
            };
        }
    }

    if (!execPath || !/^[a-zA-Z]:[\\/]/.test(execPath)) {
        return {
            kind: KINDS.UNKNOWN,
            source: SOURCES.UNKNOWN,
            status: TRUST.UNKNOWN,
            evidence: "Kein gültiger Windows-Ausführungspfad"
        };
    }

    const lowered = execPath.toLowerCase().replace(/\//g, "\\");
    const programDirs = [env.ProgramFiles, env["ProgramFiles(x86)"], env.ProgramW6432]
        .filter((value) => typeof value === "string" && value.length > 0)
        .map((value) => value.toLowerCase().replace(/\//g, "\\"));

    const localPrograms = typeof env.LOCALAPPDATA === "string"
        ? `${env.LOCALAPPDATA.toLowerCase().replace(/\//g, "\\")}\\programs`
        : null;

    const insideProgramDir = programDirs.some((dir) => lowered.startsWith(dir)) ||
        (localPrograms !== null && lowered.startsWith(localPrograms));

    if (insideProgramDir) {
        return {
            kind: KINDS.WINDOWS_EXE,
            source: SOURCES.INSTALLER,
            status: TRUST.DETECTED,
            evidence: "Ausführung aus einem Windows-Programmverzeichnis (NSIS/EXE)"
        };
    }

    return {
        kind: KINDS.WINDOWS_PORTABLE,
        source: SOURCES.PORTABLE,
        status: TRUST.DETECTED,
        evidence: "Ausführung außerhalb der Programmverzeichnisse"
    };
}

/**
 * Prüft, ob ein Paket in der Debian-Datenbank registriert ist.
 */
function hasDebianPackage(fsModule = defaultFs) {
    try {
        if (typeof fsModule.readFileSync !== "function") return false;
        const status = String(fsModule.readFileSync("/var/lib/dpkg/status", "utf8"));
        return PACKAGE_NAMES.some((name) =>
            new RegExp(`^Package:\\s*${name}$`, "m").test(status)
        );
    } catch {
        return false;
    }
}

/**
 * Prüft, ob ein Paket in der pacman-Datenbank registriert ist.
 */
function hasArchPackage(fsModule = defaultFs) {
    try {
        if (typeof fsModule.readdirSync !== "function") return false;
        const entries = fsModule.readdirSync("/var/lib/pacman/local");
        return entries.some((entry) =>
            PACKAGE_NAMES.some((name) => typeof entry === "string" && entry.startsWith(`${name}-`))
        );
    } catch {
        return false;
    }
}

/**
 * Ermittelt Installationsart unter Linux.
 */
function detectLinuxKind({ app, processObj = {}, execPath, appPath, fsModule = defaultFs, pathModule = defaultPath, distribution, marker }) {
    const env = (processObj && processObj.env) || {};

    // 1. AppImage: APPIMAGE-Variable des AppImage-Runtimes (stärkstes Signal)
    const appImagePath = typeof env.APPIMAGE === "string" ? env.APPIMAGE : null;
    if (appImagePath && appImagePath.length > 0) {
        let exists = false;
        try {
            exists = typeof fsModule.existsSync === "function" && fsModule.existsSync(appImagePath);
        } catch {
            exists = false;
        }
        if (exists) {
            return {
                kind: KINDS.LINUX_APPIMAGE,
                source: SOURCES.APPIMAGE,
                status: TRUST.VERIFIED,
                evidence: "APPIMAGE gesetzt und Datei vorhanden",
                appImagePath
            };
        }
        return {
            kind: KINDS.LINUX_APPIMAGE,
            source: SOURCES.APPIMAGE,
            status: TRUST.DETECTED,
            evidence: "APPIMAGE gesetzt, Datei nicht verifizierbar",
            appImagePath
        };
    }

    // 2. AppImage-Mountpfade (Runtime gemountet, ohne APPIMAGE-Variable)
    const appImageMount = [appPath, execPath].find((value) =>
        typeof value === "string" && (value.includes(".mount_") || value.startsWith("/tmp/appimage_"))
    );
    if (appImageMount) {
        return {
            kind: KINDS.LINUX_APPIMAGE,
            source: SOURCES.APPIMAGE,
            status: TRUST.DETECTED,
            evidence: "Ausführung aus einem AppImage-Mountpfad"
        };
    }

    // 3. Explizite Deklaration durch den Packager
    if (marker) {
        return {
            kind: marker.kind,
            source: marker.source,
            status: TRUST.VERIFIED,
            evidence: `Installationsmarker: ${marker.path}`
        };
    }

    const candidates = [appPath, execPath].filter((value) => typeof value === "string");
    const systemRoot = SYSTEM_INSTALL_ROOTS.find((root) =>
        candidates.some((value) => value === root || value.startsWith(`${root}/`))
    );

    if (systemRoot) {
        // Primär die os-release-Familie, sonst generische Paketmanager-Signale.
        const evidencePackageManager = detectLinuxPackageManager(fsModule);
        const family = distribution && distribution.family !== "unknown"
            ? distribution.family
            : familyFromPackageManager(evidencePackageManager);

        if (family === "arch") {
            const verified = hasArchPackage(fsModule);
            return {
                kind: KINDS.LINUX_ARCH,
                source: SOURCES.PACKAGE_MANAGER,
                status: verified ? TRUST.VERIFIED : TRUST.DETECTED,
                evidence: verified
                    ? "pacman-Datenbank enthält webradio"
                    : "Systempfad + Arch-Familie (paketverwaltet angenommen)"
            };
        }

        if (family === "debian") {
            const verified = hasDebianPackage(fsModule);
            return {
                kind: KINDS.LINUX_DEB,
                source: SOURCES.PACKAGE_MANAGER,
                status: verified ? TRUST.VERIFIED : TRUST.DETECTED,
                evidence: verified
                    ? "dpkg-Status enthält webradio"
                    : "Systempfad + Debian-Familie (paketverwaltet angenommen)"
            };
        }

        if (family === "fedora" || family === "rhel" || family === "suse") {
            return {
                kind: KINDS.LINUX_RPM,
                source: SOURCES.PACKAGE_MANAGER,
                status: TRUST.DETECTED,
                evidence: `Systempfad + RPM-Familie (${family})`
            };
        }

        return {
            kind: KINDS.UNKNOWN,
            source: SOURCES.UNKNOWN,
            status: TRUST.UNKNOWN,
            evidence: "Systempfad, aber Distributionsfamilie nicht bestimmbar"
        };
    }

    // 4. Benutzerverzeichnis: Portable-Entpackung oder manuelle Installation
    const baseDir = execPath ? pathModule.dirname(execPath) : null;
    if (baseDir) {
        let looksPortable = false;
        try {
            looksPortable = typeof fsModule.existsSync === "function" &&
                (fsModule.existsSync(pathModule.join(baseDir, "resources", "app.asar")) ||
                    fsModule.existsSync(pathModule.join(baseDir, "resources")));
        } catch {
            looksPortable = false;
        }

        const access = checkWriteAccess(baseDir, fsModule);

        if (looksPortable) {
            return {
                kind: KINDS.LINUX_PORTABLE,
                source: SOURCES.PORTABLE,
                status: access.writable === true ? TRUST.DETECTED : TRUST.UNKNOWN,
                evidence: access.writable === true
                    ? "Entpackte Anwendung im Benutzerverzeichnis"
                    : "Entpackte Anwendung, Schreibrechte nicht bestätigt"
            };
        }

        return {
            kind: KINDS.UNKNOWN,
            source: SOURCES.MANUAL,
            status: TRUST.UNKNOWN,
            evidence: "Benutzerverzeichnis ohne erkennbare Portable-Struktur"
        };
    }

    return {
        kind: KINDS.UNKNOWN,
        source: SOURCES.UNKNOWN,
        status: TRUST.UNKNOWN,
        evidence: "Kein Ausführungspfad ermittelbar"
    };
}

/**
 * Ermittelt Installationsart unter macOS.
 */
function detectMacosKind({ execPath, fsModule = defaultFs, marker }) {
    if (marker) {
        return {
            kind: marker.kind,
            source: marker.source,
            status: TRUST.VERIFIED,
            evidence: `Installationsmarker: ${marker.path}`
        };
    }

    if (typeof execPath !== "string" || execPath.length === 0) {
        return {
            kind: KINDS.UNKNOWN,
            source: SOURCES.UNKNOWN,
            status: TRUST.UNKNOWN,
            evidence: "Kein Ausführungspfad ermittelbar"
        };
    }

    // PKG-Installation über Paket-Receipts (starkes Signal)
    let hasReceipt = false;
    try {
        if (typeof fsModule.readdirSync === "function") {
            const receipts = fsModule.readdirSync("/var/db/receipts");
            hasReceipt = Array.isArray(receipts) && receipts.some((entry) =>
                typeof entry === "string" && entry.toLowerCase().includes("webradio")
            );
        }
    } catch {
        hasReceipt = false;
    }

    // Direkt aus einem gemounteten DMG gestartet
    if (execPath.startsWith("/Volumes/")) {
        return {
            kind: KINDS.MACOS_DMG,
            source: SOURCES.INSTALLER,
            status: TRUST.VERIFIED,
            evidence: "Ausführung aus einem gemounteten DMG-Volume"
        };
    }

    if (hasReceipt) {
        return {
            kind: KINDS.MACOS_PKG,
            source: SOURCES.INSTALLER,
            status: TRUST.VERIFIED,
            evidence: "PKG-Receipt vorhanden"
        };
    }

    const bundleMatch = execPath.match(/^(.*\.app)\/Contents\/MacOS\//);
    if (bundleMatch) {
        const bundlePath = bundleMatch[1];
        if (bundlePath.startsWith("/Applications/")) {
            // Konventioneller Drag-and-Drop-Ort. Die Quelle (DMG oder ZIP)
            // ist daraus NICHT eindeutig ableitbar und bleibt "unknown".
            return {
                kind: KINDS.MACOS_DMG,
                source: SOURCES.UNKNOWN,
                status: TRUST.DETECTED,
                evidence: "App-Bundle unter /Applications (Quelle nicht eindeutig)"
            };
        }
        return {
            kind: KINDS.MACOS_ZIP,
            source: SOURCES.PORTABLE,
            status: TRUST.DETECTED,
            evidence: "App-Bundle außerhalb von /Applications (entpackt/portable)"
        };
    }

    return {
        kind: KINDS.UNKNOWN,
        source: SOURCES.MANUAL,
        status: TRUST.UNKNOWN,
        evidence: "Kein App-Bundle erkennbar"
    };
}

/**
 * Berechnet alle relevanten Pfade.
 */
function buildPaths({ platform, kind, execPath, appPath, appImagePath, app, processObj, pathModule, fsModule }) {
    const safeAppPath = (key) => {
        try {
            if (app && typeof app.getPath === "function") {
                const value = app.getPath(key);
                return typeof value === "string" && value.length > 0 ? value : null;
            }
        } catch {
            // ignore
        }
        return null;
    };

    const homeDir = (processObj && processObj.env && processObj.env.HOME) ||
        (processObj && processObj.env && processObj.env.USERPROFILE) || null;

    const userDataPath = safeAppPath("userData") ||
        (homeDir
            ? pathModule.join(
                homeDir,
                platform === "windows" ? "AppData" : (platform === "macos" ? "Library" : ".config"),
                "WebRadio"
            )
            : null);

    const tempPath = safeAppPath("temp") ||
        (() => {
            try {
                return defaultOs.tmpdir();
            } catch {
                return null;
            }
        })();

    let installPath = null;
    if (kind === KINDS.LINUX_APPIMAGE && appImagePath) {
        installPath = pathModule.dirname(resolveRealPath(appImagePath, fsModule) || appImagePath);
    } else if (kind === KINDS.MACOS_DMG || kind === KINDS.MACOS_PKG || kind === KINDS.MACOS_ZIP) {
        const bundleMatch = typeof execPath === "string"
            ? execPath.match(/^(.*\.app)\/Contents\/MacOS\//)
            : null;
        installPath = bundleMatch ? bundleMatch[1] : (execPath ? pathModule.dirname(execPath) : null);
    } else if (kind === KINDS.DEVELOPMENT) {
        installPath = appPath || (execPath ? pathModule.dirname(execPath) : null);
    } else {
        installPath = execPath ? pathModule.dirname(execPath) : appPath || null;
    }

    const updatePath = userDataPath ? pathModule.join(userDataPath, "updates") : null;

    return {
        installPath,
        executionPath: execPath || null,
        executablePath: execPath || null,
        appDirectory: appPath || installPath,
        userDataPath,
        updatePath,
        stagingPath: updatePath ? pathModule.join(updatePath, "staging") : null,
        backupPath: updatePath ? pathModule.join(updatePath, "backups") : null,
        tempPath
    };
}

/**
 * Hauptfunktion: erkennt Installationsart, Quelle, Pfade und Berechtigungen.
 *
 * @param {object} options
 * @returns {object} JSON-serialisierbares Installationsprofil
 */
function detect(options = {}) {
    const fsModule = options.fsModule || defaultFs;
    const pathModule = options.pathModule || defaultPath;
    const processObj = options.processObj || process;

    const system = options.system || SystemDetector.detect({
        processObj,
        fsModule,
        app: options.app
    });

    const platform = system && system.os ? system.os.name : RuntimeDetector.normalizePlatform(processObj.platform);
    const distribution = system && system.linux ? system.linux.distribution : null;

    let execPath = options.execPath || null;
    if (!execPath) {
        try {
            execPath = (options.app && typeof options.app.getPath === "function" && options.app.getPath("exe")) ||
                (processObj && processObj.execPath) || null;
        } catch {
            execPath = (processObj && processObj.execPath) || null;
        }
    }

    let appPath = options.appPath || null;
    if (!appPath) {
        try {
            appPath = (options.app && typeof options.app.getAppPath === "function" && options.app.getAppPath()) || null;
        } catch {
            appPath = null;
        }
    }

    const resolvedExecPath = resolveRealPath(execPath, fsModule);

    // Marker-Dateien: nur lesen, wenn sie tatsächlich existieren.
    const markerCandidates = [
        options.resourcesPath
            ? pathModule.join(options.resourcesPath, "install-source.json")
            : null,
        resolvedExecPath ? pathModule.join(pathModule.dirname(resolvedExecPath), "resources", "install-source.json") : null,
        appPath ? pathModule.join(appPath, "install-source.json") : null
    ].filter(Boolean);

    const marker = readInstallMarker({ fsModule, pathModule, candidates: markerCandidates });

    const isDevelopment = !!(system && system.capabilities && system.capabilities.isDevelopment);

    let detected;
    if (isDevelopment) {
        detected = {
            kind: KINDS.DEVELOPMENT,
            source: SOURCES.MANUAL,
            status: TRUST.DETECTED,
            evidence: "Ungepackte Anwendung (Entwicklungsmodus)"
        };
    } else if (platform === "windows") {
        detected = detectWindowsKind({ processObj, execPath: resolvedExecPath, marker });
    } else if (platform === "linux") {
        detected = detectLinuxKind({
            app: options.app,
            processObj,
            execPath: resolvedExecPath,
            appPath,
            fsModule,
            pathModule,
            distribution,
            marker
        });
    } else if (platform === "macos") {
        detected = detectMacosKind({ execPath: resolvedExecPath, fsModule, marker });
    } else {
        detected = {
            kind: KINDS.UNKNOWN,
            source: SOURCES.UNKNOWN,
            status: TRUST.UNKNOWN,
            evidence: "Plattform nicht unterstützt"
        };
    }

    const paths = buildPaths({
        platform,
        kind: detected.kind,
        execPath: resolvedExecPath,
        appPath,
        appImagePath: detected.appImagePath || null,
        app: options.app,
        processObj,
        pathModule,
        fsModule
    });

    const installDirAccess = checkWriteAccess(paths.installPath, fsModule);
    const executableAccess = checkWriteAccess(paths.executablePath, fsModule);

    const systemManaged = detected.source === SOURCES.PACKAGE_MANAGER ||
        (detected.kind !== KINDS.DEVELOPMENT && detected.kind !== KINDS.UNKNOWN &&
            detected.kind !== KINDS.LINUX_APPIMAGE && detected.kind !== KINDS.LINUX_PORTABLE &&
            (detected.kind === KINDS.LINUX_DEB || detected.kind === KINDS.LINUX_RPM || detected.kind === KINDS.LINUX_ARCH));

    const elevationRequired = installDirAccess.writable === false &&
        (systemManaged || detected.kind === KINDS.WINDOWS_EXE || detected.kind === KINDS.WINDOWS_MSI);

    const sourceStatus = detected.source === SOURCES.UNKNOWN
        ? TRUST.UNKNOWN
        : detected.status;

    return {
        status: detected.status,
        kind: detected.kind,
        format: FORMAT_BY_KIND[detected.kind] || "unknown",
        source: detected.source,
        sourceStatus,
        trust: {
            kind: detected.status,
            source: sourceStatus,
            paths: paths.installPath ? TRUST.DETECTED : TRUST.UNKNOWN,
            permissions: installDirAccess.status
        },
        systemManaged: !!systemManaged,
        paths,
        permissions: {
            installDirectoryWritable: installDirAccess.writable,
            executableWritable: executableAccess.writable,
            elevationRequired: !!elevationRequired,
            status: installDirAccess.status
        },
        evidence: detected.evidence || null,
        detectedAt: new Date().toISOString()
    };
}

module.exports = {
    TRUST,
    KINDS,
    SOURCES,
    FORMAT_BY_KIND,
    SYSTEM_INSTALL_ROOTS,
    readInstallMarker,
    checkWriteAccess,
    resolveRealPath,
    detectWindowsKind,
    detectLinuxKind,
    detectMacosKind,
    detectLinuxPackageManager,
    familyFromPackageManager,
    buildPaths,
    detect
};
