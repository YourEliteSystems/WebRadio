const { Tray, Menu, app } = require("electron");
const path = require("path");

let tray = null;

function createTray(mainWindow, { openSettings, checkForUpdates }) {
  const iconPath = path.join(__dirname, "../../assets/icons/tray.ico");

  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "WebRadio anzeigen",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: "Play / Pause",
      click: () => {
        mainWindow.webContents.send("media-play-pause");
      }
    },
    {
      label: "Stop",
      click: () => {
        mainWindow.webContents.send("media-stop");
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
    mainWindow.show();
    mainWindow.focus();
  });
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = { createTray, destroyTray };
