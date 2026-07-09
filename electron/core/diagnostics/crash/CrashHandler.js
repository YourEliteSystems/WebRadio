const path = require("path");

class CrashHandler {

    constructor() {
        this.initialized = false;
        this.logger = null;
    }

    initialize(logger) {

        if (this.initialized) {
            return;
        }

        this.logger = logger;

        process.on("uncaughtException", (error) => {
            this.handleCrash("uncaughtException", error);
        });

        process.on("unhandledRejection", (reason) => {

            const error = reason instanceof Error
                ? reason
                : new Error(String(reason));

            this.handleCrash("unhandledRejection", error);

        });

        this.initialized = true;

        console.log("[CrashHandler] Initialized.");

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