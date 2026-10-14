import React, { useState, useEffect } from 'react';

const IntegrationsSettings = () => {
  const [integrations, setIntegrations] = useState([]);
  const [discordEnabled, setDiscordEnabled] = useState(false);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    if (!window.integrationsAPI) return;

    try {
      const integrations = await window.integrationsAPI.get();
      setIntegrations(integrations);
      const discordIntegration = integrations.find(i => i.id === "discord-rpc");
      setDiscordEnabled(discordIntegration?.enabled === true);
    } catch (err) {
      console.error("Failed to load integrations:", err);
    }
  };

  const saveIntegrations = async (enabled) => {
    if (!window.integrationsAPI) return;

    try {
      const result = await window.integrationsAPI.update({ id: "discord-rpc", enabled: enabled });
      
      // API-Antwort prüfen: nur bei Erfolg den UI-Zustand finalisieren
      if (result && result.ok === false) {
        console.error("Failed to save integrations:", result.error);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error("Failed to save integrations:", err);
      return false;
    }
  };

  const handleDiscordToggle = async (e) => {
    const enabled = e.target.checked;
    
    // UI-Zustand sofort aktualisieren für reaktives Feedback
    setDiscordEnabled(enabled);
    
    // Speichern mit dem neuen Wert (nicht aus dem State lesen)
    const saved = await saveIntegrations(enabled);
    
    // Bei Speicherfehler: UI-Zustand zurücksetzen
    if (!saved) {
      setDiscordEnabled(!enabled);
    }
  };

  return (
    <div className="settings-page active">
      <div className="settings-page-header">
        <h1>Integrationen</h1>
        <p>Externe Dienste verbinden</p>
      </div>
      
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">Discord Rich Presence</span>
        </div>
        <div className="plugin-item">
          <div className="plugin-item-info">
            <span className="plugin-item-name">Discord Rich Presence aktivieren</span>
            <span style={{fontSize: '11px', color: 'var(--text-muted)'}}>
              Zeigt aktuellen Song in Discord Status
            </span>
          </div>
          <label className="toggle-wrap" title="Discord Rich Presence aktivieren">
            <input 
              type="checkbox" 
              checked={discordEnabled} 
              onChange={handleDiscordToggle}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsSettings;
