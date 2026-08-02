const fs = require("fs");
const path = require("path");
const eventBus = require("../eventBus");
const { app } = require("electron");
const IntegrationLoader = require("./IntegrationLoader");
const PluginRuntime = require("../plugins/PluginRuntime");
const { createPluginContext } = require("../plugins/PluginContext");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("IntegrationManager");

// Deprecation-Warnungen für direkte Core-Imports
const deprecatedImports = [
  'electron/core/diagnostics/logging/LogManager',
  'electron/core/eventBus',
  'electron/core/storage/SettingsManager',
  'electron/core/storage'
];

function checkDeprecatedImports(integrationPath) {
  const mainFile = path.join(integrationPath, 'index.js');
  if (!fs.existsSync(mainFile)) return;

  const content = fs.readFileSync(mainFile, 'utf8');
  deprecatedImports.forEach(dep => {
    if (content.includes(dep)) {
      logger.warn(
        `[Integration Deprecation] Integration uses deprecated import: ${dep}. ` +
        `Please use pluginAPI instead.`
      );
    }
  });
}

class IntegrationManager {

    constructor() {
        this.integrations = new Map();
        this.initialized = false;
    }

    //
    // Config Management
    //

    readConfig() {
        const configPath = path.join(app.getPath("userData"), "integrations/integrations.json");
        if (!fs.existsSync(configPath)) {
            const configDir = path.dirname(configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            fs.writeFileSync(
                configPath,
                JSON.stringify({ integrations: {} }, null, 2)
            );
        }
        try {
            return JSON.parse(fs.readFileSync(configPath, "utf8"));
        } catch {
            return { integrations: {} };
        }
    }

    writeConfig(config) {
        const configPath = path.join(app.getPath("userData"), "integrations/integrations.json");
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }

    //
    // Lifecycle
    //

    initialize() {
        if (this.initialized) {
            return;
        }

        this.loadIntegrations();

        this.initialized = true;
    }

    shutdown() {
        for (const integration of this.integrations.values()) {
            PluginRuntime.stop(integration);
        }

        this.integrations.clear();

        this.initialized = false;
    }

    //
    // Integration Loading
    //

    loadIntegrations() {
        const config = this.readConfig();
        const discovered = IntegrationLoader.discoverIntegrations();

        for (const integration of discovered) {
            const integrationConfig = config.integrations?.[integration.id];
            if (integrationConfig && integrationConfig.enabled === false) {
                continue;
            }

            this.integrations.set(integration.id, integration);
            PluginRuntime.start(integration);
        }
    }

    //
    // Integration Control
    //

    toggleIntegration(id, enabled) {
        const config = this.readConfig();
        if (!config.integrations) config.integrations = {};
        if (!config.integrations[id]) config.integrations[id] = {};
        config.integrations[id].enabled = enabled;
        this.writeConfig(config);

        const integration = this.integrations.get(id);
        const isActive = integration && integration.loaded;

        if (enabled && !isActive) {
            // Integration neu laden
            const discovered = IntegrationLoader.discoverIntegrations();
            const toLoad = discovered.find(i => i.id === id);
            if (toLoad) {
                this.integrations.set(id, toLoad);
                PluginRuntime.start(toLoad);
            }
        } else if (!enabled && isActive) {
            PluginRuntime.stop(integration);
            this.integrations.delete(id);
        }

        const integrationMeta = integration?.manifest || { id, name: id };
        logger.info(`Integration ${enabled ? "aktiviert" : "deaktiviert"}: ${integrationMeta.name}`);

        eventBus.emit("integrationToggled", { id, enabled });
    }

    enableIntegration(id) {
        const integration = this.integrations.get(id);
        if (!integration) {
            return false;
        }
        return PluginRuntime.start(integration);
    }

    disableIntegration(id) {
        const integration = this.integrations.get(id);
        if (!integration) {
            return false;
        }
        return PluginRuntime.stop(integration);
    }

    reloadIntegration(id) {
        const integration = this.getIntegration(id);
        if (!integration) {
            return false;
        }

        this.disableIntegration(id);
        return this.enableIntegration(id);
    }

    //
    // Getters
    //

    getIntegration(id) {
        return this.integrations.get(id);
    }

    getIntegrations() {
        const config = this.readConfig();
        const result = [];

        for (const integration of this.integrations.values()) {
            result.push({
                id: integration.manifest?.id || integration.id,
                name: integration.manifest?.name || integration.name,
                description: integration.manifest?.description || "",
                version: integration.manifest?.version || "0.0.0",
                author: integration.manifest?.author || "Unknown",
                enabled: config.integrations?.[integration.manifest?.id || integration.id]?.enabled ?? true
            });
        }

        return result;
    }

    hasIntegration(id) {
        return this.integrations.has(id);
    }

    isInitialized() {
        return this.initialized;
    }

    //
    // Renderer Scripts
    //

    getRendererScripts() {
        const config = this.readConfig();
        const scripts = [];

        for (const integration of this.integrations.values()) {
            const manifest = integration.manifest || integration;
            const integrationId = manifest.id;

            if (config.integrations?.[integrationId]?.enabled === false) {
                continue;
            }

            if (manifest.renderer) {
                const rendererAbsPath = path.join(integration.path, manifest.renderer);
                if (fs.existsSync(rendererAbsPath)) {
                    scripts.push('file:///' + rendererAbsPath.replace(/\\/g, '/'));
                }
            }
        }

        return scripts;
    }
}

module.exports = new IntegrationManager();
