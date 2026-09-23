"use strict";

const eventBus = require("../eventBus");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("PackageEvents");

const PACKAGE_EVENTS = Object.freeze({
  installed: "package:installed",
  updated: "package:updated",
  enabled: "package:enabled",
  disabled: "package:disabled",
  removed: "package:removed",
  error: "package:error",
  validated: "package:validated"
});

function emitInstalled(payload) {
  if (!payload || typeof payload.id !== "string") {
    logger.warn("package:installed ohne gueltige Payload ignoriert");
    return;
  }
  eventBus.emit(PACKAGE_EVENTS.installed, payload);
}

function emitUpdated(payload) {
  if (!payload || typeof payload.id !== "string") {
    logger.warn("package:updated ohne gueltige Payload ignoriert");
    return;
  }
  eventBus.emit(PACKAGE_EVENTS.updated, payload);
}

function emitEnabled(payload) {
  if (!payload || typeof payload.id !== "string") {
    logger.warn("package:enabled ohne gueltige Payload ignoriert");
    return;
  }
  eventBus.emit(PACKAGE_EVENTS.enabled, payload);
}

function emitDisabled(payload) {
  if (!payload || typeof payload.id !== "string") {
    logger.warn("package:disabled ohne gueltige Payload ignoriert");
    return;
  }
  eventBus.emit(PACKAGE_EVENTS.disabled, payload);
}

function emitRemoved(payload) {
  if (!payload || typeof payload.id !== "string") {
    logger.warn("package:removed ohne gueltige Payload ignoriert");
    return;
  }
  eventBus.emit(PACKAGE_EVENTS.removed, payload);
}

function emitError(payload) {
  if (!payload || typeof payload.id !== "string") {
    logger.warn("package:error ohne gueltige Payload ignoriert");
    return;
  }
  eventBus.emit(PACKAGE_EVENTS.error, payload);
}

function emitValidated(payload) {
  if (!payload || typeof payload.id !== "string") {
    logger.warn("package:validated ohne gueltige Payload ignoriert");
    return;
  }
  eventBus.emit(PACKAGE_EVENTS.validated, payload);
}

function on(event, listener) {
  eventBus.on(event, listener);
}

function once(event, listener) {
  eventBus.once(event, listener);
}

function off(event, listener) {
  eventBus.off(event, listener);
}

module.exports = {
  PACKAGE_EVENTS,
  emitInstalled,
  emitUpdated,
  emitEnabled,
  emitDisabled,
  emitRemoved,
  emitError,
  emitValidated,
  on,
  once,
  off
};
