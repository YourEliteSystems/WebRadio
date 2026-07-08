"use strict";

class LogEntry {

    constructor({

        timestamp = new Date(),

        level,

        context = "Application",

        message = "",

        arguments: args = [],

        plugin = null,

        packageId = null,

        sessionId = null,

        processId = process.pid,

        version = null,

        tags = []

    } = {}) {

        this.timestamp = timestamp;

        this.level = level;

        this.context = context;

        this.message = message;

        this.arguments = Array.isArray(args)
            ? args
            : [args];

        this.plugin = plugin;

        this.packageId = packageId;

        this.sessionId = sessionId;

        this.processId = processId;

        this.version = version;

        this.tags = tags;

    }

}

module.exports = LogEntry;