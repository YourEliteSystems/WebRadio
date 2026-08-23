const StorageManager = require("./StorageManager");

class FavoritesManager {

    getAll() {
        return StorageManager.getFavorites();
    }

    add(entry) {
        return StorageManager.addFavorite(entry);
    }

    remove(url) {
        return StorageManager.removeFavorite(url);
    }

}

module.exports = new FavoritesManager();