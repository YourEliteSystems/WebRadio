"use strict";

const { ipcMain } = require("electron");
const LocalizationService = require("../localization/LocalizationService");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("LocalizationIpc");

/**
 * IPC-Schnittstelle der Lokalisierung.
 *
 * Bewusst klein gehalten: Der Renderer darf den Sprachzustand lesen, eine
 * Sprachpräferenz setzen und Kataloge abfragen. Texte fließen ausschließlich
 * als Ausgabe aus validierten `userData`-Katalogen (Bootstrap bzw. gezielte
 * Abfragen je Plugin/Theme); es gibt keinen Schreibkanal und keine
 * unkontrollierten Argumente.
 */
function registerLocalizationHandlers() {
    ipcMain.handle("localization:get-state", () => {
        try {
            return LocalizationService.getState();
        } catch (err) {
            logger.error(`localization:get-state fehlgeschlagen: ${err.message}`);
            return { ok: false, error: "state-unavailable" };
        }
    });

    /**
     * Kataloge für den Renderer. Der Regelweg ist der synchrone Bootstrap im
     * Preload; dieser Kanal dient als Fallback (z. B. nach einem Reload) und
     * liefert ausschließlich validierte Anwendungskataloge aus `userData`.
     */
    ipcMain.handle("localization:get-catalogs", () => {
        try {
            const manager = LocalizationService.manager || LocalizationService.initialize();
            return { ok: true, catalogs: manager.getAppCatalogs() };
        } catch (err) {
            logger.error(`localization:get-catalogs fehlgeschlagen: ${err.message}`);
            return { ok: false, error: "catalogs-unavailable" };
        }
    });

    ipcMain.handle("localization:set-language", (_event, preference) => {
        // Eingaben werden streng validiert; der Service lehnt alles ab, was
        // keine bekannte Präferenz ist (kein Freitext, keine Objekte).
        if (typeof preference !== "string") {
            return { ok: false, error: "invalid-preference" };
        }

        try {
            return LocalizationService.setLanguage(preference);
        } catch (err) {
            logger.error(`localization:set-language fehlgeschlagen: ${err.message}`);
            return { ok: false, error: "internal-error" };
        }
    });

    ipcMain.handle("localization:get-theme-catalogs", (_event, themeId) => {
        if (typeof themeId !== "string" || !/^[a-z0-9][a-z0-9-]*$/i.test(themeId)) {
            return { ok: false, error: "invalid-theme-id" };
        }

        try {
            const catalogs = LocalizationService.getThemeCatalogs(themeId);
            if (!catalogs) {
                return { ok: false, error: "theme-translations-unavailable" };
            }
            return { ok: true, catalogs };
        } catch (err) {
            logger.error(`localization:get-theme-catalogs fehlgeschlagen: ${err.message}`);
            return { ok: false, error: "internal-error" };
        }
    });

    ipcMain.handle("localization:get-plugin-catalogs", (_event, pluginId) => {
        if (typeof pluginId !== "string" || !/^[a-z0-9][a-z0-9-]*$/i.test(pluginId)) {
            return { ok: false, error: "invalid-plugin-id" };
        }

        try {
            const catalogs = LocalizationService.getPluginCatalogs(pluginId);
            if (!catalogs) {
                return { ok: false, error: "plugin-translations-unavailable" };
            }
            return { ok: true, catalogs };
        } catch (err) {
            logger.error(`localization:get-plugin-catalogs fehlgeschlagen: ${err.message}`);
            return { ok: false, error: "internal-error" };
        }
    });

    ipcMain.handle("localization:get-plugin-translations", (_event, pluginId) => {
        if (typeof pluginId !== "string" || !/^[a-z0-9][a-z0-9-]*$/i.test(pluginId)) {
            return { ok: false, error: "invalid-plugin-id" };
        }

        try {
            const translations = LocalizationService.getPluginTranslations(pluginId);
            if (!translations) {
                return { ok: false, error: "plugin-translations-unavailable" };
            }
            return { ok: true, translations };
        } catch (err) {
            logger.error(`localization:get-plugin-translations fehlgeschlagen: ${err.message}`);
            return { ok: false, error: "internal-error" };
        }
    });
}

module.exports = registerLocalizationHandlers;
