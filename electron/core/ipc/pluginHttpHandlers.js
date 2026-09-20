"use strict";

/**
 * Plugin-HTTP-Origin Handler
 *
 * Stellt den lokalen HTTP-Server-URL für Plugin-Renderer-Scripts bereit,
 * damit diese ihre Ressourcen über http:// statt file:// laden können.
 */

const { ipcMain } = require("electron");
const PluginHttpServer = require("../plugins/PluginHttpServer");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("PluginHttpHandlers");

function registerPluginHttpHandlers() {
  // Gibt die Basis-URL des lokalen Servers zurück
  ipcMain.handle("plugin:getHttpOrigin", () => {
    const url = PluginHttpServer.getUrl();
    logger.debug(`plugin:getHttpOrigin → ${url}`);
    return url;
  });

  // Gibt die vollständige URL für ein Plugin-Asset zurück
  ipcMain.handle("plugin:getAssetUrl", (_event, pluginId, relativePath) => {
    if (!pluginId || !relativePath) return null;
    return PluginHttpServer.getPluginUrl(pluginId, relativePath);
  });
}

module.exports = registerPluginHttpHandlers;
