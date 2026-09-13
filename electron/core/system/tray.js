const { Tray, Menu, app, nativeImage } = require("electron");
const { getTrayIcon } = require("../icons");

let tray = null;

function getTrayIconPath() {
  // Icon aus zentraler Icon-Verwaltung beziehen
  return getTrayIcon();
}

function createTray(mainWindow, { openSettings, checkForUpdates }) {
  if (tray) {
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

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "WebRadio anzeigen",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: "Play / Pause",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("media-play-pause");
        }
      }
    },
    {
      label: "Stop",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("media-stop");
        }
      }
    },
    {
      label: "Einstellungen",
      click: () => openSettings()
    },
    {
      label: "Update prüfen",
      click: () => checkForUpdates()
    },
    { type: "separator" },
    {
      label: "Beenden",
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip("WebRadio");
  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = { createTray, destroyTray, getTrayIconPath };
