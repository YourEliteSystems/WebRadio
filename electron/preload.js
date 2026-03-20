const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  log: (msg) => console.log(msg),
  // FAVORITES
  getFavorites: () => ipcRenderer.invoke("favorites:get"),
  addFavorite: (fav) => ipcRenderer.invoke("favorites:add", fav),

  // SETTINGS && PLUGINS SYSTEM
  openSettings: () => ipcRenderer.send("open-settings"),
  getPlugins: () => ipcRenderer.invoke("plugins:get"),
  togglePlugin: (id, enabled) => ipcRenderer.invoke("plugins:toggle", id, enabled),

  // HISTORY
  getHistory: () => ipcRenderer.invoke("history:get"),
  addHistory: (entry) => ipcRenderer.invoke("history:add", entry),

  // RADIO SEARCH
  searchRadio: (name) => ipcRenderer.invoke("radio:search", name),

});

// Aptabase
contextBridge.exposeInMainWorld("analytics", {
  trackEvent: (eventName, properties) => ipcRenderer.invoke("analytics:trackEvent", eventName, properties)
});

//Sentry
contextBridge.exposeInMainWorld("sentry", {
  captureException: (error) => ipcRenderer.invoke("sentry:captureException", {message:error?.message, stack: error?.stack}),
  captureMessage: (msg) => ipcRenderer.invoke("sentry:captureMessage", msg),
  addBreadcrumb: (breadcrumb) => ipcRenderer.invoke("sentry:addBreadcrumb", breadcrumb)
});

  // PLAYER
contextBridge.exposeInMainWorld("radioAPI", {
  startStream: (url) => ipcRenderer.invoke("radio:start", url),
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
  getThemes: () => ipcRenderer.invoke("theme:get")
});