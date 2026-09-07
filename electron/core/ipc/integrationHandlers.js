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
    
    // Discord-RPC als virtuelle Integration zurückgeben
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

  ipcMain.handle("integrations:toggle", (_, id, enabled) => {
    if (id === "discord-rpc") {
      // Discord-RPC speziell behandeln: direkter Zugriff auf DiscordRichPresence
      const settings = SettingsManager.get();
      if (!settings.integrations) settings.integrations = {};
      settings.integrations.discordRichPresence = enabled;
      SettingsManager.update(settings);

      // DiscordRichPresence Runtime aktualisieren
      DiscordRichPresence.updateSettings(settings);
    } else {
      IntegrationManager.toggleIntegration(id, enabled);
    }
  });

  ipcMain.handle("integrations:update", (_, data) => {
    if (data && data.id) {
      if (data.id === "discord-rpc") {
        // Discord-RPC speziell behandeln
        const settings = SettingsManager.get();
        if (!settings.integrations) settings.integrations = {};
        settings.integrations.discordRichPresence = data.enabled;
        SettingsManager.update(settings);
        DiscordRichPresence.updateSettings(settings);
      } else {
        IntegrationManager.toggleIntegration(data.id, data.enabled);
      }
    } else if (data && data.discordRichPresence !== undefined) {
      // Discord-RPC speziell behandeln: direkter Zugriff auf DiscordRichPresence
      const settings = SettingsManager.get();
      if (!settings.integrations) settings.integrations = {};
      settings.integrations.discordRichPresence = data.discordRichPresence;
      SettingsManager.update(settings);

      // DiscordRichPresence Runtime aktualisieren
      DiscordRichPresence.updateSettings(settings);
    }
  });

  ipcMain.handle("integrations:getRendererScripts", () => {
    return IntegrationManager.getRendererScripts();
  });
}

module.exports = registerIntegrationHandlers;
