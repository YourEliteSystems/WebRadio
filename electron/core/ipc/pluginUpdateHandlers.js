"use strict";

/**
 * IPC-Endpunkte für das Plugin-Update-System.
 *
 * Der Renderer erhält ausschließlich strukturierte Daten und niemals
 * Dateisystempfade, Schlüssel oder rohe Netzwerkantworten. Alle Argumente
 * werden vor der Weitergabe validiert; die fachlichen Prüfungen (HTTPS,
 * Signatur, Prüfsumme, IDs) erfolgen ausschließlich im Main-Prozess.
 */

const { ipcMain } = require("electron");

const PluginUpdateRuntime = require("../plugins/update/PluginUpdateRuntime");
const PluginPermissions = require("../plugins/PluginPermissions");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("PluginUpdateHandlers");

const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function getService() {
  return PluginUpdateRuntime.initialize();
}

function sanitizeApplyOptions(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    return { allowUnsigned: false, approvedPermissions: [] };
  }
  const approvedPermissions = Array.isArray(options.approvedPermissions)
    ? [...new Set(options.approvedPermissions)]
        .filter((permission) => typeof permission === "string" && PluginPermissions.VALID_PERMISSIONS.includes(permission))
        .slice(0, 32)
    : [];
  return {
    allowUnsigned: options.allowUnsigned === true,
    approvedPermissions
  };
}

function validPluginId(id) {
  return typeof id === "string" && PLUGIN_ID_PATTERN.test(id);
}

function registerPluginUpdateHandlers() {
  ipcMain.handle("pluginUpdates:get-state", () => getService().getState());

  ipcMain.handle("pluginUpdates:check", async (_event, options) => {
    const force = Boolean(options && options.force === true);
    const results = await getService().checkAll({ forceCatalog: force });
    return { ok: true, results };
  });

  ipcMain.handle("pluginUpdates:check-plugin", async (_event, id, options) => {
    if (!validPluginId(id)) {
      return { ok: false, code: "invalid_plugin_id", message: "Ungültige Plugin-ID." };
    }
    const force = Boolean(options && options.force === true);
    const result = await getService().checkPlugin(id, { forceCatalog: force });
    return { ok: true, result };
  });

  ipcMain.handle("pluginUpdates:apply", async (_event, id, options) => {
    if (!validPluginId(id)) {
      return { ok: false, code: "invalid_plugin_id", message: "Ungültige Plugin-ID." };
    }
    try {
      return await getService().applyUpdate(id, sanitizeApplyOptions(options));
    } catch (error) {
      logger.error(`Update ${id} fehlgeschlagen: ${error.message}`);
      return { ok: false, code: "update_failed", message: error.message };
    }
  });

  ipcMain.handle("pluginUpdates:cancel", () => getService().cancel());

  ipcMain.handle("pluginUpdates:set-channel", (_event, id, channel) => {
    if (!validPluginId(id)) {
      return { ok: false, code: "invalid_plugin_id", message: "Ungültige Plugin-ID." };
    }
    return getService().setChannel(id, channel);
  });

  ipcMain.handle("pluginUpdates:set-settings", (_event, patch) => {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      return { ok: false, code: "invalid_settings", message: "Ungültige Einstellungen." };
    }
    const safe = {};
    if (typeof patch.autoCheck === "boolean") safe.autoCheck = patch.autoCheck;
    if (Number.isFinite(patch.intervalHours)) safe.intervalHours = patch.intervalHours;
    if (typeof patch.defaultChannel === "string") safe.defaultChannel = patch.defaultChannel;
    return getService().setSettings(safe);
  });
}

module.exports = registerPluginUpdateHandlers;
module.exports.sanitizeApplyOptions = sanitizeApplyOptions;
