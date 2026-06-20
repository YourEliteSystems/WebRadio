const fs = require('fs');
const path = require('path');

function loadPlugins(pluginPath) {
    const manifestPath = path.join(pluginPath, 'manifesst.json');
    if(!fs.existsSync(manifestPath)) {
        throw new Error('plugin.json fehlt');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    return manifest;
}

module.exports = {
    loadPlugins
};