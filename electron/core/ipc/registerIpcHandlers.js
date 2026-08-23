"use strict";

const registerPluginHandlers = require("./pluginHandlers");
const registerUpdaterHandlers = require("./updaterHandlers");
const registerStorageHandlers = require("./storageHandlers");
const registerThemeHandlers = require("./themeHandlers");
const registerRadioHandlers = require("./radioHandlers");
const registerWindowHandlers = require("./windowHandlers");
const registerDiagnosticsHandlers = require("./diagnosticsHandlers");
const registerIntegrationHandlers = require("./integrationHandlers");
const registerNavigationHandlers = require("./navigationHandlers");
const registerUiHandlers = require("./uiHandlers");

function registerAllIpc(window) {
  registerPluginHandlers(window);
  registerUpdaterHandlers(window);
  registerStorageHandlers(window);
  registerThemeHandlers(window);
  registerRadioHandlers(window);
  registerWindowHandlers(window);
  registerDiagnosticsHandlers();
  registerIntegrationHandlers(window);
  registerNavigationHandlers();
  registerUiHandlers(window);
}

module.exports = { registerAllIpc };