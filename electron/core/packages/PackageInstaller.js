"use strict";

const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const eventBus = require("../eventBus");
const LogManager = require("../diagnostics/logging/LogManager");
const { PACKAGE_TYPES, createPackageFromDirectory } = require("./PackageModel");
const PackageValidator = require("./PackageValidator");
const { PackageRegistry, FilesPolicy } = require("./PackageRegistry");
const PluginManager = require("../plugins/PluginManager");
const ThemeManager = require("../themes/ThemeManager");
const CapabilityRegistry = require("../plugins/CapabilityRegistry");

const logger = LogManager.getLogger("PackageInstaller");

class PackageInstaller {
  constructor(options = {}) {
    const opts = options || {};
    this.registry = opts.registry || new PackageRegistry();
    this.validator = opts.validator || PackageValidator;
    this.installBaseDir = opts.installBaseDir || null;
    this.protectedInstalledDirs = new Set();
  }

  getRegistry() {
    return this.registry;
  }

  setInstallBaseDir(dir) {
    if (typeof dir !== "string") {
      throw new TypeError("installBaseDir must be a string");
    }
    this.installBaseDir = path.resolve(dir);
    fs.mkdirSync(this.installBaseDir, { recursive: true });
    return this.installBaseDir;
  }

  install(dirPath, type, options = {}) {
    const opt = Object.assign({
      enabled: false,
      allowReplace: false,
      keepVersionIfNewer: false
    }, options);

    this.registry.ensureInitialized();

    const resolvedDir = path.resolve(dirPath);
    if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
      throw new InstallationError("Invalid package directory");
    }

    if (!this._isWithinAllowedDir(resolvedDir)) {
      throw new InstallationError("Package directory is not within allowed installation area");
    }

    if (FilesPolicy.isAppPackagePath(resolvedDir)) {
      throw new InstallationError("App packages cannot be installed via PackageInstaller");
    }

    if (!this._isProtectedDir(resolvedDir)) {
      this.protectedInstalledDirs.add(resolvedDir);
    }

    const existing = this.registry.get(this._packageIdFromDir(resolvedDir));
    if (existing && !opt.allowReplace && !this._shouldReplace(existing, type, opt)) {
      throw new InstallationError("Package already installed");
    }

    const normalized = this._normalizeCandidate(resolvedDir, type);
    if (!normalized) {
      throw new InstallationError("Unable to read package manifest");
    }

    const validation = this.validator.validate(normalized.manifest, normalized.type);
    if (!validation.valid) {
      throw new InstallationError("Package validation failed: " + validation.errors.join("; "));
    }

    if (normalized.manifest.capabilities && normalized.manifest.capabilities.length) {
      const capabilityResult = CapabilityRegistry.validateCapabilities(
        normalized.manifest.capabilities,
        normalized.manifest.permissions || []
      );
      if (!capabilityResult.valid && capabilityResult.denied.length > 0) {
        throw new InstallationError(
          `Unacceptable capabilities: ${capabilityResult.denied.map((d) => `${d.capability}: ${d.reason}`).join(", ")}`
        );
      }
    }

    const installPath = this._makeInstallPath(normalized);
    const backupPath = opt.allowReplace && existing ? this._backupExistingInstall(installPath, existing.id) : null;

    try {
      this._prepareInstallDirectory(installPath, normalized);
      this._copyOrSymlinkPackage(installPath, resolvedDir, normalized.type);

      const registryEntry = this.registry.addOrUpdate(
        normalized.manifest.id,
        normalized.type,
        normalized.manifest.version,
        {
          path: path.relative(this.registry.packageDataPath(), installPath),
          source: normalized.source || "local",
          enabled: opt.enabled
        }
      );

      eventBus.emit("package:installed", {
        id: normalized.manifest.id,
        type: normalized.type,
        version: normalized.manifest.version,
        path: installPath,
        source: registryEntry.source
      });

      logger.info(`Package installiert: ${normalized.manifest.id} (${normalized.type})`);

      if (normalized.type === PACKAGE_TYPES.plugin && opt.enabled) {
        try {
          PluginManager.reloadPlugins();
        } catch (err) {
          logger.error(`Plugin-Reload nach Installation fehlgeschlagen (${normalized.manifest.id}): ${err.message}`);
        }
      } else if (normalized.type === PACKAGE_TYPES.theme) {
        try {
          ThemeManager.reloadThemes();
        } catch (err) {
          logger.error(`Theme-Reload nach Installation fehlgeschlagen (${normalized.manifest.id}): ${err.message}`);
        }
      }

      return {
        success: true,
        package: registryEntry
      };
    } catch (error) {
      if (backupPath) {
        this._restoreBackup(installPath, backupPath);
      }
      logger.error(`Installation fehlgeschlagen (${normalized.manifest.id}): ${error.message}`);
      throw error;
    }
  }

  update(id, dirPath, type, options = {}) {
    const opt = Object.assign({
      allowReplace: false,
      keepVersionIfNewer: false
    }, options);

    this.registry.ensureInitialized();

    const existing = this.registry.get(id);
    if (!existing) {
      throw new InstallationError("Package not found in registry");
    }

    if (existing.type !== type) {
      throw new InstallationError("Type mismatch for update");
    }

    const resolvedDir = path.resolve(dirPath);
    if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
      throw new InstallationError("Invalid package directory for update");
    }

    if (!this._isWithinAllowedDir(resolvedDir)) {
      throw new InstallationError("Updated package directory is not within allowed installation area");
    }

    const normalized = this._normalizeCandidate(resolvedDir, type);
    if (!normalized || normalized.manifest.id !== id) {
      throw new InstallationError("Package id mismatch");
    }

    const validation = this.validator.validate(normalized.manifest, normalized.type);
    if (!validation.valid) {
      throw new InstallationError("Package validation failed: " + validation.errors.join("; "));
    }

    const installPath = this._makeInstallPath(normalized);
    const backupPath = this._backupExistingInstall(installPath, id);

    try {
      this._prepareInstallDirectory(installPath, normalized);
      this._copyOrSymlinkPackage(installPath, resolvedDir, normalized.type);

      const registryEntry = this.registry.addOrUpdate(
        normalized.manifest.id,
        normalized.type,
        normalized.manifest.version,
        {
          path: path.relative(this.registry.packageDataPath(), installPath),
          source: normalized.source || "local",
          enabled: existing.enabled
        }
      );

      eventBus.emit("package:updated", {
        id: normalized.manifest.id,
        type: normalized.type,
        previousVersion: existing.version,
        version: normalized.manifest.version,
        path: installPath,
        source: registryEntry.source
      });

      logger.info(`Package aktualisiert: ${normalized.manifest.id} -> ${normalized.manifest.version}`);

      if (normalized.type === PACKAGE_TYPES.plugin) {
        try {
          PluginManager.reloadPlugins();
        } catch (err) {
          logger.error(`Plugin-Reload nach Aktualisierung fehlgeschlagen (${normalized.manifest.id}): ${err.message}`);
        }
      } else if (normalized.type === PACKAGE_TYPES.theme) {
        try {
          ThemeManager.reloadThemes();
        } catch (err) {
          logger.error(`Theme-Reload nach Aktualisierung fehlgeschlagen (${normalized.manifest.id}): ${err.message}`);
        }
      }

      return {
        success: true,
        package: registryEntry
      };
    } catch (error) {
      if (backupPath) {
        this._restoreBackup(installPath, backupPath);
      }
      logger.error(`Aktualisierung fehlgeschlagen (${normalized.manifest.id}): ${error.message}`);
      throw error;
    }
  }

  enable(id) {
    this.registry.ensureInitialized();

    const entry = this.registry.get(id);
    if (!entry) {
      throw new InstallationError("Package not found in registry");
    }

    const updated = this.registry.setEnabled(id, true);
    if (!updated) {
      throw new InstallationError("Unable to enable package");
    }

    eventBus.emit("package:enabled", {
      id,
      type: updated.type,
      version: updated.version
    });

    if (updated.type === PACKAGE_TYPES.plugin) {
      try {
        PluginManager.togglePlugin(id, true);
      } catch (err) {
        logger.error(`Plugin-Aktivierung fehlgeschlagen (${id}): ${err.message}`);
      }
    } else if (updated.type === PACKAGE_TYPES.theme) {
      try {
        ThemeManager.reloadThemes();
      } catch (err) {
        logger.error(`Theme-Aktivierung fehlgeschlagen (${id}): ${err.message}`);
      }
    }

    logger.info(`Package aktiviert: ${id}`);
    return updated;
  }

  disable(id) {
    this.registry.ensureInitialized();

    const entry = this.registry.get(id);
    if (!entry) {
      throw new InstallationError("Package not found in registry");
    }

    const updated = this.registry.setEnabled(id, false);
    if (!updated) {
      throw new InstallationError("Unable to disable package");
    }

    eventBus.emit("package:disabled", {
      id,
      type: updated.type,
      version: updated.version
    });

    if (updated.type === PACKAGE_TYPES.plugin) {
      try {
        PluginManager.togglePlugin(id, false);
      } catch (err) {
        logger.error(`Plugin-Deaktivierung fehlgeschlagen (${id}): ${err.message}`);
      }
    } else if (updated.type === PACKAGE_TYPES.theme) {
      try {
        ThemeManager.reloadThemes();
      } catch (err) {
        logger.error(`Theme-Deaktivierung fehlgeschlagen (${id}): ${err.message}`);
      }
    }

    logger.info(`Package deaktiviert: ${id}`);
    return updated;
  }

  remove(id, options = {}) {
    const opt = Object.assign({
      deleteFiles: false,
      skipLifecycle: false
    }, options);

    this.registry.ensureInitialized();

    const entry = this.registry.get(id);
    if (!entry) {
      throw new InstallationError("Package not found in registry");
    }

    if (!FilesPolicy.isWithinUserPackageDataDir(this.registry.packageDataPath(), this.registry.packageDataPath())) {
      throw new InstallationError("Registry path protection violated");
    }

    if (entry.type === PACKAGE_TYPES.plugin) {
      if (!opt.skipLifecycle) {
        try {
          PluginManager.togglePlugin(id, false);
        } catch (err) {
          logger.error(`Plugin-Deaktivierung vor Entfernung fehlgeschlagen (${id}): ${err.message}`);
        }
      }
      try {
        PluginManager.reloadPlugins();
      } catch (err) {
        logger.error(`Plugin-Reload vor Entfernung fehlgeschlagen (${id}): ${err.message}`);
      }
    } else if (entry.type === PACKAGE_TYPES.theme) {
      if (!opt.skipLifecycle) {
        try {
          ThemeManager.reloadThemes();
        } catch (err) {
          logger.error(`Theme-Deaktivierung vor Entfernung fehlgeschlagen (${id}): ${err.message}`);
        }
      }
    }

    let removedEntry = null;
    try {
      removedEntry = this.registry.remove(id, {
        deleteFiles: opt.deleteFiles && entry.path && FilesPolicy.isWithinUserPackageDataDir(
          path.resolve(this.registry.packageDataPath(), entry.path),
          this.registry.packageDataPath()
        )
      });
    } catch (err) {
      logger.error(`Registry-Bereinigung fehlgeschlagen (${id}): ${err.message}`);
      throw err;
    }

    eventBus.emit("package:removed", {
      id,
      type: entry.type,
      version: entry.version
    });

    logger.info(`Package entfernt: ${id}`);
    return removedEntry;
  }

  validateOnly(dirPath, type) {
    const resolvedDir = path.resolve(dirPath);
    if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
      throw new InstallationError("Invalid package directory");
    }

    const normalized = this._normalizeCandidate(resolvedDir, type);
    if (!normalized) {
      return { valid: false, errors: ["Unable to read manifest"] };
    }

    const validation = this.validator.validate(normalized.manifest, normalized.type);
    return {
      valid: validation.valid,
      errors: validation.errors,
      manifest: validation.valid ? normalized.manifest : null
    };
  }

  _normalizeCandidate(dirPath, type) {
    const result = createPackageFromDirectory(dirPath, type, { inferType: false, preferTypeFromDirectory: false });
    if (!result) return null;
    return {
      manifest: result.manifest,
      type: result.type,
      source: result.manifestSource
    };
  }

  _packageIdFromDir(dirPath) {
    const normalized = createPackageFromDirectory(dirPath, PACKAGE_TYPES.plugin, {
      inferType: true,
      preferTypeFromDirectory: false
    });
    if (!normalized) {
      const themeNormalized = createPackageFromDirectory(dirPath, PACKAGE_TYPES.theme, {
        inferType: true,
        preferTypeFromDirectory: false
      });
      if (themeNormalized) return themeNormalized.manifest.id;
      return path.basename(dirPath);
    }
    return normalized.manifest.id;
  }

  _makeInstallPath(normalized) {
    const base = this.installBaseDir || path.join(this.registry.packageDataPath(), "..");
    const baseResolved = path.resolve(base);
    return path.join(baseResolved, normalized.type, normalized.manifest.id);
  }

  _prepareInstallDirectory(installPath, normalized) {
    if (fs.existsSync(installPath)) {
      fs.rmSync(installPath, { recursive: true, force: true });
    }
    fs.mkdirSync(installPath, { recursive: true });
  }

  _copyOrSymlinkPackage(installPath, sourceDir, type) {
    const allFiles = this._listRecursiveFiles(sourceDir);
    for (const file of allFiles) {
      const relative = path.relative(sourceDir, file);
      if (relative === "") continue;

      const dest = path.join(installPath, relative);
      const destDir = path.dirname(dest);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      if (fs.statSync(file).isDirectory()) {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        continue;
      }

      const resolvedDest = path.resolve(dest);
      const resolvedInstall = path.resolve(installPath);

      if (!resolvedDest.startsWith(resolvedInstall + path.sep) && resolvedDest !== resolvedInstall) {
        throw new InstallationError("Invalid destination path during package copy");
      }

      fs.copyFileSync(file, dest);
    }
  }

  _listRecursiveFiles(dir) {
    const results = [];
    const list = (current) => {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          list(full);
        } else {
          results.push(full);
        }
      }
    };
    list(dir);
    return results;
  }

  _isWithinAllowedDir(targetPath) {
    const base = this.installBaseDir || path.join(this.registry.packageDataPath(), "..");
    const resolvedBase = path.resolve(base);
    const resolvedTarget = path.resolve(targetPath);
    if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
      return false;
    }
    if (resolvedTarget.includes(path.sep + ".." + path.sep) || resolvedTarget.endsWith(path.sep + "..")) {
      return false;
    }
    return true;
  }

  _isProtectedDir(targetPath) {
    const resolved = path.resolve(targetPath);
    for (const protectedPath of this.protectedInstalledDirs.values()) {
      if (resolved === protectedPath) {
        return true;
      }
    }
    return false;
  }

  _shouldReplace(existing, type, options) {
    if (!options.allowReplace) {
      return false;
    }
    const existingEntry = this.registry.get(existing.id);
    if (!existingEntry) {
      return true;
    }
    const newVersion = options.newVersion || existingEntry.version;
    const currentVersion = existingEntry.version || "0.0.0";
    if (options.keepVersionIfNewer) {
      return false;
    }
    return true;
  }

  _backupExistingInstall(installPath, id) {
    if (!fs.existsSync(installPath)) {
      return null;
    }
    const backupDir = installPath + ".backup";
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    fs.renameSync(installPath, backupDir);
    return backupDir;
  }

  _restoreBackup(installPath, backupPath) {
    try {
      if (fs.existsSync(installPath)) {
        fs.rmSync(installPath, { recursive: true, force: true });
      }
      if (fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, installPath);
      }
    } catch (err) {
      logger.error(`Backup-Wiederherstellung fehlgeschlagen: ${err.message}`);
    }
  }
}

class InstallationError extends Error {
  constructor(message) {
    super(message);
    this.name = "InstallationError";
  }
}

module.exports = {
  PackageInstaller,
  InstallationError
};
