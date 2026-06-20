const PluginAPI = require("./PluginAPI");

function createPluginContext(meta) {
  return {
    plugin: meta,
    ...PluginAPI.create(meta)
  };
}

module.exports = {
  createPluginContext
};