const { app, BrowserWindow } = require("electron");
const path = require("path");
const pluginManager = require("./plugins/pluginManager");
const eventBus = require("./core/eventBus");
const ipcBridge = require("./core/ipc/ipcBridge");

let mainWindow;
let settingsWindow;

const isDev = !app.isPackaged;

/**
 * Erstellt das Hauptfenster
 */
function createMainWindow() {
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
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  return mainWindow;
}

/**
 * App-Initialisierung
 */
app.whenReady().then(() => {
  console.log("[Main] App bereit, starte Initialisierung...");

  // Fenster erstellen
  mainWindow = createMainWindow();

  // IPC-Handler registrieren (mit Platzhalter für streamController)
  // TODO: streamController wird in Phase 2 implementiert
  const streamController = {
    start: async (url, mainWindow) => {
      console.warn("[TODO] StreamController.start() nicht implementiert");
    },
    stop: async () => {
      console.warn("[TODO] StreamController.stop() nicht implementiert");
    },
  };

  ipcBridge.registerAllHandlers(mainWindow, settingsWindow, streamController);

  // Plugins laden
  pluginManager.loadPlugins();

  // Update-Check nach 5 Sekunden (Hintergrund)
  setTimeout(async () => {
    console.log("[Main] Starte Update-Check...");
    // wird über IPC ausgelöst
  }, 5000);

  console.log("[Main] Initialisierung abgeschlossen.");
});

/**
 * Fenster-Events
 */
app.on("window-all-closed", (e) => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async (e) => {
  console.log("[Main] App wird beendet, Cleanup...");
  // TODO: StreamController.stopAll() in Phase 2
});

module.exports = { mainWindow, settingsWindow };
