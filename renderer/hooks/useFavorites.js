import { useState, useEffect, useCallback } from 'react';

/**
 * Hook für Favoriten-Verwaltung über die IPC-API.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    if (window.api?.getFavorites) {
      window.api.getFavorites().then(res => setFavorites(res || []));
    }
  }, []);

  const toggleFavorite = useCallback(async (stationOverride, nowPlayingStation) => {
    const stationToToggle = stationOverride || nowPlayingStation;
    if (!stationToToggle) return;

    const url = stationToToggle.url_resolved || stationToToggle.url;
    const isFav = favorites.some(f => f.url === url);

    if (isFav) {
      if (window.api?.removeFavorite) await window.api.removeFavorite(url);
      setFavorites(prev => prev.filter(f => f.url !== url));
    } else {
      const newFav = {
        name: stationToToggle.name,
        url: url,
        favicon: stationToToggle.favicon || stationToToggle.logo
      };
      if (window.api?.addFavorite) await window.api.addFavorite(newFav);
      setFavorites(prev => [...prev, newFav]);
    }
  }, [favorites]);

  return { favorites, toggleFavorite };
}
