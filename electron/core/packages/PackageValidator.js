"use strict";

const fs = require("fs");
const path = require("path");
const PluginPermissions = require("../plugins/PluginPermissions");
const CapabilityRegistry = require("../plugins/CapabilityRegistry");
const LogManager = require("../diagnostics/logging/LogManager");
const {
  PACKAGE_TYPES,
  isValidId,
  normalizeName,
  normalizeVersion,
  normalizeType,
  validateCapabilityRequest
} = require("./PackageModel");

const logger = LogManager.getLogger("PackageValidator");

const FORBIDDEN_ABSOLUTE_PATH_PATTERNS = [
  /^[A-Za-z]:\\/,
  /^\//,
  /\\\.\.\\/,
  /\/\.\.\//
];

const FORBIDDEN_FILENAME_CHARS_REGEX = /[<>:"/\\|?*]/;

function containsPathTraversal(relativePath) {
  if (typeof relativePath !== "string") return false;
  if (!/^[\w.\-/\\]+$/.test(relativePath)) return true;
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith("../") || normalized.includes("/../") || normalized.endsWith("/..")) {
    return true;
  }
  return false;
}

function isAbsolutePathSuspicious(filePath) {
  if (typeof filePath !== "string") return false;
  for (const pattern of FORBIDDEN_ABSOLUTE_PATH_PATTERNS) {
    if (pattern.test(filePath)) return true;
  }
  return false;
}

function validateSecurityConstraints(data, type) {
  const errors = [];

  const manifestPath = data.manifestSource ? String(data.manifestSource) : "";
  if (containsPathTraversal(manifestPath)) {
    errors.push("manifest source contains path traversal artefacts");
  }

  if (data.main) {
    if (containsPathTraversal(data.main)) {
      errors.push("plugin main path contains traversal artefacts");
    }
    if (isAbsolutePathSuspicious(data.main)) {
      errors.push("plugin main path must be relative");
    }
  }

  if (data.renderer) {
    if (containsPathTraversal(data.renderer)) {
      errors.push("plugin renderer path contains traversal artefacts");
    }
    if (isAbsolutePathSuspicious(data.renderer)) {
      errors.push("plugin renderer path must be relative");
    }
  }

  if (data.css) {
    if (containsPathTraversal(data.css)) {
      errors.push("theme css path contains traversal artefacts");
    }
    if (isAbsolutePathSuspicious(data.css)) {
      errors.push("theme css path must be relative");
    }
  }

  if (data.permissions) {
    const allowed = PluginPermissions.validatePermissions(data.permissions);
    const denied = data.permissions.filter((p) => !allowed.includes(p));
    if (denied.length > 0) {
      errors.push(`unknown permissions: ${denied.join(", ")}`);
    }
  }

  if (data.capabilities) {
    const capabilityResult = validateCapabilityRequest(data.capabilities, data.permissions || []);
    if (!capabilityResult.valid && capabilityResult.denied.length > 0) {
      const reasons = capabilityResult.denied.map((d) => `${d.capability}: ${d.reason}`).join("; ");
      errors.push(`unacceptable capabilities: ${reasons}`);
    }
  }

  return errors;
}

function validateGeneral(data) {
  const errors = [];

  if (!data || typeof data !== "object" || data === null) {
    errors.push("manifest must be a valid object");
    return { valid: false, errors };
  }

  if (isValidId(data.id) === false) {
    errors.push("invalid or missing id");
  }

  if (normalizeName(data.name) === null) {
    errors.push("invalid or missing name");
  }

  if (normalizeVersion(data.version) === null) {
    errors.push("invalid or missing version");
  }

  if (normalizeType(data.type) === null) {
    errors.push("invalid or missing type");
  }

  if (!PACKAGE_TYPES.plugin && !PACKAGE_TYPES.theme) {
    errors.push("unknown package type");
  }

  const securityErrors = validateSecurityConstraints(data, data.type);
  if (securityErrors.length > 0) {
    errors.push(...securityErrors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validatePlugin(data) {
  const errors = [];

  const general = validateGeneral(data);
  if (general.errors.length > 0) {
    return general;
  }

  if (data.type !== PACKAGE_TYPES.plugin) {
    errors.push("type must be plugin for plugin validation");
    return { valid: false, errors };
  }

  if (typeof data.main !== "string" || data.main.trim().length === 0) {
    errors.push("plugin main file is missing or invalid");
  }

  const main = data.main.trim();
  if (!/.+\.js$/.test(main)) {
    errors.push("plugin main file must be a .js file");
  }

  if (data.renderer !== null && typeof data.renderer !== "string") {
    errors.push("plugin renderer must be a string if present");
  }

  if (data.capabilities) {
    const capabilityResult = validateCapabilityRequest(data.capabilities, data.permissions || []);
    if (!capabilityResult.valid) {
      const deniedText = capabilityResult.denied.map((d) => `${d.capability}: ${d.reason}`).join("; ");
      errors.push(`unacceptable capabilities: ${deniedText}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateTheme(data) {
  const errors = [];

  const general = validateGeneral(data);
  if (general.errors.length > 0) {
    return general;
  }

  if (data.type !== PACKAGE_TYPES.theme) {
    errors.push("type must be theme for theme validation");
    return { valid: false, errors };
  }

  if (typeof data.css !== "string" || data.css.trim().length === 0) {
    errors.push("theme css file is missing or invalid");
  }

  const css = data.css.trim();
  if (!/.+\.css$/.test(css)) {
    errors.push("theme css file must be a .css file");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validate(data, type) {
  if (type === PACKAGE_TYPES.plugin) {
    return validatePlugin(data);
  }
  if (type === PACKAGE_TYPES.theme) {
    return validateTheme(data);
  }
  return validateGeneral(data);
}

module.exports = {
  validate,
  validateGeneral,
  validatePlugin,
  validateTheme,
  containsPathTraversal,
  isAbsolutePathSuspicious
};
