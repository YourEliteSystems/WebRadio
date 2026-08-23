const { app } = require("electron");
const LogManager = require("../logging/LogManager");

const logger = LogManager.getLogger("MemoryMonitor");

/**
 * MemoryMonitor – Leichtgewichtiger Speicher-Monitor für den Main Process.
 *
 * Im Development-Modus: periodisches Logging alle 30 Sekunden.
 * Im Production-Modus: kein automatisches Polling – nur auf expliziten Aufruf.
 * Kein permanenter Interval in Production → kein unnötiger Speicher-Overhead.
 */
class MemoryMonitor {

    constructor() {
        this._interval = null;
        this._isDev    = false;
    }

    initialize(isDev = false) {
        this._isDev = isDev;

        if (isDev) {
            // Im Dev-Modus: alle 30 Sekunden Speicherverbrauch loggen
            this._interval = setInterval(() => {
                const snapshot = this.getSnapshot();
                logger.debug(
                    `[MemoryMonitor] RSS: ${snapshot.rss} | Heap: ${snapshot.heapUsed}/${snapshot.heapTotal} | External: ${snapshot.external} | ArrayBuffers: ${snapshot.arrayBuffers}`
                );
            }, 30_000);

            // Interval soll den Prozess nicht am Beenden hindern
            if (this._interval.unref) {
                this._interval.unref();
            }

            logger.info("MemoryMonitor gestartet (Dev-Modus, 30s Intervall).");
        }
    }

    shutdown() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }

    /**
     * Gibt eine formatierte Speicher-Momentaufnahme zurück.
     * Werte in MB, gerundet auf 2 Dezimalstellen.
     */
    getSnapshot() {
        const mem  = process.memoryUsage();
        const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(2) + " MB";

        return {
            // Main Process
            rss:          toMB(mem.rss),
            heapUsed:     toMB(mem.heapUsed),
            heapTotal:    toMB(mem.heapTotal),
            external:     toMB(mem.external),
            arrayBuffers: toMB(mem.arrayBuffers),

            // Raw bytes (für programmatische Auswertung)
            raw: {
                rss:          mem.rss,
                heapUsed:     mem.heapUsed,
                heapTotal:    mem.heapTotal,
                external:     mem.external,
                arrayBuffers: mem.arrayBuffers
            },

            // Electron-spezifische Prozess-Infos
            pid:  process.pid,
            uptime: Math.floor(process.uptime()) + "s",

            // App-Version
            version: app.getVersion(),

            // Zeitstempel
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Gibt Informationen über EventEmitter-Listener zurück,
     * um EventEmitter-Leaks zu erkennen.
     */
    getEventBusStats() {
        try {
            const eventBus = require("../../eventBus");
            return {
                events:  eventBus.eventNames(),
                counts:  eventBus.eventNames().reduce((acc, e) => {
                    acc[e] = eventBus.listenerCount(e);
                    return acc;
                }, {})
            };
        } catch {
            return { events: [], counts: {} };
        }
    }

}

module.exports = new MemoryMonitor();
