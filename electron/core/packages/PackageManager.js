"use strict";

const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const LogManager = require("../diagnostics/logging/LogManager");
const eventBus = require("../eventBus");
const { PackageRegistry, FilesPolicy, PACKAGE_DATA_SUBDIR } = require("./PackageRegistry");
const { PackageInstaller, InstallationError } = require("./PackageInstaller");
const { PACKAGE_EVENTS } = require("./events");
const { PackageSource, LocalSource } = require("./LocalSource");
const { PACKAGE_TYPES } = require("./PackageModel");
const CapabilityRegistry = require("../plugins/CapabilityRegistry");

const logger = LogManager.getLogger("PackageManager");

class PackageManager {
  constructor() {
    this.initialized = false;
    this._userPackageDataDir = null;
    this.installer = new PackageInstaller({
      registry: new PackageRegistry()
    });
    this.localSource = new LocalSource({
      allowedBaseDirs: [this._resolveUserPackageDataDir()]
    });
    this.runtimeCallbacks = {
      onPackageInstalled: null,
      onPackageUpdated: null,
      onPackageRemoved: null,
      onPackageEnabled: null,
      onPackageDisabled: null
    };
  }

  _resolveUserPackageDataDir() {
    if (this._userPackageDataDir) return this._userPackageDataDir;
    const base = app && typeof app.getPath === "function"
      ? app.getPath("userData")
      : process.cwd();
    this._userPackageDataDir = path.join(base, PACKAGE_DATA_SUBDIR);
    return this._userPackageDataDir;
  }

  setRuntimeCallbacks(callbacks) {
    if (callbacks && typeof callbacks === "object") {
      if (typeof callbacks.onPackageInstalled === "function") {
        this.runtimeCallbacks.onPackageInstalled = callbacks.onPackageInstalled;
      }
      if (typeof callbacks.onPackageUpdated === "function") {
        this.runtimeCallbacks.onPackageUpdated = callbacks.onPackageUpdated;
      }
      if (typeof callbacks.onPackageRemoved === "function") {
        this.runtimeCallbacks.onPackageRemoved = callbacks.onPackageRemoved;
      }
      if (typeof callbacks.onPackageEnabled === "function") {
        this.runtimeCallbacks.onPackageEnabled = callbacks.onPackageEnabled;
      }
      if (typeof callbacks.onPackageDisabled === "function") {
        this.runtimeCallbacks.onPackageDisabled = callbacks.onPackageDisabled;
      }
    }
  }

  initialize() {
    if (this.initialized) return;
    this.installer.getRegistry().ensureInitialized();
    this.initialized = true;
    logger.info("PackageManager initialisiert.");
  }

  shutdown() {
    this.initialized = false;
    logger.info("PackageManager heruntergefahren.");
  }

  setInstallBaseDir(dir) {
    this.installer.setInstallBaseDir(dir);
  }

  getInstallBaseDir() {
    return this.installer.getRegistry().userDataPath() || path.join(
      (app && typeof app.getPath === "function") ? app.getPath("userData") : process.cwd()
    );
  }

  isInitialized() {
    return this.initialized;
  }

  registry() {
    return this.installer.getRegistry();
  }

  getInstaller() {
    return this.installer;
  }

  getLocalSource() {
    return this.localSource;
  }

  installFromDirectory(dirPath, type, options = {}) {
    this.initialize();
    const result = this.installer.install(dirPath, type, options);
    
    if (result.success && this.runtimeCallbacks.onPackageInstalled) {
      try {
        this.runtimeCallbacks.onPackageInstalled(result.package);
      } catch (err) {
        logger.error(`Runtime callback after installation failed: ${err.message}`);
      }
    }
    
    return result;
  }

  updateFromDirectory(packageId, dirPath, type, options = {}) {
    this.initialize();
    const result = this.installer.update(packageId, dirPath, type, options);
    
    if (result.success && this.runtimeCallbacks.onPackageUpdated) {
      try {
        this.runtimeCallbacks.onPackageUpdated(result.package);
      } catch (err) {
        logger.error(`Runtime callback after update failed: ${err.message}`);
      }
    }
    
    return result;
  }

  enable(packageId) {
    this.initialize();
    const result = this.installer.enable(packageId);
    
    if (this.runtimeCallbacks.onPackageEnabled) {
      try {
        this.runtimeCallbacks.onPackageEnabled(result);
      } catch (err) {
        logger.error(`Runtime callback after enable failed: ${err.message}`);
      }
    }
    
    return result;
  }

  disable(packageId) {
    this.initialize();
    const result = this.installer.disable(packageId);
    
    if (this.runtimeCallbacks.onPackageDisabled) {
      try {
        this.runtimeCallbacks.onPackageDisabled(result);
      } catch (err) {
        logger.error(`Runtime callback after disable failed: ${err.message}`);
      }
    }
    
    return result;
  }

  remove(packageId, options = {}) {
    this.initialize();
    const result = this.installer.remove(packageId, options);
    
    if (result && this.runtimeCallbacks.onPackageRemoved) {
      try {
        this.runtimeCallbacks.onPackageRemoved(result);
      } catch (err) {
        logger.error(`Runtime callback after removal failed: ${err.message}`);
      }
    }
    
    return result;
  }

  validateOnly(dirPath, type) {
    this.initialize();
    return this.installer.validateOnly(dirPath, type);
  }

  list() {
    this.initialize();
    return this.registry().list();
  }

  get(packageId) {
    this.initialize();
    return this.registry().get(packageId);
  }

  has(packageId) {
    this.initialize();
    return this.registry().has(packageId);
  }

  listByType(type) {
    this.initialize();
    return this.registry().byType(type);
  }

}

module.exports = new PackageManager();
