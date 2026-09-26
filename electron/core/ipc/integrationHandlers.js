"use strict";

const { ipcMain } = require("electron");
const IntegrationManager = require("../integrations/IntegrationManager");
const DiscordRichPresence = require("../services/DiscordRichPresence");
const SettingsManager = require("../storage/SettingsManager");

function registerIntegrationHandlers(mainWindow) {
  ipcMain.handle("integrations:get", () => {
    const integrations = IntegrationManager.getIntegrations();
    // Discord-RPC Status aus SettingsManager hinzufügen (Single Source of Truth)
    const settings = SettingsManager.get();
    const discordEnabled = settings.integrations?.discordRichPresence === true;

    // Discord-RPC als virtuellen Integration zurückgeben
    return [
      ...integrations,
      {
        id: "discord-rpc",
        name: "Discord Rich Presence",
        description: "Discord Rich Presence Integration für WebRadio",
        version: "1.0.0",
        author: "WebRadio Team",
        enabled: discordEnabled
      }
    ];
  });

  ipcMain.handle("integrations:toggle", async (_, id, enabled) => {
    if (id === "discord-rpc") {
      // Discord-RPC speziell behandeln: direkter Zugriff auf DiscordRichPresence
      const result = await DiscordRichPresence.updateSettings(enabled);
      return result;
    }

    IntegrationManager.toggleIntegration(id, enabled);
    return { ok: true };
  });

  ipcMain.handle("integrations:update", async (_, data) => {
    if (data && data.id) {
      if (data.id === "discord-rpc") {
        // Discord-RPC speziell behandeln
        const result = await DiscordRichPresence.updateSettings(data.enabled);
        return result;
      } else {
        IntegrationManager.toggleIntegration(data.id, data.enabled);
        return { ok: true };
      }
    } else if (data && data.discordRichPresence !== undefined) {
      // Discord-RPC speziell behandeln: direkter Zugriff auf DiscordRichPresence
      const result = await DiscordRichPresence.updateSettings(data.discordRichPresence);
      return result;
    }

    return { ok: false, error: { code: "INVALID_INPUT", message: "Keine gültigen Daten" } };
  });

  ipcMain.handle("integrations:getRendererScripts", () => {
    return IntegrationManager.getRendererScripts();
  });
}

module.exports = registerIntegrationHandlers;
