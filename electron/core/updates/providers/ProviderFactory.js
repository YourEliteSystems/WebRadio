"use strict";

/**
 * ProviderFactory.js
 *
 * Kompatibilitätsschicht zur zentralen `UpdateProviderRegistry`.
 *
 * Die eigentliche Auswahl (Betriebssystem, Architektur, Installationsformat,
 * Installationsquelle, Berechtigungen) liegt in
 * `electron/core/updates/UpdateProviderRegistry.js`. Diese Factory bleibt
 * als stabile API erhalten, damit bestehende Aufrufer und Tests
 * unverändert funktionieren.
 *
 * Designprinzipien:
 *  - Keine zweite Auswahllogik
 *  - Fallback auf UnsupportedUpdateProvider
 *  - Optionale Injektion einer bereits berechneten Erkennung
 */

const RuntimeDetector = require("../../platform/RuntimeDetector");
const SystemDetector = require("../../platform/SystemDetector");
const InstallationDetector = require("../../platform/InstallationDetector");
const UpdateProviderRegistry = require("../UpdateProviderRegistry");

class ProviderFactory {

    /**
     * Erstellt den passenden Provider für das aktuelle Runtime.
     *
     * @param {object} app - Electron app instance
     * @param {object} autoUpdater - electron-updater instance (optional)
     * @param {object} fs - fs module (optional, für Tests)
     * @param {object} path - path module (optional, für Tests)
     * @param {object} [processObj=process]
     * @param {object} [detection=null] - bereits berechnete Erkennung
     *        ({ system, installation, selection })
     * @returns {object} Provider-Instanz
     */
    static createProvider(app, autoUpdater, fs, path, processObj = process, detection = null) {
        const context = detection || ProviderFactory.detectEnvironment(app, fs, path, processObj);

        const selection = context.selection || UpdateProviderRegistry.select({
            system: context.system,
            installation: context.installation
        });

        return UpdateProviderRegistry.createProvider(selection, {
            app,
            autoUpdater,
            fs,
            path
        });
    }

    /**
     * Berechnet System- und Installationsprofil inklusive Provider-Auswahl.
     *
     * @param {object} app
     * @param {object} [fs]
     * @param {object} [path]
     * @param {object} [processObj=process]
     * @returns {{ system: object, installation: object, selection: object }}
     */
    static detectEnvironment(app, fs, path, processObj = process) {
        const system = SystemDetector.detect({
            app,
            processObj,
            fsModule: fs,
            versions: processObj ? processObj.versions : process.versions,
            platform: processObj ? processObj.platform : process.platform,
            arch: processObj ? processObj.arch : process.arch
        });

        const installation = InstallationDetector.detect({
            system,
            app,
            processObj,
            fsModule: fs,
            pathModule: path
        });

        const selection = UpdateProviderRegistry.select({ system, installation });

        return { system, installation, selection };
    }

    /**
     * Liefert Runtime-Informationen für Diagnose (Abwärtskompatibilität).
     *
     * @param {object} app - Electron app instance
     * @param {object} fs - fs module (optional)
     * @param {object} path - path module (optional)
     * @param {object} [processObj=process]
     * @returns {object}
     */
    static getRuntimeInfo(app, fs, path, processObj = process) {
        return RuntimeDetector.detectRuntime(app, processObj, fs, path);
    }
}

module.exports = ProviderFactory;
