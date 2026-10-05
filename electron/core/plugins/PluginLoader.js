const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const StorageManager = require("../storage/StorageManager");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("PluginLoader");

class PluginLoader {

    loadManifest(pluginPath) {
        // Optional: install.json prüfen, aber nur um das eigentliche Manifest zu finden
        const installJsonPath = path.join(pluginPath, "install.json");
        let manifestFilename = null;

        if (fs.existsSync(installJsonPath)) {
            try {
                const installJson = JSON.parse(fs.readFileSync(installJsonPath, "utf8"));
                if (installJson.manifest && typeof installJson.manifest === "string") {
                    manifestFilename = installJson.manifest;
                }
            } catch (err) {
                logger.warn(`[PluginLoader] Konnte install.json nicht lesen: ${err.message}`);
            }
        }

        // Wenn install.json ein Manifest angibt, dieses bevorzugen
        if (manifestFilename) {
            const customManifestPath = path.join(pluginPath, manifestFilename);
            if (fs.existsSync(customManifestPath)) {
                try {
                    return JSON.parse(fs.readFileSync(customManifestPath, "utf8"));
                } catch (err) {
                    logger.warn(`[PluginLoader] Konnte ${manifestFilename} nicht lesen: ${err.message}`);
                }
            }
        }

        // Fallback: plugin.json (altes Format)
        const pluginJsonPath = path.join(pluginPath, "plugin.json");
        if (fs.existsSync(pluginJsonPath)) {
            return JSON.parse(fs.readFileSync(pluginJsonPath, "utf8"));
        }

        // Fallback auf manifest.json (neues Format)
        const manifestJsonPath = path.join(pluginPath, "manifest.json");
        if (fs.existsSync(manifestJsonPath)) {
            return JSON.parse(fs.readFileSync(manifestJsonPath, "utf8"));
        }

        throw new Error(
            `Kein Manifest gefunden (plugin.json oder manifest.json fehlt in ${pluginPath})`
        );
    }

    // Erzeugt einen Fingerprint für Änderungserkennung
    createFingerprint(plugin) {
        const manifest = plugin.manifest || plugin;
        const relevantFields = {
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            main: manifest.main,
            renderer: manifest.renderer,
            path: plugin.path
        };
        const fingerprintStr = JSON.stringify(relevantFields);
        return crypto.createHash('md5').update(fingerprintStr).digest('hex');
    }

    discoverPlugins() {

        const plugins = [];

        const pluginsPath =
            StorageManager.getPluginPath();

        if (!fs.existsSync(pluginsPath)) {
            return plugins;
        }

        const folders = fs.readdirSync(
            pluginsPath,
            {
                withFileTypes: true
            }
        );

        for (const folder of folders) {

            if (!folder.isDirectory()) {
                continue;
            }

            const pluginPath = path.join(
                pluginsPath,
                folder.name
            );

            try {

                const manifest =
                    this.loadManifest(pluginPath);

                const plugin = {
                    ...manifest,
                    path: pluginPath,
                    dir: folder.name
                };

                plugin.fingerprint = this.createFingerprint(plugin);

                plugins.push(plugin);

            } catch (err) {

                logger.error(
                    `[PluginLoader] ${folder.name}`,
                    err.message
                );

            }

        }

        return plugins;

    }
}

module.exports = new PluginLoader();