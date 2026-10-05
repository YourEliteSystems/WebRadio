"use strict";

const fs = require("fs");
const path = require("path");
const LogManager = require("../diagnostics/logging/LogManager");
const {
  detectPackageType,
  readManifestWithInstall,
  createPackageFromDirectory,
  PACKAGE_TYPES,
  KNOWN_PACKAGE_TYPES
} = require("./PackageModel");

const logger = LogManager.getLogger("PackageDiscovery");

class PackageDiscovery {
  constructor() {
  }

  inspect(sourcePath) {
    if (typeof sourcePath !== "string" || sourcePath.trim().length === 0) {
      return {
        valid: false,
        error: "sourcePath must be a non-empty string"
      };
    }

    const resolved = path.resolve(sourcePath);
    if (!fs.existsSync(resolved)) {
      return {
        valid: false,
        error: "source path does not exist"
      };
    }

    if (!fs.statSync(resolved).isDirectory()) {
      return {
        valid: false,
        error: "source path must be a directory"
      };
    }

    const detected = detectPackageType(resolved);
    if (!detected) {
      return {
        valid: false,
        error: "unable to detect package type"
      };
    }

    const readWithInstall = readManifestWithInstall(resolved);
    if (!readWithInstall) {
      return {
        valid: false,
        error: "unable to read package manifest"
      };
    }

    const manifest = readWithInstall.manifest;
    if (!manifest || typeof manifest !== "object") {
      return {
        valid: false,
        error: "invalid manifest structure"
      };
    }

    return {
      valid: true,
      id: manifest.id || null,
      type: detected.type,
      version: manifest.version || null,
      name: manifest.name || null,
      manifestPath: path.join(resolved, readWithInstall.source),
      installManifestPath: readWithInstall.installManifest ? path.join(resolved, "install.json") : null,
      sourcePath: resolved,
      source: readWithInstall.source,
      hasInstallManifest: !!readWithInstall.installManifest
    };
  }

  detectType(sourcePath) {
    if (typeof sourcePath !== "string" || sourcePath.trim().length === 0) {
      return null;
    }

    const resolved = path.resolve(sourcePath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return null;
    }

    const detected = detectPackageType(resolved);
    if (!detected) {
      return null;
    }

    return {
      type: detected.type,
      source: detected.source,
      hasInstallManifest: !!detected.installManifest
    };
  }

  readInstallManifest(sourcePath) {
    if (typeof sourcePath !== "string" || sourcePath.trim().length === 0) {
      return null;
    }

    const resolved = path.resolve(sourcePath);
    const installJsonPath = path.join(resolved, "install.json");

    if (!fs.existsSync(installJsonPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(installJsonPath, "utf8");
      return JSON.parse(content);
    } catch (err) {
      logger.warn(`Failed to read install.json from ${resolved}: ${err.message}`);
      return null;
    }
  }

  readPackageManifest(sourcePath, type) {
    if (typeof sourcePath !== "string" || sourcePath.trim().length === 0) {
      return null;
    }

    const resolved = path.resolve(sourcePath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return null;
    }

    let resolvedType = type;
    if (!resolvedType || !KNOWN_PACKAGE_TYPES.includes(resolvedType)) {
      const detected = this.detectType(resolved);
      if (!detected) {
        return null;
      }
      resolvedType = detected.type;
    }

    const packageInfo = createPackageFromDirectory(resolved, resolvedType, {
      inferType: false,
      preferTypeFromDirectory: false
    });

    if (!packageInfo) {
      return null;
    }

    return {
      manifest: packageInfo.manifest,
      source: packageInfo.manifestSource,
      type: packageInfo.type,
      dir: packageInfo.dir,
      installManifest: packageInfo.installManifest
    };
  }
}

module.exports = new PackageDiscovery();
