const eventBus = require("../eventBus");
const fs = require("fs");
const path = require("path");
const PluginStorage = require("./PluginStorage");
const UIMannager = require("../ui/UIManager");
const LogManager = require("../diagnostics/logging/LogManager");
const SettingsManager = require("../storage/SettingsManager");
const { app } = require("electron");

const PLUGIN_API_VERSION = "1.0.0";

function create(meta) {
  return {
    plugin: meta,
    version: {
      pluginAPI: PLUGIN_API_VERSION,
      application: app.getVersion() || "1.0.0"
    },

    logger: (context) => {
      return LogManager.getLogger(`Plugin:${meta.name}:${context}`);
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
        UIMannager.register(item, {
          pluginId: meta.id,
          version: meta.version,
          source: "plugin"
        });
      },
      unregister(id) {
        UIMannager.unregister(id);
      }
    }
  };
}

module.exports = {
  create
};