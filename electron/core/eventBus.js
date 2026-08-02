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

    emit(event, data) {
        if (!this.events.has(event)) return;
        this.events.get(event).forEach(cb => {
    try {
      cb(data);
    } catch (err) {
      logger.error("EventBus Fehler:", err);
    }
  });
    }

    off(event, cb) {
        if (!this.events.has(event)) return;
        this.events.set(event, this.events.get(event).filter(handler => handler !== cb));
    }

    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }
}

module.exports = new EventBus();