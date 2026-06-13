import React from 'react';

export default function Sidebar({
  searchQuery,
  setSearchQuery,
  country,
  setCountry,
  genre,
  setGenre,
  countries,
  tags,
  onSearch,
  onLoadFavorites,
  onLoadHistory
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h3>Suchen</h3>
        <input
          type="text"
          placeholder="Sender suchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        />
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Alle Länder</option>
          {countries.map((c) => (
            <option key={c.iso_3166_1} value={c.iso_3166_1}>
              {c.name} ({c.stationcount})
            </option>
          ))}
        </select>
        <select value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">Alle Genres</option>
          {tags.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name} ({t.stationcount})
            </option>
          ))}
        </select>
        <button className="btn-primary" onClick={onSearch}>Suchen</button>
      </div>

      <div className="sidebar-section">
        <h3>Meine Sender</h3>
        <button className="btn-secondary" onClick={onLoadFavorites}>Favoriten laden</button>
        <button className="btn-secondary" onClick={onLoadHistory}>Verlauf laden</button>
      </div>
    </aside>
  );
}
