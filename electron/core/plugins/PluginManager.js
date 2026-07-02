class PluginManager {

    constructor() {

        this.plugins = new Map();

    }

    loadPlugins() {

        const plugins =
            PluginLoader.discoverPlugins();

        for (const plugin of plugins) {

            this.plugins.set(
                plugin.id,
                plugin
            );

        }

    }

    enablePlugin(id) {

        const plugin =
            this.plugins.get(id);

        if (!plugin)
            return false;

        return PluginRuntime.start(plugin);

    }

    disablePlugin(id) {

        const plugin =
            this.plugins.get(id);

        if (!plugin)
            return false;

        return PluginRuntime.stop(plugin);

    }

    getPlugins() {

        return [
            ...this.plugins.values()
        ];

    }

}

module.exports = new PluginManager();