"use strict";

/**
 * Public entry-point für das Update-Subsystem.
 *
 * Erlaubt Imports wie:
 *   const { updateManager } = require("./updates");
 *
 * ohne dass Aufrufer das Verzeichnis-Layout des Subsystems kennen
 * müssen.
 */

const UpdateManager = require("./UpdateManager");
const UpdateState = require("./UpdateState");
const UpdateChannel = require("./UpdateChannel");
const MarkdownSanitizer = require("./MarkdownSanitizer");

module.exports = {
    updateManager: UpdateManager,
    states: UpdateState.STATES,
    errorCodes: UpdateState.ERROR_CODES,
    channels: UpdateState.CHANNELS,
    isValidChannel: UpdateChannel.isValidChannel,
    isPrerelease: UpdateChannel.isPrerelease,
    detectChannelFromVersion: UpdateChannel.detectChannelFromVersion,
    sanitizeMarkdown: MarkdownSanitizer.sanitize
};
