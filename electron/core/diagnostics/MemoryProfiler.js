"use strict";

const eventBus = require("../eventBus");
const DiagnosticsStore = require("./DiagnosticsStore");

/**
 * MemoryProfiler – Produktiv aktiver, speicherschonender Memory-Profiler.
 *
 * Sammelt regelmäßig Speichermetriken in einem kompakten Ring-Buffer.
 * Löst bei Überschreitung definierter Schwellenwerte interne Events aus.
 */
class MemoryProfiler {

    constructor(options = {}) {
        this.intervalMs = typeof options.intervalMs === "number" ? options.intervalMs : 10000;
        this.maxSamples = typeof options.maxSamples === "number" ? options.maxSamples : 60;

        // Schwellenwerte für Heap-Used (in MB)
        this.thresholds = {
            warning:  options.warningMB  || 250,
            high:     options.highMB     || 400,
            critical: options.criticalMB || 600
        };

        this._samples = [];
        this._timer = null;
        this._running = false;
        this._lastLevel = "normal";
    }

    start() {
        if (this._running) {
            return;
        }

        this._running = true;
        this.sample();

        this._timer = setInterval(() => {
            this.sample();
        }, this.intervalMs);

        if (this._timer && typeof this._timer.unref === "function") {
            this._timer.unref();
        }
    }

    stop() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        this._running = false;
    }

    sample() {
        const mem = process.memoryUsage();
        const uptime = Math.floor(process.uptime());
        const timestamp = new Date().toISOString();

        const sampleData = {
            timestamp,
            rss: mem.rss,
            heapTotal: mem.heapTotal,
            heapUsed: mem.heapUsed,
            external: mem.external,
            arrayBuffers: mem.arrayBuffers,
            uptime,
            pid: process.pid
        };

        // Ring-Buffer
        this._samples.push(sampleData);
        if (this._samples.length > this.maxSamples) {
            this._samples.shift();
        }

        // DiagnosticsStore synchronisieren (RAM only)
        DiagnosticsStore.set("memory:current", sampleData);
        DiagnosticsStore.set("memory:history", this._samples);

        // Schwellenwert-Check
        this._evaluateThresholds(sampleData);

        return sampleData;
    }

    _evaluateThresholds(sampleData) {
        const heapUsedMB = sampleData.heapUsed / (1024 * 1024);
        let level = "normal";

        if (heapUsedMB >= this.thresholds.critical) {
            level = "critical";
        } else if (heapUsedMB >= this.thresholds.high) {
            level = "high";
        } else if (heapUsedMB >= this.thresholds.warning) {
            level = "warning";
        }

        if (level !== this._lastLevel) {
            const payload = {
                level,
                previousLevel: this._lastLevel,
                heapUsedMB: parseFloat(heapUsedMB.toFixed(2)),
                timestamp: sampleData.timestamp
            };

            if (level === "warning" || level === "high") {
                eventBus.emit("diagnostics:memory-warning", payload);
            } else if (level === "critical") {
                eventBus.emit("diagnostics:memory-critical", payload);
            }

            this._lastLevel = level;
        }
    }

    getCurrent() {
        if (this._samples.length > 0) {
            return this._samples[this._samples.length - 1];
        }
        return null;
    }

    getHistory() {
        return [...this._samples];
    }

    isRunning() {
        return this._running;
    }

    getStatus() {
        return {
            running: this._running,
            intervalMs: this.intervalMs,
            sampleCount: this._samples.length,
            maxSamples: this.maxSamples,
            currentLevel: this._lastLevel,
            current: this.getCurrent()
        };
    }

}

module.exports = MemoryProfiler;
