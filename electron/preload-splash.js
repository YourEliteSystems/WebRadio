"use strict";

/**
 * preload-splash.js
 *
 * Minimales Preload-Skript fuer das Splash-Fenster.
 * Exponiert nur zwei sichere APIs:
 *   - splashApi.onBootupState(callback)   – empfaengt Bootup-Zustandsupdates
 *   - splashApi.getVersion()              – gibt die App-Version zurueck
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
    }

});
