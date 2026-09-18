"use strict";

const LogManager = require("./logging/LogManager");
const CrashDumpWriter = require("./CrashDumpWriter");
const DiagnosticsManager = require("./DiagnosticsManager");

/**
 * CrashHandler – Fängt ungefangene Ausnahmen ab, loggt sie
 * und erzeugt einen bereinigten Crash-Dump mit der letzten
 * Memory- und Bootup-Historie.
 */
class CrashHandler {

    constructor() {
        this.initialized = false;
        this.logger = null;
        this.uncaughtExceptionHandler = null;
        this.unhandledRejectionHandler = null;
        this._isHandlingCrash = false;
    }

    initialize() {
        if (this.initialized) {
            return;
        }

        this.logger = LogManager.getLogger("CrashHandler");

        this.uncaughtExceptionHandler = (error) => {
            this.handleCrash("uncaughtException", error);
        };

        this.unhandledRejectionHandler = (reason) => {
            const error = reason instanceof Error
                ? reason
                : new Error(String(reason));
            this.handleCrash("unhandledRejection", error);
        };

        process.on("uncaughtException", this.uncaughtExceptionHandler);
        process.on("unhandledRejection", this.unhandledRejectionHandler);

        this.initialized = true;
        this.logger.info("[CrashHandler] Initialized.");
    }

    shutdown() {
        if (!this.initialized) {
            return;
        }

        if (this.uncaughtExceptionHandler) {
            process.removeListener("uncaughtException", this.uncaughtExceptionHandler);
            this.uncaughtExceptionHandler = null;
        }

        if (this.unhandledRejectionHandler) {
            process.removeListener("unhandledRejection", this.unhandledRejectionHandler);
            this.unhandledRejectionHandler = null;
        }

        this.logger = null;
        this.initialized = false;
    }

    handleCrash(type, error) {
        // Rekursions-Schutz bei Fehlern während des Crash-Handlings
        if (this._isHandlingCrash) {
            console.error(`[CrashHandler] Rekursiver Fehler bei ${type}:`, error);
            return null;
        }

        this._isHandlingCrash = true;
        let dumpPath = null;

        try {
            // 1. Logging über bestehenden Logger (keine Fehler verschlucken)
            if (this.logger) {
                this.logger.fatal(
                    `${type}: ${error?.message || error}`,
                    {
                        stack: error?.stack,
                        type
                    }
                );
            } else {
                console.error(`[${type}]`, error);
            }

            // 2. Crash-Dump-Generierung mit RAM-Historie aus Profilern
            const dumpData = DiagnosticsManager.getCrashDumpData({ type, error });
            dumpPath = CrashDumpWriter.write(dumpData);

            if (this.logger && dumpPath) {
                this.logger.info(`[CrashHandler] Crash-Dump geschrieben: ${dumpPath}`);
            }
        } catch (err) {
            console.error("[CrashHandler] Fehler beim Erstellen des Crash-Dumps:", err);
        } finally {
            this._isHandlingCrash = false;
        }

        return dumpPath;
    }

}

module.exports = new CrashHandler();
