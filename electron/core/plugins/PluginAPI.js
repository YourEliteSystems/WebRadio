"use strict";

const eventBus = require("../eventBus");
const fs = require("fs");
const PluginStorage = require("./PluginStorage");
const UIManager = require("../ui/UIManager");
const NavigationManager = require("../navigation/NavigationManager");
const PluginPermissions = require("./PluginPermissions");
const LogManager = require("../diagnostics/logging/LogManager");
const SettingsManager = require("../storage/SettingsManager");
const playerManager = require("../player/PlayerManager");
const PluginHttpServer = require("./PluginHttpServer");
const { app } = require("electron");

const PLUGIN_API_VERSION = "1.1.0";

function create(meta = {}) {
  const pluginId = meta.id || "anonymous";
  const permissions = meta.permissions || [];

  function checkNavPermission() {
    if (!PluginPermissions.hasPermission(permissions, "navigation")) {
      const msg = `[PluginAPI] Plugin "${pluginId}" benötigt die Berechtigung "navigation", um auf die Navigation Extension API zuzugreifen.`;
      const logger = LogManager.getLogger(`Plugin:${pluginId}`);
      logger.error(msg);
      throw new Error(msg);
    }
  }

  function checkPlayerPermission() {
    if (!PluginPermissions.hasPermission(permissions, "player")) {
      const msg = `[PluginAPI] Plugin "${pluginId}" benötigt die Berechtigung "player", um auf die Player API zuzugreifen.`;
      const logger = LogManager.getLogger(`Plugin:${pluginId}`);
      logger.error(msg);
      throw new Error(msg);
    }
  }

  return {
    plugin: meta,
    version: {
      pluginAPI: PLUGIN_API_VERSION,
      application: (app && typeof app.getVersion === "function") ? app.getVersion() : "1.0.5"
    },

    logger: (context) => {
      return LogManager.getLogger(`Plugin:${meta.name || pluginId}:${context}`);
    },

    events: {
      on(event, callback) {
        eventBus.on(event, callback);
      },

      once(event, callback) {
        eventBus.once(event, callback);
      },

      off(event, callback) {
        eventBus.off(event, callback);
      },

      emit(event, payload) {
        eventBus.emit(event, payload);
      }
    },

    navigation: {
      registerSection(section) {
        checkNavPermission();
        return NavigationManager.registerSection(section, pluginId);
      },

      registerItem(item) {
        checkNavPermission();
        return NavigationManager.registerItem(item, pluginId);
      },

      updateItem(id, updates) {
        checkNavPermission();
        return NavigationManager.updateItem(id, updates, pluginId);
      },

      removeItem(id) {
        checkNavPermission();
        return NavigationManager.removeItem(id, pluginId);
      },

      removeSection(id) {
        checkNavPermission();
        return NavigationManager.removeSection(id, pluginId);
      },

      getTree() {
        return NavigationManager.getTree();
      },

      getSections() {
        return NavigationManager.getSections();
      },

      getItems(sectionId) {
        return NavigationManager.getItems(sectionId);
      }
    },

    storage: {
      exists() {
        return fs.existsSync(PluginStorage.getPluginFile(meta.id));
      },

      read() {
        return PluginStorage.read(meta.id);
      },

      write(data) {
        PluginStorage.write(meta.id, data);
      },

      delete() {
        const file = PluginStorage.getPluginFile(meta.id);
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      },

      get(key) {
        const data = PluginStorage.read(meta.id);
        return data[key];
      },

      set(key, value) {
        const data = PluginStorage.read(meta.id);
        data[key] = value;
        PluginStorage.write(meta.id, data);
      },

      remove(key) {
        const data = PluginStorage.read(meta.id);
        delete data[key];
        PluginStorage.write(meta.id, data);
      },

      has(key) {
        const data = PluginStorage.read(meta.id);
        return key in data;
      }
    },

    httpOrigin: {
      getUrl() {
        return PluginHttpServer.getUrl();
      },
      getPort() {
        return PluginHttpServer.getPort();
      },
      getPluginUrl(pluginId, relativePath) {
        return PluginHttpServer.getPluginUrl(pluginId, relativePath);
      }
    },

    settings: {
      get(key) {
        const settings = SettingsManager.get();
        return settings[key];
      },

      set(key, value) {
        const settings = SettingsManager.get();
        settings[key] = value;
        SettingsManager.update(settings);
      },

      has(key) {
        const settings = SettingsManager.get();
        return key in settings;
      },

      delete(key) {
        const settings = SettingsManager.get();
        delete settings[key];
        SettingsManager.update(settings);
      }
    },

    ui: {
      register(item) {
        UIManager.register(item, {
          pluginId: meta.id,
          version: meta.version,
          source: "plugin"
        });
      },
      unregister(id) {
        UIManager.unregister(id);
      }
    },

    /**
     * Player API – erlaubt Plugins, Provider zu registrieren und den
     * Player-State zu abonnieren.
     * Erfordert die Permission "player" im Plugin-Manifest.
     */
    player: {
      /**
       * Registriert einen Player-Provider.
       * @param {object} spec  { id, name, play, pause, stop, setVolume, getState }
       * @returns {{ unregister: Function }}
       */
      registerProvider(spec) {
        checkPlayerPermission();
        if (!spec || !spec.id) {
          throw new Error(`[PluginAPI:${pluginId}] registerProvider: spec.id ist erforderlich.`);
        }
        return playerManager.registerProvider(spec.id, spec);
      },

      /**
       * Entfernt einen zuvor registrierten Provider.
       * @param {string} id  Provider-ID
       */
      unregisterProvider(id) {
        checkPlayerPermission();
        playerManager.unregisterProvider(id);
      },

      /**
       * Aktiviert einen registrierten Provider als aktiven Player.
       * @param {string} id  Provider-ID
       */
      setActiveProvider(id) {
        checkPlayerPermission();
        playerManager.setActiveProvider(id);
      },

      /**
       * Gibt den aktuellen Player-State zurück.
       * @returns {object}
       */
      getState() {
        return playerManager.getState();
      },

      /**
       * Abonniert Player-State-Änderungen.
       * @param {Function} callback
       * @returns {Function}  unsubscribe()
       */
      subscribe(callback) {
        return playerManager.subscribe(callback);
      },

      /**
       * Meldet einen Provider-State an den PlayerManager.
       * Nur der aktive Provider darf den globalen State überschreiben.
       * @param {string} providerId
       * @param {object} state
       */
      updateProviderState(providerId, state) {
        checkPlayerPermission();
        playerManager.updateProviderState(providerId, state);
      }
    }
  };
}

module.exports = {
  create
};