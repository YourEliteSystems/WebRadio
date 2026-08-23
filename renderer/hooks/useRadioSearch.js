import { useState, useEffect, useCallback } from 'react';

/**
 * Hook für die Radio-Sendersuche inkl. Länder-/Genre-Filter.
 * Kapselt den Such-State und die IPC-Aufrufe für Suche und Filter.
 */
export function useRadioSearch() {
  const [stations, setStations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [country, setCountry] = useState('');
  const [genre, setGenre] = useState('');
  const [countries, setCountries] = useState([]);
  const [tags, setTags] = useState([]);

  // Verfügbare Filter (Länder/Tags) einmalig laden
  useEffect(() => {
    if (window.api?.getCountries) {
      window.api.getCountries().then(res => setCountries(res || []));
    }
    if (window.api?.getTags) {
      window.api.getTags().then(res => setTags(res || []));
    }
  }, []);

  const search = useCallback(async (overrideQuery) => {
    if (!window.api?.searchRadio) {
      console.warn("searchRadio API not found in window.api. Running in dev without electron?");
      return;
    }
    const useOverride = typeof overrideQuery === 'string';
    const q = useOverride ? overrideQuery : searchQuery;
    try {
      const results = await window.api.searchRadio({
        name: q || '',
        country: useOverride ? '' : country,
        genre: useOverride ? '' : genre,
      });
      setStations(results.slice(0, 50));
    } catch (err) {
      console.error("Fehler bei der Sendersuche:", err);
    }
  }, [searchQuery, country, genre]);

  return {
    stations,
    setStations,
    searchQuery,
    setSearchQuery,
    country,
    setCountry,
    genre,
    setGenre,
    countries,
    tags,
    search
  };
}
