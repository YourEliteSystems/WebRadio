"use strict";

const fs = require("fs");
const path = require("path");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("LocalSource");

class PackageSource {
  constructor() {
    if (this.constructor === PackageSource) {
      throw new TypeError("PackageSource is abstract");
    }
  }

  async resolvePackageCandidates(request, context) {
    throw new NotImplementedError();
  }

  async fetchPackageContent(candidate, context) {
    throw new NotImplementedError();
  }

  type() {
    return null;
  }

  description() {
    return this.constructor.name;
  }
}

class NotImplementedError extends Error {
  constructor() {
    super("Not implemented by this source");
    this.name = "NotImplementedError";
  }
}

class LocalSource extends PackageSource {
  constructor(options = {}) {
    super();
    this.allowedBaseDirs = [];
    const opts = options || {};
    if (Array.isArray(opts.allowedBaseDirs)) {
      this.allowedBaseDirs = opts.allowedBaseDirs.map((d) => path.resolve(d)).filter((d) => fs.existsSync(d));
    }
  }

  async resolvePackageCandidates(request, context) {
    const result = [];

    const candidates = request.paths || [];
    const type = request.type || null;

    for (const candidatePath of candidates) {
      const resolved = path.resolve(candidatePath);
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
        continue;
      }

      if (!this._isAllowed(resolved)) {
        logger.warn(`LocalSource ignoriert nicht erlaubten Pfad: ${resolved}`);
        continue;
      }

      result.push({
        source: this.description(),
        type: "directory",
        path: resolved,
        requestedType: type
      });
    }

    return result;
  }

  async fetchPackageContent(candidate, context) {
    if (!candidate || candidate.type !== "directory") {
      return null;
    }

    const resolved = path.resolve(candidate.path);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return null;
    }

    return {
      source: candidate.source,
      type: "directory",
      path: resolved,
      requestedType: candidate.requestedType
    };
  }

  _isAllowed(targetPath) {
    if (this.allowedBaseDirs.length === 0) {
      return true;
    }

    const resolved = path.resolve(targetPath);
    for (const base of this.allowedBaseDirs) {
      if (resolved.startsWith(base + path.sep) || resolved === base) {
        return true;
      }
    }

    return false;
  }

  allowedBaseDirs() {
    return [...this.allowedBaseDirs];
  }

  addAllowedBaseDir(dir) {
    const resolved = path.resolve(dir);
    if (!fs.existsSync(resolved)) {
      return false;
    }
    if (!this.allowedBaseDirs.includes(resolved)) {
      this.allowedBaseDirs.push(resolved);
    }
    return true;
  }

  description() {
    return "local";
  }
}

class GitHubSource extends PackageSource {
  constructor() {
    super();
  }

  type() {
    return "github";
  }

  description() {
    return "github";
  }
}

class HTTPSource extends PackageSource {
  constructor() {
    super();
  }

  type() {
    return "http";
  }

  description() {
    return "http";
  }
}

class StoreSource extends PackageSource {
  constructor() {
    super();
  }

  type() {
    return "store";
  }

  description() {
    return "store";
  }
}

module.exports = {
  PackageSource,
  LocalSource,
  GitHubSource,
  HTTPSource,
  StoreSource,
  NotImplementedError
};
