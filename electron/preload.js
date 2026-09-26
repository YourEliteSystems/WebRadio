const { contextBridge, ipcRenderer } = require('electron');

// UPDATES API IMPLEMENTATION
const updatesApi = {
  // Commands
  check:        () => ipcRenderer.invoke("updates:check"),
  download:     () => ipcRenderer.invoke("updates:download"),
  install:      () => ipcRenderer.invoke("updates:install"),
  getState:     () => ipcRenderer.invoke("updates:get-state"),
  getChannel:   () => ipcRenderer.invoke("updates:get-channel"),
  getStoredChannel: () => ipcRenderer.invoke("updates:get-stored-channel"),
  setChannel:   (channel) => ipcRenderer.invoke("updates:set-channel", channel),
  getCurrentVersion:    () => ipcRenderer.invoke("updates:get-current-version"),
  isPrerelease:         () => ipcRenderer.invoke("updates:is-prerelease"),
  markNotified:         () => ipcRenderer.invoke("updates:mark-notified"),
  getAvailableInfo:     () => ipcRenderer.invoke("updates:get-available-info"),
  getAutoCheck:         () => ipcRenderer.invoke("updates:get-auto-check"),
  setAutoCheck:         (enabled) => ipcRenderer.invoke("updates:set-auto-check", enabled),
  dismissLater:         () => ipcRenderer.invoke("updates:dismiss-later"),

  // Events – sauber registrieren & entfernen
  onStateChanged: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on("updates:state-changed", handler);
    return () => ipcRenderer.removeListener("updates:state-changed", handler);
  },
  onAvailable: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on("updates:available", handler);
    return () => ipcRenderer.removeListener("updates:available", handler);
  },
  onNotAvailable: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on("updates:not-available", handler);
    return () => ipcRenderer.removeListener("updates:not-available", handler);
  },
  onProgress: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on("updates:download-progress", handler);
    return () => ipcRenderer.removeListener("updates:download-progress", handler);
  },
  onDownloaded: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on("updates:downloaded", handler);
    return () => ipcRenderer.removeListener("updates:downloaded", handler);
  },
  onError: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on("updates:error", handler);
    return () => ipcRenderer.removeListener("updates:error", handler);
  },
  onChannelChanged: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on("updates:channel-changed", handler);
    return () => ipcRenderer.removeListener("updates:channel-changed", handler);
  }
};

updatesApi.getChannelMetadata = (channel) =>
    ipcRenderer.invoke("update:getChannelMetadata", channel);

updatesApi.getAllChannelMetadata = () =>
    ipcRenderer.invoke("update:getAllChannelMetadata");

contextBridge.exposeInMainWorld('api', {
  log: (level, context, msg) => ipcRenderer.send("log", level, context, msg),
  // FAVORITES
  getFavorites: () => ipcRenderer.invoke("favorites:get"),
  addFavorite: (fav) => ipcRenderer.invoke("favorites:add", fav),
  removeFavorite: (url) => ipcRenderer.invoke("favorites:remove", url),

  // RADIO SEARCH & FILTER
  searchRadio: (params) => ipcRenderer.invoke("radio:search", params),
  getCountries: () => ipcRenderer.invoke("radio:getCountries"),
  getTags: () => ipcRenderer.invoke("radio:getTags"),

  // SETTINGS && PLUGINS SYSTEM
  openSettings: () => ipcRenderer.send("open-settings"),
  getPlugins: () => ipcRenderer.invoke("plugins:get"),
  togglePlugin: (id, enabled) => ipcRenderer.invoke("plugins:toggle", id, enabled),
  getRendererScripts: () => ipcRenderer.invoke("plugins:getRendererScripts"),
  reloadPlugins: () => ipcRenderer.invoke("plugins:reload"),
  onPluginsChanged: (callback) => {
    const handler = (_event, result) => callback(result);
    ipcRenderer.on("plugins:changed", handler);
    return () => ipcRenderer.removeListener("plugins:changed", handler);
  },

  // UPDATES (Section 16 Specification)
  updates: updatesApi
});

// PACKAGE API
const packageApi = {
  list: () => ipcRenderer.invoke("package:list"),
  get: (id) => ipcRenderer.invoke("package:get", id),
  install: (payload) => ipcRenderer.invoke("package:install", payload),
  update: (payload) => ipcRenderer.invoke("package:update", payload),
  enable: (id) => ipcRenderer.invoke("package:enable", id),
  disable: (id) => ipcRenderer.invoke("package:disable", id),
  remove: (payload) => ipcRenderer.invoke("package:remove", payload),
  openUserFolder: () => ipcRenderer.invoke("package:openUserFolder"),

  onInstalled: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("package:installed", handler);
    return () => ipcRenderer.removeListener("package:installed", handler);
  },
  onUpdated: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("package:updated", handler);
    return () => ipcRenderer.removeListener("package:updated", handler);
  },
  onEnabled: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("package:enabled", handler);
    return () => ipcRenderer.removeListener("package:enabled", handler);
  },
  onDisabled: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("package:disabled", handler);
    return () => ipcRenderer.removeListener("package:disabled", handler);
  },
  onRemoved: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("package:removed", handler);
    return () => ipcRenderer.removeListener("package:removed", handler);
  }
};

contextBridge.exposeInMainWorld("packageAPI", packageApi);

// UPDATES API (Abwärtskompatibilität für bestehende Renderer-Aufrufe)
contextBridge.exposeInMainWorld("updatesAPI", updatesApi);

// NAVIGATION API
contextBridge.exposeInMainWorld("navigationAPI", {
  getTree: () => ipcRenderer.invoke("navigation:getTree"),
  getSections: () => ipcRenderer.invoke("navigation:getSections"),
  getItems: (sectionId) => ipcRenderer.invoke("navigation:getItems", sectionId),
  registerSection: (section, pluginId) => ipcRenderer.invoke("navigation:registerSection", section, pluginId),
  registerItem: (item, pluginId) => ipcRenderer.invoke("navigation:registerItem", item, pluginId),
  updateItem: (id, updates, pluginId) => ipcRenderer.invoke("navigation:updateItem", id, updates, pluginId),
  removeItem: (id, pluginId) => ipcRenderer.invoke("navigation:removeItem", id, pluginId),
  removeSection: (id, pluginId) => ipcRenderer.invoke("navigation:removeSection", id, pluginId),
  onUpdated: (callback) => {
    const handler = (_event, tree) => callback(tree);
    ipcRenderer.on("navigation:updated", handler);
    return () => ipcRenderer.removeListener("navigation:updated", handler);
  }
});

// PLUGIN API FOR RENDERER SCRIPTS
contextBridge.exposeInMainWorld("pluginAPI", {
  log: (level, context, msg) => ipcRenderer.send("log", level, context, msg),
  onPluginToggled: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("plugin:toggled", handler);
    return () => ipcRenderer.removeListener("plugin:toggled", handler);
  },

  // HISTORY
  getHistory: () => ipcRenderer.invoke("history:get"),
  addHistory: (entry) => ipcRenderer.invoke("history:add", entry),

  // NAVIGATION – nutzt dieselben Kanäle wie window.navigationAPI
  navigation: {
    registerSection: (section, pluginId) => ipcRenderer.invoke("navigation:registerSection", section, pluginId),
    registerItem: (item, pluginId) => ipcRenderer.invoke("navigation:registerItem", item, pluginId),
    updateItem: (id, updates, pluginId) => ipcRenderer.invoke("navigation:updateItem", id, updates, pluginId),
    removeItem: (id, pluginId) => ipcRenderer.invoke("navigation:removeItem", id, pluginId),
    removeSection: (id, pluginId) => ipcRenderer.invoke("navigation:removeSection", id, pluginId),
    getTree: () => ipcRenderer.invoke("navigation:getTree"),
  }
});

// PLAYER
contextBridge.exposeInMainWorld("radioAPI", {
  startStream: (url) => ipcRenderer.invoke("radio:start", url),
  stopStream: () => ipcRenderer.invoke("radio:stop"),
  onMetadata: (callback) => ipcRenderer.on("radio:metadata", (_, data) => callback(data)),
  onPCM: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("radio:pcm", handler);
    return () => ipcRenderer.removeListener("radio:pcm", handler);
  },
  getAudioDiagnostics: () => {
    // Worklet-Zähler einmalig beim Renderer abfragen und mitliefern
    const workletPromise = (typeof window !== "undefined" && window.__webradioAudioDiagnostics)
      ? window.__webradioAudioDiagnostics()
      : Promise.resolve(null);
    return Promise.resolve(workletPromise).then(
      (worklet) => ipcRenderer.invoke("radio:getAudioDiagnostics", worklet)
    );
  }
});

// Window Controls
contextBridge.exposeInMainWorld("windowControls", {
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
  // Window State Queries (für Settings-Fenster)
  isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  isMinimized: () => ipcRenderer.invoke("window:isMinimized"),
  // Event-Listener für Fensterzustandsänderungen
  onMaximized: (callback) => {
    const handler = () => callback(true);
    ipcRenderer.on("window:onMaximized", handler);
    return () => ipcRenderer.removeListener("window:onMaximized", handler);
  },
  onUnmaximized: (callback) => {
    const handler = () => callback(false);
    ipcRenderer.on("window:onUnmaximized", handler);
    return () => ipcRenderer.removeListener("window:onUnmaximized", handler);
  }
});

contextBridge.exposeInMainWorld("media", {
  onPlayPause: (cb) => ipcRenderer.on("media-play-pause", cb),
  onStop: (cb) => ipcRenderer.on("media-stop", cb),
  onNext: (cb) => ipcRenderer.on("media-next", cb),
  onVolumeUp:   (cb) => ipcRenderer.on("media-volume-up",   (_, ...args) => cb(...args)),
  onVolumeDown: (cb) => ipcRenderer.on("media-volume-down", (_, ...args) => cb(...args)),
  onMute:       (cb) => ipcRenderer.on("media-volume-mute", (_, ...args) => cb(...args)),
});

// THEME API
contextBridge.exposeInMainWorld("themeAPI", {
  getThemes: () => ipcRenderer.invoke("theme:get"),
  getActiveTheme: () => ipcRenderer.invoke("theme:getActive"),
  setActiveTheme: (id) => ipcRenderer.invoke("theme:setActive", id),
  reloadThemes: () => ipcRenderer.invoke("theme:reload"),
  openThemeFolder: () => ipcRenderer.invoke("theme:openFolder"),
  onThemeChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("theme:changed", handler);
    return () => ipcRenderer.removeListener("theme:changed", handler);
  },
  onThemesChanged: (callback) => {
    const handler = (_event, result) => callback(result);
    ipcRenderer.on("themes:changed", handler);
    return () => ipcRenderer.removeListener("themes:changed", handler);
  }
});

// UPDATER API (Kompatibilitätsschicht für bestehenden Renderer-Code)
contextBridge.exposeInMainWorld("updaterAPI", {
  check: () => ipcRenderer.invoke("updater:check"),
  install: () => ipcRenderer.invoke("updater:install"),
  getVersion: () => ipcRenderer.invoke("app:version"),
  onUpdateAvailable: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("updater:available", handler);
    return () => ipcRenderer.removeListener("updater:available", handler);
  }
});


contextBridge.exposeInMainWorld("uiAPI", {
    getPages() {
        return ipcRenderer.invoke("ui:getPages");
    }
});

// SHELL API – Ordner im Explorer öffnen
contextBridge.exposeInMainWorld("shellAPI", {
    openPath: (folderPath) => ipcRenderer.invoke("shell:openPath", folderPath)
});

// DIAGNOSTICS API
contextBridge.exposeInMainWorld("diagnosticsAPI", {
    getHealth:           ()         => ipcRenderer.invoke("diagnostics:getHealth"),
    getSystemInfo:       ()         => ipcRenderer.invoke("diagnostics:getSystemInfo"),
    getCrashReports:     ()         => ipcRenderer.invoke("diagnostics:getCrashReports"),
    readCrashReport:     (fileName) => ipcRenderer.invoke("diagnostics:readCrashReport", fileName),
    deleteCrashReport:   (fileName) => ipcRenderer.invoke("diagnostics:deleteCrashReport", fileName),
    clearCrashReports:   ()         => ipcRenderer.invoke("diagnostics:clearCrashReports"),
    getLogs:             ()         => ipcRenderer.invoke("diagnostics:getLogs"),
    readLog:             (fileName) => ipcRenderer.invoke("diagnostics:readLog", fileName),
    deleteLog:           (fileName) => ipcRenderer.invoke("diagnostics:deleteLog", fileName),
    clearLogs:           ()         => ipcRenderer.invoke("diagnostics:clearLogs"),
    getPaths:            ()         => ipcRenderer.invoke("diagnostics:getPaths"),
    getMemory:           ()         => ipcRenderer.invoke("diagnostics:getMemory"),
    getEventBusStats:    ()         => ipcRenderer.invoke("diagnostics:getEventBusStats"),
    getBootupState:      ()         => ipcRenderer.invoke("diagnostics:getBootupState")
});

// INTEGRATIONS API
contextBridge.exposeInMainWorld("integrationsAPI", {
    get: () => ipcRenderer.invoke("integrations:get"),
    update: (data) => ipcRenderer.invoke("integrations:update", data)
});

// MEDIAHUB OAUTH API
contextBridge.exposeInMainWorld("mediaHubAuth", {
  status: () => ipcRenderer.invoke("mediahub:auth-status"),
  signIn: () => ipcRenderer.invoke("mediahub:auth-sign-in"),
  signOut: () => ipcRenderer.invoke("mediahub:auth-sign-out"),
  search: (query) => ipcRenderer.invoke("mediahub:search", query)
});

// CREDENTIALS API
// Google Client Secret Handler wurden entfernt, da der Secret jetzt
// direkt in MediaHubOAuth.js integriert ist und nicht mehr
// vom Benutzer konfiguriert werden muss.
// contextBridge.exposeInMainWorld("credentialsAPI", {
//   setGoogleClientSecret: (secret) => ipcRenderer.invoke("credentials:set-google-client-secret", secret),
//   hasGoogleClientSecret: () => ipcRenderer.invoke("credentials:has-google-client-secret"),
//   deleteGoogleClientSecret: () => ipcRenderer.invoke("credentials:delete-google-client-secret")
// });

// ─────────────────────────────────────────────
// UNIFIED PLAYER API
// Erlaubt dem Renderer, den Unified Player State zu lesen, zu
// steuern und State-Änderungen zu abonnieren.
// ─────────────────────────────────────────────
contextBridge.exposeInMainWorld("playerAPI", {
  // State Query
  getState: () => ipcRenderer.invoke("player:getState"),

  // Controls
  play:      ()      => ipcRenderer.invoke("player:play"),
  pause:     ()      => ipcRenderer.invoke("player:pause"),
  stop:      ()      => ipcRenderer.invoke("player:stop"),
  toggle:    ()      => ipcRenderer.invoke("player:toggle"),
  setVolume: (value) => ipcRenderer.invoke("player:setVolume", value),

  // Provider-Activation (Main-to-Renderer: aktiviere/Deaktiviere Provider)
  // Als Funktion, nicht IPC-Handler, um kein Rendererverhalten zu brüchen
  setActiveProvider: (id) => ipcRenderer.invoke("player:setActiveProvider", id),

  // State Subscription – gibt Unsubscribe-Funktion zurück (kein Memory Leak)
  onStateChanged: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("player:stateChanged", handler);
    return () => ipcRenderer.removeListener("player:stateChanged", handler);
  },

  // Provider-State-Reporting (Renderer-seitige Provider, z.B. MediaHub YouTube)
  // Erlaubt Plugin-Renderer-Skripte, ihren State an den Main-Prozess zu melden.
  reportProviderState: (providerId, state) =>
    ipcRenderer.invoke("player:reportProviderState", providerId, state)
});

// ─────────────────────────────────────────────
// PLUGIN HTTP ORIGIN API
// Gibt dem Renderer die URL des lokalen Plugin-HTTP-Servers.
// Wird von MediaHub genutzt, um Assets über http:// zu laden.
// ─────────────────────────────────────────────
contextBridge.exposeInMainWorld("pluginHttpAPI", {
  getOrigin:   ()                         => ipcRenderer.invoke("plugin:getHttpOrigin"),
  getAssetUrl: (pluginId, relativePath)   => ipcRenderer.invoke("plugin:getAssetUrl", pluginId, relativePath)
});

// UPDATES API (Zentral und abwärtskompatibel auf window.updatesAPI und window.updateAPI)
contextBridge.exposeInMainWorld("updatesAPI", updatesApi);
contextBridge.exposeInMainWorld("updateAPI", updatesApi);

