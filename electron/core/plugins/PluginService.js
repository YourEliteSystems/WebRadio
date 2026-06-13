class PluginService {

  load() {
    pluginManager.loadPlugins();
  }

  getAll() {
    return pluginManager.getPlugins();
  }

  toggle(id, enabled) {
    return pluginManager.togglePlugin(id, enabled);
  }

}

module.exports = new PluginService();