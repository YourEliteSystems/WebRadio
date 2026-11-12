"use strict";

/**
 * PluginUpdateRuntime
 *
 * Einmalige Verdrahtung des Update-Dienstes mit der Anwendung:
 * App-Version, Plugin-Verzeichnisse, PluginManager und Logging. Die
 * Fachlogik liegt vollständig in `PluginUpdateService` und bleibt dadurch
 * ohne Electron-Abhängigkeit testbar.
 */

const path = require("path");
const { app, BrowserWindow } = require("electron");

const StorageManager = require("../../storage/StorageManager");
const PluginManager = require("../PluginManager");
const LogManager = require("../../diagnostics/logging/LogManager");
const PluginUpdateService = require("./PluginUpdateService");
const LocalizationService = require("../../localization/LocalizationService");

const logger = LogManager.getLogger("PluginUpdate");

function broadcast(channel, payload) {
  try {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(channel, payload);
    }
  } catch (error) {
    logger.warn(`Broadcast ${channel} fehlgeschlagen: ${error.message}`);
  }
}

class PluginUpdateRuntime {
  constructor() {
    this.service = null;
  }

  initialize() {
    if (this.service) return this.service;

    this.service = new PluginUpdateService({
      appVersion: app.getVersion(),
      pluginsRoot: StorageManager.getPluginPath(),
      updatesRoot: path.join(app.getPath("userData"), "plugin-updates"),
      logger,
      emit: (state) => broadcast("pluginUpdates:changed", state),
      // Übersetzungskataloge werden gemeinsam mit dem Plugin installiert,
      // aktualisiert und zurückgerollt.
      localizationAdapter: {
        provision: (pluginId, manifest) => (manifest && manifest.localization
          ? LocalizationService.provisionPluginCatalogs(pluginId, manifest.localization)
          : LocalizationService.clearPluginCatalogs(pluginId)),
        restore: (pluginId, backupPath) =>
          LocalizationService.restorePluginCatalogs(pluginId, backupPath)
      },
      getInstalledPlugins: () => {
        const enabled = new Map(
          PluginManager.getPlugins().map((plugin) => [plugin.id, plugin.enabled !== false])
        );
        const discovered = require("../PluginLoader").discoverPlugins();
        return discovered.map((plugin) => {
          const manifest = plugin.manifest || plugin;
          return {
            ...plugin,
            // Deaktivierte Plugins bleiben sichtbar, werden aber nicht
            // automatisch aktualisiert.
            updateEnabled: enabled.get(manifest.id) !== false
          };
        });
      },
      isPluginEnabled: (id) => {
        const entry = PluginManager.getPlugins().find((plugin) => plugin.id === id);
        return entry ? entry.enabled !== false : true;
      },
      reloadPlugins: async () => PluginManager.reloadPlugins()
    });

    this.service.startAutoCheck();
    logger.info("Plugin-Update-Dienst initialisiert.");
    return this.service;
  }

  getService() {
    return this.service;
  }

  shutdown() {
    if (this.service) {
      this.service.shutdown();
      this.service = null;
    }
  }
}

module.exports = new PluginUpdateRuntime();
