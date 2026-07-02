const fs = require('fs');
const path = require('path');

function loadManifest(pluginPath) {
    const manifestPath = path.join(pluginPath, 'manifest.json');
    if(!fs.existsSync(manifestPath)) {
        throw new Error(`plugin.json fehlt in: ${pluginPath}`);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    return manifest;
}

module.exports = {
    loadManifest
};