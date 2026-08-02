"use strict";

const path = require("path");
const { app } = require("electron");

const Logger = require("./Logger");
const LogFormatter = require("./LogFormatter");

const ConsoleTransport = require("./transports/ConsoleTransport");
const FileTransport = require("./transports/FileTransport");

class LogManager {

    constructor() {

        this.initialized = false;

        this.rootLogger = null;

        this.formatter = null;

        this.consoleTransport = null;

        this.fileTransport = null;

    }

    initialize() {

        if (this.initialized) {
            return;
        }

        this.formatter = new LogFormatter();

        this.consoleTransport =
            new ConsoleTransport(this.formatter);

        this.fileTransport =
            new FileTransport(

                path.join(
                    app.getPath("userData"),
                    "logs"
                ),

                this.formatter

            );

        this.rootLogger =
            new Logger("Application");

        if (!app.isPackaged) {
            this.rootLogger.addTransport(
                this.consoleTransport
            );
        }

        this.rootLogger.addTransport(
            this.fileTransport
        );

        this.initialized = true;

        this.rootLogger.separator();

        this.rootLogger.info(
            "Logging initialisiert."
        );

        this.rootLogger.separator();

    }

    getLogger(context = "Application") {

        if (!this.initialized) {
            this.initialize();
        }

        return this.rootLogger.child(context);

    }

    // Alias für getLogger (Kompatibilität)
    createLogger(context = "Application") {
        return this.getLogger(context);
    }

    getRootLogger() {

        if (!this.initialized) {
            this.initialize();
        }

        return this.rootLogger;

    }

    shutdown() {

        if (!this.initialized) {
            return;
        }

        this.rootLogger.separator();
        this.rootLogger.info("Logging wird beendet.");
        this.rootLogger.separator();

        this.rootLogger      = null;
        this.formatter       = null;
        this.consoleTransport = null;
        this.fileTransport   = null;
        this.initialized     = false;

    }

}

module.exports = new LogManager();