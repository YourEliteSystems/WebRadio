const fs = require("fs");
const path = require("path");
const { app } = require("electron");

class StorageManager {

    constructor() {
        this.userData = app.getPath("userData");
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

        this.ensureFile(
            this.getStorageFile(),
            JSON.stringify({
                history: [],
                favorites: [],
                settings: {}
            }, null, 2)
        );

        this.ensureFile(
            this.getRegistryFile(),
            JSON.stringify({
                version: 1,
                packages: {}
            }, null, 2)
        );

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

    // ---------------------------------------------------------
    // UserData
    // ---------------------------------------------------------

    getUserDataPath() {
        return this.userData;
    }

    // ---------------------------------------------------------
    // Ordner
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
    // Dateien
    // ---------------------------------------------------------

    getStorageFile() {
        return path.join(this.userData, "storage.json");
    }

    getRegistryFile() {
        return path.join(this.userData, "registry.json");
    }

    getSettingsFile() {
        return path.join(this.userData, "settings.json");
    }

}

module.exports = new StorageManager();