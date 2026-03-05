const fs = require("fs");
const path = require("path");

let plugins = [];

function loadPlugins(mainWindow) {
  const pluginDir = path.join(__dirname, "..", "plugins");

  if (!fs.existsSync(pluginDir)) return;

  const folders = fs.readdirSync(pluginDir);

  folders.forEach(folder => {
    const pluginPath = path.join(pluginDir, folder, "plugin.js");
    if (fs.existsSync(pluginPath)) {
      try {
        const pluginModule = require(pluginPath);
        if (pluginModule.init) {
          pluginModule.init({ mainWindow });
          plugins.push(pluginModule);
          console.log(`Plugin geladen: ${folder}`);
        }
      } catch (err) {
        console.error(`Fehler beim Laden von ${folder}:`, err);
      }
    }
  });
}

function getPlugins() {
  return plugins;
}

module.exports = { loadPlugins, getPlugins };
