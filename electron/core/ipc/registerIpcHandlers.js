"use strict";

const registerPluginHandlers       = require("./pluginHandlers");
const registerUpdaterHandlers      = require("./updaterHandlers");
const registerStorageHandlers      = require("./storageHandlers");
const registerThemeHandlers        = require("./themeHandlers");
const registerRadioHandlers        = require("./radioHandlers");
const registerWindowHandlers       = require("./windowHandlers");
const registerDiagnosticsHandlers  = require("./diagnosticsHandlers");
const registerIntegrationHandlers  = require("./integrationHandlers");
const registerNavigationHandlers   = require("./navigationHandlers");
const registerUiHandlers           = require("./uiHandlers");
const registerMediaHubHandlers     = require("./mediaHubHandlers");
const registerCredentialHandlers   = require("./credentialHandlers");
const registerPlayerHandlers       = require("./playerHandlers");
const registerPluginHttpHandlers   = require("./pluginHttpHandlers");

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
  registerMediaHubHandlers();
  registerCredentialHandlers();
  registerPlayerHandlers(window);
  registerPluginHttpHandlers();
}

module.exports = { registerAllIpc };