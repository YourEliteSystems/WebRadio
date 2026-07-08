"use strict";

const LogManager = require("./LogManager");

module.exports = {

    initialize() {
        LogManager.initialize();
    },

    getLogger(context) {
        return LogManager.getLogger(context);
    },

    getRootLogger() {
        return LogManager.getRootLogger();
    }

};