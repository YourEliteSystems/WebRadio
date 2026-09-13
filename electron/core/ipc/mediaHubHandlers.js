"use strict";

// Add this file to electron/core/ipc/mediaHubHandlers.js.
const { ipcMain } = require("electron");
const oauth = require("../services/MediaHubOAuth");

module.exports = function registerMediaHubHandlers() {
  ipcMain.handle("mediahub:auth-status", () => oauth.status());
  ipcMain.handle("mediahub:auth-sign-in", () => oauth.signIn());
  ipcMain.handle("mediahub:auth-sign-out", () => oauth.signOut());
  ipcMain.handle("mediahub:search", (_event, query) => oauth.search(String(query || "").trim()));
};
