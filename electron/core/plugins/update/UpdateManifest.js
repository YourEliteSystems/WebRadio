"use strict";

/**
 * UpdateManifest
 *
 * Schema-Version 1 des Plugin-Update-Manifests sowie die zugehörige strenge
 * Validierung. Grundsätze:
 *
 *  - Unbekannte Felder werden abgelehnt, damit keine Daten durch das Manifest
 *    geschmuggelt werden (Schemaänderungen erfordern `schemaVersion: 2`).
 *  - Die Plugin-ID ist unveränderlich und muss zur installierten Version passen.
 *  - Jede Zeichenkette hat ein Größenlimit; Zahlen müssen endlich und im
 *    erlaubten Bereich liegen.
 *  - Berechtigungsänderungen werden als Differenz ausgewiesen, nicht still
 *    übernommen.
 */

const semver = require("./PluginSemver");
const PluginPermissions = require("../PluginPermissions");
const CapabilityRegistry = require("../CapabilityRegistry");

const SCHEMA_VERSION = 1;
const MAX_PACKAGE_BYTES = 64 * 1024 * 1024;
const MAX_CHANGELOG_LENGTH = 8000;
const ALLOWED_CHANNELS = ["stable", "beta", "alpha"];
const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const KEY_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const ORIGIN_PATTERN = /^https:\/\/[a-z0-9.-]+(?::\d{1,5})?$/;

const ALLOWED_FIELDS = new Set([
  "schemaVersion",
  "pluginId",
  "version",
  "channel",
  "engines",
  "release",
  "changelog",
  "dependencies",
  "permissions",
  "capabilities",
  "webSessionOrigins",
  "signature"
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value) {
  if (typeof value !== "string" || value.length > 40) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && value.includes("T");
}

function isStringArray(value, maxItems, maxLength) {
  return Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => typeof item === "string" && item.length > 0 && item.length <= maxLength);
}

/**
 * Prüft eine HTTPS-Origin ohne Pfad, Query, Fragment, Wildcard oder
 * Zugangsdaten. Bewusst lokal implementiert, damit die Validierung ohne
 * Electron-Kontext (und damit in Tests) nutzbar bleibt.
 */
function isExactHttpsOrigin(value) {
  if (typeof value !== "string" || value.length > 255 || value !== value.trim()) return false;
  if (!ORIGIN_PATTERN.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname === "/" &&
      !parsed.search &&
      !parsed.hash &&
      !parsed.hostname.includes("*") &&
      !parsed.hostname.includes("_");
  } catch {
    return false;
  }
}

function error(code, field, message) {
  return { code, field, message };
}

/**
 * Validiert ein Update-Manifest.
 *
 * @param {unknown} manifest
 * @param {Object} [options]
 * @param {Object} [options.installedManifest] Manifest der installierten Version
 * @returns {{valid:boolean, errors:Array, data:Object|null}}
 */
function validate(manifest, options = {}) {
  const errors = [];

  if (!isPlainObject(manifest)) {
    return { valid: false, errors: [error("manifest_not_an_object", "", "Manifest ist kein JSON-Objekt.")], data: null };
  }

  for (const key of Object.keys(manifest)) {
    if (!ALLOWED_FIELDS.has(key)) {
      errors.push(error("unknown_field", key, `Unbekanntes Feld: ${key}`));
    }
  }

  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    errors.push(error("unsupported_schema", "schemaVersion", `schemaVersion muss ${SCHEMA_VERSION} sein.`));
  }

  const pluginId = manifest.pluginId;
  if (typeof pluginId !== "string" || !PLUGIN_ID_PATTERN.test(pluginId)) {
    errors.push(error("invalid_plugin_id", "pluginId", "pluginId ist ungültig."));
  } else if (options.installedManifest && options.installedManifest.id !== pluginId) {
    errors.push(error(
      "plugin_id_mismatch",
      "pluginId",
      `Plugin-ID darf nicht geändert werden (installiert: ${options.installedManifest.id}).`
    ));
  }

  if (!semver.isValid(manifest.version)) {
    errors.push(error("invalid_version", "version", "version ist kein gültiges Semver."));
  }

  if (!ALLOWED_CHANNELS.includes(manifest.channel)) {
    errors.push(error("unknown_channel", "channel", `Unbekannter Update-Kanal: ${String(manifest.channel)}`));
  }

  if (!isPlainObject(manifest.engines) || typeof manifest.engines.webradio !== "string") {
    errors.push(error("missing_engine_range", "engines.webradio", "engines.webradio fehlt."));
  } else if (!semver.isValidRange(manifest.engines.webradio)) {
    errors.push(error("invalid_engine_range", "engines.webradio", "engines.webradio ist kein gültiger Bereich."));
  }

  const release = manifest.release;
  if (!isPlainObject(release)) {
    errors.push(error("missing_release", "release", "release fehlt."));
  } else {
    if (typeof release.downloadUrl !== "string" || release.downloadUrl.length > 2048) {
      errors.push(error("invalid_download_url", "release.downloadUrl", "downloadUrl ist ungültig."));
    }
    if (typeof release.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(release.sha256)) {
      errors.push(error("invalid_sha256", "release.sha256", "sha256 muss ein 64-stelliger Hex-Wert sein."));
    }
    if (!Number.isInteger(release.size) || release.size <= 0 || release.size > MAX_PACKAGE_BYTES) {
      errors.push(error("invalid_size", "release.size", "size ist ungültig oder zu groß."));
    }
    if (!isIsoDate(release.releasedAt)) {
      errors.push(error("invalid_release_date", "release.releasedAt", "releasedAt ist kein ISO-Zeitstempel."));
    }
    for (const key of Object.keys(release)) {
      if (!["downloadUrl", "sha256", "size", "releasedAt"].includes(key)) {
        errors.push(error("unknown_field", `release.${key}`, `Unbekanntes Feld: release.${key}`));
      }
    }
  }

  if (manifest.changelog !== undefined &&
      (typeof manifest.changelog !== "string" || manifest.changelog.length > MAX_CHANGELOG_LENGTH)) {
    errors.push(error("invalid_changelog", "changelog", "changelog ist zu lang oder kein Text."));
  }

  if (manifest.dependencies !== undefined) {
    if (!Array.isArray(manifest.dependencies) || manifest.dependencies.length > 32) {
      errors.push(error("invalid_dependencies", "dependencies", "dependencies muss eine Liste sein."));
    } else {
      const seen = new Set();
      manifest.dependencies.forEach((dependency, index) => {
        const field = `dependencies[${index}]`;
        if (!isPlainObject(dependency)) {
          errors.push(error("invalid_dependency", field, "Abhängigkeit ist kein Objekt."));
          return;
        }
        for (const key of Object.keys(dependency)) {
          if (!["id", "range", "optional"].includes(key)) {
            errors.push(error("unknown_field", `${field}.${key}`, `Unbekanntes Feld: ${field}.${key}`));
          }
        }
        if (typeof dependency.id !== "string" || !PLUGIN_ID_PATTERN.test(dependency.id)) {
          errors.push(error("invalid_dependency_id", `${field}.id`, "Abhängigkeits-ID ist ungültig."));
        } else if (seen.has(dependency.id)) {
          errors.push(error("duplicate_dependency", `${field}.id`, `Doppelte Abhängigkeit: ${dependency.id}`));
        } else {
          seen.add(dependency.id);
        }
        if (dependency.id === pluginId) {
          errors.push(error("self_dependency", `${field}.id`, "Ein Plugin darf nicht von sich selbst abhängen."));
        }
        if (!semver.isValidRange(dependency.range)) {
          errors.push(error("invalid_dependency_range", `${field}.range`, "Versionsbereich ist ungültig."));
        }
        if (dependency.optional !== undefined && typeof dependency.optional !== "boolean") {
          errors.push(error("invalid_dependency_flag", `${field}.optional`, "optional muss ein Boolean sein."));
        }
      });
    }
  }

  if (manifest.permissions !== undefined) {
    if (!isStringArray(manifest.permissions, 32, 64)) {
      errors.push(error("invalid_permissions", "permissions", "permissions muss eine Liste von Zeichenketten sein."));
    } else {
      for (const permission of manifest.permissions) {
        if (!PluginPermissions.VALID_PERMISSIONS.includes(permission) && permission !== "*") {
          errors.push(error("unknown_permission", "permissions", `Unbekannte Berechtigung: ${permission}`));
        }
      }
      if (new Set(manifest.permissions).size !== manifest.permissions.length) {
        errors.push(error("duplicate_permission", "permissions", "permissions enthält Duplikate."));
      }
    }
  }

  if (manifest.capabilities !== undefined) {
    if (!isStringArray(manifest.capabilities, 32, 64)) {
      errors.push(error("invalid_capabilities", "capabilities", "capabilities muss eine Liste von Zeichenketten sein."));
    } else {
      for (const capability of manifest.capabilities) {
        if (!CapabilityRegistry.isKnown(capability)) {
          errors.push(error("unknown_capability", "capabilities", `Unbekannte Capability: ${capability}`));
        }
      }
    }
  }

  if (manifest.webSessionOrigins !== undefined) {
    if (!isStringArray(manifest.webSessionOrigins, 32, 255)) {
      errors.push(error("invalid_web_origins", "webSessionOrigins", "webSessionOrigins ist ungültig."));
    } else {
      for (const origin of manifest.webSessionOrigins) {
        if (!isExactHttpsOrigin(origin)) {
          errors.push(error("invalid_web_origin", "webSessionOrigins", `Ungültige Origin: ${origin}`));
        }
      }
    }
  }

  if (manifest.signature !== undefined) {
    const signature = manifest.signature;
    if (!isPlainObject(signature)) {
      errors.push(error("invalid_signature", "signature", "signature ist kein Objekt."));
    } else {
      for (const key of Object.keys(signature)) {
        if (!["algorithm", "keyId", "value"].includes(key)) {
          errors.push(error("unknown_field", `signature.${key}`, `Unbekanntes Feld: signature.${key}`));
        }
      }
      if (signature.algorithm !== "ed25519") {
        errors.push(error("unsupported_signature", "signature.algorithm", "Nur ed25519 wird unterstützt."));
      }
      if (typeof signature.keyId !== "string" || !KEY_ID_PATTERN.test(signature.keyId)) {
        errors.push(error("invalid_key_id", "signature.keyId", "keyId ist ungültig."));
      }
      if (typeof signature.value !== "string" || !/^[A-Za-z0-9+/=]{20,200}$/.test(signature.value)) {
        errors.push(error("invalid_signature_value", "signature.value", "Signaturwert ist ungültig."));
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? manifest : null
  };
}

/**
 * Berechnet die Berechtigungsdifferenz zwischen installierter und neuer
 * Version. Zusätzliche Rechte müssen vom Benutzer ausdrücklich bestätigt
 * werden; entfernte Rechte werden nur informativ gemeldet.
 */
function diffPermissions(installedManifest = {}, nextManifest = {}) {
  const before = new Set(
    Array.isArray(installedManifest.permissions) ? installedManifest.permissions : []
  );
  const after = new Set(
    Array.isArray(nextManifest.permissions) ? nextManifest.permissions : []
  );
  const added = [...after].filter((permission) => !before.has(permission));
  const removed = [...before].filter((permission) => !after.has(permission));
  const beforeCapabilities = new Set(
    Array.isArray(installedManifest.capabilities) ? installedManifest.capabilities : []
  );
  const afterCapabilities = new Set(
    Array.isArray(nextManifest.capabilities) ? nextManifest.capabilities : []
  );
  return {
    added,
    removed,
    addedCapabilities: [...afterCapabilities].filter((capability) => !beforeCapabilities.has(capability)),
    removedCapabilities: [...beforeCapabilities].filter((capability) => !afterCapabilities.has(capability)),
    changed: added.length > 0 || removed.length > 0 ||
      beforeCapabilities.size !== afterCapabilities.size ||
      [...afterCapabilities].some((capability) => !beforeCapabilities.has(capability))
  };
}

module.exports = {
  SCHEMA_VERSION,
  MAX_PACKAGE_BYTES,
  MAX_CHANGELOG_LENGTH,
  ALLOWED_CHANNELS,
  validate,
  diffPermissions,
  isExactHttpsOrigin
};
