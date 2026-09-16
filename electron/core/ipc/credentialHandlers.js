"use strict";

// IPC Handler für Credential-Verwaltung
// Erlaubt sicheren Zugriff auf Credentials vom Renderer aus
const { ipcMain } = require("electron");
const CredentialManager = require("../services/CredentialManager");

module.exports = function registerCredentialHandlers() {
  // Google Client Secret speichern
  ipcMain.handle("credentials:set-google-client-secret", async (_event, secret) => {
    if (typeof secret !== "string") {
      throw new Error("Client Secret muss ein String sein.");
    }
    if (secret.trim().length === 0) {
      throw new Error("Client Secret darf nicht leer sein.");
    }
    return CredentialManager.setCredential("google-client-secret", secret.trim());
  });

  // Google Client Secret Status (nur ob vorhanden, nicht den Wert)
  ipcMain.handle("credentials:get-google-client-secret", async () => {
    // Aus Sicherheitsgründen wird der tatsächliche Secret-Wert niemals zurückgegeben
    // Nur ein Status, ob ein Secret konfiguriert ist
    return CredentialManager.getCredential("google-client-secret") !== null;
  });

  // Google Client Secret löschen
  ipcMain.handle("credentials:delete-google-client-secret", async () => {
    return CredentialManager.deleteCredential("google-client-secret");
  });

  // Prüfen ob ein Client Secret existiert (ohne den Wert zurückzugeben)
  ipcMain.handle("credentials:has-google-client-secret", async () => {
    return CredentialManager.getCredential("google-client-secret") !== null;
  });
};
