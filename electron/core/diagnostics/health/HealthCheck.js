const fs = require("fs");
const StorageManager = require("../../storage/StorageManager");

class HealthCheck {

    constructor() {
        this.checks = [];
    }

    register(name, callback) {

        this.checks.push({
            name,
            callback
        });

    }

    run() {

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

const healthCheck = new HealthCheck();

//
// Standardprüfungen
//

healthCheck.register("Plugin Directory", () => {

    if (!fs.existsSync(StorageManager.getPluginPath())) {
        throw new Error("Plugin directory missing.");
    }

});

healthCheck.register("Theme Directory", () => {

    if (!fs.existsSync(StorageManager.getThemePath())) {
        throw new Error("Theme directory missing.");
    }

});

healthCheck.register("Plugin Data", () => {

    if (!fs.existsSync(StorageManager.getPluginDataPath())) {
        throw new Error("Plugin data directory missing.");
    }

});

healthCheck.register("Logs", () => {

    if (!fs.existsSync(StorageManager.getLogsPath())) {
        throw new Error("Logs directory missing.");
    }

});

healthCheck.register("Storage File", () => {

    if (!fs.existsSync(StorageManager.getStorageFile())) {
        throw new Error("storage.json missing.");
    }

});

healthCheck.register("Registry File", () => {

    if (!fs.existsSync(StorageManager.getRegistryFile())) {
        throw new Error("registry.json missing.");
    }

});

module.exports = healthCheck;