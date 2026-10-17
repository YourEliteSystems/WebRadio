"use strict";

const { BrowserWindow, app, ipcMain } = require("electron");
const path = require("path");
const { getWindowIcon } = require("../icons");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("SplashWindow");

/**
 * SplashWindow
 *
 * Verwaltet das Boot-up-Fenster von WebRadio. Es wird vor dem Haupt-
 * fenster angezeigt und uebertraegt Bootup-Fortschritt per IPC an den
 * Renderer. Schliesst sich automatisch nach dem app-ready-Signal.
 */
class SplashWindow {

    constructor() {
        this._window   = null;
        this._ready    = false;
        this._ipcRegistered = false;
    }

    // ─────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────

    /**
     * Oeffnet das Splash-Fenster und registriert IPC-Handler.
     * Idempotent: mehrfacher Aufruf hat keine Wirkung.
     */
    open() {
        if (this._window) return;

        logger.info("Opening splash window");

        const iconPath = getWindowIcon();

        this._window = new BrowserWindow({
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
                preload: path.join(__dirname, "../../preload-splash.js"),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
            }
        });

        this._window.loadFile(
            path.join(__dirname, "../../../renderer/splash.html")
        );

        this._window.on("closed", () => {
            this._window = null;
            logger.info("Splash window closed");
        });

        this._registerIpc();
    }

    /**
     * Sendet den aktuellen Bootup-Zustand an den Splash-Renderer.
     * @param {object} state  BootupDiagnostics.getState()
     */
    sendBootupState(state) {
        if (!this._window || this._window.isDestroyed()) return;
        try {
            this._window.webContents.send("splash:bootup-state", state);
        } catch (err) {
            logger.warn("Failed to send bootup state to splash:", err.message);
        }
    }

    /**
     * Schliesst das Splash-Fenster mit einer kurzen Verzoegerung,
     * damit die Fade-out-Animation ablaufen kann.
     * @param {number} [delay=600] ms Wartezeit vor dem Schliessen
     */
    close(delay = 600) {
        if (!this._window || this._window.isDestroyed()) return;

        logger.info(`Closing splash window in ${delay}ms`);
        setTimeout(() => {
            if (this._window && !this._window.isDestroyed()) {
                this._window.close();
            }
        }, delay);
    }

    /**
     * Gibt zurueck, ob das Fenster aktuell offen ist.
     * @returns {boolean}
     */
    isOpen() {
        return !!(this._window && !this._window.isDestroyed());
    }

    // ─────────────────────────────────────────────
    // Private
    // ─────────────────────────────────────────────

    _registerIpc() {
        if (this._ipcRegistered) return;
        this._ipcRegistered = true;

        // Versions-Abfrage aus dem Splash-Renderer
        ipcMain.handle("splash:get-version", () => {
            return app.getVersion();
        });
    }
}

module.exports = SplashWindow;
