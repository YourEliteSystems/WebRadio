const { ipcMain } = require("electron");
const storage = require("../storage");

function registerStorageHandlers() {

  // Verlauf

  ipcMain.handle("history:get", () => {
    return storage.getHistory();
  });

  ipcMain.handle("history:add", (_, entry) => {
    return storage.addHistory(entry);
  });

  // Favoriten

  ipcMain.handle("favorites:get", () => {
    return storage.getFavorites();
  });

  ipcMain.handle("favorites:add", (_, entry) => {
    return storage.addFavorite(entry);
  });

  ipcMain.handle("favorites:remove", (_, url) => {
    return storage.removeFavorite(url);
  });

}

module.exports = registerStorageHandlers;