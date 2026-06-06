const { ipcMain } = require("electron");

/**
 * Registriert IPC-Handler für den Radio-Player
 * @param {BrowserWindow} mainWindow - das Hauptfenster
 * @param {Object} streamController - Instanz für Stream-Verwaltung
 */
function registerPlayerHandlers(mainWindow, streamController) {
  // Radio-Stream starten
  ipcMain.handle("radio:start", async (_, url) => {
    try {
      await streamController.start(url, mainWindow);
      return { success: true };
    } catch (err) {
      console.error("Fehler beim Starten des Streams:", err);
      return { success: false, error: err.message };
    }
  });

  // Radio-Stream stoppen
  ipcMain.handle("radio:stop", async () => {
    try {
      await streamController.stop();
      return { success: true };
    } catch (err) {
      console.error("Fehler beim Stoppen des Streams:", err);
      return { success: false, error: err.message };
    }
  });

  // Radio-Sender suchen (Radio Browser API)
  ipcMain.handle("radio:search", async (_, name) => {
    const url = `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(
      name
    )}`;
    try {
      const res = await globalThis.fetch(url, {
        headers: {
          "User-Agent": "WebRadioApp/1.0",
        },
      });
      return await res.json();
    } catch (err) {
      console.error("Radio Browser API Fehler:", err);
      return [];
    }
  });
}

module.exports = { registerPlayerHandlers };
