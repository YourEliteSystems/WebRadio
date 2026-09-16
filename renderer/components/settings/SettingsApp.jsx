import React, { useState, useEffect, useCallback, useRef } from 'react';
import SettingsLayout from './SettingsLayout';
import IntegrationsSettings from './IntegrationsSettings';
import PluginsSettings from './PluginsSettings';
import ThemesSettings from './ThemesSettings';
import UpdatesSettings from './UpdatesSettings';
import AboutSettings from './AboutSettings';
import DiagnosticsSettings from './DiagnosticsSettings';

const SettingsApp = () => {
  const [currentPage, setCurrentPage] = useState('integrations');
  const [themes, setThemes] = useState([]);
  const [activeTheme, setActiveTheme] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const isMaximizedRef = useRef(isMaximized);

  // Window Control Handler
  const handleWindowControl = (action) => {
    if (window.windowControls && window.windowControls[action]) {
      window.windowControls[action]();
    }
  };

  // Synchronisiere den isMaximized-Ref bei Zustandsänderungen
  useEffect(() => {
    isMaximizedRef.current = isMaximized;
  }, [isMaximized]);

  const loadThemes = useCallback(async () => {
    if (window.themeAPI) {
      try {
        const [themesList, activeId] = await Promise.all([
          window.themeAPI.getThemes(),
          window.themeAPI.getActiveTheme()
        ]);
        setThemes(themesList);
        setActiveTheme(activeId);
        
        // Theme anwenden
        const found = themesList.find(t => t.id === activeId) || themesList[0];
        if (found?.css) {
          const link = document.getElementById("theme-style");
          const url = found.css.startsWith("file://") 
            ? found.css 
            : "file:///" + found.css.replace(/\\/g, "/");
          if (link) link.href = url;
        }
      } catch (err) {
        console.warn("Could not load themes:", err);
      }
    }
  }, []);

  // Lade aktives Theme beim Mounten
  useEffect(() => {
    loadThemes();

    // Theme-Änderungen von anderen Fenstern empfangen
    if (window.themeAPI?.onThemeChanged) {
      const handler = (data) => {
        if (data?.css) {
          const link = document.getElementById("theme-style");
          const url = data.css.startsWith("file://")
            ? data.css
            : "file:///" + data.css.replace(/\\/g, "/");
          if (link) link.href = url;

          setActiveTheme(data.themeId);
        }
      };
      const removeListener = window.themeAPI.onThemeChanged(handler);
      return () => {
        if (removeListener) {
          removeListener();
        }
      };
    }
  }, [loadThemes]);

  // Fensterzustand synchronisieren
  useEffect(() => {
    const updateMaximizedState = async () => {
      if (window.windowControls?.isMaximized) {
        const maximized = await window.windowControls.isMaximized();
        setIsMaximized(maximized);
      }
    };

    updateMaximizedState();

    // Event-Listener für maximize/unmaximize registrieren
    if (window.windowControls?.onMaximized && window.windowControls?.onUnmaximized) {
      const onMax = window.windowControls.onMaximized(() => setIsMaximized(true));
      const onUnmax = window.windowControls.onUnmaximized(() => setIsMaximized(false));
      return () => {
        if (onMax) onMax();
        if (onUnmax) onUnmax();
      };
    }
  }, []);

  // Auf Theme-Rescan reagieren (themes:changed Event)
  useEffect(() => {
    if (window.themeAPI?.onThemesChanged) {
      const handler = () => {
        loadThemes();
      };
      const removeListener = window.themeAPI.onThemesChanged(handler);
      return () => {
        if (removeListener) {
          removeListener();
        }
      };
    }
  }, [loadThemes]);

  const renderPage = () => {
    switch (currentPage) {
      case 'integrations':
        return <IntegrationsSettings />;
      case 'plugins':
        return <PluginsSettings />;
      case 'themes':
        return <ThemesSettings themes={themes} activeTheme={activeTheme} setActiveTheme={setActiveTheme} />;
      case 'updates':
        return <UpdatesSettings />;
      case 'about':
        return <AboutSettings />;
      case 'diagnostics':
        return <DiagnosticsSettings />;
      default:
        return <IntegrationsSettings />;
    }
  };

  return (
    <>
      <div className="titlebar">
        <div className="titlebar-left">
          <img className="app-logo" src="../assets/icons/tray.png" alt="WebRadio" />
          <span className="app-title">WebRadio</span>
          <span style={{fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px'}}>· Einstellungen</span>
        </div>
        <div className="titlebar-right">
          <button className="window-btn" onClick={() => handleWindowControl('minimize')}>
            <svg viewBox="0 0 10 1"><rect width="10" height="1" /></svg>
          </button>
          <button className="window-btn" onClick={() => handleWindowControl('maximize')}>
            <svg viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" /></svg>
          </button>
          <button className="window-btn close" onClick={() => handleWindowControl('close')}>
            <svg viewBox="0 0 10 10"><path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" /></svg>
          </button>
        </div>
      </div>
      <div className="settings-main-container">
        <SettingsLayout currentPage={currentPage} setCurrentPage={setCurrentPage} isMaximized={isMaximized}>
          {renderPage()}
        </SettingsLayout>
      </div>
    </>
  );
};

export default SettingsApp;
