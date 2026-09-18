"use strict";

// Re-export des zentralen CrashHandlers zur Vermeidung konkurrierender Listener
const CrashHandler = require("../CrashHandler");

module.exports = CrashHandler;