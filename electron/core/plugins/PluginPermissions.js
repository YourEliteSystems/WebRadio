"use strict";

const VALID_PERMISSIONS = [
    "events",
    "storage",
    "settings",
    "theme",
    "ui",
    "navigation",
    "navigation.register",
    "audio",
    "notifications",
    "network",
    "player"
];

const CapabilityRegistry = require("./CapabilityRegistry");

function validatePermissions(permissions = []) {
    return permissions.filter(p =>
        VALID_PERMISSIONS.includes(p) || p === "*"
    );
}

function hasPermission(permissions = [], permission) {
    if (!Array.isArray(permissions)) {
        return true;
    }
    if (permissions.includes("*")) {
        return true;
    }
    if (permissions.includes(permission)) {
        return true;
    }
    if (permission === "navigation" && (permissions.includes("navigation.register") || permissions.includes("ui"))) {
        return true;
    }
    if (permission === "navigation.register" && (permissions.includes("navigation") || permissions.includes("ui"))) {
        return true;
    }
    return false;
}

/**
 * Validiert Capabilities für ein Plugin.
 * Capabilities können nur gewährt werden, wenn:
 * 1. Sie bekannt sind
 * 2. Die erforderliche Basis-Permission vorhanden ist
 * 3. Sie nicht geschützt sind oder korrekt beantragt wurden
 *
 * @param {string[]} requestedCapabilities  capabilities aus dem Manifest
 * @param {string[]} grantedPermissions     permissions aus dem Manifest
 * @returns {{ granted: string[], denied: string[], valid: boolean }}
 */
function validateCapabilities(requestedCapabilities = [], grantedPermissions = []) {
    const granted = [];
    const denied = [];

    if (!Array.isArray(requestedCapabilities)) {
        return { granted: [], denied: [], valid: true };
    }

    for (const capId of requestedCapabilities) {
        const result = CapabilityRegistry.canGrant(capId, grantedPermissions);
        if (result.granted) {
            granted.push(capId);
        } else {
            denied.push(capId);
        }
    }

    return {
        granted,
        denied,
        valid: denied.length === 0
    };
}

/**
 * Prüft, ob ein Plugin eine bestimmte Capability hat.
 * @param {string[]} grantedCapabilities
 * @param {string} capabilityId
 * @returns {boolean}
 */
function hasCapability(grantedCapabilities = [], capabilityId) {
    if (!Array.isArray(grantedCapabilities)) {
        return false;
    }
    return grantedCapabilities.includes(capabilityId);
}

/**
 * Prüft, ob eine externe Origin für die Capabilities des Plugins erlaubt ist.
 * @param {string[]} grantedCapabilities
 * @param {string} origin
 * @returns {{ allowed: boolean, reason?: string }}
 */
function isOriginAllowed(grantedCapabilities = [], origin) {
    if (!origin) {
        return { allowed: true }; // Kein Origin = keine Einschränkung
    }

    // Prüfe jede Capability, ob sie den Origin erlaubt
    for (const capId of grantedCapabilities) {
        const result = CapabilityRegistry.isOriginAllowedForCapability(capId, origin);
        if (result.allowed) {
            return { allowed: true };
        }
    }

    // Keine Capability erlaubt den Origin
    return { allowed: false, reason: "No capability allows this origin" };
}

module.exports = {
    VALID_PERMISSIONS,
    validatePermissions,
    hasPermission,
    validateCapabilities,
    hasCapability,
    isOriginAllowed
};