const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { createTray } = require("./tray");
const { loadSettings, saveSettings } = require("./settings");
const { registerMediaKeys, unregisterMediaKeys } = require("./mediaKeys");
const { autoUpdater } = require("electron-updater");
const { loadPlugins} = require("./pluginLoader");
const ffmpeg_StaticPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const {Readable} = require("stream");
const fs = require("fs");

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

ipcMain.on("window:minimize", () => {
  BrowserWindow.getFocusedWindow().minimize();
});

ipcMain.on("window:close", () => {
  BrowserWindow.getFocusedWindow().close();
});

ipcMain.on("window:maximize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
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
let ffmpegStream;
let mainWindow;
let ffmpegCommand;

//Theme laden automatisch
ipcMain.handle("theme:get", async () => {
  const themesPath = path.join(__dirname,"../themes");
  const folders = fs.readdirSync(themesPath, { withFileTypes: true })

  const themes = [];
  for (const folder of folders) {
    if (!folder.isDirectory())continue;
    const themeJsonPath = path.join(themesPath, folder.name, "theme.json");
    if (!fs.existsSync(themeJsonPath)) continue;

    const data = JSON.parse(fs.readFileSync(themeJsonPath));

    themes.push({
      id: folder.name,
      name: data.name,
      css: `../themes/${folder.name}/${data.css}`,
    });
  }
  return themes;
});

// FFmpeg-Stream starten
ipcMain.handle("radio:start", async (_, url) => {
  ffmpeg.setFfmpegPath(ffmpeg_StaticPath);
  if (ffmpegCommand) {
    try {
    ffmpegCommand.kill("SIGKILL");
    } catch (err) {
      console.warn("Fehler beim Stoppen des vorherigen FFmpeg-Prozesses:", err);
    }
    ffmpegCommand = null;
    ffmpegStream = null;
  }

  ffmpegCommand = ffmpeg(url)
    .audioChannels(2)
    .audioFrequency(48000)
    .format("f32le")
    .on("stderr", line => {
      if(line.includes("StreamTitle")){
        const match = line.match(/StreamTitle='([^']*)';/);
        if(match){
          const metadata = { StreamTitle: match[1] };
          mainWindow.webContents.send("radio:metadata", metadata);
        }
      }
    })
    .on("error", err =>{ 
      if(err.message.includes("ffmpeg was killed with signal SIGKILL")){
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    icon: path.join(__dirname, "../assets/icons/tray.ico"),
    //show: !settings.startMinimized,
    webPreferences: {
      autoplayPolicy: "no-user-gesture-required",
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      frame: false,
      titleBarStyle: "hidden",
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

