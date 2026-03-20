const fs = require("fs");
const path = require("path");

const settingsPath = path.join(
  appDataDir(),
  "settings.json"
);

function appDataDir() {
  return require("electron").app.getPath("userData");
}

const defaultSettings = {
  autostart: true,
  startMinimized: true
};

function loadSettings() {
  if (!fs.existsSync(settingsPath)) {
    saveSettings(defaultSettings);
    return defaultSettings;
  }

  return JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
}

function saveSettings(settings) {
  fs.writeFileSync(
    settingsPath,
    JSON.stringify(settings, null, 2)
  );
}

module.exports = {
  loadSettings,
  saveSettings
};
