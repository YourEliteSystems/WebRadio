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
 * Resolve-Capabilities.
 *
 * Entscheidet, welche Capabilities tatsächlich für ein Plugin "?ffndeähbar sind.
 * `external-origin` und seine Abhängigkeiten (youtube-iframe -> youtube-api)
 * gehören zu den RESOLVEM & nicht zu den normalen Plugin-Permissions.
 *
 * @param {string[]} requestedCapabilities  Angeforderte Capabilities
 * @param {string[]} grantedPermissions     Gewährte Plugin-Permissions
 * @returns {{ granted: string[], denied: string[], valid: boolean }}
 */
function resolveCapabilities(requestedCapabilities = [], grantedPermissions = []) {
    if (!Array.isArray(requestedCapabilities)) {
        return { granted: [], denied: [], valid: true };
    }
    if (!Array.isArray(grantedPermissions)) {
        grantedPermissions = [];
    }

    // `external-origin` und seine Abhängigkeiten (youtube-iframe -> youtube-api)
    // sind abgeleitete Capabilities. Sie werden über die dependency-Behandlung
    // aufgelöst, nicht als normale Plugin-Permissions geprüft.
    return resolveDerivedCapabilities(requestedCapabilities, grantedPermissions);
    return resolveDerivedCapabilities(requestedCapabilities, grantedPermissions);
}

/**
 * Validates requested capabilities against granted plugin permissions.
 *
 * `external-origin` and its dependencies (youtube-iframe -> youtube-api) are
 * derived capabilities resolved through the capability dependency chain;
 * they are NOT treated as plain plugin permissions. Genuinely missing
 * capabilities are still denied.
 *
 * @param {string[]} requestedCapabilities  Angeforderte Capabilities
 * @param {string[]} grantedPermissions     Gewahrte Plugin-Permissions
 * @returns {{ granted: string[], denied: string[], valid: boolean }}
 */
function validateCapabilities(requestedCapabilities = [], grantedPermissions = []) {
    if (!Array.isArray(requestedCapabilities)) {
        return { granted: [], denied: [], valid: true };
    }
    if (!Array.isArray(grantedPermissions)) {
        grantedPermissions = [];
    }

    // `external-origin` and its dependencies (youtube-iframe -> youtube-api)
    // are derived capabilities resolved through the capability dependency chain.
    // `external-origin` needs the permission `http-origin`;
    // `youtube-iframe` needs `external-origin` (Capability);
    // `youtube-api` needs `youtube-iframe` (Capability).
    // The simple canGrant check (which only checks `requiresPermission`) rejects
    // these, because `external-origin` is not an ordinary plugin permission.
    // Therefore the dependent suite is resolved first for the whole request,
    // before individual capabilities are classified as granted/denied.
    const derived = resolveDerivedCapabilities(requestedCapabilities, grantedPermissions);
    if (!derived.valid) {
        return derived;
    }

    const granted = [];
    const denied = [];
    for (const capId of requestedCapabilities) {
        if (derived.granted.includes(capId)) {
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
 * Löst die vollständigen, abhängigen Capability-Suite für eine Anforderung auf.
 *
 * Die abhängige Suite wird nach unten durchlaufen, bis alle nicht-Schranken erfüllt sind:
 *   - `external-origin`      benötigt `http-origin` (Permission)
 *   - `youtube-iframe`       benötigt `external-origin` (Capability)
 *   - `youtube-api`          benötigt `youtube-iframe` (Capability)
 *
 * `external-origin` wird hier als abgeleitete Capability behandelt, KEINE normalen Plugin-Permission.
 * Das verhindert, dass die Prüfung `external-origin` als "fehlende Plugin-Permission" ablehnt
 * und youtube-iframe/youtube-api dadurch irrtümlich als normale Permissions verworfen werden.
 *
 * @param {string[]} requestedCapabilities  Angeforderte Capabilities
 * @param {string[]} grantedPermissions     Gewährte Plugin-Permissions
 * @returns {{ granted: string[], denied: string[], valid: boolean }}
 */
function resolveDerivedCapabilities(requestedCapabilities = [], grantedPermissions = []) {
    if (!Array.isArray(requestedCapabilities)) {
        return { granted: [], denied: [], valid: true };
    }

    const granted = [];
    const denied = [];

    // Die abgeleiteten Capabilities bilden eine Kette:
    //   youtube-api  ->  youtube-iframe  ->  external-origin  ->  http-origin (Permission)
    // `external-origin` hat `requiresPermission: "http-origin"`; darin ist `http-origin`
    // tatsächlich eine Plugin-Permission.
    // `youtube-iframe` hat `requiresPermission: "external-origin"`; darin ist `external-origin`
    // eine Capability (nicht eine Plugin-Permission).
    // `youtube-api` hat `requiresPermission: "youtube-iframe"`; darin ist `youtube-iframe`
    // eine Capability (nicht eine Plugin-Permission).
    //
    // Die iterative Lösung zählt die Kette abwägend auf. Eine Capability wird
    // nur dann als gewonnen gezählt, wenn alle ihre Abhängigkeiten (Permission
    // oder Capability) bereits erfüllt sind. Dadurch wird verhindert, dass
    // youtube-iframe/youtube-api als fehlende Plugin-Permission abgelehnt werden.
    // Karnbinieren: wenn ein abhängiges Capability (z. B. `external-origin`)
    // verweigert wird, werden auch alle davon abhängigen Capabilities
    // (z. B. `youtube-iframe`, `youtube-api`) verweigert.
    const required = new Set(requestedCapabilities.filter((c) => CapabilityRegistry.isKnown(c)));
    const grantedPermissionsSet = new Set(grantedPermissions);
    const grantedCapabilitiesSet = new Set();
    const deniedCapabilitiesSet = new Set();

    // Die abgeleiteten Capability-IDs (nicht die normalen Plugin-Permissions).
    const DERIVED_CAPABILITIES = new Set(["external-origin", "youtube-iframe", "youtube-api"]);

    let progressed = true;
    while (progressed) {
        progressed = false;

        for (const capId of required) {
            if (grantedCapabilitiesSet.has(capId)) {
                continue;
            }
            if (deniedCapabilitiesSet.has(capId)) {
                continue;
            }

            const def = CapabilityRegistry.getDefinition(capId);
            if (!def) {
                continue;
            }

            // Prüfe, ob alle Voraussetzungen erfüllt sind.
            let allSatisfied = true;

            // 1) requiresPermission-Prüfung.
            //    `external-origin` hat `requiresPermission: "http-origin"` (eine tatsächliche
            //    Plugin-Permission). `youtube-iframe` und `youtube-api` haben
            //    `requiresPermission: "external-origin"` bzw. `"youtube-iframe"`, die aber
            //    keine Plugin-Permissions sind, sondern Capabilities der abgeleiteten Kette.
            //    Wenn die referenzierte Capability eine DERIVED-Capability ist und nicht als
            //    Plugin-Permission gewährt wurde, behandeln wir sie als Capability-Abhängigkeit
            //    (s.o. Punkt 2). Top-Level-Capabilities wie `http-origin` oder `player` werden
            //    aber als echte Plugin-Permissions geprüft.
            const requiresPermission = def.requiresPermission;
            if (requiresPermission) {
                if (DERIVED_CAPABILITIES.has(requiresPermission)) {
                    // Die referenzierte Capability ist eine abgeleitete Capability (z. B.
                    // youtube-iframe fordert `external-origin` als Capability). Diese wird
                    // in Punkt 2 als Capability-Abhängigkeit behandelt.
                } else if (!grantedPermissionsSet.has(requiresPermission)) {
                    allSatisfied = false;
                }
            }

            // 2) requiresCapability-Prüfung (Capability-Abhängigkeit).
            //    z. B. youtube-api und youtube-iframe erfordern als Capability.
            if (def.requiresCapability) {
                if (!grantedCapabilitiesSet.has(def.requiresCapability)) {
                    allSatisfied = false;
                }
            }

            if (allSatisfied) {
                grantedCapabilitiesSet.add(capId);
                granted.push(capId);
                required.delete(capId);
                progressed = true;
            } else {
                // Diese Capability ist nicht erreichbar (fehlende Voraussetzung).
                // Markiere sie als verweigert und entferne sie aus der Folge.
                deniedCapabilitiesSet.add(capId);
                required.delete(capId);
                denied.push(capId);
                progressed = true;
            }
        }
    }

    // Im Rest sind Capabilities, die nicht aufgelöst werden konnten
    for (const capId of required) {
        denied.push(capId);
    }

    return {
        granted,
        denied,
        valid: denied.length === 0
    };
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
    hasCapability,
    isOriginAllowed
};