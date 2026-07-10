const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const LogManager = require("./diagnostics/logging/LogManager");

const logger = LogManager.getLogger("Storage");

function getStoragePath() {
  return path.join(app.getPath("userData"), "storage.json");
}

function readData() {
  const file = getStoragePath();
  if (!fs.existsSync(file)) {
    return { history: [], favorites: [], settings: {} };
  }
  try {
    const data = fs.readFileSync(file, "utf-8");
    const parsed = JSON.parse(data);
    if (!parsed.settings) parsed.settings = {};
    return parsed;
  } catch (err) {
    logger.error(`Error reading storage: ${err.message}`);
    return { history: [], favorites: [], settings: {} };
  }
}

function writeData(data) {
  const file = getStoragePath();
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    logger.error(`Error writing storage: ${err.message}`);
  }
}

module.exports = {
  // --- History ---
  getHistory: () => {
    return readData().history;
  },
  addHistory: (entry) => {
    const data = readData();
    // Remove if already exists (to move to top)
    data.history = data.history.filter(e => e.url !== entry.url && e.url_resolved !== entry.url);
    // Add to top, add timestamp
    const newEntry = { ...entry, lastPlayed: Date.now() };
    data.history.unshift(newEntry);
    // Keep only last 100 entries
    if (data.history.length > 100) data.history.pop();
    writeData(data);
  },

  // --- Favorites ---
  getFavorites: () => {
    return readData().favorites;
  },
  addFavorite: (entry) => {
    const data = readData();
    if (!data.favorites.find(e => e.url === entry.url || e.url_resolved === entry.url)) {
      data.favorites.push({ ...entry, addedAt: Date.now() });
      writeData(data);
    }
  },
  removeFavorite: (url) => {
    const data = readData();
    data.favorites = data.favorites.filter(e => e.url !== url && e.url_resolved !== url);
    writeData(data);
  },

  // --- Settings ---
  getSettings: () => {
    return readData().settings;
  },
  updateSettings: (newSettings) => {
    const data = readData();
    data.settings = { ...data.settings, ...newSettings };
    writeData(data);
  }
};
