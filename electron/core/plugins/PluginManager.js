const fs = require('fs');
const path = require('path');
const eventBus = require('../eventBus');
const { app } = require('electron');
const PluginLoader = require('./PluginLoader');
const PluginRuntime = require('./PluginRuntime');
const { createPluginContext } = require('./PluginContext');
const LogManager = require('../diagnostics/logging/LogManager');
const PluginPermissions = require('./PluginPermissions');
const CapabilityRegistry = require('./CapabilityRegistry');
const PluginHttpServer = require('./PluginHttpServer');

const logger = LogManager.getLogger('PluginManager');

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
      logger.warn(`[Plugin Deprecation] Plugin uses deprecated import: ${dep}. Please use pluginAPI instead.`);
    }
  });
}

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.initialized = false;
  }

  readConfig() {
    const configPath = path.join(app.getPath('userData'), 'plugins/plugins.json');
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({ plugins: {} }, null, 2));
    }
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      return { plugins: {} };
    }
  }

  writeConfig(config) {
    fs.writeFileSync(path.join(app.getPath('userData'), 'plugins/plugins.json'), JSON.stringify(config, null, 2));
  }

  initialize() {
    if (this.initialized) return;
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

  loadPlugins() {
    const config = this.readConfig();
    const discovered = PluginLoader.discoverPlugins();
    for (const plugin of discovered) {
      const pluginConfig = config.plugins?.[plugin.id];
      this.plugins.set(plugin.id, plugin);
      if (pluginConfig && pluginConfig.enabled === false) {
        plugin.loaded = false;
        continue;
      }
      PluginRuntime.start(plugin);
    }
  }

  togglePlugin(id, enabled) {
    const config = this.readConfig();
    if (!config.plugins) config.plugins = {};
    if (!config.plugins[id]) config.plugins[id] = {};
    config.plugins[id].enabled = enabled;
    this.writeConfig(config);
    const plugin = this.plugins.get(id);
    if (!plugin) return;
    if (enabled) PluginRuntime.start(plugin);
    else PluginRuntime.stop(plugin);
  }

  rescan() {
    const config = this.readConfig();
    const discovered = PluginLoader.discoverPlugins();
    const existingIds = new Set(this.plugins.keys());
    const discoveredIds = new Set();
    const result = { added: [], removed: [], changed: [], unchanged: [], disabled: [], errors: [], success: true };

    for (const plugin of discovered) {
      const pluginId = plugin.manifest?.id || plugin.id;
      discoveredIds.add(pluginId);
      const pluginConfig = config.plugins?.[pluginId];
      const enabled = pluginConfig?.enabled ?? true;
      const existing = this.plugins.get(pluginId);

      if (!existing) {
        this.plugins.set(pluginId, plugin);
        if (enabled) {
          const started = PluginRuntime.start(plugin);
          if (started) {
            result.added.push(pluginId);
          } else {
            result.errors.push({ id: pluginId, error: 'Plugin start failed' });
            result.success = false;
          }
        } else {
          plugin.loaded = false;
          result.disabled.push(pluginId);
        }
      } else if (existing.fingerprint !== plugin.fingerprint) {
        try {
          PluginRuntime.stop(existing);
          this.plugins.delete(pluginId);
          this.plugins.set(pluginId, plugin);
          if (enabled) {
            PluginRuntime.start(plugin);
            result.changed.push(pluginId);
          } else {
            plugin.loaded = false;
            result.disabled.push(pluginId);
          }
        } catch (err) {
          result.errors.push({ id: pluginId, error: err.message });
          result.success = false;
        }
      } else if (enabled) {
        // Plugin exists, fingerprint unchanged, still enabled - unchanged
        result.unchanged.push(pluginId);
      } else {
        // Plugin exists, fingerprint unchanged, but now disabled
        try {
          PluginRuntime.stop(existing);
          existing.loaded = false;
          result.disabled.push(pluginId);
        } catch (err) {
          result.errors.push({ id: pluginId, error: err.message });
          result.success = false;
        }
      }
    }

    for (const existingId of existingIds) {
      if (!discoveredIds.has(existingId)) {
        const plugin = this.plugins.get(existingId);
        if (plugin) {
          try {
            PluginRuntime.stop(plugin);
            this.plugins.delete(existingId);
            result.removed.push(existingId);
            logger.info(`Plugin entfernt (Rescan): ${plugin?.manifest?.name || existingId}`);
          } catch (err) {
            result.errors.push({ id: existingId, error: err.message });
            logger.error(`Fehler beim Entfernen von Plugin ${existingId}: ${err.message}`);
          }
        }
      }
    }

    if (result.errors.length > 0) result.success = false;
    eventBus.emit('plugins:changed', result);
    logger.info(`Plugin-Rescan abgeschlossen: ${result.added.length} neu, ${result.removed.length} entfernt, ${result.changed.length} geändert, ${result.unchanged.length} unverändert, ${result.disabled.length} deaktiviert, ${result.errors.length} Fehler`);
    return result;
  }

  reloadPlugins() {
    return this.rescan();
  }
  getPlugin(id) {
    return this.plugins.get(id);
  }

  getPlugins() {
    const config = this.readConfig();
    const discovered = PluginLoader.discoverPlugins();
    const result = [];
    for (const plugin of discovered) {
      const pluginId = plugin.manifest?.id || plugin.id;
      const pluginConfig = config.plugins?.[pluginId];
      const enabled = pluginConfig?.enabled ?? true;
      const isActive = this.plugins.has(pluginId) && this.plugins.get(pluginId).loaded;
      result.push({
        id: pluginId,
        name: plugin.manifest?.name || plugin.name,
        enabled: enabled,
        loaded: isActive
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

  getRendererScripts() {
    const config = this.readConfig();
    const scripts = [];
    for (const plugin of this.plugins.values()) {
      const manifest = plugin.manifest || plugin;
      const pluginId = manifest.id;
      if (config.plugins?.[pluginId]?.enabled === false) continue;

      if (manifest['http-origin']) {
        const origin = PluginHttpServer.getUrl();
        if (origin && manifest.renderer) {
          scripts.push(`${origin}/plugins/${pluginId}/${manifest.renderer}`);
        }
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