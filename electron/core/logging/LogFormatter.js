"use strict";

const util = require("util");
const LogLevel = require("./LogLevel");

class LogFormatter {

    format(entry) {

        const timestamp = this.formatTimestamp(entry.timestamp || new Date());

        const level = this.formatLevel(entry.level);

        const context = entry.context
            ? `[${entry.context}]`
            : "";

        const message = this.formatArguments(entry.arguments || []);

        return `${timestamp} ${level} ${context}\n${message}`;

    }

    formatTimestamp(date) {

        const pad = (value, length = 2) =>
            String(value).padStart(length, "0");

        return (
            `${date.getFullYear()}-` +
            `${pad(date.getMonth() + 1)}-` +
            `${pad(date.getDate())} ` +
            `${pad(date.getHours())}:` +
            `${pad(date.getMinutes())}:` +
            `${pad(date.getSeconds())}.` +
            `${pad(date.getMilliseconds(), 3)}`
        );

    }

    formatLevel(level) {

        return `[${LogLevel.getName(level).padEnd(5)}]`;

    }

    formatArguments(args) {

        if (!Array.isArray(args)) {
            args = [args];
        }

        return args
            .map(arg => this.formatValue(arg))
            .join(" ");

    }

    formatValue(value) {

        if (value instanceof Error) {
            return this.formatError(value);
        }

        if (value === null) {
            return "null";
        }

        if (value === undefined) {
            return "undefined";
        }

        if (typeof value === "string") {
            return this.indentMultiline(value);
        }

        if (typeof value === "object") {

            return util.inspect(value, {
                depth: null,
                colors: false,
                compact: false,
                sorted: true
            });

        }

        return String(value);

    }

    formatError(error) {

        let output = "";

        output += `Error: ${error.message}`;

        if (error.stack) {

            output += "\n\n";
            output += error.stack;

        }

        return output;

    }

    indentMultiline(text) {

        const lines = String(text).split("\n");

        if (lines.length <= 1) {
            return text;
        }

        return lines
            .map((line, index) => index === 0 ? line : "    " + line)
            .join("\n");

    }

}

module.exports = LogFormatter;