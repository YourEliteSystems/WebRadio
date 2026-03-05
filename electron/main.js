const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { createTray } = require("./tray");
//const db = require("./database");
const { loadSettings, saveSettings } = require("./settings");
const { registerMediaKeys, unregisterMediaKeys } = require("./mediaKeys");
const { autoUpdater } = require("electron-updater");
const { loadPlugins} = require("./pluginLoader");
const ffmpeg_StaticPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const {Readable} = require("stream");

const settings = loadSettings();
const { getPlugins } = require("./pluginLoader");

ipcMain.handle("plugin-onPlay", (event, station) => {
  getPlugins().forEach(p => {
    if (p.onPlay) p.onPlay(station);
  });
});

ipcMain.handle("plugin-onStop", () => {
  getPlugins().forEach(p => {
    if (p.onStop) p.onStop();
  });
});

ipcMain.handle("load-settings", async () => {
  return loadSettings();
});

ipcMain.handle("save-settings", (event, newSettings) => {
  saveSettings(newSettings);

  // Autostart und MediaKeys direkt umsetzen
  app.setLoginItemSettings({
    openAtLogin: newSettings.autostart,
    openAsHidden: newSettings.startMinimized
  });

  // Media-Keys aktivieren/deaktivieren
  if (newSettings.mediaKeys) {
    registerMediaKeys(mainWindow);
  } else {
    unregisterMediaKeys();
  }

  return true;
});
let ffmpegProcess;
let mainWindow;

/*
console.log(process.versions.node);
console.log(process.versions.electron);
console.log("typeof fetch =", typeof fetch);
console.log("typeof globalThis.fetch =", typeof globalThis.fetch);
*/

// FFmpeg-Stream starten
ipcMain.handle("radio:start", async (_, url) => {
  ffmpeg.setFfmpegPath(ffmpeg_StaticPath);
  if (ffmpegProcess) {
    ffmpegProcess.kill("SIGKILL");
    ffmpegProcess = null;
  }

  ffmpegProcess = ffmpeg(url)
    .audioChannels(2)
    .audioFrequency(48000)
    .format("f32le")
    .on("error", err => console.error("FFmpeg Fehler:", err))
    .pipe();

  ffmpegProcess.on("data", chunk => {
    // 🔴 DAS IST KRITISCH
    const pcm = new Float32Array(
      chunk.buffer,
      chunk.byteOffset,
      chunk.byteLength / 4
    );

    mainWindow.webContents.send("radio:pcm", pcm.buffer);
  });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    show: !settings.startMinimized,
    webPreferences: {
      autoplayPolicy: "no-user-gesture-required",
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
console.log("Preload path:", path.join(__dirname, "preload.js"));
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  mainWindow.once("ready-to-show", () => {
    if (!settings.startMinimized){
      mainWindow.show();
    }
  });

  // ❗ Fenster-Schließen → Tray
  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  createTray(mainWindow);
  registerMediaKeys(mainWindow);
}

app.whenReady().then(() => {
  createWindow();
  checkForUpdates();
  loadPlugins(mainWindow);
});
/*
ipcMain.handle("favorites:get", () => {
  return db.prepare("SELECT * FROM favorites").all();
});

ipcMain.handle("favorites:add", (e, fav) => {
  db.prepare("INSERT OR REPLACE INTO favorites VALUES (?, ?, ?, ?)")
    .run(fav.id, fav.name, fav.url, fav.country);
});

ipcMain.handle("history:get", () => {
  return db.prepare("SELECT * FROM history ORDER BY lastPlayed DESC").all();
});*/

ipcMain.handle("radio:search", async (event, name) => {
  const url = `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(name)}`;
  try {
    const res = await globalThis.fetch(url);
    return await res.json();
  } catch (err) {
    console.error("Radio fetch error:", err);
    return [];
  }
});
/*
ipcMain.handle("history:add", (e, entry) => {
  db.prepare(`
    INSERT INTO history (id, name, url, country, lastPlayed)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET lastPlayed = excluded.lastPlayed
  `).run(entry.id, entry.name, entry.url, entry.country, new Date().toISOString());
});*/

// Update-Check
function checkForUpdates() {
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("update-available", (info) => {
    tray.displayBalloon({
      title: "WebRadio Update",
      content: `Update ${info.version} verfügbar. Download startet...`
    });
  });

  autoUpdater.on("update-downloaded", () => {
    tray.displayBalloon({
      title: "WebRadio Update",
      content: "Update heruntergeladen. App wird neu gestartet..."
    });
    autoUpdater.quitAndInstall();
  });

  autoUpdater.on("error", (err) => {
    console.error("Update-Fehler:", err);
  });
}

app.setLoginItemSettings({
  openAtLogin: settings.autostart,
  openAsHidden: settings.startMinimized
});

app.on("window-all-closed", (e) => {
  // App soll weiterlaufen
  e.preventDefault();
});
app.on("will-quit", () => {
  unregisterMediaKeys();
});

