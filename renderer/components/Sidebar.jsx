import React, { useState, useEffect } from 'react';
import { subscribe, views } from '../ui/componentRegistry';

export default function Sidebar({
  currentView,
  setCurrentView,
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
  const [pluginViews, setPluginViews] = useState(() => new Map(views));

  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setPluginViews(new Map(views));
    });
    return unsubscribe;
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h3>Navigation</h3>
        <button 
          className={`btn-secondary ${currentView === 'home' ? 'active' : ''}`}
          onClick={() => setCurrentView('home')}
        >
          Home
        </button>
        {Array.from(pluginViews.entries()).map(([id, view]) => (
          <button 
            key={id}
            className={`btn-secondary ${currentView === id ? 'active' : ''}`}
            onClick={() => setCurrentView(id)}
          >
            {view.title}
          </button>
        ))}
      </div>

      {currentView === 'home' && (
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
      )}

      {currentView === 'home' && (
        <div className="sidebar-section">
          <h3>Meine Sender</h3>
          <button className="btn-secondary" onClick={onLoadFavorites}>Favoriten laden</button>
          <button className="btn-secondary" onClick={onLoadHistory}>Verlauf laden</button>
        </div>
      )}
    </aside>
  );
}
