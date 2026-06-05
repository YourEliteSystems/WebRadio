# WebRadio Developer Guide

Dieser Guide richtet sich an alle, die eigene **Themes** oder **Plugins** für WebRadio erstellen möchten.

| Bereich | Status |
| --- | --- |
| Zielgruppe | Theme- und Plugin-Autoren |
| App-Version | `v1.0.4` in Entwicklung |
| API-Status | nutzbar, aber noch im Ausbau |
| Interne Planung | [docs/internal-notes.md](./docs/internal-notes.md) |

> Die aktuelle Plugin- und Theme-Struktur funktioniert, ist aber noch nicht final. Baue neue Erweiterungen möglichst klein und räume Ressourcen sauber wieder auf.

## Schnellstart

| Du möchtest | Dann nutze |
| --- | --- |
| Farben und Layout anpassen | ein Theme in `themes/` |
| auf Metadaten, Play oder Stop reagieren | ein Main-Plugin in `plugins/` |
| sichtbare Elemente einfügen | ein Renderer-Plugin |
| beides kombinieren | `plugin.js` plus `renderer.js` |

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

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `name` | ja | Anzeigename in den Einstellungen |
| `author` | empfohlen | Autor des Themes |
| `version` | empfohlen | Version des Themes |
| `css` | ja | CSS-Datei relativ zum Theme-Ordner |

### style.css

Themes überschreiben aktuell vor allem CSS-Variablen aus `renderer/styles/core.css`.

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

### Theme-Regeln

- Nutze bevorzugt CSS-Variablen.
- Vermeide tiefe Selektor-Überschreibungen, solange das React-Layout noch im Umbau ist.
- Halte Theme-CSS klein und gut lesbar.
- Prüfe helle und dunkle Kontraste.
- Plane ein, dass Theme-Metadaten in späteren Versionen erweitert werden.

### Theme testen

1. Ordner unter `themes/` anlegen.
2. `theme.json` und `style.css` erstellen.
3. App starten.
4. Einstellungen öffnen.
5. Im Bereich **Themes** auf **Neu laden** klicken.
6. Theme auswählen.

## Plugins

Ein Plugin liegt in einem eigenen Ordner unter `plugins/`.

```txt
plugins/mein-plugin/
  plugin.json
  plugin.js
  renderer.js
```

`plugin.js` läuft im Main-Prozess. `renderer.js` ist optional und läuft im Renderer.

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

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `name` | ja | Anzeigename in den Einstellungen |
| `id` | ja | eindeutige Plugin-ID |
| `version` | empfohlen | Plugin-Version |
| `main` | optional | Main-Prozess-Skript |
| `renderer` | optional | Renderer-Skript |
| `author` | empfohlen | Autor des Plugins |
| `description` | empfohlen | kurze Beschreibung |

Die `id` sollte stabil bleiben. Sie wird für Aktivierung, Deaktivierung und Renderer-Registrierung genutzt.

## Main-Plugin

Beispiel für `plugin.js`:

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

### Vorbereitete Hooks

| Hook | Zweck |
| --- | --- |
| `init()` | Plugin wurde geladen oder aktiviert |
| `destroy()` | Plugin wird deaktiviert oder entladen |
| `onMetadata(meta)` | Metadaten eines Streams |
| `onStationChange(station)` | Senderwechsel |
| `onPlay(data)` | Wiedergabe gestartet |
| `onStop()` | Wiedergabe gestoppt |
| `onVolumeChange(value)` | Lautstärke geändert |
| `onThemeChange(theme)` | Theme gewechselt |

Einige Events werden im aktuellen Core noch vereinheitlicht. `init()` und `destroy()` sollten deshalb immer sauber funktionieren, auch wenn andere Events später angepasst werden.

## Renderer-Plugin

Renderer-Plugins registrieren sich über `window.registerPluginRenderer`.

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

### Renderer-Regeln

- Räume in `destroy()` alle DOM-Elemente, Timer und Listener wieder auf.
- Nutze sichtbare Elemente bevorzugt im Bereich `#plugin-area`.
- Halte Renderer-Plugins klein.
- Vermeide ungeprüfte globale Änderungen am DOM.
- Rechne damit, dass die Plugin-UI später stärker in React integriert wird.

## Plugin testen

1. Plugin-Ordner unter `plugins/` anlegen.
2. `plugin.json` erstellen.
3. Optional `plugin.js` und/oder `renderer.js` erstellen.
4. App starten.
5. Einstellungen öffnen.
6. Im Bereich **Plugins** auf **Neu laden** klicken.
7. Plugin aktivieren oder deaktivieren.

## Stabilität und Sicherheit

| Empfehlung | Grund |
| --- | --- |
| Fehler selbst abfangen | Plugins sollen die App nicht mitreißen |
| Ressourcen freigeben | wichtig bei Aktivieren und Deaktivieren |
| keine sensiblen Daten speichern | Plugin-System ist noch nicht sandboxed |
| Netzwerkzugriffe sparsam nutzen | Vertrauen und Performance schützen |
| keine großen DOM-Eingriffe | React-Integration bleibt wartbarer |

## Externe Dienste

| Dienst | Einschätzung |
| --- | --- |
| Webradio | Standardweg über Radio Browser API und Stream-URL |
| Spotify | DRM-geschützt, nicht direkt per FFmpeg abspielbar |
| YouTube Music | technisch möglich, aber mit zusätzlicher Auflösung und rechtlicher Prüfung |

## Zukünftige Erweiterungen

Geplant oder angedacht:

- API-Versionen für Plugins
- stabilere Event-Namen
- Plugin-Einstellungen
- Plugin-Permissions
- Theme-Metadaten mit Kompatibilitätsangaben
- spätere Wiki-Struktur für größere Dokumentation
