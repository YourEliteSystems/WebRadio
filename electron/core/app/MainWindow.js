const { BrowserWindow } = require("electron");
const path = require("path");
const { getWindowIcon } = require("../icons");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("RendererDiagnostics");

/**
 * Optional, per Umgebungsvariable aktivierbare Renderer-Diagnose.
 *
 * `WEBRADIO_RENDERER_DIAGNOSTICS=1` protokolliert Konsolenausgaben des
 * Renderers (inkl. CSP-Verstößen wie „Refused to load the script …“) sowie
 * Lade-/Prozessfehler in das reguläre WebRadio-Log. Ohne die Variable ist
 * die Diagnose vollständig inaktiv.
 *
 * Damit lassen sich Renderer-Ladefehler (CSP-Blockade, CORS, fehlgeschlagene
 * Modulauswertung) eindeutig von Serverfehlern unterscheiden, ohne den
 * Renderer selbst zu instrumentieren oder `webSecurity` abzuschalten.
 */
function attachRendererDiagnostics(window) {
  if (process.env.WEBRADIO_RENDERER_DIAGNOSTICS !== "1") return;

  const target = window.webContents;

  target.on("did-finish-load", () => {
    logger.info(`[renderer] did-finish-load: ${target.getURL()}`);
  });

  target.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    logger.error(
      `[renderer] did-fail-load: code=${errorCode} (${errorDescription}) url=${validatedURL}`
    );
  });

  target.on("preload-error", (_event, preloadPath, error) => {
    logger.error(`[renderer] preload-error: ${preloadPath}: ${error && error.message}`);
  });

  target.on("render-process-gone", (_event, details) => {
    logger.error(
      `[renderer] render-process-gone: reason=${details && details.reason} ` +
      `exitCode=${details && details.exitCode}`
    );
  });

  // `console-message` liefert je nach Electron-Version ein Event-Details-Objekt
  // oder die Einzelargumente. Beide Formen werden unterstützt.
  target.on("console-message", (...args) => {
    const details = args.length === 1 ? args[0] : null;
    const level = details ? details.level : args[1];
    const message = details ? details.message : args[2];
    const line = details ? details.lineNumber : args[3];
    const source = details ? details.sourceId : args[4];
    logger.warn(`[renderer-console] (${level}) ${message} [${source}:${line}]`);
  });
}

function createMainWindow(isDev) {
  // Icon aus zentraler Icon-Verwaltung beziehen
  const iconPath = getWindowIcon();

  const window = new BrowserWindow({
    width: 1100,
    height: 700,
    frame: false,
    titleBarStyle: "hidden",
    ...(iconPath ? { icon: iconPath } : {}),
    // WM_CLASS für Linux Desktop-Integration (verhindert Chromium-Instanz-Gruppierung)
    // Muss mit StartupWMClass in .desktop-Datei übereinstimmen
    ...(process.platform === 'linux' ? { title: 'WebRadio' } : {}),

    webPreferences: {
      preload: path.join(__dirname, "../../preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      autoplayPolicy: "no-user-gesture-required"
    }
  });

  attachRendererDiagnostics(window);

  window.loadFile(
    path.join(__dirname, "../../../renderer/index.html")
  );

  return window;
}

module.exports = {
  createMainWindow
};