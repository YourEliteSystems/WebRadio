"use strict";

const { ipcMain, BrowserWindow } = require("electron");
const LogManager = require("../diagnostics/logging/LogManager");
const PackageManager = require("../packages/PackageManager");
const { PACKAGE_TYPES } = require("../packages/PackageModel");
const { InstallationError } = require("../packages/PackageInstaller");

const logger = LogManager.getLogger("PackageHandlers");

const ERROR_CODES = Object.freeze({
  PACKAGE_NOT_FOUND: "PACKAGE_NOT_FOUND",
  PACKAGE_ALREADY_INSTALLED: "PACKAGE_ALREADY_INSTALLED",
  PACKAGE_VALIDATION_FAILED: "PACKAGE_VALIDATION_FAILED",
  PACKAGE_CAPABILITY_DENIED: "PACKAGE_CAPABILITY_DENIED",
  PACKAGE_PERMISSION_DENIED: "PACKAGE_PERMISSION_DENIED",
  PACKAGE_INSTALL_FAILED: "PACKAGE_INSTALL_FAILED",
  PACKAGE_UPDATE_FAILED: "PACKAGE_UPDATE_FAILED",
  PACKAGE_REMOVE_FAILED: "PACKAGE_REMOVE_FAILED",
  PACKAGE_NOT_ALLOWED: "PACKAGE_NOT_ALLOWED",
  PACKAGE_NOT_INITIALIZED: "PACKAGE_NOT_INITIALIZED",
  INVALID_REQUEST: "INVALID_REQUEST"
});

function safePackageEntry(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  return {
    id: typeof raw.id === "string" ? raw.id : null,
    name: typeof raw.name === "string" ? raw.name : null,
    version: typeof raw.version === "string" ? raw.version : null,
    type: typeof raw.type === "string" ? raw.type : null,
    enabled: !!raw.enabled,
    source: typeof raw.source === "string" ? raw.source : null,
    installedAt: Number.isFinite(raw.installedAt) ? raw.installedAt : null,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : null
  };
}

function isAllowedPackageType(type) {
  return type === PACKAGE_TYPES.plugin || type === PACKAGE_TYPES.theme;
}

function buildError(code, message) {
  return {
    success: false,
    error: {
      code,
      message: message || code
    }
  };
}

function registerPackageHandlers() {
  ipcMain.handle("package:list", () => {
    try {
      if (!PackageManager.isInitialized()) {
        return buildError(ERROR_CODES.PACKAGE_NOT_INITIALIZED, "Package system not initialized");
      }

      const list = PackageManager.list();
      const safe = list.map(safePackageEntry).filter(Boolean);
      return { ok: true, packages: safe };
    } catch (err) {
      logger.error(`package:list error: ${err.message}`);
      return buildError(ERROR_CODES.PACKAGE_INSTALL_FAILED, "Unable to list packages");
    }
  });

  ipcMain.handle("package:get", (_, id) => {
    try {
      if (!PackageManager.isInitialized()) {
        return buildError(ERROR_CODES.PACKAGE_NOT_INITIALIZED, "Package system not initialized");
      }

      if (typeof id !== "string" || id.trim().length === 0) {
        return buildError(ERROR_CODES.INVALID_REQUEST, "Invalid package id");
      }

      const entry = PackageManager.get(id.trim());
      if (!entry) {
        return buildError(ERROR_CODES.PACKAGE_NOT_FOUND, `Package not found: ${id}`);
      }

      return { ok: true, package: safePackageEntry(entry) };
    } catch (err) {
      logger.error(`package:get error: ${err.message}`);
      return buildError(ERROR_CODES.PACKAGE_INSTALL_FAILED, "Unable to get package");
    }
  });

  ipcMain.handle("package:install", (_, payload) => {
    try {
      if (!PackageManager.isInitialized()) {
        return buildError(ERROR_CODES.PACKAGE_NOT_INITIALIZED, "Package system not initialized");
      }

      if (!payload || typeof payload !== "object") {
        return buildError(ERROR_CODES.INVALID_REQUEST, "Invalid install payload");
      }

      const localSourcePath = typeof payload.localSourcePath === "string" ? payload.localSourcePath.trim() : "";
      const type = typeof payload.type === "string" ? payload.type.trim().toLowerCase() : "";

      if (!isAllowedPackageType(type)) {
        return buildError(ERROR_CODES.INVALID_REQUEST, "Invalid or unsupported package type");
      }

      if (!localSourcePath) {
        return buildError(ERROR_CODES.INVALID_REQUEST, "localSourcePath is required for local install");
      }

      const normalizedSource = require("path").resolve(localSourcePath);
      const result = PackageManager.installFromDirectory(normalizedSource, type, {
        enabled: !!payload.enabled
      });

      return {
        ok: true,
        package: safePackageEntry(result.package)
      };
    } catch (err) {
      const code = mapInstallError(err);
      logger.error(`package:install error: ${err.message}`);
      return buildError(code, "Package install failed");
    }
  });

  ipcMain.handle("package:update", (_, payload) => {
    try {
      if (!PackageManager.isInitialized()) {
        return buildError(ERROR_CODES.PACKAGE_NOT_INITIALIZED, "Package system not initialized");
      }

      if (!payload || typeof payload !== "object") {
        return buildError(ERROR_CODES.INVALID_REQUEST, "Invalid update payload");
      }

      const id = typeof payload.id === "string" ? payload.id.trim() : "";
      const localSourcePath = typeof payload.localSourcePath === "string" ? payload.localSourcePath.trim() : "";
      const type = typeof payload.type === "string" ? payload.type.trim().toLowerCase() : "";

      if (!id) {
        return buildError(ERROR_CODES.INVALID_REQUEST, "Invalid package id");
      }

      if (!isAllowedPackageType(type)) {
        return buildError(ERROR_CODES.INVALID_REQUEST, "Invalid or unsupported package type");
      }

      if (!localSourcePath) {
        return buildError(ERROR_CODES.INVALID_REQUEST, "localSourcePath is required for local update");
      }

      const normalizedSource = require("path").resolve(localSourcePath);
      const result = PackageManager.updateFromDirectory(id, normalizedSource, type);
      return {
        ok: true,
        package: safePackageEntry(result.package)
      };
    } catch (err) {
      const code = mapInstallError(err);
      logger.error(`package:update error: ${err.message}`);
      return buildError(code, "Package update failed");
    }
  });

  ipcMain.handle("package:enable", (_, id) => {
    try {
      if (!PackageManager.isInitialized()) {
        return buildError(ERROR_CODES.PACKAGE_NOT_INITIALIZED, "Package system not initialized");
      }

      if (typeof id !== "string" || id.trim().length === 0) {
        return buildError(ERROR_CODES.INVALID_REQUEST, "Invalid package id");
      }

      const result = PackageManager.enable(id.trim());
      return { ok: true, package: safePackageEntry(result) };
    } catch (err) {
      const code = mapGenericError(err);
      logger.error(`package:enable error: ${err.message}`);
      return buildError(code, "Package enable failed");
    }
  });

  ipcMain.handle("package:disable", (_, id) => {
    try {
      if (!PackageManager.isInitialized()) {
        return buildError(ERROR_CODES.PACKAGE_NOT_INITIALIZED, "Package system not initialized");
      }

      if (typeof id !== "string" || id.trim().length === 0) {
        return buildError(ERROR_CODES.INVALID_REQUEST, "Invalid package id");
      }

      const result = PackageManager.disable(id.trim());
      return { ok: true, package: safePackageEntry(result) };
    } catch (err) {
      const code = mapGenericError(err);
      logger.error(`package:disable error: ${err.message}`);
      return buildError(code, "Package disable failed");
    }
  });

  ipcMain.handle("package:remove", (_, payload) => {
    try {
      if (!PackageManager.isInitialized()) {
        return buildError(ERROR_CODES.PACKAGE_NOT_INITIALIZED, "Package system not initialized");
      }

      if (!payload || typeof payload !== "object") {
        return buildError(ERROR_CODES.INVALID_REQUEST, "Invalid remove payload");
      }

      const id = typeof payload.id === "string" ? payload.id.trim() : "";

      if (!id) {
        return buildError(ERROR_CODES.INVALID_REQUEST, "Invalid package id");
      }

      const removed = PackageManager.remove(id.trim(), {
        deleteFiles: !!payload.deleteFiles
      });

      return { ok: true, package: safePackageEntry(removed) };
    } catch (err) {
      const code = mapGenericError(err);
      logger.error(`package:remove error: ${err.message}`);
      return buildError(code, "Package remove failed");
    }
  });

  ipcMain.handle("package:openUserFolder", () => {
    try {
      const { shell } = require("electron");
      const userDir = PackageManager.getInstallBaseDir();
      if (!userDir || !require("fs").existsSync(userDir)) {
        return { ok: true, opened: false };
      }
      const opened = shell.openPath(userDir);
      return { ok: true, opened: typeof opened === "string" && opened.length > 0 };
    } catch (err) {
      logger.error(`package:openUserFolder error: ${err.message}`);
      return buildError(ERROR_CODES.PACKAGE_INSTALL_FAILED, "Unable to open package folder");
    }
  });

  try {
    const { eventBus } = require("../eventBus");

    eventBus.on("package:installed", (payload) => {
      broadcastPackageEvent("package:installed", payload);
    });
    eventBus.on("package:updated", (payload) => {
      broadcastPackageEvent("package:updated", payload);
    });
    eventBus.on("package:enabled", (payload) => {
      broadcastPackageEvent("package:enabled", payload);
    });
    eventBus.on("package:disabled", (payload) => {
      broadcastPackageEvent("package:disabled", payload);
    });
    eventBus.on("package:removed", (payload) => {
      broadcastPackageEvent("package:removed", payload);
    });
  } catch (err) {
    logger.warn(`Konnte Package-Event-Broadcast nicht registrieren: ${err.message}`);
  }
}

function broadcastPackageEvent(event, payload) {
  const safe = safePackageEventPayload(payload);
  if (!safe) return;

  try {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(event, safe);
      }
    });
  } catch (broadcastErr) {
    logger.warn(`Konnte ${event} nicht broadcasten: ${broadcastErr.message}`);
  }
}

function safePackageEventPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const id = typeof payload.id === "string" ? payload.id : null;
  if (!id) return null;

  return {
    id,
    type: typeof payload.type === "string" ? payload.type : null,
    version: typeof payload.version === "string" ? payload.version : null,
    previousVersion: typeof payload.previousVersion === "string" ? payload.previousVersion : null,
    source: typeof payload.source === "string" ? payload.source : null
  };
}

function mapInstallError(err) {
  if (!err || typeof err !== "object") {
    return ERROR_CODES.PACKAGE_INSTALL_FAILED;
  }

  if (err instanceof InstallationError) {
    const message = String(err.message || "");
    if (/not found in registry/i.test(message)) return ERROR_CODES.PACKAGE_NOT_FOUND;
    if (/already installed/i.test(message)) return ERROR_CODES.PACKAGE_ALREADY_INSTALLED;
    if (/validation failed/i.test(message)) return ERROR_CODES.PACKAGE_VALIDATION_FAILED;
    if (/not within allowed/i.test(message) || /app packages cannot be installed/i.test(message)) {
      return ERROR_CODES.PACKAGE_NOT_ALLOWED;
    }
    return ERROR_CODES.PACKAGE_INSTALL_FAILED;
  }

  const message = String(err.message || "");
  if (/not found/i.test(message)) return ERROR_CODES.PACKAGE_NOT_FOUND;
  if (/validation/i.test(message) || /manifest/i.test(message)) return ERROR_CODES.PACKAGE_VALIDATION_FAILED;
  return ERROR_CODES.PACKAGE_INSTALL_FAILED;
}

function mapGenericError(err) {
  if (!err || typeof err !== "object") {
    return ERROR_CODES.PACKAGE_INSTALL_FAILED;
  }

  const message = String(err.message || "").toLowerCase();
  if (/not found/i.test(message)) return ERROR_CODES.PACKAGE_NOT_FOUND;
  if (/validation/i.test(message) || /manifest/i.test(message)) return ERROR_CODES.PACKAGE_VALIDATION_FAILED;
  if (/already installed/i.test(message)) return ERROR_CODES.PACKAGE_ALREADY_INSTALLED;
  if (/not allowed/i.test(message)) return ERROR_CODES.PACKAGE_NOT_ALLOWED;
  return ERROR_CODES.PACKAGE_INSTALL_FAILED;
}

module.exports = registerPackageHandlers;
module.exports.ERROR_CODES = ERROR_CODES;
