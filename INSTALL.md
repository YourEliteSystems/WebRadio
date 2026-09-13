# WebRadio-Kernpatch für MediaHub OAuth

Diese drei Ergänzungen gehören in den **WebRadio-Quellcode von Version `v1.0.6-beta.2`**. Sie können nicht in die installierte AppImage/EXE kopiert werden; WebRadio muss danach neu gebaut werden.

1. `MediaHubOAuth.js` nach `electron/core/services/MediaHubOAuth.js` kopieren.
2. `mediaHubHandlers.js` nach `electron/core/ipc/mediaHubHandlers.js` kopieren.
3. In `electron/core/ipc/registerIpcHandlers.js` ergänzen:

```js
const registerMediaHubHandlers = require("./mediaHubHandlers");
// innerhalb von registerAllIpc(window):
registerMediaHubHandlers();
```

4. In `electron/preload.js` nach den anderen `contextBridge.exposeInMainWorld`-Blöcken ergänzen:

```js
contextBridge.exposeInMainWorld("mediaHubAuth", {
  status: () => ipcRenderer.invoke("mediahub:auth-status"),
  signIn: () => ipcRenderer.invoke("mediahub:auth-sign-in"),
  signOut: () => ipcRenderer.invoke("mediahub:auth-sign-out"),
  search: (query) => ipcRenderer.invoke("mediahub:search", query)
});
```

Der Kern öffnet die Google-Anmeldung mit `shell.openExternal`, verwendet PKCE und speichert Zugriffs-/Erneuerungstoken nur im lokalen `userData/plugin-data`-Ordner mit restriktiven Dateirechten. Kein Clientschlüssel wird verwendet oder an den Renderer weitergegeben.
