const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("StorageManager");

class StorageManager {

    constructor() {
        this.userData = (app && typeof app.getPath === "function")
            ? app.getPath("userData")
            : path.join(process.cwd(), "data");
    }

    // ---------------------------------------------------------
    // Initialisierung
    // ---------------------------------------------------------

    initialize() {

        [
            this.getPluginPath(),
            this.getThemePath(),
            this.getPluginDataPath(),
            this.getLogsPath(),
            this.getCrashPath(),
            this.getPackagesPath(),
            this.getReportsPath()
        ].forEach(dir => this.ensureDirectory(dir));

        // Separate Dateien statt monolithischem storage.json
        this.ensureFile(
            this.getHistoryFile(),
            JSON.stringify([], null, 2)
        );

        this.ensureFile(
            this.getFavoritesFile(),
            JSON.stringify([], null, 2)
        );

        this.ensureFile(
            this.getSettingsFile(),
            JSON.stringify({}, null, 2)
        );

        this.ensureFile(
            this.getRegistryFile(),
            JSON.stringify({
                version: 1,
                packages: {}
            }, null, 2)
        );

        // Migration: Falls altes storage.json noch existiert, Daten übernehmen
        this._migrateFromLegacyStorage();

    }

    // ---------------------------------------------------------
    // Legacy-Migration
    // ---------------------------------------------------------

    _migrateFromLegacyStorage() {
        const legacyFile = path.join(this.userData, "storage.json");
        if (!fs.existsSync(legacyFile)) return;

        try {
            const legacy = JSON.parse(fs.readFileSync(legacyFile, "utf-8"));

            // History migrieren (nur wenn Zieldatei leer ist)
            const historyFile = this.getHistoryFile();
            const existingHistory = this._readJsonFile(historyFile, []);
            if (Array.isArray(legacy.history) && legacy.history.length > 0 && existingHistory.length === 0) {
                fs.writeFileSync(historyFile, JSON.stringify(legacy.history, null, 2));
                logger.info("Legacy storage.json: History migriert.");
            }

            // Favorites migrieren
            const favFile = this.getFavoritesFile();
            const existingFavs = this._readJsonFile(favFile, []);
            if (Array.isArray(legacy.favorites) && legacy.favorites.length > 0 && existingFavs.length === 0) {
                fs.writeFileSync(favFile, JSON.stringify(legacy.favorites, null, 2));
                logger.info("Legacy storage.json: Favorites migriert.");
            }

            // Settings migrieren
            const settingsFile = this.getSettingsFile();
            const existingSettings = this._readJsonFile(settingsFile, {});
            if (legacy.settings && Object.keys(legacy.settings).length > 0 && Object.keys(existingSettings).length === 0) {
                fs.writeFileSync(settingsFile, JSON.stringify(legacy.settings, null, 2));
                logger.info("Legacy storage.json: Settings migriert.");
            }

        } catch (err) {
            logger.warn(`Legacy-Migration fehlgeschlagen: ${err.message}`);
        }
    }

    // ---------------------------------------------------------
    // Verzeichnisse
    // ---------------------------------------------------------

    ensureDirectory(dir) {
        if (typeof dir !== "string") {
            throw new TypeError(
                `Invalid directory path: ${dir}`
            );
        }
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {
                recursive: true
            });
        }
    }

    // ---------------------------------------------------------
    // Dateien
    // ---------------------------------------------------------

    ensureFile(file, defaultContent = "{}") {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, defaultContent, "utf8");
        }
    }

    _readJsonFile(file, defaultValue) {
        if (!fs.existsSync(file)) return defaultValue;
        try {
            return JSON.parse(fs.readFileSync(file, "utf-8"));
        } catch {
            return defaultValue;
        }
    }

    _writeJsonFile(file, data) {
        try {
            fs.writeFileSync(file, JSON.stringify(data, null, 2));
        } catch (err) {
            logger.error(`Fehler beim Schreiben von ${file}: ${err.message}`);
        }
    }

    // ---------------------------------------------------------
    // UserData
    // ---------------------------------------------------------

    getUserDataPath() {
        return this.userData;
    }

    // ---------------------------------------------------------
    // Ordner-Pfade
    // ---------------------------------------------------------

    getPluginPath() {
        return path.join(this.userData, "plugins");
    }

    getThemePath() {
        return path.join(this.userData, "themes");
    }

    getPluginDataPath() {
        return path.join(this.userData, "plugin-data");
    }

    getLogsPath() {
        return path.join(this.userData, "logs");
    }

    getCrashPath() {
        return path.join(this.userData, "crash");
    }

    getPackagesPath() {
        return path.join(this.userData, "packages");
    }

    getReportsPath() {
        return path.join(this.userData, "reports");
    }

    // ---------------------------------------------------------
    // Datei-Pfade
    // ---------------------------------------------------------

    getHistoryFile() {
        return path.join(this.userData, "history.json");
    }

    getFavoritesFile() {
        return path.join(this.userData, "favorites.json");
    }

    getSettingsFile() {
        return path.join(this.userData, "settings.json");
    }

    getRegistryFile() {
        return path.join(this.userData, "registry.json");
    }

    // ---------------------------------------------------------
    // History
    // ---------------------------------------------------------

    getHistory() {
        return this._readJsonFile(this.getHistoryFile(), []);
    }

    addHistory(entry) {
        let history = this._readJsonFile(this.getHistoryFile(), []);
        // Doppelten Eintrag entfernen (damit er an die Spitze kommt)
        history = history.filter(
            e => e.url !== entry.url && e.url_resolved !== entry.url
        );
        history.unshift({ ...entry, lastPlayed: Date.now() });
        // Auf 100 Einträge begrenzen
        if (history.length > 100) history.pop();
        this._writeJsonFile(this.getHistoryFile(), history);
    }

    // ---------------------------------------------------------
    // Favorites
    // ---------------------------------------------------------

    getFavorites() {
        return this._readJsonFile(this.getFavoritesFile(), []);
    }

    addFavorite(entry) {
        const favorites = this._readJsonFile(this.getFavoritesFile(), []);
        const url = entry.url_resolved || entry.url;
        const exists = favorites.some(
            e => e.url === url || e.url_resolved === url
        );
        if (!exists) {
            favorites.push({ ...entry, addedAt: Date.now() });
            this._writeJsonFile(this.getFavoritesFile(), favorites);
        }
    }

    removeFavorite(url) {
        const favorites = this._readJsonFile(this.getFavoritesFile(), []);
        const filtered = favorites.filter(
            e => e.url !== url && e.url_resolved !== url
        );
        this._writeJsonFile(this.getFavoritesFile(), filtered);
    }

    // ---------------------------------------------------------
    // Settings
    // ---------------------------------------------------------

    getSettings() {
        return this._readJsonFile(this.getSettingsFile(), {});
    }

    updateSettings(newSettings) {
        const current = this._readJsonFile(this.getSettingsFile(), {});
        this._writeJsonFile(this.getSettingsFile(), { ...current, ...newSettings });
    }

}

module.exports = new StorageManager();