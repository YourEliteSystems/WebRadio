class PluginManager {

  constructor() {
    this.plugins = new Map();
  }

  loadPlugins() {

  }

  loadPlugin(pluginPath) {

  }

  enablePlugin(id) {

  }

  disablePlugin(id) {

  }

  getPlugins() {
    return [...this.plugins.values()];
  }

}

module.exports = new PluginManager();