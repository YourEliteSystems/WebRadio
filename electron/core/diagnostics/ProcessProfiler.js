"use strict";

const DiagnosticsStore = require("./DiagnosticsStore");

/**
 * ProcessProfiler – Im aktuellen Release VOLLSTÄNDIG DEAKTIVIERT.
 *
 * Bereitgestellt für zukünftige Releases zur Erfassung von Prozess-Metriken.
 * Solange disabled: 0 Overhead, kein Timer, keine Hintergrund-Aktivität.
 */
class ProcessProfiler {

    constructor(options = {}) {
        this.intervalMs = typeof options.intervalMs === "number" ? options.intervalMs : 15000;
        this.maxSamples = typeof options.maxSamples === "number" ? options.maxSamples : 30;

        this._samples = [];
        this._timer = null;
        this._running = false;
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
        const timestamp = new Date().toISOString();
        const sampleData = {
            timestamp,
            pid: process.pid,
            platform: process.platform,
            arch: process.arch,
            uptime: Math.floor(process.uptime()),
            type: "browser"
        };

        this._samples.push(sampleData);
        if (this._samples.length > this.maxSamples) {
            this._samples.shift();
        }

        DiagnosticsStore.set("process:current", sampleData);
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

module.exports = ProcessProfiler;
