const path = require("path");
const LogManager = require("../logging/LogManager");

class CrashHandler {

    constructor() {
        this.initialized = false;
        this.logger = null;
        this.uncaughtExceptionHandler = null;
        this.unhandledRejectionHandler = null;
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
        try {
            if (this.logger) {
                this.logger.fatal(
                    `${type}: ${error.message}`,
                    {
                        stack: error.stack,
                        type
                    }
                );
            } else {
                console.error(`[${type}]`, error);
            }
        } catch (err) {
            console.error("CrashHandler konnte Fehler nicht loggen:", err);
        }
    }

}

module.exports = new CrashHandler();