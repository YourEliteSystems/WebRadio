"use strict";

const fs = require("fs");
const path = require("path");
const StorageManager = require("../storage/StorageManager");

const SENSITIVE_KEY_REGEX = /token|secret|password|credential|auth|cookie|bearer|privatekey|apikey/i;

/**
 * CrashDumpWriter – Erstellt bereinigte, kompakte Crash-Dumps.
 *
 * Schreibt ausschließlich bei einem relevanten Crash.
 * Entfernt vor dem Schreiben zuverlässig Passwörter, Secrets und Tokens.
 */
class CrashDumpWriter {

    constructor() {
        this.crashDirectory = null;
    }

    getDirectory() {
        if (!this.crashDirectory) {
            try {
                this.crashDirectory = StorageManager.getCrashPath();
            } catch {
                this.crashDirectory = path.join(process.cwd(), "crash");
            }
        }
        if (!fs.existsSync(this.crashDirectory)) {
            fs.mkdirSync(this.crashDirectory, { recursive: true });
        }
        return this.crashDirectory;
    }

    write(dumpData) {
        if (!dumpData || typeof dumpData !== "object") {
            throw new Error("CrashDumpWriter: dumpData must be an object.");
        }

        const sanitized = this.sanitize(dumpData);
        const timestamp = this._createTimestamp();
        const fileName = `crash-${timestamp}.json`;
        const dir = this.getDirectory();
        const filePath = path.join(dir, fileName);

        fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2), "utf8");
        return filePath;
    }

    sanitize(data, depth = 0) {
        if (depth > 8) return "[MAX_DEPTH]";
        if (data === null || data === undefined) return data;

        if (typeof data === "string") {
            return this._sanitizeString(data);
        }

        if (typeof data === "number" || typeof data === "boolean") {
            return data;
        }

        if (Array.isArray(data)) {
            return data.map(item => this.sanitize(item, depth + 1));
        }

        if (typeof data === "object") {
            const clean = {};
            for (const [key, value] of Object.entries(data)) {
                if (SENSITIVE_KEY_REGEX.test(key)) {
                    clean[key] = "[REDACTED]";
                } else {
                    clean[key] = this.sanitize(value, depth + 1);
                }
            }
            return clean;
        }

        return String(data);
    }

    _sanitizeString(str) {
        if (typeof str !== "string") return str;
        return str
            .replace(/(bearer\s+)[A-Za-z0-9._-]+/gi, "$1[REDACTED]")
            .replace(/(password[:=])[^&\s,]+/gi, "$1[REDACTED]")
            .replace(/(secret[:=])[^&\s,]+/gi, "$1[REDACTED]")
            .replace(/(token[:=])[^&\s,]+/gi, "$1[REDACTED]")
            .replace(/(client_secret[:=])[^&\s,]+/gi, "$1[REDACTED]");
    }

    _createTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hour = String(now.getHours()).padStart(2, "0");
        const minute = String(now.getMinutes()).padStart(2, "0");
        const second = String(now.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day}_${hour}-${minute}-${second}`;
    }

}

module.exports = new CrashDumpWriter();
