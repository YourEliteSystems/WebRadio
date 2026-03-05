module.exports = {
  init: ({ mainWindow }) => {
    console.log("Sample Plugin initialisiert");

    // Beispiel: Tray-Menü erweitern
    mainWindow.webContents.once("did-finish-load", () => {
      mainWindow.webContents.send("plugin-message", "Hello from Sample Plugin!");
    });
  },
  onPlay: (station) => {
    console.log("Sample Plugin: Station gestartet", station.name);
  },
  onStop: () => {
    console.log("Sample Plugin: Stop ausgeführt");
  }
};
