const VALID_PERMISSIONS = [
    "events",
    "storage",
    "settings",
    "theme",
    "ui",

    "audio",
    "notifications",
    "network",
];

function validatePermissions(permissions = []) {
    return permissions.filter(p =>
        VALID_PERMISSIONS.includes(p)
    );
}


function hasPermission(permissions = [], permission) {
    return permissions.includes(permission);
}

module.exports = {
    VALID_PERMISSIONS,
    validatePermissions,
    hasPermission
};