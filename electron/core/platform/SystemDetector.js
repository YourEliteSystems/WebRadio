"use strict";

/**
 * SystemDetector.js
 *
 * Zentrale Erkennung der Systemumgebung für WebRadio.
 *
 * Aufgaben:
 *  - Betriebssystem (Windows / Linux / macOS / unbekannt)
 *  - Betriebssystemversion (Kernel-/Build-Version)
 *  - Systemarchitektur und Prozessarchitektur (inkl. Emulation)
 *  - Laufzeitumgebung (Electron / Node, Versionen)
 *  - Linux-Distribution anhand von /etc/os-release
 *  - Distributionsfamilie und Paketmanager
 *
 * Designprinzipien:
 *  - Reine, testbare Funktionen mit Dependency Injection
 *  - Keine Distribution wird allein aufgrund ihres Namens als kompatibel
 *    eingestuft: Familien und Paketmanager werden ausschließlich über
 *    ID / ID_LIKE aus /etc/os-release aufgelöst.
 *  - Unbekannte Systeme liefern UNKNOWN statt geratener Werte.
 *  - Kein I/O außer dem Lesen der os-release-Datei.
 */

const defaultOs = require("os");
const defaultFs = require("fs");

const RuntimeDetector = require("./RuntimeDetector");

/** Vertrauensstufen für jede erkannte Information. */
const TRUST = Object.freeze({
    DETECTED: "DETECTED",
    VERIFIED: "VERIFIED",
    UNKNOWN: "UNKNOWN",
    UNSUPPORTED: "UNSUPPORTED"
});

/** Suchpfade für os-release, in der Reihenfolge ihrer Priorität. */
const OS_RELEASE_PATHS = Object.freeze(["/etc/os-release", "/usr/lib/os-release"]);

/**
 * Zurodnung von Distribution-ID (bzw. ID_LIKE) zu Familie und Paketmanager.
 *
 * WICHTIG: Der Anzeigename einer Distribution wird hier bewusst NICHT
 * verwendet. Nur ID und ID_LIKE aus /etc/os-release sind verlässliche
 * Signale und bestimmen die Familie.
 */
const DISTRIBUTIONS = Object.freeze({
    // ── Debian-Familie ────────────────────────────────────────────────
    debian: { family: "debian", packageManager: "apt", label: "Debian" },
    ubuntu: { family: "debian", packageManager: "apt", label: "Ubuntu" },
    linuxmint: { family: "debian", packageManager: "apt", label: "Linux Mint" },
    lmde: { family: "debian", packageManager: "apt", label: "LMDE" },
    pop: { family: "debian", packageManager: "apt", label: "Pop!_OS" },
    elementary: { family: "debian", packageManager: "apt", label: "elementary OS" },
    zorin: { family: "debian", packageManager: "apt", label: "Zorin OS" },
    neon: { family: "debian", packageManager: "apt", label: "KDE neon" },
    kali: { family: "debian", packageManager: "apt", label: "Kali Linux" },
    raspbian: { family: "debian", packageManager: "apt", label: "Raspberry Pi OS" },
    devuan: { family: "debian", packageManager: "apt", label: "Devuan" },
    deepin: { family: "debian", packageManager: "apt", label: "Deepin" },

    // ── Arch-Familie ──────────────────────────────────────────────────
    arch: { family: "arch", packageManager: "pacman", label: "Arch Linux" },
    archlinux: { family: "arch", packageManager: "pacman", label: "Arch Linux" },
    cachyos: { family: "arch", packageManager: "pacman", label: "CachyOS" },
    endeavouros: { family: "arch", packageManager: "pacman", label: "EndeavourOS" },
    manjaro: { family: "arch", packageManager: "pacman", label: "Manjaro" },
    garuda: { family: "arch", packageManager: "pacman", label: "Garuda Linux" },
    artix: { family: "arch", packageManager: "pacman", label: "Artix Linux" },
    arcolinux: { family: "arch", packageManager: "pacman", label: "ArcoLinux" },
    archcraft: { family: "arch", packageManager: "pacman", label: "Archcraft" },

    // ── RPM-Familie (Fedora / RHEL / SUSE) ────────────────────────────
    fedora: { family: "fedora", packageManager: "dnf", label: "Fedora" },
    nobara: { family: "fedora", packageManager: "dnf", label: "Nobara" },
    rhel: { family: "rhel", packageManager: "dnf", label: "Red Hat Enterprise Linux" },
    centos: { family: "rhel", packageManager: "dnf", label: "CentOS" },
    rocky: { family: "rhel", packageManager: "dnf", label: "Rocky Linux" },
    almalinux: { family: "rhel", packageManager: "dnf", label: "AlmaLinux" },
    ol: { family: "rhel", packageManager: "dnf", label: "Oracle Linux" },
    amzn: { family: "rhel", packageManager: "dnf", label: "Amazon Linux" },
    opensuse: { family: "suse", packageManager: "zypper", label: "openSUSE" },
    "opensuse-leap": { family: "suse", packageManager: "zypper", label: "openSUSE Leap" },
    "opensuse-tumbleweed": { family: "suse", packageManager: "zypper", label: "openSUSE Tumbleweed" },
    sles: { family: "suse", packageManager: "zypper", label: "SUSE Linux Enterprise" },
    suse: { family: "suse", packageManager: "zypper", label: "SUSE" }
});

/**
 * Distributionen mit einem für WebRadio nicht beschreibbaren,
 * systemverwalteten Wurzeldateisystem (immutable/atomar oder
 * deklarativ). Werden erkannt, aber als UNSUPPORTED markiert.
 */
const IMMUTABLE_IDS = Object.freeze([
    "nixos",
    "silverblue",
    "kinoite",
    "bazzite",
    "bluefin",
    "aurora",
    "fedora-silverblue",
    "fedora-kinoite",
    "opensuse-microos",
    "steamos"
]);

/**
 * Parst den Inhalt einer os-release-Datei.
 *
 * @param {string} text
 * @returns {object|null} Schlüssel/Wert-Paare ohne Anführungszeichen
 */
function parseOsRelease(text) {
    if (typeof text !== "string" || text.trim().length === 0) {
        return null;
    }

    const result = {};
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        const separator = line.indexOf("=");
        if (separator <= 0) continue;

        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (
            (value.startsWith("\"") && value.endsWith("\"")) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        value = value.replace(/\\"/g, "\"");

        if (key) result[key] = value;
    }

    return Object.keys(result).length > 0 ? result : null;
}

/**
 * Liest und parst die os-release-Datei.
 *
 * @param {object} options
 * @returns {{ path: string, parsed: object }|null}
 */
function readOsRelease({ fsModule = defaultFs, osReleasePath = null } = {}) {
    const candidates = osReleasePath ? [osReleasePath] : OS_RELEASE_PATHS;

    // Wird ein fsModule injiziert, wird ausschließlich dieses verwendet.
    // Kein stiller Fallback auf das echte Dateisystem – sonst würden
    // simulierte Plattformtests echte Host-Daten mischen.
    const readFn = fsModule && typeof fsModule.readFileSync === "function"
        ? fsModule.readFileSync.bind(fsModule)
        : (fsModule ? null : defaultFs.readFileSync.bind(defaultFs));

    if (!readFn) return null;

    for (const candidate of candidates) {
        try {
            const parsed = parseOsRelease(readFn(candidate, "utf8"));
            if (parsed && parsed.ID) {
                return { path: candidate, parsed };
            }
        } catch {
            // Datei fehlt oder ist nicht lesbar -> nächster Kandidat
        }
    }

    return null;
}

/**
 * Löst Distribution, Familie und Paketmanager aus den os-release-Daten auf.
 *
 * @param {object|null} parsed
 * @returns {object}
 */
function resolveDistribution(parsed) {
    if (!parsed) {
        return {
            id: null,
            name: null,
            prettyName: null,
            versionId: null,
            idLike: [],
            family: "unknown",
            packageManager: null,
            label: null,
            immutable: false,
            status: TRUST.UNKNOWN,
            evidence: "os-release nicht lesbar"
        };
    }

    const id = typeof parsed.ID === "string" ? parsed.ID.toLowerCase() : null;
    const idLike = typeof parsed.ID_LIKE === "string"
        ? parsed.ID_LIKE.toLowerCase().split(/\s+/).filter(Boolean)
        : [];

    // Auflösung ausschließlich über ID und ID_LIKE – niemals über NAME.
    const candidates = [id, ...idLike].filter(Boolean);
    let match = null;
    let matchedId = null;
    for (const candidate of candidates) {
        if (DISTRIBUTIONS[candidate]) {
            match = DISTRIBUTIONS[candidate];
            matchedId = candidate;
            break;
        }
    }

    const immutable = candidates.some((candidate) => IMMUTABLE_IDS.includes(candidate));

    if (!match) {
        return {
            id,
            name: parsed.NAME || null,
            prettyName: parsed.PRETTY_NAME || null,
            versionId: parsed.VERSION_ID || null,
            idLike,
            family: "unknown",
            packageManager: null,
            label: parsed.PRETTY_NAME || parsed.NAME || id,
            immutable,
            status: immutable ? TRUST.UNSUPPORTED : TRUST.UNKNOWN,
            evidence: immutable
                ? "Distribution wird über ein nicht beschreibbares Wurzeldateisystem verwaltet"
                : "Keine bekannte Distributionsfamilie in ID/ID_LIKE"
        };
    }

    return {
        id,
        name: parsed.NAME || null,
        prettyName: parsed.PRETTY_NAME || null,
        versionId: parsed.VERSION_ID || null,
        idLike,
        family: match.family,
        packageManager: match.packageManager,
        label: match.label,
        immutable,
        status: immutable ? TRUST.UNSUPPORTED : TRUST.VERIFIED,
        matchedId,
        evidence: `os-release ID/ID_LIKE -> ${matchedId}`
    };
}

/**
 * Ermittelt die Linux-Informationen (Distribution + Kernel).
 *
 * @param {object} options
 * @returns {object}
 */
function detectLinux(options = {}) {
    const { osModule = defaultOs } = options;
    const release = readOsRelease(options);
    const distribution = resolveDistribution(release ? release.parsed : null);

    let kernelVersion = null;
    try {
        kernelVersion = typeof osModule.release === "function" ? osModule.release() : null;
    } catch {
        kernelVersion = null;
    }

    return {
        distribution,
        kernelVersion: kernelVersion || null,
        osReleasePath: release ? release.path : null
    };
}

/**
 * Ermittelt die Betriebssystemversion.
 *
 * @param {string} platform
 * @param {object} options
 * @returns {{ version: string|null, status: string, evidence: string }}
 */
function detectOsVersion(platform, { osModule = defaultOs, linux = null } = {}) {
    if (platform === "linux" && linux) {
        const version = linux.distribution.versionId || linux.kernelVersion || null;
        return {
            version,
            status: linux.distribution.status === TRUST.VERIFIED ? TRUST.VERIFIED : TRUST.UNKNOWN,
            evidence: linux.distribution.versionId ? "os-release VERSION_ID" : "Kernel-Version"
        };
    }

    if (platform === "windows" || platform === "macos") {
        try {
            const version = typeof osModule.release === "function" ? osModule.release() : null;
            return {
                version: version || null,
                status: version ? TRUST.DETECTED : TRUST.UNKNOWN,
                evidence: "os.release()"
            };
        } catch {
            return { version: null, status: TRUST.UNKNOWN, evidence: "os.release() nicht verfügbar" };
        }
    }

    return { version: null, status: TRUST.UNKNOWN, evidence: "Plattform nicht unterstützt" };
}

/**
 * Erkennt die Laufzeitumgebung anhand der Prozessversionen.
 *
 * @param {object} versions
 * @returns {object}
 */
function detectRuntimeEnvironment(versions = {}) {
    const runtime = versions.electron ? "electron" : (versions.node ? "node" : "unknown");
    return {
        runtime,
        electron: versions.electron || null,
        node: versions.node || null,
        chrome: versions.chrome || null,
        status: runtime === "unknown" ? TRUST.UNKNOWN : TRUST.DETECTED
    };
}

/**
 * Hauptfunktion: erkennt die vollständige Systemumgebung.
 *
 * @param {object} options
 * @param {string} [options.platform] - process.platform
 * @param {string} [options.arch] - process.arch (Prozessarchitektur)
 * @param {object} [options.processObj]
 * @param {object} [options.osModule]
 * @param {object} [options.fsModule]
 * @param {string} [options.osReleasePath] - Nur für Tests
 * @param {boolean} [options.packaged]
 * @returns {object} JSON-serialisierbare Systeminformationen
 */
function detect(options = {}) {
    const processObj = options.processObj || process;
    const osModule = options.osModule || defaultOs;

    const platform = RuntimeDetector.normalizePlatform(
        options.platform || (processObj && processObj.platform)
    );

    const processArchitecture = RuntimeDetector.normalizeArchitecture(
        options.arch || (processObj && processObj.arch)
    );

    let nativeArchitecture = null;
    try {
        nativeArchitecture = typeof osModule.arch === "function"
            ? RuntimeDetector.normalizeArchitecture(osModule.arch())
            : null;
    } catch {
        nativeArchitecture = null;
    }

    const systemArchitecture = nativeArchitecture && nativeArchitecture !== "unknown"
        ? nativeArchitecture
        : processArchitecture;

    const linux = platform === "linux" ? detectLinux({ ...options, osModule }) : null;
    const osVersion = detectOsVersion(platform, { osModule, linux });

    const osStatus = platform === "unknown"
        ? TRUST.UNKNOWN
        : (linux && linux.distribution.status === TRUST.UNSUPPORTED
            ? TRUST.UNSUPPORTED
            : (osVersion.status === TRUST.UNKNOWN ? TRUST.DETECTED : osVersion.status));

    const packaged = typeof options.packaged === "boolean"
        ? options.packaged
        : !!(options.app && options.app.isPackaged);

    const runtime = detectRuntimeEnvironment(options.versions || (processObj && processObj.versions) || {});

    return {
        status: osStatus,
        os: {
            name: platform,
            version: osVersion.version,
            kernelVersion: linux ? linux.kernelVersion : osVersion.version,
            status: osStatus,
            evidence: osVersion.evidence
        },
        architecture: {
            system: systemArchitecture,
            process: processArchitecture,
            emulated: !!(
                nativeArchitecture &&
                nativeArchitecture !== "unknown" &&
                processArchitecture !== "unknown" &&
                nativeArchitecture !== processArchitecture
            ),
            status: systemArchitecture === "unknown" ? TRUST.UNKNOWN : TRUST.DETECTED
        },
        runtime,
        linux: linux
            ? {
                distribution: linux.distribution,
                kernelVersion: linux.kernelVersion,
                osReleasePath: linux.osReleasePath
            }
            : null,
        capabilities: {
            isPackaged: packaged,
            isDevelopment: !packaged,
            hasPackageManager: !!(linux && linux.distribution.packageManager),
            immutableSystem: !!(linux && linux.distribution.immutable),
            supportsInAppUpdate: platform === "windows" || platform === "linux" || platform === "macos"
        }
    };
}

module.exports = {
    TRUST,
    OS_RELEASE_PATHS,
    DISTRIBUTIONS,
    IMMUTABLE_IDS,
    parseOsRelease,
    readOsRelease,
    resolveDistribution,
    detectLinux,
    detectOsVersion,
    detectRuntimeEnvironment,
    detect
};
