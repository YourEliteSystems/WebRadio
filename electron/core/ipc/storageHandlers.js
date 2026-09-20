const { ipcMain } = require("electron");
const path = require("path");
const FavoritesManager = require("../storage/FavoritesManager");
const HistoryManager   = require("../storage/HistoryManager");

// Utility für Input-Validierung
function validateString(input, paramName) {
  if (typeof input !== "string") {
    throw new Error(`${paramName} muss ein String sein`);
  }
  if (input.length > 1000) {
    throw new Error(`${paramName} ist zu lang (max 1000 Zeichen)`);
  }
  return input;
}

function validateEntry(entry) {
  if (!entry || typeof entry !== "object") {
    throw new Error("Entry muss ein Objekt sein");
  }
  if (entry.url) {
    validateString(entry.url, "entry.url");
  }
  if (entry.name) {
    validateString(entry.name, "entry.name");
  }
  return entry;
}

function registerStorageHandlers() {

    // Verlauf

    ipcMain.handle("history:get", () => {
        return HistoryManager.getAll();
    });

    ipcMain.handle("history:add", (_, entry) => {
        const validated = validateEntry(entry);
        return HistoryManager.add(validated);
    });

    // Favoriten

    ipcMain.handle("favorites:get", () => {
        return FavoritesManager.getAll();
    });

    ipcMain.handle("favorites:add", (_, entry) => {
        const validated = validateEntry(entry);
        return FavoritesManager.add(validated);
    });

    ipcMain.handle("favorites:remove", (_, url) => {
        const validatedUrl = validateString(url, "url");
        return FavoritesManager.remove(validatedUrl);
    });

}

module.exports = registerStorageHandlers;