"use strict";

// IPC Handler für Credential-Verwaltung
// Erlaubt sicheren Zugriff auf Credentials vom Renderer aus
const { ipcMain } = require("electron");
const CredentialManager = require("../services/CredentialManager");

module.exports = function registerCredentialHandlers() {
  // Google Client Secret Handler wurden entfernt, da der Secret jetzt
  // direkt in MediaHubOAuth.js integriert ist und nicht mehr
  // vom Benutzer konfiguriert werden muss.
};
