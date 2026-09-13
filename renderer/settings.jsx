import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsApp from './components/settings/SettingsApp';

// Settings Window Einstiegspunkt
function bootstrapSettings() {
  try {
    const container = document.getElementById('settings-root');
    if (container) {
      const root = createRoot(container);
      root.render(<SettingsApp />);
    } else {
      console.error("Settings root container not found");
    }
  } catch (err) {
    console.error("Fehler beim Initialisieren der Settings:", err);
  }
}

// Initialisiere Settings, wenn DOM bereit ist
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  bootstrapSettings();
} else {
  document.addEventListener('DOMContentLoaded', bootstrapSettings);
}
