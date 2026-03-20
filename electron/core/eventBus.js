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

module.exports = {
  on,
  emit
};