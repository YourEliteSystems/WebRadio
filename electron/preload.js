const { contextBridge, ipcRenderer } = require('electron');

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
    ipcRenderer.removeAllListeners("plugins:changed");
    ipcRenderer.on("plugins:changed", (_, result) => callback(result));
  },
});

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
    ipcRenderer.removeAllListeners("navigation:updated");
    ipcRenderer.on("navigation:updated", (_, tree) => callback(tree));
  }
});

// PLUGIN API FOR RENDERER SCRIPTS
contextBridge.exposeInMainWorld("pluginAPI", {
  log: (level, context, msg) => ipcRenderer.send("log", level, context, msg),
  onPluginToggled: (callback) => {
    ipcRenderer.removeAllListeners("plugin:toggled");
    ipcRenderer.on("plugin:toggled", (_, data) => callback(data));
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
    ipcRenderer.removeAllListeners("radio:pcm");
    ipcRenderer.on("radio:pcm", (_, data) => callback(data));
  }
});

// Window Controls
contextBridge.exposeInMainWorld("windowControls", {
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close")
});

contextBridge.exposeInMainWorld("media", {
  onPlayPause: (cb) => ipcRenderer.on("media-play-pause", cb),
  onStop: (cb) => ipcRenderer.on("media-stop", cb),
  onNext: (cb) => ipcRenderer.on("media-next", cb)
});

// THEME API
contextBridge.exposeInMainWorld("themeAPI", {
  getThemes: () => ipcRenderer.invoke("theme:get"),
  getActiveTheme: () => ipcRenderer.invoke("theme:getActive"),
  setActiveTheme: (id) => ipcRenderer.invoke("theme:setActive", id),
  onThemeChanged: (callback) => {
    ipcRenderer.removeAllListeners("theme:changed");
    ipcRenderer.on("theme:changed", (_, data) => callback(data));
  }
});

// UPDATER API
contextBridge.exposeInMainWorld("updaterAPI", {
  check: () => ipcRenderer.invoke("updater:check"),
  install: () => ipcRenderer.invoke("updater:install"),
  getVersion: () => ipcRenderer.invoke("app:version"),
  onUpdateAvailable: (callback) => {
    ipcRenderer.removeAllListeners("updater:available");
    ipcRenderer.on("updater:available", (_, data) => callback(data));
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
    getEventBusStats:    ()         => ipcRenderer.invoke("diagnostics:getEventBusStats")
});

// INTEGRATIONS API
contextBridge.exposeInMainWorld("integrationsAPI", {
    get: () => ipcRenderer.invoke("integrations:get"),
    update: (data) => ipcRenderer.invoke("integrations:update", data)
});
