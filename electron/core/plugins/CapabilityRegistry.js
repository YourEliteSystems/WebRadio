"use strict";

/**
 * Capability Registry – Zentrale Registry für bekannte Capabilities.
 *
 * Capabilities definieren, was ein Plugin darf, und werden vom Core
 * validiert und gewährt. Plugins deklarieren nur Anforderungen.
 */

const LogManager = require("../diagnostics/logging/LogManager");
const logger = LogManager.getLogger("CapabilityRegistry");

// Capability-Definitionen
const CAPABILITIES = Object.freeze({
  "http-origin": {
    id: "http-origin",
    description: "Plugin darf eigene Ressourcen über lokalen HTTP-Server ausliefern",
    requiresPermission: null,
    security: { localhostOnly: true, allowedMethods: ["GET", "HEAD"], cors: "restricted" }
  },
  "local-assets": {
    id: "local-assets",
    description: "Plugin darf auf eigene Assets zugreifen",
    requiresPermission: "http-origin",
    security: { localhostOnly: true, pathRestriction: "plugin-root" }
  },
  "external-origin": {
    id: "external-origin",
    description: "Plugin darf bestimmte externe Origins anfordern",
    requiresPermission: "http-origin",
    security: { localhostOnly: false, requiresExplicitOrigins: true, allowedOrigins: [] }
  },
  "youtube-iframe": {
    id: "youtube-iframe",
    description: "Plugin darf YouTube IFrame API verwenden",
    requiresPermission: "external-origin",
    security: {
      localhostOnly: false,
      requiresExplicitOrigins: true,
      allowedOrigins: [
        "https://www.youtube.com",
        "https://www.youtube-nocookie.com",
        "https://s.ytimg.com",
        "https://i.ytimg.com"
      ]
    }
  },
  "youtube-api": {
    id: "youtube-api",
    description: "Plugin darf YouTube IFrame API (erweitert) verwenden",
    requiresPermission: "youtube-iframe",
    security: {
      localhostOnly: false,
      requiresExplicitOrigins: true,
      allowedOrigins: [
        "https://www.youtube.com",
        "https://www.youtube-nocookie.com",
        "https://s.ytimg.com",
        "https://i.ytimg.com"
      ]
    }
  },
  "player": {
    id: "player",
    description: "Plugin darf Unified Player API verwenden",
    requiresPermission: null,
    security: { localhostOnly: true, accessLevel: "plugin" }
  }
});

function isKnown(capabilityId) {
  return capabilityId in CAPABILITIES;
}

function getDefinition(capabilityId) {
  return CAPABILITIES[capabilityId] || null;
}

function canGrant(capabilityId, grantedPermissions = []) {
  if (!isKnown(capabilityId)) {
    logger.warn(`Capability unbekannt: ${capabilityId}`);
    return { granted: false, reason: `Unknown capability: ${capabilityId}` };
  }
  const def = getDefinition(capabilityId);
  if (def.requiresPermission) {
    if (!grantedPermissions.includes(def.requiresPermission)) {
      logger.warn(`Capability ${capabilityId} benötigt Permission ${def.requiresPermission}`);
      return { granted: false, reason: `Missing permission: ${def.requiresPermission}` };
    }
  }
  return { granted: true };
}

function isOriginAllowedForCapability(capabilityId, origin) {
  if (!isKnown(capabilityId)) {
    return { allowed: false, reason: "Unknown capability" };
  }
  const def = getDefinition(capabilityId);
  if (!def.security?.requiresExplicitOrigins) {
    if (def.security?.localhostOnly) {
      return { allowed: false, reason: "Capability is localhost-only" };
    }
    return { allowed: true };
  }
  const allowedOrigins = def.security?.allowedOrigins || [];
  const normalizedOrigin = origin.replace(/\/+$/, "").toLowerCase();
  for (const allowed of allowedOrigins) {
    const normalizedAllowed = allowed.replace(/\/+$/, "").toLowerCase();
    if (normalizedOrigin === normalizedAllowed) {
      return { allowed: true };
    }
    if (normalizedOrigin.endsWith("." + normalizedAllowed)) {
      return { allowed: true };
    }
  }
  logger.debug(`Origin nicht erlaubt für Capability ${capabilityId}: ${origin}`);
  return { allowed: false, reason: `Origin not allowed for capability` };
}

function getAllCapabilityIds() {
  return Object.keys(CAPABILITIES);
}

function isProtected(capabilityId) {
  if (!isKnown(capabilityId)) return false;
  const protectedIds = ["http-origin", "player"];
  return protectedIds.includes(capabilityId);
}

module.exports = {
  CAPABILITIES,
  isKnown,
  getDefinition,
  canGrant,
  isOriginAllowedForCapability,
  getAllCapabilityIds,
  isProtected
};