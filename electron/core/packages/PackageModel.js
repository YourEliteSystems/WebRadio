"use strict";

const path = require("path");
const fs = require("fs");
const CapabilityRegistry = require("../plugins/CapabilityRegistry");
const PluginPermissions = require("../plugins/PluginPermissions");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("PackageModel");

const PACKAGE_TYPES = Object.freeze({
  plugin: "plugin",
  theme: "theme"
});

const KNOWN_PACKAGE_TYPES = Object.values(PACKAGE_TYPES);

const LEGACY_PLUGIN_MANIFEST_NAMES = ["plugin.json", "manifest.json"];
const LEGACY_THEME_MANIFEST_NAME = "theme.json";

const ID_REGEX = /^[a-z0-9-_]+$/i;

function isValidId(id) {
  if (typeof id !== "string" || id.trim().length === 0) {
    return false;
  }
  return ID_REGEX.test(id.trim());
}

function normalizeId(id) {
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  if (!isValidId(trimmed)) return null;
  return trimmed;
}

function normalizeName(name) {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

function normalizeVersion(version) {
  if (typeof version !== "string") return null;
  const trimmed = version.trim();
  if (!/^([1-9]\d*|0)(\.[1-9]\d*|\.0)*$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizeType(type) {
  if (typeof type !== "string") return null;
  const normalized = type.trim().toLowerCase();
  if (!KNOWN_PACKAGE_TYPES.includes(normalized)) return null;
  return normalized;
}

function readLocalJsonFile(filePath) {
  if (typeof filePath !== "string" || !fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readPluginManifest(pluginDir) {
  for (const name of LEGACY_PLUGIN_MANIFEST_NAMES) {
    const filePath = path.join(pluginDir, name);
    const manifest = readLocalJsonFile(filePath);
    if (manifest && typeof manifest === "object" && manifest !== null) {
      return { manifest, source: name };
    }
  }
  return null;
}

function readThemeManifest(themeDir) {
  const filePath = path.join(themeDir, LEGACY_THEME_MANIFEST_NAME);
  const manifest = readLocalJsonFile(filePath);
  if (manifest && typeof manifest === "object" && manifest !== null) {
    return { manifest, source: LEGACY_THEME_MANIFEST_NAME };
  }
  return null;
}

function normalizePluginManifest(manifest, dirName) {
  if (!manifest || typeof manifest !== "object" || manifest === null) {
    return null;
  }

  const id = normalizeId(manifest.id || manifest.ID);
  if (!id) return null;

  const name = normalizeName(manifest.name || manifest.Name || id);
  if (!name) return null;

  const version = normalizeVersion(manifest.version || manifest.Version || "1.0.0");
  if (!version) return null;

  const main = typeof manifest.main === "string" && manifest.main.trim().length > 0
    ? manifest.main.trim()
    : "main.js";

  const renderer = typeof manifest.renderer === "string" && manifest.renderer.trim().length > 0
    ? manifest.renderer.trim()
    : null;

  const permissions = Array.isArray(manifest.permissions)
    ? PluginPermissions.validatePermissions(manifest.permissions)
    : [];

  const capabilities = Array.isArray(manifest.capabilities)
    ? manifest.capabilities.filter((c) => typeof c === "string" && c.trim().length > 0).map((c) => c.trim())
    : [];

  const optionalFields = {
    author: typeof manifest.author === "string" ? manifest.author.trim() : "",
    description: typeof manifest.description === "string" ? manifest.description.trim() : "",
    homepage: typeof manifest.homepage === "string" ? manifest.homepage.trim() : "",
    license: typeof manifest.license === "string" ? manifest.license.trim() : "",
    keywords: Array.isArray(manifest.keywords) ? manifest.keywords.filter((k) => typeof k === "string") : [],
    engines: typeof manifest.engines === "object" && manifest.engines !== null
      ? manifest.engines
      : {}
  };

  return {
    id,
    name,
    version,
    type: PACKAGE_TYPES.plugin,
    main,
    renderer,
    permissions,
    capabilities,
    ...optionalFields
  };
}

function normalizeThemeManifest(manifest, dirName) {
  if (!manifest || typeof manifest !== "object" || manifest === null) {
    return null;
  }

  const id = normalizeId(manifest.id || manifest.ID || dirName);
  if (!id) return null;

  const name = normalizeName(manifest.name || manifest.Name || id);
  if (!name) return null;

  const version = normalizeVersion(manifest.version || manifest.Version || "1.0.0");
  if (!version) return null;

  const css = typeof manifest.css === "string" && manifest.css.trim().length > 0
    ? manifest.css.trim()
    : "style.css";

  const optionalFields = {
    author: typeof manifest.author === "string" ? manifest.author.trim() : "",
    description: typeof manifest.description === "string" ? manifest.description.trim() : "",
    preview: typeof manifest.preview === "string" ? manifest.preview.trim() : ""
  };

  return {
    id,
    name,
    version,
    type: PACKAGE_TYPES.theme,
    css,
    ...optionalFields
  };
}

function normalizeManifestFromDirectory(dirPath, type) {
  if (typeof dirPath !== "string" || !fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return null;
  }

  const dirName = path.basename(dirPath);

  if (type === PACKAGE_TYPES.plugin) {
    const read = readPluginManifest(dirPath);
    if (!read) return null;
    const normalized = normalizePluginManifest(read.manifest, dirName);
    if (!normalized) return null;
    return { manifest: normalized, source: read.source };
  }

  if (type === PACKAGE_TYPES.theme) {
    const read = readThemeManifest(dirPath);
    if (!read) return null;
    const normalized = normalizeThemeManifest(read.manifest, dirName);
    if (!normalized) return null;
    return { manifest: normalized, source: read.source };
  }

  return null;
}

function validateCapabilityRequest(requestedCapabilities, grantedPermissions) {
  const granted = [];
  const denied = [];

  if (!Array.isArray(requestedCapabilities)) {
    return { granted, denied, valid: true };
  }

  for (const capId of requestedCapabilities) {
    const result = CapabilityRegistry.canGrant(capId, grantedPermissions);
    if (result.granted) {
      granted.push(capId);
    } else {
      denied.push({ capability: capId, reason: result.reason });
    }
  }

  return {
    granted,
    denied,
    valid: denied.length === 0
  };
}

function createPackageFromDirectory(dirPath, type, options = {}) {
  const opt = {
    inferType: false,
    preferTypeFromDirectory: false,
    ...options
  };

  let resolvedType = type;
  if (!resolvedType && opt.inferType) {
    const pluginRead = readPluginManifest(dirPath);
    const themeRead = readThemeManifest(dirPath);
    if (pluginRead && !themeRead) resolvedType = PACKAGE_TYPES.plugin;
    else if (themeRead && !pluginRead) resolvedType = PACKAGE_TYPES.theme;
  }

  if (!resolvedType || !KNOWN_PACKAGE_TYPES.includes(resolvedType)) {
    return null;
  }

  const normalized = normalizeManifestFromDirectory(dirPath, resolvedType);
  if (!normalized) return null;

  return {
    type: resolvedType,
    dir: dirPath,
    manifest: normalized.manifest,
    manifestSource: normalized.source
  };
}

module.exports = {
  PACKAGE_TYPES,
  KNOWN_PACKAGE_TYPES,
  LEGACY_PLUGIN_MANIFEST_NAMES,
  LEGACY_THEME_MANIFEST_NAME,
  isValidId,
  normalizeId,
  normalizeName,
  normalizeVersion,
  normalizeType,
  readPluginManifest,
  readThemeManifest,
  normalizePluginManifest,
  normalizeThemeManifest,
  normalizeManifestFromDirectory,
  validateCapabilityRequest,
  createPackageFromDirectory
};
