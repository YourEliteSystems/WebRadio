"use strict";

/**
 * preload-splash.js
 *
 * Minimales Preload-Skript fuer das Splash-Fenster.
 * Exponiert nur die APIs, die der Startbildschirm benoetigt:
 *   - splashApi.onBootupState(callback)   – empfaengt Bootup-Zustandsupdates
 *   - splashApi.getVersion()              – gibt die App-Version zurueck
 *   - splashApi.getDiagnostics()          – Pfade und Angaben zu einem
 *                                           abgebrochenen Start
 *   - splashApi.openLogFolder()           – oeffnet den Logordner
 *   - splashApi.openReport()              – zeigt den Diagnosebericht an
 *   - splashApi.closeSplash()             – schliesst nur das Splash-Fenster
 *   - splashApi.quit()                    – beendet die Anwendung
 *
 * Es werden keine Pfade oder Kommandos vom Renderer entgegengenommen; der
 * Main-Prozess entscheidet selbst, was geoeffnet wird.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("splashApi", {

    /**
     * Abonniert Bootup-Zustands-Updates vom Main-Prozess.
     * @param {function(state: object): void} callback
     * @returns {function} Cleanup-Funktion
     */
    onBootupState(callback) {
        if (typeof callback !== "function") return () => {};
        const handler = (_event, state) => callback(state);
        ipcRenderer.on("splash:bootup-state", handler);
        return () => ipcRenderer.removeListener("splash:bootup-state", handler);
    },

    /**
     * Gibt die aktuelle App-Version zurueck.
     * @returns {Promise<string>}
     */
    getVersion() {
        return ipcRenderer.invoke("splash:get-version");
    },

    /**
     * Angaben zum abgebrochenen Start (Fehlermeldung, Bericht- und Logpfade).
     * @returns {Promise<object>}
     */
    getDiagnostics() {
        return ipcRenderer.invoke("splash:get-diagnostics");
    },

    /**
     * Oeffnet den Logordner im Dateimanager.
     * @returns {Promise<{ok: boolean, path?: string, error?: string}>}
     */
    openLogFolder() {
        return ipcRenderer.invoke("splash:open-log-folder");
    },

    /**
     * Zeigt den geschriebenen Diagnosebericht im Dateimanager an.
     * @returns {Promise<{ok: boolean, path?: string, error?: string}>}
     */
    openReport() {
        return ipcRenderer.invoke("splash:open-report");
    },

    /**
     * Schliesst das Splash-Fenster, ohne die Anwendung zu beenden.
     * @returns {Promise<{ok: boolean, error?: string}>}
     */
    closeSplash() {
        return ipcRenderer.invoke("splash:close");
    },

    /**
     * Beendet die Anwendung.
     * @returns {Promise<{ok: boolean}>}
     */
    quit() {
        return ipcRenderer.invoke("splash:quit");
    }

});
