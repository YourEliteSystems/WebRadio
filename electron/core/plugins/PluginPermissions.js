const VALID_PERMISSIONS = [
    "events",
    "storage",
    "settings",
    "theme",
    "ui"
];

function validatePermissions(permissions = []) {
    return permissions.filter(p =>
        VALID_PERMISSIONS.includes(p)
    );
}

module.exports = {
    validatePermissions
};