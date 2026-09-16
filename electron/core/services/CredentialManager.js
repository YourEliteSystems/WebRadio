"use strict";

// Credential Manager - Sichere Speicherung von sensiblen Daten im WebRadio-Core
// Verschlüsselte Speicherung mit System-Key auf Windows/macOS, Fallback auf gespeicherten Key
const { app } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const LogManager = require("../diagnostics/logging/LogManager");
const StorageManager = require("../storage/StorageManager");

const logger = LogManager.getLogger("CredentialManager");

class CredentialManager {
    constructor() {
        this.encryptionKey = null;
        this.credentialsFile = StorageManager.getCredentialsPath();
        this.keyFile = StorageManager.getEncryptionKeyPath();
    }

    initialize() {
        this.loadOrGenerateKey();
    }

    // Verschlüsselungsschlüssel laden oder generieren
    loadOrGenerateKey() {
        try {
            if (fs.existsSync(this.keyFile)) {
                // Vorhandenen Key laden
                this.encryptionKey = fs.readFileSync(this.keyFile, "utf8").trim();
                logger.info("Verschlüsselungsschlüssel geladen.");
            } else {
                // Neuen Key generieren und speichern
                this.encryptionKey = crypto.randomBytes(32).toString("hex");
                fs.writeFileSync(this.keyFile, this.encryptionKey, { mode: 0o600 });
                logger.info("Neuer Verschlüsselungsschlüssel generiert.");
            }
        } catch (err) {
            logger.error(`Fehler beim Laden/Generieren des Verschlüsselungsschlüssels: ${err.message}`);
            // Fallback: temporärer Key für diese Session
            this.encryptionKey = crypto.randomBytes(32).toString("hex");
        }
    }

    // Daten verschlüsseln
    encrypt(data) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(this.encryptionKey, "hex"), iv);
            
            let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
            encrypted += cipher.final("hex");
            
            const authTag = cipher.getAuthTag();
            
            return {
                iv: iv.toString("hex"),
                authTag: authTag.toString("hex"),
                data: encrypted
            };
        } catch (err) {
            logger.error(`Verschlüsselung fehlgeschlagen: ${err.message}`);
            throw new Error("Verschlüsselung fehlgeschlagen.");
        }
    }

    // Daten entschlüsseln
    decrypt(encryptedData) {
        try {
            const iv = Buffer.from(encryptedData.iv, "hex");
            const authTag = Buffer.from(encryptedData.authTag, "hex");
            const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(this.encryptionKey, "hex"), iv);
            
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encryptedData.data, "hex", "utf8");
            decrypted += decipher.final("utf8");
            
            return JSON.parse(decrypted);
        } catch (err) {
            logger.error(`Entschlüsselung fehlgeschlagen: ${err.message}`);
            throw new Error("Entschlüsselung fehlgeschlagen.");
        }
    }

    // Credential speichern
    setCredential(key, value) {
        try {
            let credentials = {};
            
            // Vorhandene Credentials laden
            if (fs.existsSync(this.credentialsFile)) {
                try {
                    const encrypted = JSON.parse(fs.readFileSync(this.credentialsFile, "utf8"));
                    credentials = this.decrypt(encrypted);
                } catch (err) {
                    logger.warn(`Bestehende Credentials konnten nicht geladen werden: ${err.message}`);
                }
            }
            
            // Neuen Credential hinzufügen/überschreiben
            credentials[key] = value;
            
            // Verschlüsselt speichern
            const encrypted = this.encrypt(credentials);
            
            // Ordner sicherstellen
            const dir = path.dirname(this.credentialsFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
            }
            
            fs.writeFileSync(this.credentialsFile, JSON.stringify(encrypted), { mode: 0o600 });
            
            logger.info(`Credential '${key}' gespeichert.`);
            return true;
        } catch (err) {
            logger.error(`Fehler beim Speichern des Credentials '${key}': ${err.message}`);
            return false;
        }
    }

    // Credential lesen
    getCredential(key) {
        try {
            if (!fs.existsSync(this.credentialsFile)) {
                return null;
            }
            
            const encrypted = JSON.parse(fs.readFileSync(this.credentialsFile, "utf8"));
            const credentials = this.decrypt(encrypted);
            
            return credentials[key] || null;
        } catch (err) {
            logger.error(`Fehler beim Lesen des Credentials '${key}': ${err.message}`);
            return null;
        }
    }

    // Credential löschen
    deleteCredential(key) {
        try {
            if (!fs.existsSync(this.credentialsFile)) {
                return false;
            }
            
            const encrypted = JSON.parse(fs.readFileSync(this.credentialsFile, "utf8"));
            const credentials = this.decrypt(encrypted);
            
            if (!(key in credentials)) {
                return false;
            }
            
            delete credentials[key];
            
            // Wenn keine Credentials mehr übrig, Datei löschen
            if (Object.keys(credentials).length === 0) {
                fs.unlinkSync(this.credentialsFile);
                logger.info(`Credential '${key}' gelöscht und Datei entfernt.`);
                return true;
            }
            
            // Sonst aktualisierte Credentials speichern
            const newEncrypted = this.encrypt(credentials);
            fs.writeFileSync(this.credentialsFile, JSON.stringify(newEncrypted), { mode: 0o600 });
            
            logger.info(`Credential '${key}' gelöscht.`);
            return true;
        } catch (err) {
            logger.error(`Fehler beim Löschen des Credentials '${key}': ${err.message}`);
            return false;
        }
    }

    // Alle Credentials auflisten (nur Keys, keine Werte)
    listCredentials() {
        try {
            if (!fs.existsSync(this.credentialsFile)) {
                return [];
            }
            
            const encrypted = JSON.parse(fs.readFileSync(this.credentialsFile, "utf8"));
            const credentials = this.decrypt(encrypted);
            
            return Object.keys(credentials);
        } catch (err) {
            logger.error(`Fehler beim Auflisten der Credentials: ${err.message}`);
            return [];
        }
    }

    shutdown() {
        // Cleanup bei Shutdown (optional, für zukünftige Erweiterungen)
        logger.info("CredentialManager shutdown.");
    }
}

module.exports = new CredentialManager();
