"use strict";

const DiagnosticsStore = require("./DiagnosticsStore");

/**
 * CPUProfiler – Im aktuellen Release VOLLSTÄNDIG DEAKTIVIERT.
 *
 * Bereitgestellt für spätere Releases.
 * Solange disabled: 0 Overhead, kein Timer, keine Hintergrund-Aktivität.
 */
class CPUProfiler {

    constructor(options = {}) {
        this.intervalMs = typeof options.intervalMs === "number" ? options.intervalMs : 15000;
        this.maxSamples = typeof options.maxSamples === "number" ? options.maxSamples : 30;

        this._samples = [];
        this._timer = null;
        this._running = false;
        this._lastCpuUsage = null;
    }

    start() {
        if (this._running) {
            return;
        }

        this._running = true;
        this._lastCpuUsage = process.cpuUsage();
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
        this._lastCpuUsage = null;
    }

    sample() {
        const timestamp = new Date().toISOString();
        const diff = this._lastCpuUsage
            ? process.cpuUsage(this._lastCpuUsage)
            : process.cpuUsage();
        this._lastCpuUsage = process.cpuUsage();

        const sampleData = {
            timestamp,
            userMicros: diff.user,
            systemMicros: diff.system
        };

        this._samples.push(sampleData);
        if (this._samples.length > this.maxSamples) {
            this._samples.shift();
        }

        DiagnosticsStore.set("cpu:current", sampleData);
        return sampleData;
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
            enabled: false,
            running: this._running,
            intervalMs: this.intervalMs,
            sampleCount: this._samples.length
        };
    }

}

module.exports = CPUProfiler;
