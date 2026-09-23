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
    this.installer = new PackageInstaller({
      registry: new PackageRegistry()
    });
    this.localSource = new LocalSource({
      allowedBaseDirs: [this._userPackageDataDir()]
    });
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
    return this.installer.getRegistry().packageDataPath ?
      this.installer.getRegistry().packageDataPath() :
      path.join(
        (app && typeof app.getPath === "function" ? app.getPath("userData") : process.cwd()),
        PACKAGE_DATA_SUBDIR
      );
  }

  isInitialized() {
    return this.initialized;
  }

  registry() {
    return this.installer.getRegistry();
  }

  installer() {
    return this.installer;
  }

  localSource() {
    return this.localSource;
  }

  installFromDirectory(dirPath, type, options = {}) {
    this.initialize();
    return this.installer.install(dirPath, type, options);
  }

  updateFromDirectory(packageId, dirPath, type, options = {}) {
    this.initialize();
    return this.installer.update(packageId, dirPath, type, options);
  }

  enable(packageId) {
    this.initialize();
    return this.installer.enable(packageId);
  }

  disable(packageId) {
    this.initialize();
    return this.installer.disable(packageId);
  }

  remove(packageId, options = {}) {
    this.initialize();
    return this.installer.remove(packageId, options);
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
