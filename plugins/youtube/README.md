# YouTube Integration Plugin

Offizielles YouTube Integration Plugin für WebRadio.

## Features

- **YouTube Wiedergabe:** Direktes Abspielen von YouTube-Videos in WebRadio
- **URL & ID Support:** Unterstützt sowohl vollständige YouTube-URLs als auch Video-IDs
- **Player-Steuerung:** Play, Pause, Stop über integrierte Controls
- **Event-Integration:** Nutzt WebRadio EventBus für Play/Stop Events
- **Storage-Integration:** Speichert Wiedergabehistorie und Einstellungen
- **Theme-Integration:** Passt sich automatisch an das aktive Theme an
- **Logging:** Vollständige Integration in WebRadio Diagnostics-System

## Installation

1. Kopiere den `youtube` Ordner in dein WebRadio Plugin-Verzeichnis:
   ```
   plugins/youtube/
   ```

2. Aktiviere das Plugin in den WebRadio Einstellungen unter Plugins.

## Verwendung

1. Öffne WebRadio und navigiere zur Sidebar
2. Klicke auf "YouTube" in der Plugin-Navigation
3. Gib eine YouTube-URL oder Video-ID ein
4. Klicke auf "Laden" oder drücke Enter
5. Das Video wird automatisch abgespielt

## Steuerung

- **Play:** ▶ Button oder YouTube-Player Controls
- **Pause:** ⏸ Button oder YouTube-Player Controls  
- **Stop:** ⏹ Button (stoppt Video und leert Player)

## API

Das Plugin stellt folgende Funktionen über `window.youtubePlugin` zur Verfügung:

```javascript
// Player initialisieren
window.youtubePlugin.initPlayer(containerId, videoId, options);

// Steuerung
window.youtubePlugin.playVideo();
window.youtubePlugin.pauseVideo();
window.youtubePlugin.stopVideo();
window.youtubePlugin.setVolume(volume);
window.youtubePlugin.seekTo(seconds);

// Status
window.youtubePlugin.getPlayerState();
window.youtubePlugin.getCurrentTime();
window.youtubePlugin.getDuration();
window.youtubePlugin.isReady();
window.youtubePlugin.getCurrentVideoId();

// Hilfsfunktionen
window.youtubePlugin.extractVideoId(url);
window.youtubePlugin.getVideoInfo(videoId);
```

## Plugin-Struktur

```
youtube/
├── plugin.json      # Plugin Manifest
├── main.js          # Backend-Logik (Event-Handling, Storage)
├── renderer.js      # Frontend-Logik (YouTube API, UI)
└── README.md        # Diese Datei
```

## Integration

Das Plugin nutzt:

- **EventBus:** `onPlay`, `onStop`, `onVolumeChange`
- **Storage:** Plugin-spezifischer Speicher für History und Settings
- **Logger:** WebRadio Logging System
- **UI-System:** Registriert eigene View in Sidebar

## Anforderungen

- WebRadio >= 1.0.0
- Internetverbindung für YouTube IFrame API

## Lizenz

MIT

## Autor

YourEliteSystems

## Hinweise

- Das Plugin verwendet die offizielle YouTube IFrame API
- Keine zusätzlichen npm-Abhängigkeiten erforderlich
- Vollständig in Plugin-Architektur integriert (keine Core-Änderungen)
