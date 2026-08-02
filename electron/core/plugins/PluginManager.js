const fs = require("fs");
const path = require("path");
const eventBus = require("../eventBus");
const { app } = require("electron");
const PluginLoader = require("./PluginLoader");
const PluginRuntime = require("./PluginRuntime");
const { createPluginContext } = require("./PluginContext");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("PluginManager");

// Deprecation-Warnungen für direkte Core-Imports
const deprecatedImports = [
  'electron/core/diagnostics/logging/LogManager',
  'electron/core/eventBus',
  'electron/core/storage/SettingsManager',
  'electron/core/storage'
];

function checkDeprecatedImports(pluginPath) {
  const mainFile = path.join(pluginPath, 'main.js');
  if (!fs.existsSync(mainFile)) return;

  const content = fs.readFileSync(mainFile, 'utf8');
  deprecatedImports.forEach(dep => {
    if (content.includes(dep)) {
      logger.warn(
        `[Plugin Deprecation] Plugin uses deprecated import: ${dep}. ` +
        `Please use pluginAPI instead.`
      );
    }
  });
}

class PluginManager {

    constructor() {
        this.plugins = new Map();
        this.initialized = false;
    }

    //
    // Config Management
    //

    readConfig() {
        const configPath = path.join(app.getPath("userData"), "plugins/plugins.json");
        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(
                configPath,
                JSON.stringify({ plugins: {} }, null, 2)
            );
        }
        try {
            return JSON.parse(fs.readFileSync(configPath, "utf8"));
        } catch {
            return { plugins: {} };
        }
    }

    writeConfig(config) {
        const configPath = path.join(app.getPath("userData"), "plugins/plugins.json");
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }

    //
    // Lifecycle
    //

    initialize() {
        if (this.initialized) {
            return;
        }

        this.loadPlugins();

        this.initialized = true;
    }

    shutdown() {
        for (const plugin of this.plugins.values()) {
            PluginRuntime.stop(plugin);
        }

        this.plugins.clear();

        this.initialized = false;
    }

    //
    // Plugin Loading
    //

    loadPlugins() {
        const config = this.readConfig();
        const discovered = PluginLoader.discoverPlugins();

        for (const plugin of discovered) {
            const pluginConfig = config.plugins?.[plugin.id];
            if (pluginConfig && pluginConfig.enabled === false) {
                continue;
            }

            this.plugins.set(plugin.id, plugin);
            PluginRuntime.start(plugin);
        }
    }

    //
    // Plugin Control
    //

    togglePlugin(id, enabled) {
        const config = this.readConfig();
        if (!config.plugins) config.plugins = {};
        if (!config.plugins[id]) config.plugins[id] = {};
        config.plugins[id].enabled = enabled;
        this.writeConfig(config);

        const plugin = this.plugins.get(id);
        const isActive = plugin && plugin.loaded;

        if (enabled && !isActive) {
            // Plugin neu laden
            const discovered = PluginLoader.discoverPlugins();
            const toLoad = discovered.find(p => p.id === id);
            if (toLoad) {
                this.plugins.set(id, toLoad);
                PluginRuntime.start(toLoad);
            }
        } else if (!enabled && isActive) {
            PluginRuntime.stop(plugin);
            this.plugins.delete(id);
        }

        const pluginMeta = plugin?.manifest || { id, name: id };
        logger.info(`Plugin ${enabled ? "aktiviert" : "deaktiviert"}: ${pluginMeta.name}`);

        eventBus.emit("pluginToggled", { id, enabled });
    }

    enablePlugin(id) {
        const plugin = this.plugins.get(id);
        if (!plugin) {
            return false;
        }
        return PluginRuntime.start(plugin);
    }

    disablePlugin(id) {
        const plugin = this.plugins.get(id);
        if (!plugin) {
            return false;
        }
        return PluginRuntime.stop(plugin);
    }

    reloadPlugin(id) {
        const plugin = this.getPlugin(id);
        if (!plugin) {
            return false;
        }

        this.disablePlugin(id);
        return this.enablePlugin(id);
    }

    //
    // Getters
    //

    getPlugin(id) {
        return this.plugins.get(id);
    }

    getPlugins() {
        const config = this.readConfig();
        const result = [];

        for (const plugin of this.plugins.values()) {
            result.push({
                id: plugin.manifest?.id || plugin.id,
                name: plugin.manifest?.name || plugin.name,
                enabled: config.plugins?.[plugin.manifest?.id || plugin.id]?.enabled ?? true
            });
        }

        return result;
    }

    hasPlugin(id) {
        return this.plugins.has(id);
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

        for (const plugin of this.plugins.values()) {
            const manifest = plugin.manifest || plugin;
            const pluginId = manifest.id;

            if (config.plugins?.[pluginId]?.enabled === false) {
                continue;
            }

            if (manifest.renderer) {
                const rendererAbsPath = path.join(plugin.path, manifest.renderer);
                if (fs.existsSync(rendererAbsPath)) {
                    scripts.push('file:///' + rendererAbsPath.replace(/\\/g, '/'));
                }
            }
        }

        return scripts;
    }
}

module.exports = new PluginManager();