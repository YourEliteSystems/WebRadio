const path = require("path");
const eventBus = require("../eventBus");
const { createPluginContext } = require("./PluginContext");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("PluginRuntime");

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

                            logger.error(
                                `[Plugin] Fehler in ${hook}: ${err.message}`
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

            logger.info(
                `Plugin geladen: ${plugin.manifest.name}`
            );

            return true;

        } catch (err) {

            logger.error(
                `Plugin Start Fehler (${plugin.manifest.id}): ${err.message}`
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

            logger.info(
                `Plugin entladen: ${plugin.manifest.name}`
            );

            return true;

        } catch (err) {

            logger.error(
                `Plugin Stop Fehler (${plugin.manifest.id}): ${err.message}`
            );

            return false;

        }

    }

}

module.exports = new PluginRuntime();