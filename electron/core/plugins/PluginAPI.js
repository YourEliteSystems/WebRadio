const eventBus = require("../eventBus");
const fs = require("fs");
const PluginStorage = require("./PluginStorage");

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
        return fs.existsSync(storage.getPluginFile(meta.id));
      },
      get(key) {
        const data = storage.read(meta.id);
        return data[key];
      },
      set(key, value) {
        const data = storage.read(meta.id);
        data[key] = value;
        storage.write(meta.id, data);
      },
      remove(key) {
        const data = storage.read(meta.id);
        delete data[key];
        storage.write(meta.id, data);
      }
    }
  }
}

module.exports = {
  create
};