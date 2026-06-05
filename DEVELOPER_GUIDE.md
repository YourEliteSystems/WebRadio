# WebRadio Entwicklerhandbuch

Willkommen beim Entwicklerhandbuch! Hier erfährst du, wie du eigene Plugins und Themes für die WebRadio-App erstellst und diese ohne Neustart der Anwendung direkt testen kannst.

---

## 🎨 1. Eigene Themes entwickeln

Ein Theme verändert das gesamte Erscheinungsbild der App. Die WebRadio-App nutzt ein modernes CSS-Variablen-System (Glassmorphism, Dark Mode).

### Verzeichnisstruktur
Erstelle einen neuen Ordner in `themes/` (z.B. `themes/my-theme/`):
- `theme.json` (Metadaten)
- `style.css` (Deine Styles)

### Die `theme.json`
```json
{
  "name": "Mein Custom Theme",
  "css": "style.css"
}
```

### Die `style.css`
Du kannst die globalen Variablen der App überschreiben. Hier sind die wichtigsten Variablen, die du anpassen solltest:

```css
:root {
  --bg-main: #0f1115; /* Haupt-Hintergrundfarbe */
  --bg-sidebar: rgba(22, 25, 33, 0.7); /* Sidebar mit Transparenz */
  --bg-card: rgba(35, 40, 52, 0.6); /* Sender-Karten */
  --bg-card-hover: rgba(50, 57, 73, 0.8);
  
  --titlebar-bg: #161921; /* Kopfzeile */
  --text-main: #e2e8f0; /* Heller Text */
  --text-muted: #94a3b8; /* Gedimmter Text */
  
  --accent-color: #6366f1; /* Primärfarbe (z.B. Buttons) */
  --accent-hover: #4f46e5;
  --accent-glow: rgba(99, 102, 241, 0.4);
}
```

> [!TIP]
> **Testen ohne Neustart:** Wenn du ein neues Theme erstellst oder CSS änderst, öffne die Einstellungen in der App und klicke bei "Themes" auf **Neu laden**. Dein Theme taucht sofort auf!

---

## ⚙️ 2. Eigene Plugins entwickeln

Plugins können tief in das System eingreifen. Sie bestehen optional aus einem **Backend-Skript** (`main.js`) für Hintergrund-Logik und einem **Frontend-Skript** (`renderer.js`) für UI-Erweiterungen.

### Verzeichnisstruktur
Erstelle einen Ordner in `plugins/` (z.B. `plugins/my-plugin/`):
- `plugin.json` (Metadaten)
- `plugin.js` (Backend Node.js Code)
- `renderer.js` (Optional: Frontend UI Code)

### Die `plugin.json`
```json
{
  "name": "Mein Cooles Plugin",
  "id": "myCoolPlugin",
  "version": "1.0.0",
  "main": "plugin.js",
  "renderer": "renderer.js",
  "author": "Dein Name",
  "description": "Was macht das Plugin?"
}
```

### Das Backend (`plugin.js`)
Das Backend läuft in Node.js. Du kannst Lebenszyklus-Hooks und Events verwenden:

```javascript
module.exports = {
  // Wird aufgerufen, wenn das Plugin aktiviert wird
  init() {
    console.log("Mein Plugin ist gestartet!");
  },
  
  // Wird aufgerufen, wenn das Plugin deaktiviert wird
  destroy() {
    console.log("Mein Plugin wird beendet. Zeit aufzuräumen!");
  },

  // Event-Hooks
  onMetadata(meta) {
    console.log("Neuer Song:", meta.StreamTitle);
  },
  onStationChange(station) {
    console.log("Sender gewechselt:", station.name);
  },
  onPlay() { console.log("Stream gestartet"); },
  onStop() { console.log("Stream gestoppt"); }
};
```

### Das Frontend (`renderer.js`)
Wenn dein Plugin sichtbare Elemente braucht (z.B. ein Icon oben rechts), nutze das Renderer-Skript:

```javascript
let myElement = null;

// Registriere das UI-Plugin
window.registerPluginRenderer("myCoolPlugin", {
  init: () => {
    // Finde den dedizierten Plugin-Bereich
    const area = document.getElementById("plugin-area");
    if(area) {
      myElement = document.createElement("div");
      myElement.textContent = "Hallo Welt";
      area.appendChild(myElement);
    }
  },
  destroy: () => {
    // Wird aufgerufen, wenn das Plugin deaktiviert wird. Unbedingt aufräumen!
    if (myElement && myElement.parentNode) {
      myElement.parentNode.removeChild(myElement);
    }
    myElement = null;
  }
});
```

---

## 🎧 3. Fortgeschrittene Plugins: Spotify & YouTube Music

Ein häufiger Wunsch ist die Integration von Plattformen wie **Spotify** oder **YouTube Music**.

### Geht das mit FFmpeg?
Die App nutzt standardmäßig `fluent-ffmpeg`, um Webradio-Streams abzurufen.
- **YouTube Music:** Ja! FFmpeg kann YouTube-Audio extrahieren, meist in Kombination mit Bibliotheken wie `ytdl-core` oder `yt-dlp`. Ein Backend-Plugin (`plugin.js`) könnte den YouTube-Link auflösen und die rohe Audio-URL an das Frontend oder direkt an `ffmpeg` weitergeben.
- **Spotify:** Nein, nicht über FFmpeg. Spotify-Streams sind DRM-geschützt. FFmpeg kann diese nicht nativ lesen.

### Wie binde ich Spotify trotzdem ein?
Anstatt das Backend (FFmpeg) zu nutzen, kannst du für Spotify ein **Frontend-Plugin** (`renderer.js`) schreiben.
Dort kannst du das offizielle **Spotify Web Playback SDK** per `<script>` Tag laden. Das SDK übernimmt die Audio-Wiedergabe im Browser-Kontext der App. Das Plugin pausiert dann einfach das Standard-Webradio (`window.radioAPI.stopStream()`) und spielt stattdessen Musik über das Spotify SDK ab!

> [!IMPORTANT]
> **Hot-Reloading für Entwickler:** Gehe in die Einstellungen und klicke bei "Plugins" auf **Neu laden**, sobald du einen neuen Plugin-Ordner erstellt hast. Du kannst das Plugin dann mit einem Klick aktivieren/deaktivieren, um deinen Code sofort in Aktion zu sehen!
