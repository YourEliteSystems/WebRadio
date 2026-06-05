const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const pluginManager = require("./plugins/pluginManager");
const ffmpeg_StaticPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const { getFFmpegPath } = require("./core/ffmpeg-resolver");
const fs = require("fs");
const eventBus = require("./core/eventBus");


let settingsWindow;

ipcMain.on("open-settings", () => {
  createSettingsWindow();
});

ipcMain.handle("plugins:get", () => {
  return pluginManager.getPlugins();
});

ipcMain.handle("plugins:toggle", (_, id, enabled) => {
  pluginManager.togglePlugin(id, enabled);
});

ipcMain.handle("plugins:getRendererScripts", () => {
  return pluginManager.getRendererScripts();
});

eventBus.on("pluginToggled", (data) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("plugin:toggled", data);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("plugin:toggled", data);
  }
});

// Storage Handlers (History & Favorites)
const storage = require("./core/storage");
ipcMain.handle("history:get", () => storage.getHistory());
ipcMain.handle("history:add", (_, entry) => storage.addHistory(entry));
ipcMain.handle("favorites:get", () => storage.getFavorites());
ipcMain.handle("favorites:add", (_, entry) => storage.addFavorite(entry));
ipcMain.handle("favorites:remove", (_, url) => storage.removeFavorite(url));


let ffmpegStream;
let mainWindow;
let ffmpegCommand;

const isDev = !app.isPackaged;

//Theme laden automatisch
ipcMain.handle("theme:get", async () => {
  // In packaged app, themes are in extraResources (process.resourcesPath/themes)
  // In dev, they are at ../themes relative to electron/
  const themesPath = isDev
    ? path.join(__dirname, "../themes")
    : path.join(process.resourcesPath, "themes");

  if (!fs.existsSync(themesPath)) return [];

  const folders = fs.readdirSync(themesPath, { withFileTypes: true });
  const themes = [];

  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    const themeJsonPath = path.join(themesPath, folder.name, "theme.json");
    if (!fs.existsSync(themeJsonPath)) continue;

    const data = JSON.parse(fs.readFileSync(themeJsonPath));
    // Use a safe-to-load file:// URL for packaged app
    const cssAbsPath = path.join(themesPath, folder.name, data.css);
    themes.push({
      id: folder.name,
      name: data.name,
      css: cssAbsPath,  // absolute path, converted in frontend
    });
  }
  return themes;
});

ipcMain.handle("theme:getActive", () => storage.getSettings()?.theme || "");
ipcMain.handle("theme:setActive", (_, themeId) => storage.updateSettings({ theme: themeId }));

function parseTitle(title) {
  if (!title || typeof title !== "string") {
    return {
      artist: "Unbekannt",
      song: "Unbekannt"
    };
  }

  let clean = title.trim();

  // Entferne unnötige Whitespaces
  clean = clean.replace(/\s+/g, " ");

  // Verschiedene Trenner normalisieren
  clean = clean.replace(/–|—/g, "-"); // lange Bindestriche → normal

  let artist = "Unbekannt";
  let song = clean;

  // --- Fall 1: Artist - Song ---
  if (clean.includes(" - ")) {
    const parts = clean.split(" - ");
    artist = parts.shift().trim();
    song = parts.join(" - ").trim();
  }

  // --- Fall 2: Artist: Song ---
  else if (clean.includes(": ")) {
    const parts = clean.split(": ");
    artist = parts.shift().trim();
    song = parts.join(": ").trim();
  }

  // --- Fallback ---
  if (!song || song.length < 2) {
    song = clean;
  }

  // --- Cleanup ---
  if (!artist || artist.length < 2) artist = "Unbekannt";
  if (!song || song.length < 2) song = "Unbekannt";

  return {
    artist,
    song
  };
}

ipcMain.handle("radio:stop", async () => {
  if (!ffmpegCommand) return;

  // Listener für Error temporär anpassen
  const originalErrorHandler = ffmpegCommand.listeners("error")[0];
  ffmpegCommand.removeAllListeners("error");
  ffmpegCommand.on("error", err => {
    if (
      err.message.includes("ffmpeg was killed with signal SIGKILL") ||
      err.message.includes("ffmpeg was killed with signal SIGTERM")
    ) {
      console.log("FFmpeg Prozess sauber beendet (Stop).");
      return;
    }
    if (originalErrorHandler) originalErrorHandler(err);
  });

  try {
    ffmpegCommand.kill("SIGTERM");
  } catch (err) {
    console.warn("Fehler beim Stoppen des FFmpeg-Prozesses:", err);
  }

  // Stream und Command zurücksetzen
  if (ffmpegStream) {
    ffmpegStream.removeAllListeners();
    ffmpegStream.destroy();
    ffmpegStream = null;
  }
  ffmpegCommand = null;
});

// FFmpeg-Stream starten
ipcMain.handle("radio:start", async (_, url) => {
  ffmpeg.setFfmpegPath(getFFmpegPath());
  if (ffmpegCommand) {
    try {
    ffmpegCommand.kill("SIGKILL");
    console.warn("FFmpeg Prozess wurde mit SIGKILL beendet.");
    ffmpegCommand = null;

    if(ffmpegStream){
      ffmpegStream.removeAllListeners("data");
      ffmpegStream.destroy();
      ffmpegStream = null;
    }
    } catch (err) {
      console.warn("Fehler beim Stoppen des vorherigen FFmpeg-Prozesses:", err);
    }
    ffmpegCommand = null;
    ffmpegStream = null;
  }
  let lastTitle = null;
  ffmpegCommand = ffmpeg(url)
    .inputOptions("-icy"," 1","-headers","User-Agent: Mozilla/5.0","-loglevel","debug")
    .audioChannels(2)
    .audioFrequency(48000)
    .format("f32le")
    .on("stderr", line => {
      if(line.includes("StreamTitle")){
        const match = line.match(/StreamTitle[:=]\s*(.*)/i);
        if(match){
          const rawtitle = match[1].trim();
          console.log("Gefundener StreamTitle:", match[1]);
          if(!rawtitle || rawtitle === lastTitle) return; // Verhindert unnötige Updates
          const { artist, song } = parseTitle(rawtitle);
          const metadata = {
            StreamTitle: rawtitle,
            Artist: artist,
            Song: song
          };
          console.log("Metadaten korrekt:", metadata);
          mainWindow.webContents.send("radio:metadata", metadata);
        }
      }
    })
    .on("error", err =>{ 
      if(err.message.includes("ffmpeg was killed with signal SIGKILL") || err.message.includes("ffmpeg was killed with signal SIGTERM")){
        console.log("FFmpeg Prozess wurde ordnungsgemäß beendet.");
        return;
      }
      console.error("FFmpeg Fehler:", err) 
    })

  ffmpegCommand.on("end", () => {
    console.log("FFmpeg-Stream beendet.");
  });

  ffmpegStream = ffmpegCommand.pipe();

  ffmpegStream.on("data", chunk => {
    // 🔴 DAS IST KRITISCH
    const pcm = new Float32Array(
      chunk.buffer,
      chunk.byteOffset,
      chunk.byteLength / 4
    );
    mainWindow.webContents.send("radio:pcm", pcm.buffer);
  });
});

function stopAllStreams() {
  if (ffmpegCommand) {
    try {
      ffmpegCommand.removeAllListeners("error");
      ffmpegCommand.removeAllListeners("end");
      ffmpegCommand.kill("SIGTERM"); // SIGTERM ist sauberer als SIGKILL
      ffmpegCommand = null;
    } catch (err) {
      console.warn("Fehler beim Stoppen von FFmpeg:", err);
    }
  }

  if (ffmpegStream) {
    try {
      ffmpegStream.removeAllListeners();
      ffmpegStream.destroy();
      ffmpegStream = null;
    } catch (err) {
      console.warn("Fehler beim Stoppen des Streams:", err);
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    frame: false,
    titleBarStyle: "hidden",
    icon: path.join(__dirname, "../assets/icons/tray.ico"),
    webPreferences: {
      autoplayPolicy: "no-user-gesture-required",
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

ipcMain.on("window:minimize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if(win){
    win.minimize();
    console.log("Fenster minimiert.");
  }
});

ipcMain.on("window:close", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if(win){
    win.close();
    console.log("Fenster geschlossen.");
  }
});

ipcMain.on("window:maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

app.whenReady().then(() => {
  createWindow();
  pluginManager.loadPlugins();
});

ipcMain.handle("radio:search", async (event, name) => {
  const url = `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(name)}`;
  try {
    const res = await globalThis.fetch(url, {
      headers: {
        "User-Agent": "WebRadioApp/1.0"
      }
    });
    return await res.json();
  } catch (err) {
    console.error("Radio fetch error:", err);
    return [];
  }
});

function createSettingsWindow() {

  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 500,
    frame: false, // gleiches Design wie Hauptfenster
    resizable: false,
    icon: path.join(__dirname, "../assets/icons/tray.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  settingsWindow.loadFile(path.join(__dirname, "..", "renderer", "settings.html"));
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

}

app.on("window-all-closed", (e) => {
  if(process.platform !== "darwin") {
    app.quit();
  }
});


app.on("before-quit", async (e) => {
  stopAllStreams();
});
