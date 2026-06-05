# WebRadio

WebRadio ist eine Desktop-App fuer Webradio, gebaut mit **Electron**, **React** und **FFmpeg**. Die App durchsucht Radiosender ueber die Radio Browser API, spielt Streams ueber die Web Audio API ab und bringt ein erstes Theme- und Plugin-System mit.

Aktuelle Entwicklungsversion: **v1.0.4**

> WebRadio befindet sich noch im aktiven Umbau. React ist frisch integriert, einige alte Module werden noch entfernt oder spaeter neu angebunden.

## Features

- **Sendersuche** ueber die Radio Browser API
- **FFmpeg-basiertes Streaming** mit PCM-Ausgabe an die Web Audio API
- **Lautstaerkeregelung** mit Speicherung im Renderer
- **Favoriten und Verlauf** ueber lokale JSON-Persistenz
- **Theme-System** mit `theme.json` und CSS-Dateien
- **Plugin-System** mit Main- und optionalen Renderer-Plugins
- **Discord Rich Presence Plugin** als Beispiel fuer ein integriertes Plugin
- **Einstellungsfenster** fuer Plugins, Themes und Updates
- **Update-Check** ueber `latest.json` und externen Download-Link
- **Custom Titlebar** mit eigenen Fensterbuttons

## Geplant oder im Umbau

Diese Funktionen sind im Code teilweise vorbereitet, aber noch nicht final angebunden:

- System Tray und Hintergrundbetrieb
- globale Media-Keys
- neue Core-Struktur fuer Fenster, Tray, Audio, Plugins und Themes
- erweiterte Plugin-API mit Versionierung, Events, Permissions und Plugin-Einstellungen
- ueberarbeitetes Theme-System mit stabileren Metadaten und besserer Vorschau
- Sentry-Integration mit React-Bundle und Sourcemaps

## Tech Stack

| Bereich | Technologie |
| --- | --- |
| App-Framework | Electron |
| UI | React |
| Build | esbuild + Electron Forge |
| Audio | fluent-ffmpeg, ffmpeg-static, Web Audio API |
| Plugins | Node.js im Main-Prozess, optionales Renderer-Skript |
| Paketierung | Electron Forge Maker fuer Windows und Linux |

## Quickstart

### Voraussetzungen

- Node.js 20 oder neuer empfohlen
- npm

### Installation

```bash
git clone https://github.com/YourEliteSystems/WebRadio.git
cd WebRadio
npm install
npm start
```

`npm start` baut zuerst das React-Frontend und startet danach Electron Forge.

## Skripte

| Befehl | Beschreibung |
| --- | --- |
| `npm start` | React bauen und App im Entwicklungsmodus starten |
| `npm run build-react` | Renderer mit esbuild nach `renderer/dist/renderer.js` bauen |
| `npm run package` | App paketieren |
| `npm run make` | Installer bzw. Distributionspakete erstellen |
| `npm run publish` | Release ueber Electron Forge veroeffentlichen |
| `npm run sentry:sourcemaps` | Sentry-Sourcemaps vorbereiten und hochladen, aktuell noch im Umbau |

## Projektstruktur

```txt
WebRadio/
  electron/
    main.js                  # Electron-Hauptprozess, IPC, Fenster, Streaming
    preload.js               # sichere Bridge zwischen Renderer und Main-Prozess
    core/
      eventBus.js            # interner Event-Bus
      ffmpeg-resolver.js     # FFmpeg-Pfad fuer Dev und Build
      storage.js             # Favoriten, Verlauf und Settings
      updater.js             # Update-Check und Download-Link
      mediaKeys.js           # vorbereitet fuer globale Mediensteuerung
      tray.js                # vorbereitet fuer Tray und Hintergrundbetrieb
    plugins/
      pluginManager.js       # Plugin-Erkennung, Aktivierung und Deaktivierung
      pluginAPI.js           # aeltere Plugin-API, wird geprueft

  renderer/
    index.html               # Hauptfenster
    settings.html            # Einstellungsfenster
    renderer.jsx             # React-Einstieg
    App.jsx                  # Root-Komponente
    components/              # Player, Sidebar, Senderliste
    services/playerService.js# AudioContext, Worklet und Stream-Steuerung
    worklets/pcm-processor.js# PCM-Ausgabe im AudioWorklet
    pluginLoader.js          # Renderer-Plugins laden
    styles/core.css          # Basis-Design

  plugins/
    discordRPC/              # Discord Rich Presence Plugin
    logger/                  # einfaches Debug-Plugin
    plugins.json             # Plugin-Aktivierungsstatus

  themes/
    default/
    dark/
    neon/

  docs/
    internal-notes.md        # interne Planung und Aufraeum-Notizen

  DEVELOPER_GUIDE.md         # Anleitung fuer Theme- und Plugin-Autoren
  forge.config.js            # Electron Forge Konfiguration
```

## Plugin-System

Plugins liegen im Ordner `plugins/`. Ein Plugin kann aus einem Main-Skript und optional aus einem Renderer-Skript bestehen.

```txt
plugins/mein-plugin/
  plugin.json
  plugin.js
  renderer.js
```

Beispiel fuer `plugin.json`:

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

Plugins koennen in den Einstellungen aktiviert und deaktiviert werden. Die API ist noch im Ausbau; Details stehen im [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md).

## Theme-System

Themes liegen im Ordner `themes/` und bestehen aus einer `theme.json` plus CSS-Datei.

```txt
themes/mein-theme/
  theme.json
  style.css
```

Beispiel:

```json
{
  "name": "Mein Theme",
  "author": "Dein Name",
  "version": "1.0.0",
  "css": "style.css"
}
```

Das Theme-System ist aktuell ein Uebergangssystem nach dem React-Umstieg. Es funktioniert, wird aber in spaeteren Versionen neu geordnet.

## Enthaltene Plugins

### Discord Rich Presence

Zeigt Radio-Informationen in Discord an, sobald das Plugin aktiv ist und die passenden Events vom Core ausgeliefert werden.

### Logger

Ein kleines Debug-Plugin fuer Konsolenausgaben.

## Build und Release

```bash
npm run build-react
npm run package
npm run make
```

Die Forge-Konfiguration packt `themes/` und `plugins/` als Extra-Ressourcen mit ein. Releases werden ueber GitHub bzw. Electron Forge vorbereitet.

## Hinweise zur aktuellen Version

- Die App wird aktuell vor allem unter Windows getestet.
- Ein Test unter Arch Linux mit Wine 11 war erfolgreich, ist aber noch kein offizieller Linux-Support.
- Einige alte Dateien aus der Zeit vor React werden noch entfernt.
- Interne Umbauplaene stehen in [docs/internal-notes.md](./docs/internal-notes.md).
- Die grobe Entwicklungsplanung steht in [docs/roadmap.md](./docs/roadmap.md).

## Lizenz

Dieses Projekt steht unter der Lizenz, die in der [LICENSE](./LICENSE)-Datei beschrieben ist.
