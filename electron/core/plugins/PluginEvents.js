const eventBus = require("../eventBus");

function on(event, callback) {
    eventBus.on(event, callback);
}

function emit(event, payload) {
    eventBus.emit(event, payload);
}

module.exports = {
    on,
    emit
};