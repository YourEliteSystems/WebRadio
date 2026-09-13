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

    initialize(options = {}) {
        const { transports = ["file", "console"] } = options;

        if (this.initialized) {
            return;
        }

        this.formatter = new LogFormatter();

        const logsPath = (app && typeof app.getPath === "function")
            ? path.join(app.getPath("userData"), "logs")
            : path.join(process.cwd(), "logs");

        if (transports.includes("console")) {
            this.consoleTransport =
                new ConsoleTransport(this.formatter);
        }

        if (transports.includes("file")) {
            this.fileTransport =
                new FileTransport(
                    logsPath,
                    this.formatter
                );
        }

        this.rootLogger =
            new Logger("Application");

        if (!app || !app.isPackaged) {
            if (this.consoleTransport) {
                this.rootLogger.addTransport(this.consoleTransport);
            }
        }

        if (this.fileTransport) {
            this.rootLogger.addTransport(this.fileTransport);
        }

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

        if (this.rootLogger) {
            this.rootLogger.clearTransports();
        }

        this.rootLogger = null;
        this.formatter = null;
        this.consoleTransport = null;
        this.fileTransport = null;
        this.initialized = false;

    }

    reset() {
        this.shutdown();
    }

}

module.exports = new LogManager();