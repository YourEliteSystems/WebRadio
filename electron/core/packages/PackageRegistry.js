"use strict";

const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const LogManager = require("../diagnostics/logging/LogManager");
const { PACKAGE_TYPES } = require("./PackageModel");
const StorageManager = require("../storage/StorageManager");

const logger = LogManager.getLogger("PackageRegistry");

const PACKAGE_DATA_SUBDIR = "package-data";
const REGISTRY_FILENAME = "registry.json";
const REGISTRY_VERSION = 1;

class PackageRegistry {
  constructor() {
    this.userData = (app && typeof app.getPath === "function")
      ? app.getPath("userData")
      : path.join(process.cwd(), "data");

    this.packageDataPath = path.join(this.userData, PACKAGE_DATA_SUBDIR);
    this.registryFile = path.join(this.packageDataPath, REGISTRY_FILENAME);
    this._data = null;
  }

  ensureInitialized() {
    fs.mkdirSync(this.packageDataPath, { recursive: true });
    if (!fs.existsSync(this.registryFile)) {
      fs.writeFileSync(this.registryFile, JSON.stringify(this._defaultData(), null, 2), "utf8");
    }
    this._load();
  }

  _defaultData() {
    return {
      version: REGISTRY_VERSION,
      packages: {}
    };
  }

  _load() {
    try {
      this._data = JSON.parse(fs.readFileSync(this.registryFile, "utf8"));
    } catch {
      this._data = this._defaultData();
    }

    if (!this._data || typeof this._data !== "object" || this._data === null) {
      this._data = this._defaultData();
    }

    if (!this._data.packages || typeof this._data.packages !== "object") {
      this._data.packages = {};
    }

    if (typeof this._data.version !== "number" || this._data.version !== REGISTRY_VERSION) {
      const migrated = this._migrateData(this._data);
      if (migrated) this._data = migrated;
    }
  }

  _migrateData(oldData) {
    if (!oldData || typeof oldData !== "object") return null;

    const version = typeof oldData.version === "number" ? oldData.version : 0;
    if (version >= REGISTRY_VERSION) return null;

    const migrated = {
      version: REGISTRY_VERSION,
      packages: {}
    };

    if (oldData.packages && typeof oldData.packages === "object") {
      for (const [id, entry] of Object.entries(oldData.packages)) {
        migrated.packages[id] = this._normalizeEntry(entry, id);
      }
    }

    return migrated;
  }

  _normalizeEntry(entry, id) {
    if (!entry || typeof entry !== "object") {
      return this._createEntry(id, null, null, false);
    }

    const type = typeof entry.type === "string" ? entry.type : null;
    const version = typeof entry.version === "string" ? entry.version : "1.0.0";
    const enabled = typeof entry.enabled === "boolean" ? entry.enabled : false;

    const normalized = {
      id,
      type,
      version,
      enabled,
      path: typeof entry.path === "string" && entry.path.trim().length > 0 ? entry.path.trim() : null,
      source: typeof entry.source === "string" && entry.source.trim().length > 0 ? entry.source.trim() : null,
      installedAt: typeof entry.installedAt === "number" ? entry.installedAt : null,
      updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : null
    };

    return normalized;
  }

  _createEntry(id, type, version, enabled = false) {
    return {
      id,
      type,
      version,
      enabled,
      path: null,
      source: null,
      installedAt: Date.now(),
      updatedAt: null
    };
  }

  _write() {
    fs.writeFileSync(this.registryFile, JSON.stringify(this._data, null, 2), "utf8");
  }

  list() {
    const result = [];

    for (const [id, entry] of Object.entries(this._data.packages)) {
      result.push({
        id,
        type: entry.type || null,
        version: entry.version || "1.0.0",
        enabled: !!entry.enabled,
        path: entry.path || null,
        source: entry.source || null,
        installedAt: entry.installedAt || null,
        updatedAt: entry.updatedAt || null
      });
    }

    return result;
  }

  get(id) {
    const entry = this._data.packages[id];
    if (!entry) return null;

    return {
      id: entry.id || id,
      type: entry.type || null,
      version: entry.version || "1.0.0",
      enabled: !!entry.enabled,
      path: entry.path || null,
      source: entry.source || null,
      installedAt: entry.installedAt || null,
      updatedAt: entry.updatedAt || null
    };
  }

  has(id) {
    return id in this._data.packages;
  }

  addOrUpdate(id, type, version, options = {}) {
    const opt = {
      path: null,
      source: null,
      enabled: false,
      installedAt: Date.now()
    };

    const merged = Object.assign(opt, options);

    let entry = this._data.packages[id];
    if (!entry) {
      entry = this._createEntry(id, type, version, opt.enabled);
    }

    entry.type = type;
    entry.version = version;
    if (merged.path !== null) entry.path = merged.path;
    if (merged.source !== null) entry.source = merged.source;
    if (typeof merged.enabled === "boolean") entry.enabled = merged.enabled;
    if (merged.installedAt !== null && typeof merged.installedAt === "number") {
      entry.installedAt = merged.installedAt;
    }

    entry.updatedAt = Date.now();
    this._data.packages[id] = entry;
    this._write();

    logger.info(`Package-Registry Eintrag aktualisiert: ${id}`);
    return this.get(id);
  }

  remove(id, options = {}) {
    const opt = { deleteFiles: false };
    const merged = Object.assign(opt, options);

    if (!this.has(id)) {
      return null;
    }

    const entry = this._data.packages[id];
    const result = this.get(id);

    if (merged.deleteFiles && entry.path && typeof entry.path === "string" && entry.path.trim().length > 0) {
      try {
        const targetPath = path.resolve(this.userData, entry.path.trim());
        if (FilesPolicy.isWithinUserPackageDataDir(targetPath, this.packageDataPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
          logger.info(`Package-Dateien entfernt: ${id}`);
        }
      } catch (err) {
        logger.warn(`Package-Dateien konnten nicht entfernt werden (${id}): ${err.message}`);
      }
    }

    delete this._data.packages[id];
    this._write();
    logger.info(`Package-Registry Eintrag entfernt: ${id}`);
    return result;
  }

  setEnabled(id, enabled) {
    if (!this.has(id)) return null;

    const entry = this._data.packages[id];
    entry.enabled = !!enabled;
    entry.updatedAt = Date.now();
    this._write();

    return this.get(id);
  }

  types() {
    return Object.keys(this._data.packages)
      .map((id) => this._data.packages[id].type)
      .filter((type) => type !== null);
  }

  byType(type) {
    const result = [];
    for (const entry of Object.values(this._data.packages)) {
      if (entry.type === type) {
        result.push({
          id: entry.id,
          type: entry.type,
          version: entry.version,
          enabled: !!entry.enabled,
          path: entry.path,
          source: entry.source,
          installedAt: entry.installedAt,
          updatedAt: entry.updatedAt
        });
      }
    }
    return result;
  }

  packageDataPath() {
    return this.packageDataPath;
  }

  registryFile() {
    return this.registryFile;
  }
}

class FilesPolicy {
  static userPackageBaseDir() {
    const registry = new PackageRegistry();
    return registry.packageDataPath();
  }

  static isWithinUserPackageDataDir(targetPath, baseDir) {
    if (typeof targetPath !== "string" || typeof baseDir !== "string") {
      return false;
    }
    const resolvedTarget = path.resolve(targetPath);
    const resolvedBase = path.resolve(baseDir);

    if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
      return false;
    }

    if (resolvedTarget.includes(path.sep + ".." + path.sep) || resolvedTarget.endsWith(path.sep + "..")) {
      return false;
    }

    return true;
  }

  static isAppPackagePath(targetPath) {
    if (typeof targetPath !== "string") {
      return false;
    }
    const resolved = path.resolve(targetPath);
    if (!resolved.startsWith(app.getAppPath() || process.cwd())) {
      return false;
    }
    if (resolved.includes(path.sep + ".." + path.sep) || resolved.endsWith(path.sep + "..")) {
      return false;
    }
    return true;
  }
}

module.exports = {
  PackageRegistry,
  FilesPolicy,
  PACKAGE_DATA_SUBDIR,
  REGISTRY_FILENAME,
  REGISTRY_VERSION
};
