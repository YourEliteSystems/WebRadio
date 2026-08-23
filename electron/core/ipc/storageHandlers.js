const { ipcMain } = require("electron");
const FavoritesManager = require("../storage/FavoritesManager");
const HistoryManager   = require("../storage/HistoryManager");

function registerStorageHandlers() {

    // Verlauf

    ipcMain.handle("history:get", () => {
        return HistoryManager.getAll();
    });

    ipcMain.handle("history:add", (_, entry) => {
        return HistoryManager.add(entry);
    });

    // Favoriten

    ipcMain.handle("favorites:get", () => {
        return FavoritesManager.getAll();
    });

    ipcMain.handle("favorites:add", (_, entry) => {
        return FavoritesManager.add(entry);
    });

    ipcMain.handle("favorites:remove", (_, url) => {
        return FavoritesManager.remove(url);
    });

}

module.exports = registerStorageHandlers;