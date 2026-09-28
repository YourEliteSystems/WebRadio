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

/**
 * Validates plugin permissions against the known valid permissions list.
 * @param {string[]} permissions
 * @returns {string[]}
 */
function validatePermissions(permissions = []) {
    if (!Array.isArray(permissions)) {
        return [];
    }
    return permissions.filter((p) => VALID_PERMISSIONS.includes(p) || p === "*");
}

/**
 * Direkt gewährte Plugin-Permissions (keine abgeleiteten Capabilities).
 * Nur solche, die tatsächlich im Manifest angegeben wurden und gültig sind.
 */
function pluginsPermissions(permissions = []) {
    if (!Array.isArray(permissions)) {
        return [];
    }
    return permissions.filter((p) => VALID_PERMISSIONS.includes(p) || p === "*");
}

/**
 * Prüft, ob ein Plugin eine normale Plugin-Permission besitzt.
 * `external-origin` wird NICHT als normale Permission behandelt.
 */
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
 * Löst die vollständige Capability-Suite einer Anforderung auf.
 *
 * Die Capabilities bilden die dokumentierte, aufeinander aufbauende Kette:
 *
 *   http-origin -> external-origin -> youtube-iframe -> youtube-api
 *
 * Eine Capability ist keine gewöhnliche, unabhängige Permission. Sie wird nur
 * dann gewährt, wenn ALLE Voraussetzungen erfüllt sind:
 *   - `requiresPermission`  (Capability -> echte Plugin-Permission)
 *   - `requiresCapability`  (Capability -> vorausgehende Capability)
 *
 * Voraussetzungs-Capabilities werden implizit mitsamt der angeforderten
 * Capability aufgelöst und nachvollziehbar in `granted` gemeldet. Fehlende
 * Voraussetzungen werden nicht stillschweigend übersprungen, sondern führen
 * zu einer Ablehnung (`denied` + `reasons`). Unbekannte Capabilities werden
 * weiterhin sicher abgelehnt.
 *
 * @param {string[]} requestedCapabilities  Angeforderte Capabilities
 * @param {string[]} grantedPermissions     Gewährte Plugin-Permissions
 * @returns {{ granted: string[], denied: string[], valid: boolean, reasons: Object }}
 */
function resolveCapabilities(requestedCapabilities = [], grantedPermissions = []) {
    const requested = Array.isArray(requestedCapabilities)
        ? requestedCapabilities.filter((cap) => typeof cap === "string" && cap.trim() !== "")
        : [];
    const permissions = Array.isArray(grantedPermissions)
        ? grantedPermissions.filter((perm) => typeof perm === "string" && perm.trim() !== "")
        : [];

    const permissionSet = new Set(permissions);
    const grantAllPermissions = permissionSet.has("*");

    const granted = [];
    const denied = [];
    const reasons = {};
    const grantedSet = new Set();

    // 1) Angeforderte Capabilities klassifizieren: unbekannt -> sofort ablehnen.
    const knownRequested = [];
    for (const capId of requested) {
        if (grantedSet.has(capId) || denied.includes(capId) || knownRequested.includes(capId)) continue;
        if (!CapabilityRegistry.isKnown(capId)) {
            denied.push(capId);
            reasons[capId] = `Unknown capability: ${capId}`;
            continue;
        }
        knownRequested.push(capId);
    }

    // 2) Benötigte Menge bilden: angeforderte Capabilities plus ihre
    //    vollständige Abhängigkeitskette (Basis-Capabilities zuerst).
    const required = [];
    const requiredSet = new Set();
    for (const capId of knownRequested) {
        for (const chainId of CapabilityRegistry.getDependencyChain(capId)) {
            if (requiredSet.has(chainId)) continue;
            requiredSet.add(chainId);
            required.push(chainId);
        }
    }

    // 3) Kette in Abhängigkeitsreihenfolge auflösen.
    for (const capId of required) {
        const prereq = CapabilityRegistry.getPrerequisites(capId) || {};
        const permission = prereq.permission;
        const capability = prereq.capability;

        if (permission && !grantAllPermissions && !permissionSet.has(permission)) {
            denied.push(capId);
            reasons[capId] = `Missing permission: ${permission}`;
            continue;
        }

        if (capability && !grantedSet.has(capability)) {
            denied.push(capId);
            reasons[capId] = `Missing prerequisite capability: ${capability}`;
            continue;
        }

        grantedSet.add(capId);
        granted.push(capId);
    }

    return {
        granted,
        denied,
        valid: denied.length === 0,
        reasons
    };
}

/**
 * Ermittelt, ob ein Plugin die lokale Plugin-HTTP-Umgebung benötigt.
 *
 * `http-origin` ist laut Dokumentation eine Capability (Basis der Kette).
 * Vorbereitete Manifeste deklarieren sie zusätzlich als Permission
 * (`permissions: ["player", "http-origin"]`). Beide Deklarationsarten
 * werden berücksichtigt, damit die Core-Implementierung ohne
 * Manifest-Umschreibung zum Plugin passt.
 *
 * Es gibt keine Sonderbehandlung für einzelne Plugins: die Entscheidung
 * basiert ausschließlich auf den deklarierten Permissions/Capabilities.
 *
 * @param {Object} manifest  Plugin-Manifest
 * @returns {boolean}
 */
function usesPluginHttpEnvironment(manifest = {}) {
    if (!manifest || typeof manifest !== "object") {
        return false;
    }

    // Legacy-/Kurzform: "http-origin": true als Manifest-Flag
    if (manifest["http-origin"]) {
        return true;
    }

    const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
    if (permissions.includes("*") || permissions.includes("http-origin")) {
        return true;
    }

    const requested = Array.isArray(manifest.capabilities) ? manifest.capabilities : [];
    if (requested.length === 0) {
        return false;
    }

    const resolved = resolveCapabilities(requested, permissions);
    return resolved.granted.includes("http-origin");
}

/**
 * Validiert angeforderte Capabilities gegen gewährte Plugin-Permissions.
 *
 * Delegiert an die zentrale, kettenbasierte Auflösung
 * (`resolveCapabilities`), damit Capabilities nie als normale,
 * voneinander unabhängige Permissions geprüft werden.
 *
 * @param {string[]} requestedCapabilities  Angeforderte Capabilities
 * @param {string[]} grantedPermissions     Gewährte Plugin-Permissions
 * @returns {{ granted: string[], denied: string[], valid: boolean, reasons: Object }}
 */
function validateCapabilities(requestedCapabilities = [], grantedPermissions = []) {
    return resolveCapabilities(requestedCapabilities, grantedPermissions);
}

/**
 * Löst die abhängige Capability-Suite für eine Anforderung auf.
 *
 * Historischer Name der zentralen Auflösung. Bleibt erhalten, damit
 * bestehende Aufrufer unverändert funktionieren; intern wird dieselbe,
 * kettenbasierte Implementierung genutzt.
 *
 * @param {string[]} requestedCapabilities  Angeforderte Capabilities
 * @param {string[]} grantedPermissions     Gewährte Plugin-Permissions
 * @returns {{ granted: string[], denied: string[], valid: boolean, reasons: Object }}
 */
function resolveDerivedCapabilities(requestedCapabilities = [], grantedPermissions = []) {
    return resolveCapabilities(requestedCapabilities, grantedPermissions);
}

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

module.exports = {
    VALID_PERMISSIONS,
    pluginsPermissions,
    validatePermissions,
    hasPermission,
    validateCapabilities,
    resolveCapabilities,
    resolveDerivedCapabilities,
    usesPluginHttpEnvironment,
    hasCapability,
    isOriginAllowed
};