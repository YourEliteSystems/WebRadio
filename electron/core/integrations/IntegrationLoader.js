const fs = require("fs");
const path = require("path");

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

    /**
     * Ermittelt den ausführbaren Einstiegspunkt einer Integration.
     *
     * Manifeste dürfen `entry` (dokumentiertes Feld) oder `main` (Feld der
     * Plugin-Runtime) verwenden. Die Runtime lädt ausschließlich `main`;
     * deshalb wird `entry` hier einmalig abgebildet, statt die Runtime zu
     * ändern oder einen Platzhalter-Einstiegspunkt zu erfinden.
     *
     * @param {Object} manifest
     * @param {string} integrationPath
     * @returns {{main:string, mainPath:string}}
     */
    resolveEntry(manifest, integrationPath) {
        const entry = typeof manifest.main === "string" && manifest.main.length > 0
            ? manifest.main
            : typeof manifest.entry === "string" && manifest.entry.length > 0
                ? manifest.entry
                : null;

        if (!entry) {
            throw new Error('Manifest enthält weder "main" noch "entry".');
        }

        const root = path.resolve(integrationPath);
        const mainPath = path.resolve(root, entry);
        if (mainPath !== root && !mainPath.startsWith(root + path.sep)) {
            throw new Error(`Einstiegspunkt liegt außerhalb des Integrationsverzeichnisses: ${entry}`);
        }
        if (!fs.existsSync(mainPath)) {
            throw new Error(`Einstiegspunkt fehlt: ${entry}`);
        }

        return { main: entry, mainPath };
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
                const entry = this.resolveEntry(manifest, integrationPath);

                integrations.push({
                    ...manifest,
                    // Die Plugin-Runtime lädt `manifest.main`; `entry` bleibt
                    // als dokumentiertes Feld erhalten.
                    main: entry.main,
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
