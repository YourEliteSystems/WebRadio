const storage = require("../storage");

class FavoritesManager {

  getAll() {
    return storage.getFavorites();
  }

  add(entry) {
    return storage.addFavorite(entry);
  }

  remove(url) {
    return storage.removeFavorite(url);
  }

}

module.exports = new FavoritesManager();