"use strict";

/**
 * UpdateProviderRegistry.js
 *
 * Zentrale Registry, die anhand von System- und Installationsprofil den
 * passenden Update-Mechanismus auswählt.
 *
 * Auswahlkriterien:
 *  - Betriebssystem
 *  - Architektur
 *  - Installationsformat
 *  - Installationsquelle
 *  - Installationspfad / Berechtigungen
 *  - Update-Kanal (nur zur Diagnose; die Auswahl ist kanalunabhängig)
 *
 * Harte Regeln:
 *  - Paketmanagerverwaltete Installationen (deb/rpm/arch) werden NIE
 *    automatisch überschrieben.
 *  - Unbekannte Installationsarten werden NIE automatisch überschrieben.
 *  - Die Provider-Auswahl ist unabhängig vom Update-Kanal. Es findet
 *    kein impliziter Kanalwechsel statt.
 *  - Ist keine sichere automatische Aktualisierung möglich, liefert die
 *    Registry eine verständliche Begründung plus manuellen Update-Weg.
 *
 * Der Rückgabewert von `select()` ist JSON-serialisierbar und enthält
 * keine Umgebungsvariablen oder vertraulichen Werte.
 */

const UpdateState = require("./UpdateState");

const RELEASES_URL = "https://github.com/YourEliteSystems/WebRadio/releases";

const ALL_CHANNELS = Object.freeze([
    UpdateState.CHANNELS.STABLE,
    UpdateState.CHANNELS.BETA,
    UpdateState.CHANNELS.ALPHA
]);

/**
 * Alle unterstützten Provider-Definitionen.
 *
 * `create` wird nur für automatisch aktualisierbare Formate gesetzt.
 * Alle anderen Formate liefern bewusst einen UnsupportedUpdateProvider,
 * damit der UpdateManager niemals eigenmächtig Dateien ersetzt.
 */
const PROVIDER_DEFINITIONS = Object.freeze([
    {
        key: "windows-nsis",
        platform: "windows",
        formats: ["nsis"],
        label: "Windows Installer (NSIS)",
        providerType: "electron-updater",
        mechanism: "in-app-installer",
        automatic: true,
        requiresElevation: true,
        create: ({ autoUpdater }) => new (require("./providers/WindowsUpdateProvider"))(autoUpdater)
    },
    {
        key: "windows-portable",
        platform: "windows",
        formats: ["portable"],
        label: "Windows Portable",
        providerType: "electron-updater",
        mechanism: "in-app-portable",
        automatic: true,
        requiresElevation: false,
        create: ({ autoUpdater }) => new (require("./providers/WindowsUpdateProvider"))(autoUpdater)
    },
    {
        key: "windows-msi",
        platform: "windows",
        formats: ["msi"],
        label: "Windows MSI",
        providerType: "unsupported",
        mechanism: "manual-msi",
        automatic: false,
        requiresElevation: true,
        reason: "MSI-Installationen werden von Windows Installer verwaltet. WebRadio ersetzt keine MSI-verwalteten Dateien selbst.",
        suggestion: "Lade das neue MSI-Paket von den GitHub Releases und installiere es über Windows Installer (msiexec)."
    },
    {
        key: "linux-appimage",
        platform: "linux",
        formats: ["appimage"],
        label: "Linux AppImage",
        providerType: "appimage-github-fallback",
        mechanism: "atomic-file-replace",
        automatic: true,
        requiresElevation: false,
        create: ({ autoUpdater, app }) => new (require("./providers/LinuxAppImageUpdateProvider"))(autoUpdater, app)
    },
    {
        key: "linux-deb",
        platform: "linux",
        formats: ["deb"],
        label: "Debian/Ubuntu Paket (.deb)",
        providerType: "unsupported",
        mechanism: "package-manager",
        automatic: false,
        requiresElevation: true,
        packageManager: "apt",
        reason: "Debian/Ubuntu-Pakete werden von dpkg/apt verwaltet. WebRadio darf diese Dateien nicht selbst überschreiben.",
        suggestion: "Aktualisiere WebRadio über den Paketmanager: sudo apt update && sudo apt install --only-upgrade webradio"
    },
    {
        key: "linux-rpm",
        platform: "linux",
        formats: ["rpm"],
        label: "RPM-Paket",
        providerType: "unsupported",
        mechanism: "package-manager",
        automatic: false,
        requiresElevation: true,
        packageManager: "dnf",
        reason: "RPM-Pakete werden von dnf/zypper verwaltet. WebRadio darf diese Dateien nicht selbst überschreiben.",
        suggestion: "Aktualisiere WebRadio über den Paketmanager: sudo dnf upgrade webradio (SUSE: sudo zypper update webradio)"
    },
    {
        key: "linux-arch",
        platform: "linux",
        formats: ["arch"],
        label: "Arch Linux Paket (.pkg.tar.zst)",
        providerType: "unsupported",
        mechanism: "package-manager",
        automatic: false,
        requiresElevation: true,
        packageManager: "pacman",
        reason: "Arch-Pakete werden von pacman verwaltet. WebRadio darf diese Dateien nicht selbst überschreiben.",
        suggestion: "Aktualisiere WebRadio über pacman: sudo pacman -Syu webradio"
    },
    {
        key: "linux-portable",
        platform: "linux",
        formats: ["portable"],
        label: "Linux Portable",
        providerType: "unsupported",
        mechanism: "manual-in-place",
        automatic: false,
        requiresElevation: false,
        reason: "Für portable Linux-Installationen stellt der Release kein automatisch prüfbares Update-Artefakt bereit.",
        suggestion: "Lade das neue Archiv von den GitHub Releases und ersetze das Anwendungsverzeichnis manuell."
    },
    {
        key: "macos-dmg",
        platform: "macos",
        formats: ["dmg"],
        label: "macOS DMG",
        providerType: "unsupported",
        mechanism: "manual-app-bundle",
        automatic: false,
        requiresElevation: false,
        reason: "Automatische macOS-Updates sind ohne Signatur- und Notarisierungsprüfung nicht sicher umsetzbar.",
        suggestion: "Lade das neue DMG von den GitHub Releases und installiere es manuell."
    },
    {
        key: "macos-pkg",
        platform: "macos",
        formats: ["pkg"],
        label: "macOS PKG",
        providerType: "unsupported",
        mechanism: "manual-pkg",
        automatic: false,
        requiresElevation: true,
        reason: "PKG-Installationen werden vom macOS Installer verwaltet. WebRadio ersetzt keine paketverwalteten Dateien.",
        suggestion: "Lade das neue PKG von den GitHub Releases und installiere es über den macOS Installer."
    },
    {
        key: "macos-zip",
        platform: "macos",
        formats: ["zip"],
        label: "macOS ZIP/Portable",
        providerType: "unsupported",
        mechanism: "manual-in-place",
        automatic: false,
        requiresElevation: false,
        reason: "Für portable macOS-Installationen steht kein automatisch geprüftes Update-Artefakt bereit.",
        suggestion: "Lade das neue ZIP von den GitHub Releases und ersetze das App-Bundle im bestehenden Verzeichnis."
    },
    {
        key: "development",
        platform: "any",
        formats: ["development"],
        label: "Entwicklungsmodus",
        providerType: "unsupported",
        mechanism: "none",
        automatic: false,
        requiresElevation: false,
        reason: "WebRadio läuft ungepackt. Automatische Updates sind im Entwicklungsmodus deaktiviert.",
        suggestion: "Aktualisiere das Arbeitsverzeichnis über dein Versionskontrollsystem."
    },
    {
        key: "unsupported",
        platform: "any",
        formats: ["unknown"],
        label: "Unbekannte Installation",
        providerType: "unsupported",
        mechanism: "none",
        automatic: false,
        requiresElevation: false,
        reason: "Installationsart und Installationsquelle konnten nicht zuverlässig ermittelt werden.",
        suggestion: "Bitte lade die passende Version manuell von den GitHub Releases herunter."
    }
]);

class UpdateProviderRegistry {

    constructor(definitions = PROVIDER_DEFINITIONS) {
        this._definitions = new Map();
        for (const definition of definitions) {
            this._definitions.set(definition.key, definition);
        }
    }

    /**
     * Registriert einen weiteren Provider (Erweiterbarkeit für neue Formate).
     *
     * @param {object} definition
     */
    register(definition) {
        if (!definition || typeof definition.key !== "string" || definition.key.length === 0) {
            throw new Error("Provider-Definition benötigt einen eindeutigen key");
        }
        this._definitions.set(definition.key, definition);
        return this;
    }

    getDefinition(key) {
        return this._definitions.get(key) || null;
    }

    list() {
        return [...this._definitions.values()].map((definition) => ({
            key: definition.key,
            platform: definition.platform,
            formats: [...definition.formats],
            label: definition.label,
            providerType: definition.providerType,
            mechanism: definition.mechanism,
            automatic: !!definition.automatic,
            requiresElevation: !!definition.requiresElevation,
            channels: [...ALL_CHANNELS]
        }));
    }

    /**
     * Wählt den passenden Provider anhand von System- und Installationsprofil.
     *
     * @param {object} options
     * @param {object} options.system - Ergebnis von SystemDetector.detect()
     * @param {object} options.installation - Ergebnis von InstallationDetector.detect()
     * @param {string} [options.channel] - Nur Diagnose, kein Auswahlkriterium
     * @returns {object} serialisierbare Auswahl
     */
    select({ system, installation, channel } = {}) {
        const platform = system && system.os ? system.os.name : "unknown";
        const format = installation && installation.format ? installation.format : "unknown";
        const distro = system && system.linux ? system.linux.distribution : null;

        let definition = null;
        for (const candidate of this._definitions.values()) {
            if (!candidate.formats.includes(format)) continue;
            if (candidate.platform !== "any" && candidate.platform !== platform) continue;
            definition = candidate;
            break;
        }

        // Fallback: unbekanntes Format oder unbekannte Plattform
        if (!definition || (format === "unknown" && definition.key !== "unsupported")) {
            if (!definition) definition = this._definitions.get("unsupported");
        }

        const reason = this._buildReason(definition, { platform, format, distro, installation });
        const suggestion = this._buildSuggestion(definition, { platform, format, distro });

        const normalizedChannel = ALL_CHANNELS.includes(channel)
            ? channel
            : UpdateState.CHANNELS.STABLE;

        return {
            key: definition.key,
            label: definition.label,
            providerType: definition.providerType,
            mechanism: definition.mechanism,
            automatic: !!definition.automatic,
            requiresElevation: !!(definition.requiresElevation &&
                (!installation || !installation.permissions || installation.permissions.installDirectoryWritable !== true)),
            channel: normalizedChannel,
            channelIndependent: true,
            channels: [...ALL_CHANNELS],
            reason: reason || null,
            suggestion: suggestion || null,
            manualUpdate: definition.automatic
                ? null
                : {
                    url: RELEASES_URL,
                    instructions: suggestion ? [suggestion] : []
                },
            isSuitableForRuntime: true
        };
    }

    /**
     * Erstellt die Provider-Instanz für eine Auswahl.
     *
     * @param {object} selection - Ergebnis von select()
     * @param {object} dependencies - { autoUpdater, app, fs, path }
     * @returns {object} Provider-Instanz
     */
    createProvider(selection, dependencies = {}) {
        const UnsupportedUpdateProvider = require("./providers/UnsupportedUpdateProvider");

        if (!selection || typeof selection.key !== "string") {
            return new UnsupportedUpdateProvider(
                "Installationsart konnte nicht bestimmt werden.",
                `Bitte lade WebRadio manuell von ${RELEASES_URL} herunter.`
            );
        }

        const definition = this._definitions.get(selection.key);
        if (!definition || typeof definition.create !== "function") {
            return new UnsupportedUpdateProvider(
                selection.reason || "Für diese Installationsart ist kein automatisches Update verfügbar.",
                selection.suggestion || `Bitte lade WebRadio manuell von ${RELEASES_URL} herunter.`
            );
        }

        try {
            return definition.create(dependencies);
        } catch (err) {
            return new UnsupportedUpdateProvider(
                `Update-Provider konnte nicht initialisiert werden: ${err.message}`,
                selection.suggestion || `Bitte lade WebRadio manuell von ${RELEASES_URL} herunter.`
            );
        }
    }

    _buildReason(definition, { platform, format, distro, installation }) {
        if (definition.key === "unsupported") {
            if (format === "unknown") {
                return "Installationsart und Installationsquelle konnten nicht zuverlässig ermittelt werden.";
            }
            return definition.reason;
        }
        if (definition.key === "linux-rpm" && distro && distro.packageManager === "zypper") {
            return definition.reason;
        }
        if (platform === "unknown") {
            return "Das Betriebssystem wird nicht unterstützt.";
        }
        if (installation && installation.status === SystemDetectorTrust.UNSUPPORTED) {
            return `${definition.reason || ""} Die Distribution wird als nicht beschreibbar verwaltet.`.trim();
        }
        return definition.reason || null;
    }

    _buildSuggestion(definition, { platform, format, distro }) {
        if (definition.key === "linux-deb") {
            return "Aktualisiere WebRadio über den Paketmanager: sudo apt update && sudo apt install --only-upgrade webradio";
        }
        if (definition.key === "linux-rpm") {
            if (distro && distro.packageManager === "zypper") {
                return "Aktualisiere WebRadio über den Paketmanager: sudo zypper update webradio";
            }
            return "Aktualisiere WebRadio über den Paketmanager: sudo dnf upgrade webradio";
        }
        if (definition.key === "linux-arch") {
            return "Aktualisiere WebRadio über pacman: sudo pacman -Syu webradio";
        }
        if (definition.key === "unsupported" && format !== "unknown") {
            return `Für dieses Format steht kein automatisches Update bereit. Bitte lade die passende Version manuell von ${RELEASES_URL} herunter.`;
        }
        if (definition.suggestion) return definition.suggestion;
        if (platform === "unknown") {
            return `Bitte lade WebRadio manuell von ${RELEASES_URL} herunter.`;
        }
        return null;
    }
}

// Vermeidet einen Zirkularimport: die Vertrauenskonstanten sind reine Strings.
const SystemDetectorTrust = Object.freeze({
    DETECTED: "DETECTED",
    VERIFIED: "VERIFIED",
    UNKNOWN: "UNKNOWN",
    UNSUPPORTED: "UNSUPPORTED"
});

const registry = new UpdateProviderRegistry();

module.exports = registry;
module.exports.UpdateProviderRegistry = UpdateProviderRegistry;
module.exports.PROVIDER_DEFINITIONS = PROVIDER_DEFINITIONS;
module.exports.ALL_CHANNELS = ALL_CHANNELS;
module.exports.RELEASES_URL = RELEASES_URL;
