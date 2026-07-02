const eventBus = require("../eventBus");
const fs = require("fs");
const PluginStorage = require("./PluginStorage");
const UIMannager = require("../ui/UIManager");

function create(meta) {
  return {
    plugin: meta,

    events: {
      on(event, callback) {
        eventBus.on(event, callback);
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
      }
    },
    ui:{
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
  }
}

module.exports = {
  create
};