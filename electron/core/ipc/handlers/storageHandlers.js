const { ipcMain } = require("electron");
const storage = require("../storage");

/**
 * Registriert IPC-Handler für Storage (History & Favorites)
 */
function registerStorageHandlers() {
  // --- History ---
  ipcMain.handle("history:get", () => {
    try {
      return storage.getHistory();
    } catch (err) {
      console.error("Fehler beim Abrufen der History:", err);
      return [];
    }
  });

  ipcMain.handle("history:add", (_, entry) => {
    try {
      storage.addHistory(entry);
      return { success: true };
    } catch (err) {
      console.error("Fehler beim Hinzufügen zur History:", err);
      return { success: false, error: err.message };
    }
  });

  // --- Favorites ---
  ipcMain.handle("favorites:get", () => {
    try {
      return storage.getFavorites();
    } catch (err) {
      console.error("Fehler beim Abrufen der Favoriten:", err);
      return [];
    }
  });

  ipcMain.handle("favorites:add", (_, entry) => {
    try {
      storage.addFavorite(entry);
      return { success: true };
    } catch (err) {
      console.error("Fehler beim Hinzufügen zu Favoriten:", err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("favorites:remove", (_, url) => {
    try {
      storage.removeFavorite(url);
      return { success: true };
    } catch (err) {
      console.error("Fehler beim Entfernen aus Favoriten:", err);
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerStorageHandlers };
