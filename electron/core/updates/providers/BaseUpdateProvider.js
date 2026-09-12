"use strict";

/**
 * BaseUpdateProvider.js
 *
 * Abstrakte Basisklasse für alle Update-Provider.
 *
 * Jeder Provider muss diese Methoden implementieren:
 *  - checkForUpdates()
 *  - downloadUpdate()
 *  - installUpdate()
 *  - dispose()
 *
 * Designprinzipien:
 *  - Provider sind zustandslos (State wird vom UpdateManager gehalten)
 *  - Provider liefern konsistente Result-Objekte
 *  - Provider werfen keine Exceptions an den Aufrufer (alles in Result kapseln)
 *  - Provider sind testbar durch Dependency Injection
 */

class BaseUpdateProvider {

    constructor() {
        if (new.target === BaseUpdateProvider) {
            throw new Error("BaseUpdateProvider ist abstrakt und kann nicht direkt instanziiert werden.");
        }
    }

    /**
     * Prüft auf verfügbare Updates.
     * @returns {Promise<object>} Result-Objekt mit status und optionalen Daten
     */
    async checkForUpdates() {
        throw new Error("checkForUpdates muss vom Provider implementiert werden");
    }

    /**
     * Lädt ein verfügbares Update herunter.
     * @returns {Promise<object>} Result-Objekt mit status und optionalen Daten
     */
    async downloadUpdate() {
        throw new Error("downloadUpdate muss vom Provider implementiert werden");
    }

    /**
     * Installiert ein heruntergeladenes Update.
     * @returns {Promise<object>} Result-Objekt mit status und optionalen Daten
     */
    async installUpdate() {
        throw new Error("installUpdate muss vom Provider implementiert werden");
    }

    /**
     * Bereinigt Ressourcen beim Shutdown.
     */
    dispose() {
        // Default: keine Aktion
    }

    /**
     * Liefert den Provider-Typ für Diagnose/Logging.
     * @returns {string}
     */
    getProviderType() {
        throw new Error("getProviderType muss vom Provider implementiert werden");
    }

    /**
     * Prüft, ob der Provider für das aktuelle Runtime geeignet ist.
     * @param {object} runtimeInfo - Runtime-Info von RuntimeDetector
     * @returns {boolean}
     */
    isSuitableForRuntime(runtimeInfo) {
        throw new Error("isSuitableForRuntime muss vom Provider implementiert werden");
    }
}

module.exports = BaseUpdateProvider;
