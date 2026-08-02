const fs = require("fs");
const path = require("path");

const StorageManager = require("../storage/StorageManager");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("IntegrationLoader");

class IntegrationLoader {

    loadManifest(integrationPath) {
        const manifestPath = path.join(integrationPath, "manifest.json");
        
        if (!fs.existsSync(manifestPath)) {
            throw new Error(
                `manifest.json fehlt in ${integrationPath}`
            );
        }

        const manifest = JSON.parse(
            fs.readFileSync(manifestPath, "utf8")
        );

        // Validiere dass es sich um eine Integration handelt
        if (manifest.type !== "integration") {
            throw new Error(
                `Manifest type muss "integration" sein, ist aber "${manifest.type}"`
            );
        }

        return manifest;
    }

    discoverIntegrations() {
        const integrations = [];
        
        // Integrationen befinden sich im Projekt-Verzeichnis (nicht userData)
        const integrationsPath = path.join(
            path.dirname(__dirname),
            "..",
            "..",
            "integrations"
        );

        if (!fs.existsSync(integrationsPath)) {
            logger.debug(
                `[IntegrationLoader] Integrations-Verzeichnis nicht gefunden: ${integrationsPath}`
            );
            return integrations;
        }

        const folders = fs.readdirSync(
            integrationsPath,
            {
                withFileTypes: true
            }
        );

        for (const folder of folders) {
            if (!folder.isDirectory()) {
                continue;
            }

            const integrationPath = path.join(
                integrationsPath,
                folder.name
            );

            try {
                const manifest = this.loadManifest(integrationPath);

                integrations.push({
                    ...manifest,
                    path: integrationPath,
                    dir: folder.name
                });

            } catch (err) {
                logger.error(
                    `[IntegrationLoader] ${folder.name}: ${err.message}`
                );
            }
        }

        return integrations;
    }
}

module.exports = new IntegrationLoader();
