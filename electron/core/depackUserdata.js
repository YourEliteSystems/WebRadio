const { app } = require("electron");
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra'); 

function setupUserDirs() {
  const userDataPath = app.getPath('userData');
  const dirs = {
    plugins: path.join(userDataPath, 'plugins'),
    themes: path.join(userDataPath, 'themes')
  };

  // Ordner anlegen
  Object.values(dirs).forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  return dirs;
}

function copyDefaults(dirs) {
  const resourcePath = process.resourcesPath; // Pfad zu resources in Build
  const defaults = {
    plugins: path.join(resourcePath, 'plugins'),
    themes: path.join(resourcePath, 'themes')
  };

  // Nur kopieren, wenn noch nichts da ist
  Object.keys(dirs).forEach(key => {
    if (fs.readdirSync(dirs[key]).length === 0) {
      fse.copySync(defaults[key], dirs[key]);
    }
  });
}

module.exports = {
    setupUserDirs,
    copyDefaults
}