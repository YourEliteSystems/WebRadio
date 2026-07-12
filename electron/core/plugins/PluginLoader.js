const fs = require("fs");
const path = require("path");

const StorageManager = require("../storage/StorageManager");

class PluginLoader {

    loadManifest(pluginPath) {

        const manifestPath = path.join(
            pluginPath,
            "manifest.json"
        );

        if (!fs.existsSync(manifestPath)) {
            throw new Error(
                `manifest.json fehlt in ${pluginPath}`
            );
        }

        return JSON.parse(
            fs.readFileSync(
                manifestPath,
                "utf8"
            )
        );

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

                plugins.push({

                    ...manifest,

                    path: pluginPath

                });

            } catch (err) {

                console.error(
                    `[PluginLoader] ${folder.name}`,
                    err.message
                );

            }

        }

        return plugins;

    }

}

module.exports = new PluginLoader();