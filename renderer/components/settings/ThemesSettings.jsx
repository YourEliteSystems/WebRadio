import React, { useEffect, useCallback } from 'react';

const ThemesSettings = ({ themes, activeTheme, setActiveTheme }) => {
  const openThemesFolder = async () => {
    if (window.diagnosticsAPI?.getPaths) {
      try {
        const paths = await window.diagnosticsAPI.getPaths();
        if (paths?.themes) {
          window.shellAPI?.openPath(paths.themes);
        }
      } catch (err) {
        console.error("Failed to open themes folder:", err);
      }
    }
  };

  const handleReloadThemes = async () => {
    // Themes neu laden
    if (window.themeAPI?.getThemes) {
      try {
        const [themesList, activeId] = await Promise.all([
          window.themeAPI.getThemes(),
          window.themeAPI.getActiveTheme()
        ]);
        setActiveTheme(activeId);
      } catch (err) {
        console.error("Failed to reload themes:", err);
      }
    }
  };

  const handleThemeSelect = async (themeId) => {
    if (!window.themeAPI) return;

    try {
      // Theme aktivieren
      await window.themeAPI.setActiveTheme(themeId);
      const url = themes.find(t => t.id === themeId)?.css;
      if (url) {
        const finalUrl = url.startsWith("file://") ? url : "file:///" + url.replace(/\\/g, "/");
        const link = document.getElementById("theme-style");
        if (link) link.href = finalUrl;
      }
      setActiveTheme(themeId);
    } catch (err) {
      console.error("Failed to set theme:", err);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h1>Themes</h1>
        <p>Aussehen der App anpassen</p>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">Verfügbare Themes</span>
          <div style={{display: 'flex', gap: '8px'}}>
            <button onClick={openThemesFolder} className="diag-open-btn">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Ordner öffnen
            </button>
            <button 
              onClick={handleReloadThemes}
              className="btn-secondary" 
              style={{width: 'auto', padding: '6px 14px', fontSize: '12px'}}
            >
              ↺ Neu laden
            </button>
          </div>
        </div>
        
        <div className="theme-grid">
          {themes.length === 0 ? (
            <p style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '12px 0'}}>
              Keine Themes gefunden
            </p>
          ) : (
            themes.map((theme) => (
              <div 
                key={theme.id} 
                className={`theme-card ${activeTheme === theme.id ? 'active' : ''}`}
                onClick={() => handleThemeSelect(theme.id)}
              >
                <div className="theme-dot"></div>
                <span>{theme.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ThemesSettings;
