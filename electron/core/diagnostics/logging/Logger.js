"use strict";

const LogLevel = require("./LogLevel");

class Logger {

    constructor(context = "Application") {

        this.context = context;
        this.transports = [];

    }

    addTransport(transport) {

        if (!transport) {
            return;
        }

        this.transports.push(transport);

    }

    removeTransport(transport) {

        this.transports =
            this.transports.filter(t => t !== transport);

    }

    clearTransports() {

        this.transports.length = 0;

    }

    trace(...args) {

        this.write(LogLevel.TRACE, args);

    }

    debug(...args) {

        this.write(LogLevel.DEBUG, args);

    }

    info(...args) {

        this.write(LogLevel.INFO, args);

    }

    warn(...args) {

        this.write(LogLevel.WARN, args);

    }

    error(...args) {

        this.write(LogLevel.ERROR, args);

    }

    fatal(...args) {

        this.write(LogLevel.FATAL, args);

    }

    separator(char = "=", length = 70) {

        this.info(char.repeat(length));

    }

    child(context) {

        const logger = new Logger(context);

        logger.transports = this.transports;

        return logger;

    }

    write(level, args) {

        const entry = {

            timestamp: new Date(),

            level,

            context: this.context,

            arguments: args

        };

        for (const transport of this.transports) {

            try {

                transport.log(entry);

            } catch (err) {

                console.error(
                    "Logger Transport Error:",
                    err
                );

            }

        }

    }

}

module.exports = Logger;