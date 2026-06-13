const registerPluginHandlers = require("./pluginHandlers");
const registerUpdaterHandlers = require("./updaterHandlers");
const registerStorageHandlers = require("./storageHandlers");
const registerThemeHandlers = require("./themeHandlers");
const registerRadioHandlers = require("./radioHandlers");
const registerWindowHandlers = require("./windowHandlers");

function registerAllIpc(mainWindow) {
  registerPluginHandlers(mainWindow);
  registerUpdaterHandlers(mainWindow);
  registerStorageHandlers(mainWindow);
  registerThemeHandlers(mainWindow);
  registerRadioHandlers(mainWindow);
  registerWindowHandlers(mainWindow);
}

module.exports = { registerAllIpc };