"use strict";

const LogLevel = require("../LogLevel");

class ConsoleTransport {

    constructor(formatter) {

        this.formatter = formatter;

    }

    log(entry) {

        const message = this.formatter.format(entry);

        switch (entry.level) {

            case LogLevel.TRACE:
            case LogLevel.DEBUG:
                console.debug(message);
                break;

            case LogLevel.INFO:
                console.info(message);
                break;

            case LogLevel.WARN:
                console.warn(message);
                break;

            case LogLevel.ERROR:
            case LogLevel.FATAL:
                console.error(message);
                break;

            default:
                console.log(message);
                break;

        }

    }

}

module.exports = ConsoleTransport;