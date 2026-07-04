import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

import { initPlayer } from './services/playerService';
import { loadAndApplySavedTheme } from './services/themeService';
import { loadRendererPlugins } from './plugins/RendererPluginManager';

// Initialize audio context and player
async function bootstrap() {
  try {
    // 1. Initialize Player logic (AudioContext, Worklets, etc.)
    await initPlayer();

    // 2. Gespeichertes Theme vor dem ersten React-Render anwenden
    try {
      await loadAndApplySavedTheme();
    } catch (themeErr) {
      console.warn("Could not load themes:", themeErr);
    }

    // 3. Render React App
    const container = document.getElementById('app');
    const root = createRoot(container);
    root.render(<App />);

    // 4. Renderer-Plugins laden (nach React-Mount, damit uiRegistry bereit ist)
    await loadRendererPlugins();

  } catch (err) {
    console.error("Fehler beim Initialisieren der App:", err);
  }
}

bootstrap();