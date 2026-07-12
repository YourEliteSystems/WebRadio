const PluginLoader = require("./PluginLoader");
const PluginRuntime = require("./PluginRuntime");

class PluginManager {

    constructor() {

        this.plugins = new Map();
        this.initialized = false;

    }

    //
    // Lifecycle
    //

    initialize() {

        if (this.initialized) {
            return;
        }

        this.loadPlugins();

        this.initialized = true;

    }

    shutdown() {

        for (const plugin of this.plugins.values()) {
            PluginRuntime.stop(plugin);
        }

        this.plugins.clear();

        this.initialized = false;

    }

    //
    // Plugin Loading
    //

    loadPlugins() {

        const plugins = PluginLoader.discoverPlugins();

        for (const plugin of plugins) {

            this.plugins.set(
                plugin.id,
                plugin
            );

        }

    }

    //
    // Plugin Control
    //

    enablePlugin(id) {

        const plugin = this.plugins.get(id);

        if (!plugin) {
            return false;
        }

        return PluginRuntime.start(plugin);

    }

    reloadPlugin(id) {

        const plugin = this.getPlugin(id);

        if (!plugin) {
            return false;
        }

        this.disablePlugin(id);

        return this.enablePlugin(id);

    }
    
    disablePlugin(id) {

        const plugin = this.plugins.get(id);

        if (!plugin) {
            return false;
        }

        return PluginRuntime.stop(plugin);

    }

    //
    // Getters
    //

    getPlugin(id) {

        return this.plugins.get(id);

    }

    getPlugins() {

        return [...this.plugins.values()];

    }

    hasPlugin(id) {

        return this.plugins.has(id);

    }

    isInitialized() {

        return this.initialized;

    }

}

module.exports = new PluginManager();