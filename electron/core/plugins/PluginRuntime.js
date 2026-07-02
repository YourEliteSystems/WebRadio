const path = require("path");
const eventBus = require("../eventBus");
const { createPluginContext } = require("./PluginContext");

class PluginRuntime {

    start(plugin) {

        try {

            const mainFile = path.join(
                plugin.path,
                plugin.manifest.main
            );

            const instance = require(mainFile);

            const listeners = [];

            const hookMap = {
                onMetadata: "metadata",
                onStationChange: "stationchange",
                onPlay: "play",
                onStop: "stop",
                onVolumeChange: "volumechange",
                onThemeChange: "themechange"
            };

            Object.entries(hookMap).forEach(
                ([hook, event]) => {

                    if (
                        typeof instance[hook]
                        !== "function"
                    ) {
                        return;
                    }

                    const handler = data => {

                        try {

                            instance[hook](data);

                        } catch (err) {

                            console.error(
                                `[Plugin] Fehler in ${hook}:`,
                                err
                            );

                        }

                    };

                    eventBus.on(
                        event,
                        handler
                    );

                    listeners.push({
                        event,
                        handler
                    });

                }
            );

            const context =
                createPluginContext(
                    plugin.manifest
                );

            if (
                typeof instance.init
                === "function"
            ) {

                instance.init(context);

            }

            plugin.instance = instance;
            plugin.listeners = listeners;
            plugin.loaded = true;

            console.log(
                `Plugin geladen: ${plugin.manifest.name}`
            );

            return true;

        } catch (err) {

            console.error(
                `Plugin Start Fehler (${plugin.manifest.id})`,
                err
            );

            return false;

        }

    }

    stop(plugin) {

        try {

            if (
                plugin.instance &&
                typeof plugin.instance.destroy
                === "function"
            ) {

                plugin.instance.destroy();

            }

            for (
                const listener of
                plugin.listeners || []
            ) {

                eventBus.off(
                    listener.event,
                    listener.handler
                );

            }

            const mainFile = path.join(
                plugin.path,
                plugin.manifest.main
            );

            delete require.cache[
                require.resolve(mainFile)
            ];

            plugin.instance = null;
            plugin.listeners = [];
            plugin.loaded = false;

            console.log(
                `Plugin entladen: ${plugin.manifest.name}`
            );

            return true;

        } catch (err) {

            console.error(
                `Plugin Stop Fehler (${plugin.manifest.id})`,
                err
            );

            return false;

        }

    }

}

module.exports = new PluginRuntime();