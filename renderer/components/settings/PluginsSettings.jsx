import React, { useState, useEffect, useCallback } from 'react';

const PluginsSettings = () => {
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);

  const loadPlugins = useCallback(async () => {
    try {
      setLoading(true);
      const plugins = await window.api.getPlugins();
      setPlugins(plugins);
    } catch (err) {
      console.error("Failed to load plugins:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlugins();

    // Auf globale Plugin-Änderungen reagieren
    if (window.api?.onPluginsChanged) {
      const handler = () => {
        loadPlugins();
      };
      window.api.onPluginsChanged(handler);
      return () => {
        if (window.api?.onPluginsChanged) {
          window.api.onPluginsChanged(handler);
        }
      };
    }
  }, [loadPlugins]);

  const handleTogglePlugin = async (pluginId, enabled) => {
    try {
      await window.api.togglePlugin(pluginId, enabled);
      // Plugin-Liste neu laden
      await loadPlugins();
    } catch (err) {
      console.error("Failed to toggle plugin:", err);
    }
  };

  const handleReloadPlugins = async () => {
    try {
      setReloading(true);
      if (window.api?.reloadPlugins) {
        await window.api.reloadPlugins();
      }
    } catch (err) {
      console.error("Failed to reload plugins:", err);
    } finally {
      setReloading(false);
    }
  };

  const openPluginsFolder = async () => {
    if (window.diagnosticsAPI?.getPaths) {
      try {
        const paths = await window.diagnosticsAPI.getPaths();
        if (paths?.plugins) {
          window.shellAPI?.openPath(paths.plugins);
        }
      } catch (err) {
        console.error("Failed to open plugins folder:", err);
      }
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h1>Plugins</h1>
        <p>Erweiterungen aktivieren oder deaktivieren</p>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">Installierte Plugins</span>
          <div style={{display: 'flex', gap: '8px'}}>
            <button 
              onClick={openPluginsFolder}
              className="diag-open-btn"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Ordner öffnen
            </button>
            <button 
              onClick={handleReloadPlugins}
              className="btn-secondary" 
              style={{width: 'auto', padding: '6px 14px', fontSize: '12px'}}
              disabled={reloading}
            >
              {reloading ? '↺ Rescan läuft…' : '↺ Neu laden'}
            </button>
          </div>
        </div>
        
        <div id="pluginList">
          {loading ? (
            <p style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0'}}>
              Wird geladen...
            </p>
          ) : plugins.length === 0 ? (
            <p style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0'}}>
              Keine Plugins gefunden
            </p>
          ) : (
            plugins.map((plugin) => (
              <div key={plugin.id} className="plugin-item">
                <div className="plugin-item-info">
                  <span className="plugin-item-name">{plugin.name}</span>
                </div>
                <label className="toggle-wrap" title={plugin.enabled ? 'Deaktivieren' : 'Aktivieren'}>
                  <input 
                    type="checkbox" 
                    checked={plugin.enabled || false}
                    onChange={(e) => handleTogglePlugin(plugin.id, e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PluginsSettings;
