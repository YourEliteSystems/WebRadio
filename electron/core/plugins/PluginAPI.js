"use strict";

const eventBus = require("../eventBus");
const fs = require("fs");
const path = require("path");
const PluginStorage = require("./PluginStorage");
const UIManager = require("../ui/UIManager");
const NavigationManager = require("../navigation/NavigationManager");
const PluginPermissions = require("./PluginPermissions");
const LogManager = require("../diagnostics/logging/LogManager");
const SettingsManager = require("../storage/SettingsManager");
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
    }
  };
}

module.exports = {
  create
};