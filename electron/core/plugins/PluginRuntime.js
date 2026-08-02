const path = require("path");
const fs = require("fs");
const eventBus = require("../eventBus");
const { createPluginContext } = require("./PluginContext");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("PluginRuntime");

// Deprecation-Warnungen für direkte Core-Imports
const deprecatedImports = [
  'electron/core/diagnostics/logging/LogManager',
  'electron/core/eventBus',
  'electron/core/storage/SettingsManager',
  'electron/core/storage'
];

function checkDeprecatedImports(pluginPath) {
  const mainFile = path.join(pluginPath, 'main.js');
  if (!fs.existsSync(mainFile)) return;

  const content = fs.readFileSync(mainFile, 'utf8');
  deprecatedImports.forEach(dep => {
    if (content.includes(dep)) {
      logger.warn(
        `[Plugin Deprecation] Plugin uses deprecated import: ${dep}. ` +
        `Please use pluginAPI instead.`
      );
    }
  });
}

class PluginRuntime {

    start(plugin) {

        try {

            const manifest = plugin.manifest || plugin;
            const mainFile = path.join(
                plugin.path,
                manifest.main
            );

            // Deprecation-Check
            checkDeprecatedImports(plugin.path);

            const instance = require(mainFile);

            const context =
                createPluginContext(manifest);

            if (
                typeof instance.init
                === "function"
            ) {

                try {
                    instance.init(context);
                } catch (err) {
                    logger.error(
                        `Plugin init Fehler (${manifest.id}): ${err.message}`
                    );
                }

            }

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

                            instance[hook](data, context);

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

            plugin.instance = instance;
            plugin.listeners = listeners;
            plugin.loaded = true;
            plugin.manifest = manifest;

            logger.info(
                `Plugin geladen: ${manifest.name}`
            );

            return true;

        } catch (err) {

            logger.error(
                `Plugin Start Fehler: ${err.message}`
            );

            return false;

        }

    }

    stop(plugin) {

        try {

            const manifest = plugin.manifest || plugin;

            if (
                plugin.instance &&
                typeof plugin.instance.destroy
                === "function"
            ) {

                try {
                    plugin.instance.destroy();
                } catch (err) {
                    logger.error(
                        `Plugin destroy Fehler: ${err.message}`
                    );
                }

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

            const manifestForFile = plugin.manifest || plugin;
            const mainFile = path.join(
                plugin.path,
                manifestForFile.main
            );

            delete require.cache[
                require.resolve(mainFile)
            ];

            plugin.instance = null;
            plugin.listeners = [];
            plugin.loaded = false;

            logger.info(
                `Plugin entladen: ${manifest.name}`
            );

            return true;

        } catch (err) {

            logger.error(
                `Plugin Stop Fehler: ${err.message}`
            );

            return false;

        }

    }

}

module.exports = new PluginRuntime();