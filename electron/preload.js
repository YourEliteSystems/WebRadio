const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  log: (msg) => console.log(msg),
  // FAVORITES
  getFavorites: () => ipcRenderer.invoke("favorites:get"),
  addFavorite: (fav) => ipcRenderer.invoke("favorites:add", fav),

  // HISTORY
  getHistory: () => ipcRenderer.invoke("history:get"),
  addHistory: (entry) => ipcRenderer.invoke("history:add", entry),

  // RADIO SEARCH
  searchRadio: (name) => ipcRenderer.invoke("radio:search", name),

});

  // PLAYER
contextBridge.exposeInMainWorld("radioAPI", {
  startStream: (url) => ipcRenderer.invoke("radio:start", url),
  onPCM: (callback) => {
    ipcRenderer.removeAllListeners("radio:pcm");
    ipcRenderer.on("radio:pcm", (_, data) => callback(data));
  }
});

contextBridge.exposeInMainWorld("media", {
  onPlayPause: (cb) => ipcRenderer.on("media-play-pause", cb),
  onStop: (cb) => ipcRenderer.on("media-stop", cb),
  onNext: (cb) => ipcRenderer.on("media-next", cb)
});
