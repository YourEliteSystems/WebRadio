"use strict";

const DiagnosticsStore = require("./DiagnosticsStore");
const eventBus = require("../eventBus");

/**
 * BootupDiagnostics – Erfasst Meilensteine des Startvorgangs.
 *
 * Bietet eine stabile Hook- und Subscription-Schnittstelle (onChange/offChange),
 * semantische EventBus-Events und bereinigte Zustände für zukünftige UI-Komponenten
 * wie einen Splash Screen.
 */
class BootupDiagnostics {

    constructor() {
        this._steps = new Map();
        this._order = [];
        this._startTime = Date.now();
        this._started = false;
        this._ready = false;
        this._currentStepName = null;
        this._listeners = new Set();
    }

    start(name = null, details = null) {
        if (!this._started) {
            this._started = true;
            this._startTime = Date.now();
            eventBus.emit("bootup:start", {
                timestamp: new Date(this._startTime).toISOString(),
                state: this.getState()
            });
        }

        if (name && typeof name === "string") {
            this.markStart(name, details);
        } else {
            this._notifyChange();
        }
    }

    markStart(name, details = null) {
        if (!name || typeof name !== "string") return;

        if (!this._started) {
            this._started = true;
            eventBus.emit("bootup:start", {
                timestamp: new Date(Date.now()).toISOString(),
                state: this.getState()
            });
        }

        this._currentStepName = name;
        const timestamp = Date.now();
        const step = {
            name,
            status: "started",
            startTimestamp: timestamp,
            timestamp: new Date(timestamp).toISOString(),
            durationMs: null
        };

        if (details && typeof details === "object") {
            step.details = this._sanitizeDetails(details);
        }

        this._steps.set(name, step);
        if (!this._order.includes(name)) {
            this._order.push(name);
        }

        this._syncStore();

        eventBus.emit("bootup:step", {
            step: { ...step },
            state: this.getState()
        });

        this._notifyChange();
    }

    step(name, status = "started", details = null) {
        if (status === "completed") {
            this.complete(name, details);
        } else if (status === "failed") {
            this.fail(name, details);
        } else {
            this.start(name, details);
        }
    }

    markComplete(name, details = null) {
        if (!name || typeof name !== "string") return;

        let step = this._steps.get(name);
        const timestamp = Date.now();

        if (step) {
            step.status = "completed";
            step.completedTimestamp = timestamp;
            step.durationMs = timestamp - step.startTimestamp;
            if (details && typeof details === "object") {
                step.details = { ...step.details, ...this._sanitizeDetails(details) };
            }
        } else {
            step = {
                name,
                status: "completed",
                startTimestamp: timestamp,
                completedTimestamp: timestamp,
                timestamp: new Date(timestamp).toISOString(),
                durationMs: 0
            };
            if (details && typeof details === "object") {
                step.details = this._sanitizeDetails(details);
            }
            this._steps.set(name, step);
            this._order.push(name);
        }

        if (name === "app-ready") {
            this._ready = true;
        }

        this._syncStore();

        eventBus.emit("bootup:complete", {
            step: { ...step },
            state: this.getState()
        });

        if (name === "app-ready") {
            eventBus.emit("bootup:ready", {
                summary: this.getSummary(),
                state: this.getState()
            });
        }

        this._notifyChange();
    }

    complete(name, details = null) {
        this.markComplete(name, details);
    }

    markFailed(name, error) {
        if (!name || typeof name !== "string") return;

        let step = this._steps.get(name);
        const timestamp = Date.now();
        const safeError = error instanceof Error
            ? { name: error.name, message: this._sanitizeString(error.message) }
            : { message: this._sanitizeString(String(error)) };

        if (step) {
            step.status = "failed";
            step.failedTimestamp = timestamp;
            step.durationMs = timestamp - step.startTimestamp;
            step.error = safeError;
        } else {
            step = {
                name,
                status: "failed",
                startTimestamp: timestamp,
                failedTimestamp: timestamp,
                timestamp: new Date(timestamp).toISOString(),
                durationMs: 0,
                error: safeError
            };
            this._steps.set(name, step);
            this._order.push(name);
        }

        this._syncStore();

        eventBus.emit("bootup:failed", {
            step: { ...step },
            error: safeError,
            state: this.getState()
        });

        this._notifyChange();
    }

    fail(name, error) {
        this.markFailed(name, error);
    }

    getCurrent() {
        if (this._currentStepName && this._steps.has(this._currentStepName)) {
            return { ...this._steps.get(this._currentStepName) };
        }
        if (this._order.length > 0) {
            const last = this._order[this._order.length - 1];
            return { ...this._steps.get(last) };
        }
        return null;
    }

    getHistory() {
        return this.getSteps();
    }

    isComplete() {
        return this._ready || (this._steps.has("app-ready") && this._steps.get("app-ready").status === "completed");
    }

    getState() {
        return {
            started: this._started,
            completed: this.isComplete(),
            ready: this._ready,
            current: this._currentStepName,
            stepCount: this._order.length,
            steps: this.getSteps()
        };
    }

    onChange(callback) {
        if (typeof callback !== "function") {
            return () => {};
        }
        this._listeners.add(callback);
        return () => this.offChange(callback);
    }

    offChange(callback) {
        this._listeners.delete(callback);
    }

    _notifyChange() {
        if (this._listeners.size === 0) return;
        const state = this.getState();
        for (const listener of this._listeners) {
            try {
                listener(state);
            } catch (err) {
                console.error("[BootupDiagnostics] Listener error:", err);
            }
        }
    }

    getSteps() {
        return this._order.map(name => ({ ...this._steps.get(name) }));
    }

    getSummary() {
        const steps = this.getSteps();
        const totalDuration = steps.reduce((sum, s) => sum + (s.durationMs || 0), 0);
        return {
            startTime: new Date(this._startTime).toISOString(),
            stepCount: steps.length,
            completedCount: steps.filter(s => s.status === "completed").length,
            failedCount: steps.filter(s => s.status === "failed").length,
            totalDurationMs: totalDuration,
            steps
        };
    }

    _sanitizeDetails(details) {
        const result = {};
        const sensitiveKeys = /token|secret|key|password|credential|auth|cookie|bearer/i;

        for (const [k, v] of Object.entries(details)) {
            if (sensitiveKeys.test(k)) {
                result[k] = "[REDACTED]";
            } else if (typeof v === "string") {
                result[k] = this._sanitizeString(v);
            } else {
                result[k] = v;
            }
        }
        return result;
    }

    _sanitizeString(str) {
        if (typeof str !== "string") return str;
        return str
            .replace(/(bearer\s+)[A-Za-z0-9._-]+/gi, "$1[REDACTED]")
            .replace(/(password=)[^&\s]+/gi, "$1[REDACTED]")
            .replace(/(secret=)[^&\s]+/gi, "$1[REDACTED]")
            .replace(/(token=)[^&\s]+/gi, "$1[REDACTED]");
    }

    _syncStore() {
        DiagnosticsStore.set("bootup", this.getSteps());
    }

    clear() {
        this._steps.clear();
        this._order = [];
        this._startTime = Date.now();
        this._started = false;
        this._ready = false;
        this._currentStepName = null;
        this._listeners.clear();
        DiagnosticsStore.set("bootup", []);
    }

}

module.exports = new BootupDiagnostics();
