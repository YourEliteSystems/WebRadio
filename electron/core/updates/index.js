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
const ChannelMetadata = require("./ChannelMetadata");
const ReleaseChannel = require("./ReleaseChannel");
const ChannelStore = require("./settings");

module.exports = {
    updateManager: UpdateManager,
    states: UpdateState.STATES,
    errorCodes: UpdateState.ERROR_CODES,
    channels: UpdateState.CHANNELS,
    isValidChannel: UpdateChannel.isValidChannel,
    isPrerelease: UpdateChannel.isPrerelease,
    detectChannelFromVersion: UpdateChannel.detectChannelFromVersion,
    getUpdateChannel: UpdateChannel.getUpdateChannel,
    sanitizeMarkdown: MarkdownSanitizer.sanitize,

    channelMetadata: ChannelMetadata.CHANNEL_METADATA,
    channelIds: ChannelMetadata.CHANNEL_IDS,
    getUpdateChannelMetadata: ChannelMetadata.getUpdateChannelMetadata,
    getAllUpdateChannelMetadata: ChannelMetadata.getAllUpdateChannelMetadata,
    hasChannelMetadata: ChannelMetadata.hasChannelMetadata,
    releaseChannel: ReleaseChannel,

    getStoredChannel: ChannelStore.getStoredChannel,
    setStoredChannel: ChannelStore.setStoredChannel,
    isValidStoredChannel: ChannelStore.isValidStoredChannel
};
