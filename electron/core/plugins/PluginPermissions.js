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
    "network"
];

function validatePermissions(permissions = []) {
    return permissions.filter(p =>
        VALID_PERMISSIONS.includes(p) || p === "*"
    );
}

function hasPermission(permissions = [], permission) {
    if (!Array.isArray(permissions)) {
        // Wenn keine Berechtigungen im Manifest deklariert sind, Standardzugriff für Abwärtskompatibilität
        return true;
    }

    if (permissions.includes("*")) {
        return true;
    }

    if (permissions.includes(permission)) {
        return true;
    }

    // Fallback: Wenn "navigation" geprüft wird, reicht auch "navigation.register" oder "ui"
    if (permission === "navigation" && (permissions.includes("navigation.register") || permissions.includes("ui"))) {
        return true;
    }

    // Fallback: Wenn "navigation.register" geprüft wird, reicht auch "navigation" oder "ui"
    if (permission === "navigation.register" && (permissions.includes("navigation") || permissions.includes("ui"))) {
        return true;
    }

    return false;
}

module.exports = {
    VALID_PERMISSIONS,
    validatePermissions,
    hasPermission
};