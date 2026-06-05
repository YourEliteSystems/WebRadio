# WebRadio Developer Guide

Dieser Guide richtet sich an alle, die eigene **Themes** oder **Plugins** fuer WebRadio erstellen moechten. Interne Architektur- und Roadmap-Notizen stehen getrennt in `docs/internal-notes.md`.

> Stand: WebRadio v1.0.4. Theme- und Plugin-System funktionieren bereits, werden aber in den naechsten Versionen weiter ausgebaut.

## Themes

Ein Theme liegt in einem eigenen Ordner unter `themes/`.

```txt
themes/mein-theme/
  theme.json
  style.css
```

### theme.json

```json
{
  "name": "Mein Theme",
  "author": "Dein Name",
  "version": "1.0.0",
  "css": "style.css"
}
```

| Feld | Bedeutung |
| --- | --- |
| `name` | Anzeigename in den Einstellungen |
| `author` | Autor des Themes |
| `version` | Theme-Version |
| `css` | CSS-Datei relativ zum Theme-Ordner |

### style.css

Themes ueberschreiben aktuell vor allem CSS-Variablen aus `renderer/styles/core.css`.

```css
:root {
  --bg-main: #0f1115;
  --bg-sidebar: rgba(22, 25, 33, 0.7);
  --bg-card: rgba(35, 40, 52, 0.6);
  --bg-card-hover: rgba(50, 57, 73, 0.8);

  --titlebar-bg: #161921;
  --text-main: #e2e8f0;
  --text-muted: #94a3b8;

  --accent-color: #6366f1;
  --accent-hover: #4f46e5;
  --accent-glow: rgba(99, 102, 241, 0.4);
}
```

Hinweise:

- Nutze bevorzugt CSS-Variablen statt harte Selektor-Ueberschreibungen.
- Halte Theme-CSS klein, damit es mit zukuenftigen React-Komponenten kompatibel bleibt.
- Das Theme-System ist aktuell noch ein Uebergangssystem und kann sich in spaeteren Versionen aendern.

### Theme testen

1. Theme-Ordner unter `themes/` anlegen.
2. `theme.json` und `style.css` erstellen.
3. App starten.
4. Einstellungen oeffnen.
5. Im Bereich **Themes** auf **Neu laden** klicken.
6. Theme auswaehlen.

## Plugins

Ein Plugin liegt in einem eigenen Ordner unter `plugins/`.

```txt
plugins/mein-plugin/
  plugin.json
  plugin.js
  renderer.js
```

`plugin.js` laeuft im Main-Prozess. `renderer.js` ist optional und laeuft im Renderer.

### plugin.json

```json
{
  "name": "Mein Plugin",
  "id": "meinPlugin",
  "version": "1.0.0",
  "main": "plugin.js",
  "renderer": "renderer.js",
  "author": "Dein Name",
  "description": "Kurze Beschreibung"
}
```

| Feld | Bedeutung |
| --- | --- |
| `name` | Anzeigename in den Einstellungen |
| `id` | eindeutige Plugin-ID |
| `version` | Plugin-Version |
| `main` | optionales Main-Prozess-Skript |
| `renderer` | optionales Renderer-Skript |
| `author` | Autor des Plugins |
| `description` | kurze Beschreibung |

Die `id` sollte stabil bleiben, weil sie fuer Aktivierung, Deaktivierung und Renderer-Registrierung genutzt wird.

## Main-Plugin

Beispiel fuer `plugin.js`:

```javascript
module.exports = {
  init() {
    console.log("Plugin gestartet");
  },

  destroy() {
    console.log("Plugin beendet");
  },

  onMetadata(meta) {
    console.log("Metadaten:", meta.StreamTitle);
  },

  onPlay(data) {
    console.log("Stream gestartet:", data);
  },

  onStop() {
    console.log("Stream gestoppt");
  }
};
```

Aktuell vorbereitet sind diese Hook-Namen:

| Hook | Zweck |
| --- | --- |
| `init()` | Plugin wurde geladen oder aktiviert |
| `destroy()` | Plugin wird deaktiviert oder entladen |
| `onMetadata(meta)` | Metadaten eines Streams |
| `onStationChange(station)` | Senderwechsel |
| `onPlay(data)` | Wiedergabe gestartet |
| `onStop()` | Wiedergabe gestoppt |
| `onVolumeChange(value)` | Lautstaerke geaendert |
| `onThemeChange(theme)` | Theme gewechselt |

Einige Events werden im aktuellen Core noch vereinheitlicht. Fuer neue Plugins sollten `init()` und `destroy()` immer sauber implementiert werden; weitere Events koennen sich waehrend des Core-Umbaus noch aendern.

## Renderer-Plugin

Renderer-Plugins registrieren sich ueber `window.registerPluginRenderer`.

```javascript
let element = null;

window.registerPluginRenderer("meinPlugin", {
  init: () => {
    const area = document.getElementById("plugin-area");
    if (!area) return;

    element = document.createElement("button");
    element.textContent = "Mein Plugin";
    area.appendChild(element);
  },

  destroy: () => {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
    element = null;
  }
});
```

Wichtig:

- Raeume in `destroy()` alle DOM-Elemente, Timer und Listener wieder auf.
- Nutze fuer sichtbare Elemente bevorzugt den Bereich `#plugin-area`.
- Halte Renderer-Plugins klein, weil die Plugin-UI spaeter noch staerker in React integriert werden kann.

## Plugin testen

1. Plugin-Ordner unter `plugins/` anlegen.
2. `plugin.json` erstellen.
3. Optional `plugin.js` und/oder `renderer.js` erstellen.
4. App starten.
5. Einstellungen oeffnen.
6. Im Bereich **Plugins** auf **Neu laden** klicken.
7. Plugin aktivieren oder deaktivieren.

## Sicherheit und Stabilitaet

Plugins laufen aktuell mit viel Vertrauen in der App. Deshalb:

- Keine unnoetigen Netzwerkzugriffe einbauen.
- Keine sensiblen Daten speichern.
- Fehler in Plugin-Code immer selbst abfangen.
- Ressourcen bei Deaktivierung freigeben.
- Keine grossen UI-Elemente unkontrolliert in den Renderer einhaengen.

## Externe Dienste

Integrationen wie Spotify oder YouTube Music brauchen eigene APIs oder SDKs.

- Spotify-Streams sind DRM-geschuetzt und koennen nicht einfach per FFmpeg abgespielt werden.
- YouTube-Integrationen sind technisch moeglich, brauchen aber eigene Aufloesung und rechtliche Pruefung.
- Fuer Webradio bleibt die Radio Browser API der aktuelle Standardweg.

## Zukunft

Geplant sind unter anderem:

- API-Versionen fuer Plugins
- stabilere und besser dokumentierte Events
- Plugin-Einstellungen
- Plugin-Permissions
- ueberarbeitetes Theme-System
- spaetere Wiki-Struktur fuer groessere Dokumentation
