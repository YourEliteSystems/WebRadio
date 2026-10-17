"use strict";

const { BrowserWindow, app, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { getWindowIcon } = require("../icons");
const BootFailureReport = require("../diagnostics/BootFailureReport");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("SplashWindow");

// Kanaele des Splash-Fensters. ipcMain erlaubt pro Kanal nur einen Handler,
// daher werden sie modulweit genau einmal registriert und beim Schliessen bzw.
// Aufraeumen wieder entfernt.
const SPLASH_CHANNELS = [
    "splash:get-version",
    "splash:get-diagnostics",
    "splash:open-log-folder",
    "splash:open-report",
    "splash:close",
    "splash:quit"
];

// Maximale Wartezeit auf das echte Lade-Signal des Splash-Renderers.
const SPLASH_READY_TIMEOUT = 1200;

// Maximale Zeit, um das Schliessen hinauszuzoegern, damit nicht mitten in
// den Ladevorgang hinein geschlossen wird.
const SPLASH_CLOSE_DEFER = 1000;

let splashHandlersInstalled = false;

/**
 * Loest eine Datei relativ zum App-Wurzelverzeichnis auf – im Entwicklungs-
 * betrieb das Projektverzeichnis, im Paket das app.asar. Der zweite
 * Kandidat ueber __dirname deckt den Fall ab, dass app.getAppPath() noch
 * nicht verfuegbar ist.
 */
function resolveAppFile(...segments) {
    const roots = [];

    if (app && typeof app.getAppPath === "function") {
        try {
            roots.push(app.getAppPath());
        } catch {
            // app.getAppPath() ist noch nicht verfuegbar.
        }
    }

    roots.push(path.join(__dirname, "../../.."));

    for (const root of roots) {
        const candidate = path.join(root, ...segments);

        try {
            fs.accessSync(candidate, fs.constants.R_OK);
            return candidate;
        } catch {
            // Naechsten Kandidaten pruefen.
        }
    }

    return path.join(roots[0], ...segments);
}

function registerHandler(channel, listener) {
    // Ueberbleibsel einer frueheren Initialisierung defensiv entfernen.
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, listener);
}

function installSplashHandlers() {
    if (splashHandlersInstalled) return;

    registerHandler("splash:get-version", () => app.getVersion());
    registerHandler("splash:get-diagnostics", (event) => getDiagnosticsInfo(event));
    registerHandler("splash:open-log-folder", () => openLogFolder());
    registerHandler("splash:open-report", () => openDiagnosticsReport());
    registerHandler("splash:close", (event) => closeSplashWindow(event));
    registerHandler("splash:quit", () => { app.quit(); return { ok: true }; });

    splashHandlersInstalled = true;
}

function uninstallSplashHandlers() {
    if (!splashHandlersInstalled) return;

    for (const channel of SPLASH_CHANNELS) {
        ipcMain.removeHandler(channel);
    }

    splashHandlersInstalled = false;
}

/**
 * Diagnoseinformationen fuer den Fehlerzustand des Splash-Renderers.
 * Pfade kommen ausschliesslich aus dem Main-Prozess.
 */
function getDiagnosticsInfo(event) {
    const info = BootFailureReport.getInfo();
    const sender = BrowserWindow.fromWebContents(event.sender);

    const canContinue = BrowserWindow.getAllWindows().some((win) => {
        return win !== sender && !win.isDestroyed();
    });

    return { ...info, canContinue };
}

function closeSplashWindow(event) {
    const win = BrowserWindow.fromWebContents(event.sender);

    if (!win || win.isDestroyed()) {
        return { ok: false, error: "Splash-Fenster nicht verfuegbar." };
    }

    win.close();

    return { ok: true };
}

async function openLogFolder() {
    const { logDirectory } = BootFailureReport.getPaths();

    return openDirectory(logDirectory, "Logordner");
}

async function openDiagnosticsReport() {
    const { reportPath, reportDirectory } = BootFailureReport.getInfo();

    if (isInsideDirectory(reportPath, reportDirectory) && fs.existsSync(reportPath)) {
        try {
            shell.showItemInFolder(reportPath);
            return { ok: true, path: reportPath };
        } catch (err) {
            logger.error(`Diagnosebericht konnte nicht angezeigt werden: ${err.message}`);
            return { ok: false, error: err.message };
        }
    }

    return openDirectory(reportDirectory, "Berichtsordner");
}

async function openDirectory(directory, label) {
    try {
        if (!directory || !fs.existsSync(directory)) {
            return { ok: false, error: `${label} ist nicht vorhanden.` };
        }

        const errorMessage = await shell.openPath(directory);

        return errorMessage
            ? { ok: false, error: errorMessage }
            : { ok: true, path: directory };
    } catch (err) {
        logger.error(`${label} konnte nicht geoeffnet werden: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

function isInsideDirectory(filePath, directory) {
    if (!filePath || !directory) return false;

    const resolvedFile = path.resolve(filePath);
    const resolvedDirectory = path.resolve(directory);

    return resolvedFile === resolvedDirectory
        || resolvedFile.startsWith(resolvedDirectory + path.sep);
}

/**
 * SplashWindow
 *
 * Verwaltet das Boot-up-Fenster von WebRadio. Es wird vor dem Haupt-
 * fenster angezeigt und uebertraegt Bootup-Fortschritt per IPC an den
 * Renderer. Schliesst sich automatisch nach dem app-ready-Signal.
 */
class SplashWindow {

    constructor() {
        this._window          = null;
        this._lastState       = null;
        this._closeTimer      = null;
        this._closeDeferTimer = null;
        this._loadFailed      = false;
        this._loadState       = "idle";
        this._closing         = false;
        this._pendingClose    = false;
        this._readyWaiters    = [];
    }

    // ─────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────

    /**
     * Oeffnet das Splash-Fenster und registriert IPC-Handler.
     * Idempotent: mehrfacher Aufruf hat keine Wirkung.
     */
    open() {
        if (this._window && !this._window.isDestroyed()) {
            return this._window;
        }

        const iconPath = getWindowIcon();
        const splashFile = resolveAppFile("renderer", "splash.html");
        const preloadFile = resolveAppFile("electron", "preload-splash.js");

        // Diagnose: macht Pfadfehler im Entwicklungs- und Paketbetrieb direkt
        // im Log sichtbar, statt nur einen generischen Ladefehler zu melden.
        logger.info(
            `Splash laden: ${splashFile} (exists=${fs.existsSync(splashFile)}, ` +
            `packaged=${!!app.isPackaged}, preload=${preloadFile}, ` +
            `preloadExists=${fs.existsSync(preloadFile)})`
        );

        logger.info("Opening splash window");

        const win = new BrowserWindow({
            width:  480,
            height: 300,
            frame:  false,
            resizable: false,
            movable:   true,
            center:    true,
            alwaysOnTop: true,
            skipTaskbar: true,
            transparent: false,
            backgroundColor: "#080c12",
            ...(iconPath ? { icon: iconPath } : {}),
            ...(process.platform === "linux" ? { title: "WebRadio" } : {}),
            webPreferences: {
                preload: preloadFile,
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
            }
        });

        this._window          = win;
        this._lastState       = null;
        this._loadFailed      = false;
        this._loadState       = "loading";
        this._closing         = false;
        this._pendingClose    = false;
        this._clearCloseTimers();

        // Der Renderer kann erst nach did-finish-load Empfangen. Zustaende, die
        // waehrend des Ladens eintreffen, werden gespeichert und danach
        // nachgesendet (verzoegerte Initialisierung).
        win.webContents.once("did-finish-load", () => {
            this._handleLoaded(win);
        });

        win.webContents.on("did-fail-load", (_event, code, description, validatedURL, isMainFrame) => {
            if (!isMainFrame) return;

            // Eigenes Schliessen bzw. ERR_ABORTED beendet die Navigation
            // absichtlich und ist kein Ladefehler.
            if (this._closing || this._pendingClose) return;
            if (code === -3) return;

            this._handleLoadFailure(`${description} (${code}) url=${validatedURL}`);
        });

        win.webContents.on("preload-error", (_event, preloadPath, error) => {
            logger.error(
                `Splash-Preload fehlgeschlagen: ${preloadPath}: ${error && error.message}`
            );
        });

        win.webContents.on("render-process-gone", (_event, details) => {
            const reason = details && details.reason;

            logger.error(
                `Splash-Renderer beendet: reason=${reason} exitCode=${details && details.exitCode}`
            );

            if (!this._closing && (reason === "crashed" || reason === "oom" || reason === "abnormal-exit")) {
                this._handleLoadFailure(`Renderer beendet (${reason})`);
            }
        });

        win.on("closed", () => {
            if (this._window === win) {
                this._window       = null;
                this._lastState    = null;
                this._loadState    = "idle";
                this._pendingClose = false;
            }

            this._clearCloseTimers();
            this._settleWaiters(false);
            uninstallSplashHandlers();

            logger.info("Splash window closed");
        });

        installSplashHandlers();

        // Expliziter Testmodus (nur Dev-Build): WEBRADIO_SPLASH_SIMULATE=1
        // laesst den Renderer den Ablauf simulieren. Im Normalbetrieb nie aktiv.
        const loadOptions = (!app.isPackaged && process.env.WEBRADIO_SPLASH_SIMULATE === "1")
            ? { query: { simulate: "1" } }
            : undefined;

        const load = win.loadFile(splashFile, loadOptions);

        if (load && typeof load.then === "function") {
            load.then(
                () => this._handleLoaded(win),
                (err) => this._handleLoadRejection(err)
            );
        }

        return win;
    }

    /**
     * Wartet auf das tatsaechliche Lade-Signal des Renderers. Loest mit true
     * auf, sobald die Seite geladen ist, sonst (Fehler oder Timeout) mit
     * false. Der Aufrufer wird dadurch nie dauerhaft blockiert.
     * @param {number} [timeoutMs] maximale Wartezeit
     * @returns {Promise<boolean>}
     */
    whenLoaded(timeoutMs = SPLASH_READY_TIMEOUT) {
        if (this._loadState === "loaded") return Promise.resolve(true);
        if (this._loadState !== "loading" || !this.isOpen()) return Promise.resolve(false);

        return new Promise((resolve) => {
            let settled = false;

            const finish = (ok) => {
                if (settled) return;

                settled = true;
                clearTimeout(timer);
                this._readyWaiters = this._readyWaiters.filter((waiter) => waiter.finish !== finish);
                resolve(ok);
            };

            const timer = setTimeout(() => finish(false), Math.max(0, timeoutMs));

            this._readyWaiters.push({ finish });
        });
    }

    /**
     * Sendet den aktuellen Bootup-Zustand an den Splash-Renderer.
     * @param {object} state  BootupDiagnostics.getState()
     */
    sendBootupState(state) {
        if (!state) return;

        this._lastState = state;

        const win = this._window;

        if (!win || win.isDestroyed()) return;

        // Waehrend des Ladens ginge die Nachricht verloren; did-finish-load
        // sendet anschliessend den zuletzt gespeicherten Zustand.
        if (win.webContents.isLoadingMainFrame()) return;

        this._send(win, state);
    }

    /**
     * Schliesst das Splash-Fenster mit einer kurzen Verzoegerung,
     * damit die Fade-out-Animation ablaufen kann.
     * @param {number} [delay=600] ms Wartezeit vor dem Schliessen
     */
    close(delay = 600) {
        const win = this._window;

        if (!win || win.isDestroyed()) {
            // Kein eigenes Fenster: nur die eigenen Timer freigeben. Der
            // IPC-Handler gehoert der Instanz, die das Fenster offen haelt.
            this._clearCloseTimers();
            return;
        }

        this._clearCloseTimers();

        logger.info(`Closing splash window in ${delay}ms`);

        this._closeTimer = setTimeout(() => {
            this._closeTimer = null;
            this._closeWhenReady();
        }, Math.max(0, delay));
    }

    /**
     * Gibt zurueck, ob das Fenster aktuell offen ist.
     * @returns {boolean}
     */
    isOpen() {
        return !!(this._window && !this._window.isDestroyed());
    }

    /**
     * Raeumt Fenster, Timer und IPC-Handler zuverlaessig auf.
     * Idempotent und auch bei vorzeitigem Beenden aufrufbar.
     */
    dispose() {
        this._closing = true;
        this._clearCloseTimers();
        this._settleWaiters(false);

        const win = this._window;

        this._window       = null;
        this._lastState    = null;
        this._loadState    = "idle";
        this._pendingClose = false;

        uninstallSplashHandlers();

        if (win && !win.isDestroyed()) {
            win.removeAllListeners("closed");
            win.destroy();
        }
    }

    // ─────────────────────────────────────────────
    // Private
    // ─────────────────────────────────────────────

    /**
     * Der Renderer hat fertig geladen (did-finish-load und/oder aufgeloeste
     * loadFile-Promise). Der letzte Bootup-Zustand wird nachgesendet.
     */
    _handleLoaded(win) {
        if (this._window !== win || this._loadState === "loaded" || this._loadState === "failed") {
            return;
        }

        this._loadState = "loaded";
        this._settleWaiters(true);

        if (this._lastState) this._send(win, this._lastState);

        // Ein waehrend des Ladens angeforderter Close wird jetzt faellig.
        if (this._pendingClose) this._closeNow();
    }

    _send(win, state) {
        try {
            win.webContents.send("splash:bootup-state", state);
        } catch (err) {
            logger.warn("Failed to send bootup state to splash:", err.message);
        }
    }

    /**
     * Schliesst das Fenster nur, wenn der Renderer fertig geladen hat. Ein
     * Close mitten im Laden bricht die Navigation ab; Electron meldet das als
     * ERR_FAILED (-2) und es saehe wie ein echter Ladefehler aus. Auf den
     * Abschluss wird deshalb gewartet – hoechstens SPLASH_CLOSE_DEFER ms,
     * damit der Start nie an einem haengenden Splash festhaelt.
     */
    _closeWhenReady() {
        const win = this._window;

        if (!win || win.isDestroyed()) return;

        if (this._loadState === "loading") {
            this._pendingClose = true;

            this._closeDeferTimer = setTimeout(() => {
                this._closeDeferTimer = null;
                this._pendingClose = false;
                this._closeNow();
            }, SPLASH_CLOSE_DEFER);

            return;
        }

        this._closeNow();
    }

    _closeNow() {
        this._clearCloseTimers();
        this._pendingClose = false;

        const win = this._window;

        if (!win || win.isDestroyed()) return;

        this._closing = true;
        win.close();
    }

    /**
     * loadFile() lehnt auch dann ab, wenn das Fenster waehrend des Ladens
     * geschlossen wird (ERR_FAILED (-2)). Das ist kein Ladefehler und darf
     * nicht als solcher protokolliert oder behandelt werden.
     */
    _handleLoadRejection(err) {
        if (this._loadState === "loaded" || this._loadFailed) return;

        if (this._closing || this._pendingClose) return;

        if (!this._window || this._window.isDestroyed()) return;

        const message = err && err.message ? err.message : String(err);

        if (message.indexOf("ERR_ABORTED") !== -1) return;

        this._handleLoadFailure(message);
    }

    /**
     * Das Splash-Fenster konnte nicht geladen werden. Es wird geschlossen,
     * damit kein leerer Rahmen stehen bleibt; der Start laeuft ohne Splash
     * weiter und protokolliert den Fehler.
     */
    _handleLoadFailure(reason) {
        if (this._loadFailed) return;

        this._loadFailed = true;
        this._loadState  = "failed";

        this._settleWaiters(false);

        logger.error(`Splash window failed to load: ${reason}`);

        this.dispose();
    }

    _settleWaiters(ok) {
        if (!this._readyWaiters.length) return;

        const waiters = this._readyWaiters;
        this._readyWaiters = [];

        for (const waiter of waiters) {
            waiter.finish(ok);
        }
    }

    _clearCloseTimers() {
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = null;
        }

        if (this._closeDeferTimer) {
            clearTimeout(this._closeDeferTimer);
            this._closeDeferTimer = null;
        }
    }
}

module.exports = SplashWindow;
