"use strict";

const { app } = require("electron");
const DiagnosticsStore = require("./DiagnosticsStore");
const BootupDiagnostics = require("./BootupDiagnostics");
const MemoryProfiler = require("./MemoryProfiler");
const ProcessProfiler = require("./ProcessProfiler");
const CPUProfiler = require("./CPUProfiler");
const CrashDumpWriter = require("./CrashDumpWriter");

/**
 * DiagnosticsManager – Zentrale Koordinationsstelle für Profiler und Diagnostics.
 *
 * Verwaltet Profiler basierend auf Konfiguration.
 * Im aktuellen Release: nur MemoryProfiler aktiv, Process- und CPUProfiler deaktiviert.
 */
class DiagnosticsManager {

    constructor(options = {}) {
        this.initialized = false;
        this.config = {
            profilers: {
                memory: true,
                process: false,
                cpu: false
            },
            memoryIntervalMs: 10000,
            memoryMaxSamples: 60,
            ...options
        };

        this.memoryProfiler = null;
        this.processProfiler = null;
        this.cpuProfiler = null;
        this.store = DiagnosticsStore;
        this.bootup = BootupDiagnostics;
        this.dumpWriter = CrashDumpWriter;
    }

    initialize(customConfig = {}) {
        if (this.initialized) {
            return;
        }

        if (customConfig.profilers) {
            this.config.profilers = { ...this.config.profilers, ...customConfig.profilers };
        }
        if (typeof customConfig.memoryIntervalMs === "number") {
            this.config.memoryIntervalMs = customConfig.memoryIntervalMs;
        }
        if (typeof customConfig.memoryMaxSamples === "number") {
            this.config.memoryMaxSamples = customConfig.memoryMaxSamples;
        }

        this.memoryProfiler = new MemoryProfiler({
            intervalMs: this.config.memoryIntervalMs,
            maxSamples: this.config.memoryMaxSamples
        });

        this.processProfiler = new ProcessProfiler();
        this.cpuProfiler = new CPUProfiler();

        this.initialized = true;
    }

    start() {
        if (!this.initialized) {
            this.initialize();
        }

        // Ausschließlich aktivierte Profiler starten
        if (this.config.profilers.memory && this.memoryProfiler) {
            this.memoryProfiler.start();
        }

        // Process- und CPU-Profiler bleiben deaktiviert (Zero Overhead)
        if (this.config.profilers.process && this.processProfiler) {
            this.processProfiler.start();
        }

        if (this.config.profilers.cpu && this.cpuProfiler) {
            this.cpuProfiler.start();
        }
    }

    stop() {
        if (this.memoryProfiler) {
            this.memoryProfiler.stop();
        }
        if (this.processProfiler) {
            this.processProfiler.stop();
        }
        if (this.cpuProfiler) {
            this.cpuProfiler.stop();
        }
    }

    getStatus() {
        return {
            initialized: this.initialized,
            config: this.config,
            memory: this.memoryProfiler ? this.memoryProfiler.getStatus() : null,
            process: this.processProfiler ? this.processProfiler.getStatus() : null,
            cpu: this.cpuProfiler ? this.cpuProfiler.getStatus() : null,
            storeKeys: Object.keys(this.store.getAll()),
            bootupSummary: this.bootup.getSummary()
        };
    }

    getCrashDumpData({ type, error }) {
        const appVersion = app && typeof app.getVersion === "function"
            ? app.getVersion()
            : "unknown";

        return {
            appVersion,
            platform: process.platform,
            arch: process.arch,
            electron: process.versions?.electron || "unknown",
            node: process.versions?.node || "unknown",
            uptime: Math.floor(process.uptime()),
            reason: type || "unknown",
            timestamp: new Date().toISOString(),
            error: {
                name: error?.name || "Error",
                message: error?.message || String(error),
                stack: error?.stack || ""
            },
            memory: {
                current: this.memoryProfiler ? this.memoryProfiler.getCurrent() : null,
                history: this.memoryProfiler ? this.memoryProfiler.getHistory() : []
            },
            process: {
                pid: process.pid,
                uptime: Math.floor(process.uptime()),
                platform: process.platform,
                arch: process.arch
            },
            bootup: this.bootup.getSteps()
        };
    }

}

module.exports = new DiagnosticsManager();
