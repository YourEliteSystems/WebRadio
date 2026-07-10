"use strict";

const { ipcMain } = require("electron");

const HealthCheck    = require("../diagnostics/health/HealthCheck");
const SystemInfo     = require("../diagnostics/system/SystemInfo");
const CrashReportReader = require("../diagnostics/crash/CrashReportReader");
const StorageManager = require("../storage/StorageManager");
const LogManager     = require("../diagnostics/logging/LogManager");
const LogReader      = require("../diagnostics/logging/LogReader");

function registerDiagnosticsHandlers() {

    // ── Logging Bridge ────────────────────────────────────────
    ipcMain.on("log", (event, level, context, msg) => {
        const logger = LogManager.getLogger(context || "Frontend");
        
        switch (level) {
            case "info": logger.info(msg); break;
            case "warn": logger.warn(msg); break;
            case "error": logger.error(msg); break;
            case "debug": logger.debug(msg); break;
            default: logger.info(msg); break;
        }
    });

    // ── Health-Check ──────────────────────────────────────────
    ipcMain.handle("diagnostics:getHealth", () => {
        return HealthCheck.run();
    });

    // ── System Info ───────────────────────────────────────────
    ipcMain.handle("diagnostics:getSystemInfo", () => {
        return SystemInfo.getPretty();
    });

    // ── Crash Reports ─────────────────────────────────────────
    ipcMain.handle("diagnostics:getCrashReports", () => {
        return CrashReportReader.getReports().map(r => ({
            id:      r.id,
            file:    r.file,
            created: r.created
        }));
    });

    ipcMain.handle("diagnostics:readCrashReport", (_, fileName) => {
        return CrashReportReader.read(fileName);
    });

    ipcMain.handle("diagnostics:deleteCrashReport", (_, fileName) => {
        return CrashReportReader.delete(fileName);
    });

    ipcMain.handle("diagnostics:clearCrashReports", () => {
        CrashReportReader.clear();
        return true;
    });

    // ── Logs ──────────────────────────────────────────────────
    ipcMain.handle("diagnostics:getLogs", () => {
        return LogReader.getLogs().map(l => ({
            id:      l.id,
            file:    l.file,
            created: l.created
        }));
    });

    ipcMain.handle("diagnostics:readLog", (_, fileName) => {
        return LogReader.read(fileName);
    });

    ipcMain.handle("diagnostics:deleteLog", (_, fileName) => {
        return LogReader.delete(fileName);
    });

    ipcMain.handle("diagnostics:clearLogs", () => {
        LogReader.clear();
        return true;
    });

    // ── Pfade ─────────────────────────────────────────────────
    ipcMain.handle("diagnostics:getPaths", () => {
        return {
            plugins:    StorageManager.getPluginPath(),
            themes:     StorageManager.getThemePath(),
            logs:       StorageManager.getLogsPath(),
            crash:      StorageManager.getCrashPath(),
            pluginData: StorageManager.getPluginDataPath(),
            userData:   StorageManager.getUserDataPath()
        };
    });

}

module.exports = registerDiagnosticsHandlers;
