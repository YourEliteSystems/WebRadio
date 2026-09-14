import React, { useState, useEffect, useCallback } from 'react';
import SettingsLayout from './SettingsLayout';
import IntegrationsSettings from './IntegrationsSettings';
import PluginsSettings from './PluginsSettings';
import ThemesSettings from './ThemesSettings';
import UpdatesSettings from './UpdatesSettings';
import AboutSettings from './AboutSettings';
import DiagnosticsSettings from './DiagnosticsSettings';

const SettingsApp = () => {
  const [currentPage, setCurrentPage] = useState('integrations');
  const [activeTheme, setActiveTheme] = useState(null);
  const [themes, setThemes] = useState([]);

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
    <SettingsLayout currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {renderPage()}
    </SettingsLayout>
  );
};

export default SettingsApp;
