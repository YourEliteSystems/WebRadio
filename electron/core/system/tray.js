const { Tray, Menu, app, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");

let tray = null;

function getTrayIconPath() {
  // Plattformabhängige Icon-Auswahl:
  //   • Windows: .ico (nativ)
  //   • Linux/macOS: PNG
  const iconDir = path.join(__dirname, "..", "..", "..", "assets", "icons");
  const candidates =
    process.platform === "win32"
      ? ["tray.ico", "tray.png"]
      : ["tray.png", "tray.ico"];

  for (const name of candidates) {
    const p = path.join(iconDir, name);
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Fallback: leeres Image (sollte nie greifen, da Assets vorhanden sind).
  return null;
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
