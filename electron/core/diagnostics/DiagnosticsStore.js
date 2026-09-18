"use strict";

/**
 * DiagnosticsStore – Leichtgewichtiger In-Memory Key-Value-Store
 * für diagnostische Laufzeitdaten.
 * 
 * Verhindert permanente Disk-Writes im Normalbetrieb.
 */
class DiagnosticsStore {

    constructor() {
        this._store = new Map();
    }

    set(key, value) {
        if (typeof key !== "string" || key.trim() === "") {
            throw new TypeError("DiagnosticsStore.set: Key must be a non-empty string.");
        }
        this._store.set(key, value);
        return this;
    }

    get(key, defaultValue = null) {
        if (this._store.has(key)) {
            return this._store.get(key);
        }
        return defaultValue;
    }

    has(key) {
        return this._store.has(key);
    }

    delete(key) {
        return this._store.delete(key);
    }

    append(key, item, maxItems = 100) {
        const current = this.get(key, []);
        const list = Array.isArray(current) ? current : [current];
        list.push(item);
        if (list.length > maxItems) {
            list.shift();
        }
        this._store.set(key, list);
        return list;
    }

    getAll() {
        const result = {};
        for (const [key, value] of this._store.entries()) {
            result[key] = value;
        }
        return result;
    }

    clear() {
        this._store.clear();
    }

}

module.exports = new DiagnosticsStore();
