const PluginAPI = require("./PluginAPI");
const PluginPermissions = require("./PluginPermissions");

function createPluginContext(meta) {
  const api = PluginAPI.create(meta);
  const permissions = meta.permissions || [];
  
  // Capabilities aus dem Manifest extrahieren
  const requestedCapabilities = meta.capabilities || [];
  
  // Capabilities validieren (dasselbe wie im Core)
  // NOTE: In der Praxis wird dies vom Core during PluginHttpServer.servePlugin() getan
  // Für Plugin-Isolation simulieren wir hier die gleiche Logik
  const capabilityValidation = PluginPermissions.validateCapabilities(
    requestedCapabilities,
    permissions
  );
  
  const grantedCapabilities = capabilityValidation.granted;

  return {
    ...api,
    logger: api.logger("Main"),
    player: api.player,
    httpOrigin: {
      ...api.httpOrigin,
      // Erweiterte HTTP-Origin API mit Capability-Integration
      getUrl: () => api.httpOrigin.getUrl(),
      getPort: () => api.httpOrigin.getPort(),
      getPluginUrl: (pluginId, relativePath) => api.httpOrigin.getPluginUrl(pluginId, relativePath),
      
      // Capability-basierte Origin-Prüfung
      canAccessOrigin: (origin) => {
        return PluginPermissions.isOriginAllowed(grantedCapabilities, origin);
      },
      
      // Verfügbare Capabilities
      getCapabilities: () => {
        return [...grantedCapabilities];
      },
      
      // Prüft, ob eine Capability gewährt wurde
      hasCapability: (capabilityId) => {
        return PluginPermissions.hasCapability(grantedCapabilities, capabilityId);
      }
    },
    
    // Capability-Zugriff
    capabilities: {
      has: (capabilityId) => {
        return PluginPermissions.hasCapability(grantedCapabilities, capabilityId);
      },
      getAll: () => {
        return [...grantedCapabilities];
      },
      isOriginAllowed: (origin) => {
        return PluginPermissions.isOriginAllowed(grantedCapabilities, origin);
      }
    }
  };
}

module.exports = {
  createPluginContext
};