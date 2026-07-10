const PluginAPI = require("./PluginAPI");
const LogManager = require("../diagnostics/logging/LogManager");

function createPluginContext(meta) {
  return {
    plugin: meta,
    logger: LogManager.getLogger(`Plugin:${meta.name}`),
    ...PluginAPI.create(meta)
  };
}

module.exports = {
  createPluginContext
};