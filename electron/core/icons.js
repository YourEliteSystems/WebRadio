const path = require('path');
const fs = require('fs');

/**
 * Icon-Verwaltung für WebRadio
 * 
 * Zentrale Quelle für alle Program-Icon-Pfade
 * Priorität: Plattformspezifische Icons > Fallback Icons
 */

// Basis-Verzeichnis für Icons
const ASSETS_DIR = path.join(__dirname, '../../assets/icons');

// verfügbare Icon-Dateien
const ICON_FILES = {
  windows: {
    primary: 'tray.ico',
    fallback: ['tray.png']
  },
  linux: {
    primary: 'tray.png',
    fallback: ['tray.ico']
  },
  darwin: { // macOS
    primary: 'tray.icns',
    fallback: ['tray.png', 'tray.ico']
  },
  // Generische Icons (für andere Plattformen)
  generic: {
    primary: 'tray.png',
    fallback: ['tray.ico']
  }
};

// Cache für Icon-Pfade
let iconPathsCache = null;

/**
 * Ermittele den besten Icon-Pfad für die aktuelle Plattform
 * @param {string} type - Icon-Typ ('window', 'tray', 'app', etc.)
 * @returns {string|null} - Pfad zum Icon oder null
 */
function getBestIconPath(type = 'app') {
  const platform = process.platform;
  const config = ICON_FILES[platform] || ICON_FILES.generic;
  
  // Erst primäres Icon versuchen
  let iconPath = path.join(ASSETS_DIR, config.primary);
  if (fs.existsSync(iconPath)) {
    return iconPath;
  }
  
  // Dann Fallbacks versuchen
  for (const fallback of config.fallback) {
    const fallbackPath = path.join(ASSETS_DIR, fallback);
    if (fs.existsSync(fallbackPath)) {
      return fallbackPath;
    }
  }
  
  // Letzter Versuch: generisches primäres Icon
  const genericPath = path.join(ASSETS_DIR, ICON_FILES.generic.primary);
  if (fs.existsSync(genericPath)) {
    return genericPath;
  }
  
  return null;
}

/**
 * Ermittele alle verfügbaren Icon-Pfade
 * @returns {Object} - Objekt mit Icon-Pfaden pro Plattform
 */
function getAllIconPaths() {
  if (iconPathsCache) {
    return iconPathsCache;
  }
  
  const paths = {};
  
  // Alle Icon-Dateien im Verzeichnis finden
  try {
    const files = fs.readdirSync(ASSETS_DIR);
    files.forEach(file => {
      const ext = path.extname(file).toLowerCase();
      const name = path.basename(file, ext);
      
      if (['.ico', '.png', '.icns', '.jpg', '.jpeg', '.svg'].includes(ext)) {
        if (!paths[name]) {
          paths[name] = {};
        }
        paths[name][ext] = path.join(ASSETS_DIR, file);
      }
    });
  } catch (err) {
    console.warn('Could not read icons directory:', err.message);
  }
  
  iconPathsCache = paths;
  return paths;
}

/**
 * Erzwinge eine Aktualisierung des Icon-Cache
 */
function refreshIconCache() {
  iconPathsCache = null;
  return getAllIconPaths();
}

/**
 * Prüfe, ob ein Icon für die aktuelle Plattform verfügbar ist
 * @returns {boolean}
 */
function hasPlatformIcon() {
  return getBestIconPath() !== null;
}

/**
 * Standard-Icon-Pfad für BrowserWindow
 * @returns {string|undefined}
 */
function getWindowIcon() {
  return getBestIconPath('window');
}

/**
 * Tray-Icon-Pfad
 * @returns {string|undefined}
 */
function getTrayIcon() {
  // Für Tray wird oft PNG bevorzugt, aber ICO unter Windows
  const platform = process.platform;
  if (platform === 'win32') {
    // Windows: .ico für bessere Qualität
    const icoPath = path.join(ASSETS_DIR, 'tray.ico');
    if (fs.existsSync(icoPath)) return icoPath;
  }
  
  // Andere Plattformen: .png
  const pngPath = path.join(ASSETS_DIR, 'tray.png');
  if (fs.existsSync(pngPath)) return pngPath;
  
  return getBestIconPath('tray');
}

/**
 * Icon für Packaging (electron-builder)
 * @param {string} target - Zielplattform ('win', 'linux', 'mac')
 * @returns {string|undefined}
 */
function getPackagingIcon(target) {
  const targetConfig = {
    win: 'tray.ico',
    linux: 'tray.png',
    mac: 'tray.icns'
  };
  
  const iconPath = path.join(ASSETS_DIR, targetConfig[target] || targetConfig.linux);
  if (fs.existsSync(iconPath)) {
    return iconPath;
  }
  
  return getBestIconPath();
}

module.exports = {
  ASSETS_DIR,
  getBestIconPath,
  getAllIconPaths,
  refreshIconCache,
  hasPlatformIcon,
  getWindowIcon,
  getTrayIcon,
  getPackagingIcon
};