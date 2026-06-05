const listeners = {};

function on(event, callback) {

  if (!listeners[event]) {
    listeners[event] = [];
  }

  listeners[event].push(callback);
}

function emit(event, data) {

  if (!listeners[event]) return;

  for (const cb of listeners[event]) {
    try {
      cb(data);
    } catch (err) {
      console.error("EventBus Fehler:", err);
    }
  }

}

function off(event, callback) {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter(cb => cb !== callback);
}

module.exports = {
  on,
  off,
  emit
};