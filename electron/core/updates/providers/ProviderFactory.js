"use strict";

/**
 * ProviderFactory.js
 *
 * Factory für die Erstellung des passenden Update-Providers basierend auf Runtime-Informationen.
 *
 * Aufgaben:
 *  - Runtime-Informationen analysieren
 *  - Passenden Provider auswählen
 *  - Provider-Instanz erstellen und zurückgeben
 *
 * Designprinzipien:
 *  - Zentrale Provider-Selektion
 *  - RuntimeDetector-Integration
 *  - Fallback auf UnsupportedProvider
 */

const RuntimeDetector = require("../../platform/RuntimeDetector");
const WindowsUpdateProvider = require("./WindowsUpdateProvider");
const LinuxAppImageUpdateProvider = require("./LinuxAppImageUpdateProvider");
const UnsupportedUpdateProvider = require("./UnsupportedUpdateProvider");

class ProviderFactory {

    /**
     * Erstellt den passenden Provider für das aktuelle Runtime.
     *
     * @param {object} app - Electron app instance
     * @param {object} autoUpdater - electron-updater instance (optional)
     * @param {object} fs - fs module (optional, für Tests)
     * @param {object} path - path module (optional, für Tests)
     * @returns {BaseUpdateProvider}
     */
    static createProvider(app, autoUpdater, fs, path, processObj = process) {
        const runtimeInfo = RuntimeDetector.detectRuntime(app, processObj, fs, path);

        // Windows -> electron-updater
        if (runtimeInfo.platform === "windows") {
            return new WindowsUpdateProvider(autoUpdater);
        }

        // Linux AppImage -> AppImage-Provider (vorläufig GitHub-Fallback)
        if (runtimeInfo.isAppImage) {
            return new LinuxAppImageUpdateProvider(autoUpdater, app);
        }

        // Linux .deb / Arch / RPM / macOS / unknown -> Unsupported
        let reason = "Der installierte Pakettyp unterstützt keine automatischen In-App-Updates.";
        let suggestion = "Bitte nutze die Paketverwaltung deines Systems, um WebRadio zu aktualisieren.";

        if (runtimeInfo.platform === "linux") {
            if (runtimeInfo.packaging === "deb") {
                reason = "Debian/Ubuntu-Pakete (.deb) müssen über die System-Paketverwaltung (apt/dpkg) aktualisiert werden.";
                suggestion = "Bitte aktualisiere WebRadio über deinen Paketmanager (z. B. sudo apt update && sudo apt upgrade webradio).";
            } else if (runtimeInfo.packaging === "arch") {
                reason = "Arch-Linux-Pakete (.pkg.tar.zst) müssen über die Paketverwaltung (pacman) aktualisiert werden.";
                suggestion = "Bitte aktualisiere WebRadio über deinen Paketmanager (z. B. sudo pacman -Syu webradio).";
            } else if (runtimeInfo.packaging === "rpm") {
                reason = "RPM-Pakete müssen über die System-Paketverwaltung (dnf/zypper) aktualisiert werden.";
                suggestion = "Bitte aktualisiere WebRadio über deinen Paketmanager (z. B. sudo dnf upgrade webradio).";
            } else {
                reason = "Systemweit installierte Linux-Pakete können aus Sicherheitsgründen nicht über den In-App-Updater modifiziert werden.";
                suggestion = "Bitte nutze den Paketmanager deiner Linux-Distribution, um WebRadio zu aktualisieren.";
            }
        } else if (runtimeInfo.platform === "macos") {
            reason = "Automatische Updates für macOS sind noch nicht implementiert.";
            suggestion = "Bitte lade das neueste Release für macOS manuell von GitHub herunter.";
        }

        return new UnsupportedUpdateProvider(reason, suggestion);
    }

    /**
     * Liefert Runtime-Informationen für Diagnose.
     *
     * @param {object} app - Electron app instance
     * @param {object} fs - fs module (optional)
     * @param {object} path - path module (optional)
     * @returns {object}
     */
    static getRuntimeInfo(app, fs, path, processObj = process) {
        return RuntimeDetector.detectRuntime(app, processObj, fs, path);
    }
}

module.exports = ProviderFactory;
