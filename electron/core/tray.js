const { Tray, Menu, app } = require("electron");
const path = require("path");

let tray = null;

function createTray(mainWindow) {
  const iconPath = path.join(__dirname, "..", "assets", "icons", "tray.png");

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
      label:"Play / Pause",
      click: () => {
        mainWindow.webContents.send("media-play-pause");
      }
    },
    {
      label:"Stop",
      click: () => {
        mainWindow.webContents.send("media-stop");
      }
    },
    {
      label: "Einstellungen",
      click: () => {
        const settingsWindow = new BrowserWindow({
          width: 400,
          height: 300,
          parent: mainWindow,
          modal: true,
          webPreferences: {
            preload: path.join(__dirname, "preload.js")
          }
        });
        settingsWindow.loadFile(path.join(__dirname, "..", "renderer", "settings.html"));
      }
    },
    { label: "Update prüfen", click: () => autoUpdater.checkForUpdates() },
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

module.exports = { createTray };
