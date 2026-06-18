const registerPluginHandlers = require("./pluginHandlers");
const registerUpdaterHandlers = require("./updaterHandlers");
const registerStorageHandlers = require("./storageHandlers");
const registerThemeHandlers = require("./themeHandlers");
const registerRadioHandlers = require("./radioHandlers");
const registerWindowHandlers = require("./windowHandlers");

function registerAllIpc(window) {
  registerPluginHandlers(window);
  registerUpdaterHandlers(window);
  registerStorageHandlers(window);
  registerThemeHandlers(window);
  registerRadioHandlers(window);
  registerWindowHandlers(window);
}

module.exports = { registerAllIpc };