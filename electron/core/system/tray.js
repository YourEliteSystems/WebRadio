const { Tray, Menu, app, nativeImage } = require("electron");
const { getTrayIcon } = require("../icons");
const LocalizationService = require("../localization/LocalizationService");

let tray = null;
let trayState = null;

function getTrayIconPath() {
  // Icon aus zentraler Icon-Verwaltung beziehen
  return getTrayIcon();
}

/**
 * Baut das Tray-Kontextmenü in der aktuell aktiven Sprache.
 * Alle sichtbaren Beschriftungen laufen über die Localization Engine.
 */
function buildContextMenu() {
  const t = (key) => LocalizationService.t(key);
  const mainWindow = trayState?.mainWindow;
  const openSettings = trayState?.openSettings;
  const checkForUpdates = trayState?.checkForUpdates;

  return Menu.buildFromTemplate([
    {
      label: t("tray.show"),
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: t("tray.playPause"),
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("media-play-pause");
        }
      }
    },
    {
      label: t("tray.stop"),
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("media-stop");
        }
      }
    },
    {
      label: t("tray.settings"),
      click: () => openSettings()
    },
    {
      label: t("tray.checkUpdates"),
      click: () => checkForUpdates()
    },
    { type: "separator" },
    {
      label: t("tray.quit"),
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
}

function createTray(mainWindow, { openSettings, checkForUpdates }) {
  if (tray) {
    // Bestehendes Tray nur aktualisieren, nicht duplizieren.
    trayState = { mainWindow, openSettings, checkForUpdates };
    tray.setContextMenu(buildContextMenu());
    return tray;
  }

  const iconPath = getTrayIconPath();
  let image;

  if (iconPath) {
    image = nativeImage.createFromPath(iconPath);
    // Auf Linux kann eine zu große PNG zu einem unsichtbaren Tray-Icon
    // führen. Wir setzen daher explizit die Standardgröße.
    if (process.platform !== "win32" && !image.isEmpty()) {
      image = image.resize({ width: 22, height: 22 });
    }
  } else {
    image = nativeImage.createEmpty();
  }

  tray = new Tray(image);
  trayState = { mainWindow, openSettings, checkForUpdates };

  tray.setToolTip(LocalizationService.t("app.name"));
  tray.setContextMenu(buildContextMenu());

  tray.on("double-click", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

/**
 * Menü nach einem Sprachwechsel neu aufbauen.
 * Wird von der LocalizationService aufgerufen; ohne Tray ein No-Op.
 */
function refreshTrayMenu() {
  if (!tray || !trayState) return;
  tray.setContextMenu(buildContextMenu());
  tray.setToolTip(LocalizationService.t("app.name"));
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
    trayState = null;
  }
}

module.exports = { createTray, destroyTray, refreshTrayMenu, getTrayIconPath };
