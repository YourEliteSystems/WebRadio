"use strict";

/**
 * IPC-Handler für das Update-System.
 *
 * Wird über registerIpcHandlers() an die bestehende Architektur
 * angedockt. Keine zweite IPC-Abstraktion.
 *
 * Primäre Kanäle (alle unter dem Namespace "updates:"):
 *   - updates:get-state           -> aktueller UpdateState
 *   - updates:check               -> manueller Update-Check
 *   - updates:download            -> Update herunterladen
 *   - updates:install             -> heruntergeladenes Update installieren
 *   - updates:get-channel         -> aktiver Channel (stable/beta)
 *   - updates:set-channel         -> Channel wechseln
 *   - updates:get-current-version -> installierte App-Version
 *   - updates:is-prerelease       -> true wenn installierte Version Pre-Release
 *   - updates:mark-notified       -> aktuelle Version als benachrichtigt markieren
 *   - updates:get-available-info  -> strukturierte Info zum gefundenen Update
 *
 * Renderer->Main Events (broadcasts):
 *   - updates:state-changed
 *   - updates:available
 *   - updates:not-available
 *   - updates:download-progress
 *   - updates:downloaded
 *   - updates:error
 *   - updates:channel-changed
 *
 * Legacy-Kanäle (Kompatibilität für ältere Renderer-Code-Pfade):
 *   - updater:check      -> leitet an updates:check weiter
 *   - updater:install    -> leitet an updates:install weiter
 *   - app:version        -> bleibt unverändert
 *   - updater:available  -> nur Empfangs-Event, kein handler
 */

const { ipcMain } = require("electron");
const updateManager = require("../updates");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("UpdaterHandlers");

function registerUpdaterHandlers() {
    // ─────────────────────────────────────────
    // Primäre Kanäle
    // ─────────────────────────────────────────

    ipcMain.handle("updates:get-state", () => {
        try {
            return {
                ok: true,
                state: updateManager.updateManager.getState()
            };
        } catch (err) {
            logger.error(`updates:get-state: ${err.message}`);
            return { ok: false, error: { code: "INTERNAL", message: err.message } };
        }
    });

    ipcMain.handle("updates:check", async () => {
        try {
            const result = await updateManager.updateManager.checkForUpdates();
            return { ok: true, result };
        } catch (err) {
            logger.error(`updates:check: ${err.message}`);
            return {
                ok: false,
                error: { code: "CHECK_FAILED", message: "Update-Check fehlgeschlagen" }
            };
        }
    });

    ipcMain.handle("updates:download", async () => {
        try {
            const result = await updateManager.updateManager.downloadUpdate();
            return { ok: true, result };
        } catch (err) {
            logger.error(`updates:download: ${err.message}`);
            return {
                ok: false,
                error: { code: "DOWNLOAD_FAILED", message: "Download fehlgeschlagen" }
            };
        }
    });

    ipcMain.handle("updates:install", async () => {
        try {
            const result = await updateManager.updateManager.installUpdate();
            return { ok: true, result };
        } catch (err) {
            logger.error(`updates:install: ${err.message}`);
            return {
                ok: false,
                error: { code: "INSTALL_FAILED", message: "Installation fehlgeschlagen" }
            };
        }
    });

    ipcMain.handle("updates:get-channel", () => {
        return { ok: true, channel: updateManager.updateManager.getChannel() };
    });

    ipcMain.handle("updates:set-channel", async (_event, channel) => {
        try {
            const state = updateManager.updateManager.setChannel(channel);
            return { ok: true, state };
        } catch (err) {
            logger.error(`updates:set-channel: ${err.message}`);
            return {
                ok: false,
                error: { code: "INVALID_CHANNEL", message: err.message }
            };
        }
    });

    ipcMain.handle("updates:get-current-version", () => {
        return {
            ok: true,
            version: updateManager.updateManager.getCurrentVersion(),
            isPrerelease: updateManager.updateManager.isPrerelease(),
            channel: updateManager.updateManager.getChannel()
        };
    });

    ipcMain.handle("updates:is-prerelease", () => {
        return { ok: true, isPrerelease: updateManager.updateManager.isPrerelease() };
    });

    ipcMain.handle("updates:mark-notified", () => {
        updateManager.updateManager.markCurrentVersionAsNotified();
        return { ok: true };
    });

    ipcMain.handle("updates:get-available-info", () => {
        const m = updateManager.updateManager;
        if (!m.isUpdateAvailable() && !m.isDownloaded()) {
            return { ok: true, available: false };
        }
        return {
            ok: true,
            available: true,
            version: m.getAvailableVersion(),
            releaseNotes: m.getReleaseNotes(),
            releaseNotesRaw: m.getReleaseNotesRaw(),
            channel: m.getChannel(),
            downloaded: m.isDownloaded()
        };
    });

    ipcMain.handle("updates:get-auto-check", () => {
        return { ok: true, enabled: updateManager.updateManager.getAutoCheck() };
    });

    ipcMain.handle("updates:set-auto-check", (_event, enabled) => {
        const result = updateManager.updateManager.setAutoCheck(enabled);
        return { ok: true, enabled: result };
    });

    ipcMain.handle("updates:dismiss-later", () => {
        const state = updateManager.updateManager.dismissUpdateForLater();
        return { ok: true, state };
    });

    // ─────────────────────────────────────────
    // Legacy-Kanäle (Abwärtskompatibilität)
    // ─────────────────────────────────────────
    //
    // Diese Kanäle bleiben erhalten, damit bestehender Renderer-Code
    // (z.B. useUpdateInfo.js) nicht bricht.

    ipcMain.handle("updater:check", async () => {
        try {
            const result = await updateManager.updateManager.checkForUpdates();
            if (result && result.status === "available") {
                return {
                    available: true,
                    version: result.version,
                    releaseNotes: result.releaseNotes,
                    releaseDate: result.releaseDate
                };
            }
            return {
                available: false,
                version: (result && result.currentVersion)
                    || updateManager.updateManager.getCurrentVersion()
            };
        } catch (err) {
            logger.error(`updater:check (legacy): ${err.message}`);
            return { available: false };
        }
    });

    ipcMain.handle("updater:install", async () => {
        try {
            const m = updateManager.updateManager;
            if (m.isDownloaded()) {
                await m.installUpdate();
                return { ok: true };
            }
            await m.downloadUpdate();
            return { ok: true };
        } catch (err) {
            logger.error(`updater:install (legacy): ${err.message}`);
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle("app:version", () => {
        return updateManager.updateManager.getCurrentVersion();
    });
}

module.exports = registerUpdaterHandlers;
