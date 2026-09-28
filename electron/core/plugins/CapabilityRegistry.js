"use strict";

/**
 * Capability Registry – Zentrale Registry für bekannte Capabilities.
 *
 * Capabilities definieren, was ein Plugin darf, und werden vom Core
 * validiert und gewährt. Plugins deklarieren nur Anforderungen.
 *
 * Capabilities bilden eine Abhängigkeitskette (siehe
 * `docs/plugin-sdk/13-Capabilities.md`):
 *
 *   http-origin -> external-origin -> youtube-iframe -> youtube-api
 *
 * Abhängigkeiten werden deshalb explizit über `requiresCapability`
 * (Capability → Capability) bzw. `requiresPermission`
 * (Capability → Plugin-Permission) beschrieben. Eine Capability darf
 * nicht als normale Plugin-Permission behandelt werden.
 */

const LogManager = require("../diagnostics/logging/LogManager");
const logger = LogManager.getLogger("CapabilityRegistry");

// Capability-Definitionen
const CAPABILITIES = Object.freeze({
  "http-origin": {
    id: "http-origin",
    description: "Plugin darf eigene Ressourcen über lokalen HTTP-Server ausliefern",
    requiresPermission: null,
    requiresCapability: null,
    security: { localhostOnly: true, allowedMethods: ["GET", "HEAD"], cors: "restricted" }
  },
  "local-assets": {
    id: "local-assets",
    description: "Plugin darf auf eigene Assets zugreifen",
    requiresPermission: null,
    requiresCapability: "http-origin",
    security: { localhostOnly: true, pathRestriction: "plugin-root" }
  },
  "external-origin": {
    id: "external-origin",
    description: "Plugin darf bestimmte externe Origins anfordern",
    requiresPermission: null,
    requiresCapability: "http-origin",
    security: { localhostOnly: false, requiresExplicitOrigins: true, allowedOrigins: [] }
  },
  "youtube-iframe": {
    id: "youtube-iframe",
    description: "Plugin darf YouTube IFrame API verwenden",
    requiresPermission: null,
    requiresCapability: "external-origin",
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
    requiresPermission: null,
    requiresCapability: "youtube-iframe",
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
    requiresCapability: null,
    security: { localhostOnly: true, accessLevel: "plugin" }
  }
});

function isKnown(capabilityId) {
  return typeof capabilityId === "string" && Object.prototype.hasOwnProperty.call(CAPABILITIES, capabilityId);
}

function getDefinition(capabilityId) {
  return isKnown(capabilityId) ? CAPABILITIES[capabilityId] : null;
}

/**
 * Liefert die direkten Voraussetzungen einer Capability.
 * @param {string} capabilityId
 * @returns {{ permission: string|null, capability: string|null }|null}
 */
function getPrerequisites(capabilityId) {
  const def = getDefinition(capabilityId);
  if (!def) return null;
  return {
    permission: def.requiresPermission || null,
    capability: def.requiresCapability || null
  };
}

/**
 * Liefert die vollständige Abhängigkeitskette einer Capability,
 * Basis-Capability zuerst (z. B. für `youtube-api`:
 * `http-origin`, `external-origin`, `youtube-iframe`, `youtube-api`).
 * Zyklische Definitionen werden sicher abgebrochen.
 *
 * @param {string} capabilityId
 * @returns {string[]} Ketten-IDs (ohne unbekannte Capabilities)
 */
function getDependencyChain(capabilityId) {
  if (!isKnown(capabilityId)) return [];

  const chain = [];
  const seen = new Set();

  const visit = (id) => {
    if (seen.has(id) || !isKnown(id)) return;
    seen.add(id);
    const def = getDefinition(id);
    if (def.requiresCapability) visit(def.requiresCapability);
    chain.push(id);
  };

  visit(capabilityId);
  return chain;
}

/**
 * Prüft, ob eine Capability mit den gewährten Permissions überhaupt
 * gewährt werden darf. Berücksichtigt die vollständige Abhängigkeitskette,
 * damit fehlende Voraussetzungen nicht stillschweigend übersprungen werden.
 *
 * @param {string} capabilityId
 * @param {string[]} grantedPermissions  Gewährte Plugin-Permissions
 * @returns {{ granted: boolean, reason?: string }}
 */
function canGrant(capabilityId, grantedPermissions = []) {
  if (!isKnown(capabilityId)) {
    logger.warn(`Capability unbekannt: ${capabilityId}`);
    return { granted: false, reason: `Unknown capability: ${capabilityId}` };
  }

  const permissions = Array.isArray(grantedPermissions) ? grantedPermissions : [];
  const hasAllPermissions = permissions.includes("*");

  for (const chainId of getDependencyChain(capabilityId)) {
    const requiredPermission = getDefinition(chainId).requiresPermission;
    if (!requiredPermission) continue;
    if (!hasAllPermissions && !permissions.includes(requiredPermission)) {
      logger.warn(`Capability ${capabilityId} benötigt Permission ${requiredPermission} (über ${chainId})`);
      return { granted: false, reason: `Missing permission: ${requiredPermission}` };
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
  getPrerequisites,
  getDependencyChain,
  canGrant,
  isOriginAllowedForCapability,
  getAllCapabilityIds,
  isProtected
};