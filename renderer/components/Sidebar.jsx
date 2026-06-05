import React from 'react';

export default function Sidebar({ 
  searchQuery, 
  setSearchQuery, 
  country, 
  setCountry, 
  genre, 
  setGenre, 
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
          <option value="DE">Deutschland</option>
          <option value="AT">Österreich</option>
          <option value="CH">Schweiz</option>
          <option value="US">USA</option>
          <option value="GB">Großbritannien</option>
        </select>
        <select value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">Alle Genres</option>
          <option value="pop">Pop</option>
          <option value="rock">Rock</option>
          <option value="electronic">Electronic</option>
          <option value="hiphop">Hip Hop</option>
          <option value="jazz">Jazz</option>
          <option value="classical">Klassik</option>
          <option value="news">Nachrichten</option>
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
