const fs = require("fs");
const StorageManager = require("../../storage/StorageManager");

class HealthCheck {

    constructor() {
        this.initialized = false;
        this.checks = [];
    }

    initialize() {
        if (this.initialized) {
            return;
        }

        // Standardprüfungen
        this.register("Plugin Directory", () => {
            if (!fs.existsSync(StorageManager.getPluginPath())) {
                throw new Error("Plugin directory missing.");
            }
        });

        this.register("Theme Directory", () => {
            if (!fs.existsSync(StorageManager.getThemePath())) {
                throw new Error("Theme directory missing.");
            }
        });

        this.register("Plugin Data", () => {
            if (!fs.existsSync(StorageManager.getPluginDataPath())) {
                throw new Error("Plugin data directory missing.");
            }
        });

        this.register("Logs", () => {
            if (!fs.existsSync(StorageManager.getLogsPath())) {
                throw new Error("Logs directory missing.");
            }
        });

        this.register("History File", () => {
            if (!fs.existsSync(StorageManager.getHistoryFile())) {
                throw new Error("history.json missing.");
            }
        });

        this.register("Favorites File", () => {
            if (!fs.existsSync(StorageManager.getFavoritesFile())) {
                throw new Error("favorites.json missing.");
            }
        });

        this.register("Settings File", () => {
            if (!fs.existsSync(StorageManager.getSettingsFile())) {
                throw new Error("settings.json missing.");
            }
        });

        this.register("Registry File", () => {
            if (!fs.existsSync(StorageManager.getRegistryFile())) {
                throw new Error("registry.json missing.");
            }
        });

        this.initialized = true;
    }

    shutdown() {
        if (!this.initialized) {
            return;
        }

        this.checks = [];
        this.initialized = false;
    }

    register(name, callback) {
        this.checks.push({
            name,
            callback
        });
    }

    run() {
        if (!this.initialized) {
            this.initialize();
        }

        const results = [];

        for (const check of this.checks) {
            try {
                const result = check.callback();
                results.push({
                    name: check.name,
                    success: true,
                    message: result || "OK"
                });
            } catch (err) {
                results.push({
                    name: check.name,
                    success: false,
                    message: err.message
                });
            }
        }

        return results;
    }

}

module.exports = new HealthCheck();