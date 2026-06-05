import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

import { initPlayer } from './services/playerService';

// Initialize audio context and player
async function bootstrap() {
  try {
    // 1. Initialize Player logic (AudioContext, Worklets, etc.)
    await initPlayer();

    // 2. Load themes if available
    if (window.themeAPI && window.themeAPI.getThemes) {
      try {
        const themes = await window.themeAPI.getThemes();
        if (themes && themes.length > 0) {
          // Default to the second theme or first, depending on what the user originally had
          const defaultTheme = themes.length > 1 ? themes[1].css : themes[0].css;
          
          let link = document.getElementById("theme-style");
          if (!link) {
            link = document.createElement("link");
            link.rel = "stylesheet";
            link.id = "theme-style";
            document.head.appendChild(link);
          }
          link.href = defaultTheme;
        }
      } catch (themeErr) {
        console.warn("Could not load themes:", themeErr);
      }
    }

    // 3. Render React App
    const container = document.getElementById('app');
    const root = createRoot(container);
    root.render(<App />);

  } catch (err) {
    console.error("Fehler beim Initialisieren der App:", err);
  }
}

bootstrap();