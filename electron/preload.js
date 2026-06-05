const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  log: (msg) => console.log(msg),
  // FAVORITES
  getFavorites: () => ipcRenderer.invoke("favorites:get"),
  addFavorite: (fav) => ipcRenderer.invoke("favorites:add", fav),
  removeFavorite: (url) => ipcRenderer.invoke("favorites:remove", url),

  // RADIO SEARCH
  searchRadio: (name) => ipcRenderer.invoke("radio:search", name),

  // SETTINGS && PLUGINS SYSTEM
  openSettings: () => ipcRenderer.send("open-settings"),
  getPlugins: () => ipcRenderer.invoke("plugins:get"),
  togglePlugin: (id, enabled) => ipcRenderer.invoke("plugins:toggle", id, enabled),
  getRendererScripts: () => ipcRenderer.invoke("plugins:getRendererScripts"),
});

// PLUGIN API FOR RENDERER SCRIPTS
contextBridge.exposeInMainWorld("pluginAPI", {
  onPluginToggled: (callback) => {
    ipcRenderer.removeAllListeners("plugin:toggled");
    ipcRenderer.on("plugin:toggled", (_, data) => callback(data));
  },

  // HISTORY
  getHistory: () => ipcRenderer.invoke("history:get"),
  addHistory: (entry) => ipcRenderer.invoke("history:add", entry),
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

//Window Controls
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
  setActiveTheme: (id) => ipcRenderer.invoke("theme:setActive", id)
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