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
    static createProvider(app, autoUpdater, fs, path) {
        const runtimeInfo = RuntimeDetector.detectRuntime(app, process, fs, path);

        // Windows -> electron-updater
        if (runtimeInfo.platform === "windows") {
            return new WindowsUpdateProvider(autoUpdater);
        }

        // Linux AppImage -> AppImage-Provider (vorläufig GitHub-Fallback)
        if (runtimeInfo.isAppImage) {
            return new LinuxAppImageUpdateProvider(autoUpdater);
        }

        // Linux .deb / Arch / macOS / unknown -> Unsupported
        let reason = "Packaging type does not support automatic app updates";
        if (runtimeInfo.platform === "linux") {
            if (runtimeInfo.packaging === "deb") {
                reason = "Debian/Ubuntu packages should be updated via apt/dpkg";
            } else if (runtimeInfo.packaging === "arch") {
                reason = "Arch Linux packages should be updated via pacman";
            }
        } else if (runtimeInfo.platform === "macos") {
            reason = "macOS automatic updates are not yet implemented";
        }

        return new UnsupportedUpdateProvider(reason);
    }

    /**
     * Liefert Runtime-Informationen für Diagnose.
     *
     * @param {object} app - Electron app instance
     * @param {object} fs - fs module (optional)
     * @param {object} path - path module (optional)
     * @returns {object}
     */
    static getRuntimeInfo(app, fs, path) {
        return RuntimeDetector.detectRuntime(app, process, fs, path);
    }
}

module.exports = ProviderFactory;
