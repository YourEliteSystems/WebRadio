"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { app } = require("electron");

const BootupDiagnostics = require("./BootupDiagnostics");
const CrashDumpWriter = require("./CrashDumpWriter");
const StorageManager = require("../storage/StorageManager");
const LogManager = require("./logging/LogManager");

const logger = LogManager.getLogger("BootFailureReport");

/**
 * BootFailureReport – Dokumentiert einen abgebrochenen Start.
 *
 * Schreibt einen bereinigten Diagnosebericht (Fehlermeldung, fehlgeschlagener
 * Bootup-Schritt, Bootup-Zusammenfassung, Plattform- und Pfadangaben) in den
 * Crash-Ordner und haelt die Pfade fuer den Splash-Renderer bereit, damit der
 * Nutzer Bericht und Logdatei direkt oeffnen kann.
 *
 * Der Bericht wird ueber den CrashDumpWriter geschrieben und ist damit Teil der
 * bestehenden Crash-Report-Liste im Diagnosebereich der Einstellungen.
 */
class BootFailureReport {

    constructor() {
        this._lastFailure = null;
    }

    /**
     * Erstellt den Diagnosebericht fuer einen fehlgeschlagenen Start.
     * Wirft niemals: fehlende Pfade oder Schreibfehler werden protokolliert.
     *
     * @param {Error|string} error
     * @param {string|null} [failedStep]
     * @returns {object} Informationen fuer den Splash-Renderer
     */
    create(error, failedStep = null) {
        const paths = this.getPaths();

        const report = {
            type: "boot-failure",
            timestamp: new Date().toISOString(),
            application: {
                name: "WebRadio",
                version: (app && typeof app.getVersion === "function") ? app.getVersion() : "unknown",
                packaged: !!(app && app.isPackaged)
            },
            runtime: {
                electron: process.versions.electron || null,
                chrome: process.versions.chrome || null,
                node: process.versions.node
            },
            platform: {
                platform: process.platform,
                arch: process.arch,
                release: os.release()
            },
            failedStep,
            bootup: BootupDiagnostics.getSummary(),
            paths: {
                logs: paths.logDirectory,
                logFile: paths.logFilePath,
                reports: paths.reportDirectory,
                userData: paths.userData
            },
            error: {
                name: error instanceof Error ? error.name : "Error",
                message: error instanceof Error ? error.message : String(error),
                stack: (error instanceof Error && error.stack) ? error.stack : null
            }
        };

        let reportPath = null;

        try {
            reportPath = CrashDumpWriter.write(report);
        } catch (err) {
            logger.error(`Diagnosebericht konnte nicht geschrieben werden: ${err.message}`);
        }

        this._lastFailure = {
            timestamp: report.timestamp,
            failedStep,
            reportPath,
            error: report.error,
            ...paths
        };

        if (reportPath) {
            logger.error(`Start fehlgeschlagen, Diagnosebericht: ${reportPath}`);
        } else {
            logger.error("Start fehlgeschlagen, kein Diagnosebericht geschrieben.");
        }

        return { ...this._lastFailure };
    }

    /**
     * Liefert die zuletzt erstellten Fehlerinformationen (bzw. nur die Pfade,
     * wenn noch kein Fehler dokumentiert wurde).
     *
     * @returns {object}
     */
    getInfo() {
        if (this._lastFailure) {
            return { ...this._lastFailure };
        }

        return {
            timestamp: null,
            failedStep: null,
            reportPath: null,
            error: null,
            ...this.getPaths()
        };
    }

    /**
     * Ermittelt die Pfade fuer Logs und Berichte. Faellt auf das userData-
     * Verzeichnis zurueck, wenn der StorageManager noch nicht bereit ist, und
     * legt die Ordner nach Moeglichkeit an, damit sie geoeffnet werden koennen.
     *
     * @returns {object}
     */
    getPaths() {
        const fallbackRoot = (app && typeof app.getPath === "function")
            ? app.getPath("userData")
            : path.join(process.cwd(), "data");

        let userData = fallbackRoot;
        let logDirectory = path.join(fallbackRoot, "logs");
        let reportDirectory = path.join(fallbackRoot, "crash");

        try {
            userData = StorageManager.getUserDataPath();
            logDirectory = StorageManager.getLogsPath();
            reportDirectory = StorageManager.getCrashPath();
        } catch (err) {
            logger.warn(`StorageManager-Pfade nicht verfuegbar, nutze Fallback: ${err.message}`);
        }

        return {
            userData,
            logDirectory,
            logDirectoryExists: this._ensureDirectory(logDirectory),
            logFilePath: path.join(logDirectory, "latest.log"),
            reportDirectory,
            reportDirectoryExists: this._ensureDirectory(reportDirectory)
        };
    }

    clear() {
        this._lastFailure = null;
    }

    // ─────────────────────────────────────────────
    // Private
    // ─────────────────────────────────────────────

    _ensureDirectory(directory) {
        try {
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }
            return true;
        } catch (err) {
            logger.warn(`Verzeichnis nicht anlegbar (${directory}): ${err.message}`);
            return false;
        }
    }

}

module.exports = new BootFailureReport();
