const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { createTray } = require("./core/tray");
const { initialize, trackEvent } = require("@aptabase/electron/main");
const Sentry = require("@sentry/electron/main");
const { registerMediaKeys, unregisterMediaKeys } = require("./core/mediaKeys");
const { autoUpdater } = require("electron-updater");
const pluginManager = require("./plugins/pluginManager");
const ffmpeg_StaticPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const {Readable} = require("stream");
const fs = require("fs");

let settingsWindow;

ipcMain.on("open-settings", () => {
  createSettingsWindow();
});

ipcMain.on("window:minimize", () => {
  BrowserWindow.getFocusedWindow().minimize();
});

ipcMain.on("window:close", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  win.close();
});

ipcMain.handle("plugins:get", () => {
  return pluginManager.getPlugins();
});

ipcMain.handle("plugins:toggle", (_, id, enabled) => {
  pluginManager.togglePlugin(id, enabled);
});

ipcMain.on("window:maximize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

let ffmpegStream;
let mainWindow;
let ffmpegCommand;

//Theme laden automatisch
ipcMain.handle("theme:get", async () => {
  const themesPath = path.join(__dirname,"../renderer/themes");
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
      css: `../renderer/themes/${folder.name}/${data.css}`,
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
          pluginManager.emit("onMetadata", metadata);
          eventBus.emit("onMetadata", metadata);
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
    frame: false,
    titleBarStyle: "hidden",
    icon: path.join(__dirname, "../assets/icons/tray.ico"),
    //show: !settings.startMinimized,
    webPreferences: {
      autoplayPolicy: "no-user-gesture-required",
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  //console.log("Preload path:", path.join(__dirname, "preload.js"));
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  //mainWindow.webContents.openDevTools();
  
  // ❗ Fenster-Schließen → Tray
  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

Sentry.init({
  dsn: "https://84cda7a2f665ab15b9ac790890b55a24@o4509039289040897.ingest.de.sentry.io/4511078839550032",
  debug: true,
  release: app.getVersion(),
  tracesSampleRate: 1.0
});

// Handler für Renderer-Events
ipcMain.handle('analytics:trackEvent', (_, { eventName, props }) => {
  if (!trackEvent) return;
  trackEvent(eventName, props);
});

// IPC Handler
ipcMain.handle('sentry:captureException', (_, payload) => {
  Sentry.captureException(new Error(payload.message + '\n' + payload.stack));
});

ipcMain.handle('sentry:captureMessage', (_, payload) => {
  Sentry.captureMessage(payload.message);
});

ipcMain.handle('sentry:addBreadcrumb', (_, breadcrumb) => {
  Sentry.addBreadcrumb(breadcrumb);
});

initialize("A-EU-8544304569");

app.whenReady().then(() => {
  //console.log(pluginManager);
  createWindow();
  pluginManager.loadPlugins();
  trackEvent("App Started");
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
      //autoplayPolicy: "no-user-gesture-required",
      preload: path.join(__dirname, "preload.js"),
      //devTools: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
//mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  settingsWindow.loadFile(path.join(__dirname, "..", "renderer", "settings.html"));
  /*settingsWindow.webContents.on("before-input-event", (event, input) => {
    if(input.key === "F12"){
      settingsWindow.webContents.openDevTools();
    }
  });*/
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

}

app.on("window-all-closed", (e) => {
  // App soll weiterlaufen
  e.preventDefault();
});
app.on("will-quit", () => {
  unregisterMediaKeys();
});

// Auto-Updater
app.whenReady().then(() => {
  autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on("checking-for-update", () => {
  console.log("Suche nach Updates...");
});

autoUpdater.on("update-available", () => {
  console.log("Update verfügbar");
});

autoUpdater.on("update-not-available", () => {
  console.log("Kein Update");
});

autoUpdater.on("update-downloaded", () => {
  console.log("Update geladen – Neustart nötig");
  autoUpdater.quitAndInstall();
});
