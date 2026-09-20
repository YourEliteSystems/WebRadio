const PluginAPI = require("./PluginAPI");

function createPluginContext(meta) {
  const api = PluginAPI.create(meta);
  return {
    ...api,
    logger: api.logger("Main"),
    player: api.player, // Player API für Plugins
    httpOrigin: api.httpOrigin // HTTP Origin für Plugins
  };
}

module.exports = {
  createPluginContext
};