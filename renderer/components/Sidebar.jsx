import React, { useState, useEffect } from 'react';
import { subscribe as subscribeViews, views } from '../ui/componentRegistry';
import {
  subscribe as subscribeNav,
  getNavigationTree,
  toggleSection
} from '../ui/navigationRegistry';

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
  const [navTree, setNavTree] = useState(() => getNavigationTree());
  const [pluginViews, setPluginViews] = useState(() => new Map(views));

  useEffect(() => {
    const unsubNav = subscribeNav(() => {
      setNavTree(getNavigationTree());
    });
    const unsubViews = subscribeViews(() => {
      setPluginViews(new Map(views));
    });
    return () => {
      unsubNav();
      unsubViews();
    };
  }, []);

  const sections = navTree.sections || [];
  const topLevelItems = navTree.topLevelItems || [];

  // IDs aller registrierten Items sammeln, um Doppelungen mit legacy pluginViews zu vermeiden
  const registeredItemIds = new Set();
  topLevelItems.forEach(item => registeredItemIds.add(item.id));
  sections.forEach(section => {
    (section.items || []).forEach(item => registeredItemIds.add(item.id));
  });

  return (
    <aside className="sidebar">
      {/* ── Haupt-Navigation ── */}
      <div className="sidebar-section">
        <h3>Navigation</h3>

        {/* Top-Level Items (ohne Parent) - inkl. Core Radio */}
        {topLevelItems.map(item => (
          <button
            key={item.id}
            className={`btn-nav-item ${currentView === item.id || currentView === item.route ? 'active' : ''}`}
            onClick={() => setCurrentView(item.route || item.id)}
            disabled={item.disabled}
          >
            {item.icon ? (
              <span className="nav-icon">{item.icon}</span>
            ) : (
              <span className="section-dot"></span>
            )}
            <span className="nav-label">{item.label}</span>
          </button>
        ))}

        {/* Dynamische Sections von Plugins */}
        {sections.map(section => {
          const isCollapsible = section.collapsible !== false;
          const isExpanded = section.isExpanded !== false;
          const hasItems = Array.isArray(section.items) && section.items.length > 0;

          return (
            <div key={section.id} className="nav-section-container">
              {/* Section Header */}
              <div 
                className={`nav-section-header ${isCollapsible ? 'collapsible' : ''}`}
                onClick={() => isCollapsible && toggleSection(section.id)}
                title={section.label}
              >
                <div className="nav-section-title">
                  {section.icon ? (
                    <span className="nav-icon">{section.icon}</span>
                  ) : (
                    <span className="section-dot"></span>
                  )}
                  <span className="section-label">{section.label}</span>
                </div>
                {isCollapsible && (
                  <span className={`section-chevron ${isExpanded ? 'expanded' : ''}`}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                  </span>
                )}
              </div>

              {/* Section Items */}
              {(!isCollapsible || isExpanded) && hasItems && (
                <div className="nav-section-items">
                  {section.items.map(item => (
                    <button
                      key={item.id}
                      className={`btn-nav-subitem ${currentView === item.id || currentView === item.route ? 'active' : ''}`}
                      onClick={() => setCurrentView(item.route || item.id)}
                      disabled={item.disabled}
                    >
                      {item.icon ? (
                        <span className="subitem-icon">{item.icon}</span>
                      ) : (
                        <span className="subitem-indicator"></span>
                      )}
                      <span className="nav-label">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Standalone Views (Backward compatibility) */}
        {Array.from(pluginViews.entries())
          .filter(([id]) => !registeredItemIds.has(id))
          .map(([id, view]) => (
            <button 
              key={id}
              className={`btn-nav-item ${currentView === id ? 'active' : ''}`}
              onClick={() => setCurrentView(id)}
            >
              <span className="nav-label">{view.title}</span>
            </button>
          ))}
      </div>

      {/* ── Suche & Filter (Nur in Radio-Ansicht) ── */}
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

      {/* ── Gespeicherte Sender (Nur in Radio-Ansicht) ── */}
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
