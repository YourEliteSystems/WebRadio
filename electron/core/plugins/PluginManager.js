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

    /**
     * Discovery-Rescan: scannt das Plugin-Verzeichnis erneut und führt den
     * Runtime-Zustand mit dem aktuellen Dateisystem-Zustand zusammen.
     *
     * Unterschied zu reloadPlugin(id):
     *   - reloadPlugin(id): lädt ein einzelnes, bereits bekanntes Plugin neu.
     *   - reloadPlugins():  globaler Rescan inkl. neuer/entfernter/geänderter Plugins.
     *
     * Die Konfiguration in `plugins.json` (enabled-Flag) bleibt maßgeblich.
     */
    reloadPlugins() {
        const config = this.readConfig();
        const discovered = PluginLoader.discoverPlugins();

        const result = {
            success: true,
            added: [],
            removed: [],
            changed: [],
            unchanged: [],
            disabled: [],
            errors: []
        };

        const isDisabled = (id) =>
            config.plugins?.[id]?.enabled === false;

        const pluginIdOf = (p) => p?.manifest?.id || p?.id;

        // Snapshot der aktuell geladenen Plugins nach ID
        const currentPlugins = new Map();
        for (const plugin of this.plugins.values()) {
            const id = pluginIdOf(plugin);
            if (id) currentPlugins.set(id, plugin);
        }

        // Snapshot der neu entdeckten Plugins nach ID
        const discoveredPlugins = new Map();
        for (const plugin of discovered) {
            const id = pluginIdOf(plugin);
            if (!id) {
                logger.warn("Plugin ohne ID beim Rescan übersprungen");
                continue;
            }
            discoveredPlugins.set(id, plugin);
        }

        const loadedIds = new Set();
        const failedIds = new Set();

        // 1) Discovery-Scan: neue, geänderte und deaktivierte Plugins behandeln.
        for (const [id, newPlugin] of discoveredPlugins) {
            // Deaktiviertes Plugin darf nach Rescan nicht (erneut) geladen werden.
            if (isDisabled(id)) {
                if (currentPlugins.has(id)) {
                    try {
                        const old = currentPlugins.get(id);
                        PluginRuntime.stop(old);
                        this.plugins.delete(id);
                        result.disabled.push(id);
                        logger.info(
                            `Plugin deaktiviert (Rescan): ${old?.manifest?.name || id}`
                        );
                    } catch (err) {
                        result.errors.push({ id, error: err.message });
                        logger.error(
                            `Fehler beim Stoppen des deaktivierten Plugins ${id}: ${err.message}`
                        );
                    }
                }
                continue;
            }

            const currentPlugin = currentPlugins.get(id);

            if (!currentPlugin) {
                // Neues Plugin
                try {
                    const started = PluginRuntime.start(newPlugin);
                    if (!started) {
                        failedIds.add(id);
                        result.errors.push({
                            id,
                            error: "PluginRuntime.start() returned false"
                        });
                        continue;
                    }
                    this.plugins.set(id, newPlugin);
                    loadedIds.add(id);
                    result.added.push(id);
                    logger.info(
                        `Plugin neu geladen (Rescan): ${newPlugin.manifest?.name || id}`
                    );
                } catch (err) {
                    failedIds.add(id);
                    result.errors.push({ id, error: err.message });
                    logger.error(
                        `Fehler beim Laden von Plugin ${id}: ${err.message}`
                    );
                }
                continue;
            }

            // Existierendes Plugin: Fingerprint-Vergleich für Änderungen
            const oldFingerprint = currentPlugin.fingerprint;
            const newFingerprint = newPlugin.fingerprint;

            if (oldFingerprint !== newFingerprint) {
                try {
                    PluginRuntime.stop(currentPlugin);
                    this.plugins.delete(id);

                    const started = PluginRuntime.start(newPlugin);
                    if (!started) {
                        failedIds.add(id);
                        result.errors.push({
                            id,
                            error: "PluginRuntime.start() returned false"
                        });
                        // Altes Plugin bewusst nicht neu starten — würde
                        // potentiell Listener/Navigation doppelt registrieren.
                        logger.error(
                            `Geändertes Plugin ${id} konnte nicht gestartet werden, ` +
                            `altes Plugin bleibt entladen.`
                        );
                        continue;
                    }
                    this.plugins.set(id, newPlugin);
                    loadedIds.add(id);
                    result.changed.push(id);
                    logger.info(
                        `Plugin geändert und neu geladen (Rescan): ${newPlugin.manifest?.name || id}`
                    );
                } catch (err) {
                    failedIds.add(id);
                    result.errors.push({ id, error: err.message });
                    logger.error(
                        `Fehler beim Neuladen von Plugin ${id}: ${err.message}`
                    );
                }
            } else {
                result.unchanged.push(id);
                loadedIds.add(id);
            }
        }

        // 2) Im aktuellen Lauf entfernte Plugins sauber stoppen.
        for (const [id, plugin] of currentPlugins) {
            if (!discoveredPlugins.has(id) && !failedIds.has(id)) {
                try {
                    PluginRuntime.stop(plugin);
                    this.plugins.delete(id);
                    result.removed.push(id);
                    logger.info(
                        `Plugin entfernt (Rescan): ${plugin?.manifest?.name || id}`
                    );
                } catch (err) {
                    result.errors.push({ id, error: err.message });
                    logger.error(
                        `Fehler beim Entfernen von Plugin ${id}: ${err.message}`
                    );
                }
            }
        }

        // Falls einzelne Operationen Fehler verursacht haben: success = false,
        // aber Rescan wurde dennoch so weit wie möglich fortgeführt.
        if (result.errors.length > 0) {
            result.success = false;
        }

        // EventBus Event für interne Konsumenten
        eventBus.emit("plugins:changed", result);

        logger.info(
            `Plugin-Rescan abgeschlossen: ` +
            `${result.added.length} neu, ${result.removed.length} entfernt, ` +
            `${result.changed.length} geändert, ${result.unchanged.length} unverändert, ` +
            `${result.disabled.length} deaktiviert, ${result.errors.length} Fehler`
        );

        return result;
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