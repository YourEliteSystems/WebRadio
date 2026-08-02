const PluginAPI = require("./PluginAPI");

function createPluginContext(meta) {
  const api = PluginAPI.create(meta);
  return {
    ...api,
    logger: api.logger("Main")
  };
}

module.exports = {
  createPluginContext
};