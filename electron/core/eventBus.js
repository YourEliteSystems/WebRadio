const LogManager = require("./diagnostics/logging/LogManager");

const logger = LogManager.getLogger("EventBus");

class EventBus {

    constructor() {
        this.events = new Map();
    }

    on(event, cb) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(cb);
    }

    /**
     * Registriert einen Listener, der nur einmal ausgeführt wird.
     * Nach dem ersten Aufruf wird er automatisch entfernt.
     */
    once(event, cb) {
        const wrapper = (data) => {
            cb(data);
            this.off(event, wrapper);
        };
        // Referenz auf Original für eventuelle manuelle Entfernung
        wrapper._originalCb = cb;
        this.on(event, wrapper);
    }

    emit(event, data) {
        if (!this.events.has(event)) return;
        // Kopie erstellen, damit Listener während Emission entfernt werden können
        const handlers = [...this.events.get(event)];
        handlers.forEach(cb => {
            try {
                cb(data);
            } catch (err) {
                logger.error("EventBus Fehler:", err);
            }
        });
    }

    off(event, cb) {
        if (!this.events.has(event)) return;
        this.events.set(
            event,
            this.events.get(event).filter(
                handler => handler !== cb && handler._originalCb !== cb
            )
        );
    }

    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }

    /**
     * Gibt die Anzahl der registrierten Listener für ein Event zurück.
     * Nützlich für Diagnostics/Memory-Monitoring.
     */
    listenerCount(event) {
        return this.events.get(event)?.length ?? 0;
    }

    /**
     * Gibt alle registrierten Event-Namen zurück.
     */
    eventNames() {
        return [...this.events.keys()];
    }
}

module.exports = new EventBus();