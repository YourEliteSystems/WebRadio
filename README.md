# 🎵 WebRadio

Eine plattformübergreifende Webradio-Desktop-App, gebaut mit **Electron**, **React** und **FFmpeg**. Durchsuche tausende Radiosender weltweit, verwalte Favoriten und passe die App mit eigenen Themes und Plugins an.

> Aktuelle Version: **v1.0.3** · Entwickelt von **YourEliteSystems**

---

## ✨ Features

- 🔍 **Sendersuche** – Live-Suche via [Radio Browser API](https://www.radio-browser.info/) mit tausenden Sendern weltweit
- ▶️ **PCM-Streaming** – FFmpeg dekodiert den Stream direkt als Float32 PCM und gibt ihn über die Web Audio API aus
- 🎚️ **Lautstärkeregelung** – persistente Lautstärke (gespeichert in `localStorage`)
- ⭐ **Favoriten & Verlauf** – Sender als Favorit speichern und Wiedergabeverlauf nachverfolgen
- 🎨 **Theme-System** – drei eingebaute Themes (Default, Dark, Neon) + eigene Themes per CSS-Variablen
- 🔌 **Plugin-System** – erweiterbar mit Backend- und Frontend-Plugins (inkl. Lifecycle-Hooks)
- 🎮 **Discord Rich Presence** – zeigt den aktuell spielenden Radiosender in Discord an
- 🖥️ **System Tray** – App läuft im Hintergrund, steuerbar über das Tray-Icon
- ⌨️ **Media-Key-Support** – Play/Pause, Stop und Next über Multimedia-Tasten der Tastatur
- 🪟 **Custom Titlebar** – rahmenloses Fenster mit eigenen Fenstersteuerungsbuttons

---

## 🛠️ Tech Stack

| Bereich | Technologie |
|---|---|
| App-Framework | [Electron](https://www.electronjs.org/) v40 |
| UI | [React](https://react.dev/) v19 |
| Build | [esbuild](https://esbuild.github.io/) + [Electron Forge](https://www.electronforge.io/) |
| Audio | [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) + [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) + Web Audio API |
| Discord | [discord-rpc](https://github.com/discordjs/discord-rpc) |
| Paketierung | Squirrel (Windows), Deb/RPM (Linux) |

---

## 🚀 Quickstart

### Voraussetzungen

- [Node.js](https://nodejs.org/) ≥ 18
- npm ≥ 9

### Installation & Start

```bash
# Repository klonen
git clone https://github.com/YourEliteSystems/WebRadio.git
cd WebRadio

# Abhängigkeiten installieren
npm install

# App starten (baut React & startet Electron)
npm start
```

### Verfügbare Skripte

| Befehl | Beschreibung |
|---|---|
| `npm start` | React bauen & App im Dev-Modus starten |
| `npm run build-react` | Nur das React-Frontend mit esbuild bundlen |
| `npm run package` | App paketieren (ohne Installer) |
| `npm run make` | Installer/Distributionspakete erstellen |
| `npm run publish` | Release auf GitHub veröffentlichen |

---

## 📁 Projektstruktur

```
WebRadio/
├── electron/
│   ├── main.js              # Electron Hauptprozess, IPC-Handler, FFmpeg-Streaming
│   ├── preload.js           # Context Bridge (IPC-API für den Renderer)
│   ├── core/
│   │   ├── eventBus.js      # Interner Event-Bus (Main-Prozess)
│   │   ├── ffmpeg-resolver.js
│   │   ├── mediaKeys.js     # Multimedia-Tasten (Play/Pause/Stop/Next)
│   │   ├── session.js       # Session-ID-Verwaltung
│   │   ├── storage.js       # Favoriten & Verlauf (JSON-Persistenz)
│   │   └── tray.js          # System-Tray-Icon & Kontextmenü
│   └── plugins/
│       ├── pluginManager.js # Plugin laden, starten, stoppen, toggling
│       └── pluginAPI.js     # Plugin-Registrierung (Frontend)
├── renderer/
│   ├── index.html           # Haupt-HTML
│   ├── settings.html        # Einstellungs-Fenster
│   ├── App.jsx              # Root React-Komponente
│   ├── renderer.jsx         # React-Einstiegspunkt
│   ├── components/
│   │   ├── PlayerBar.jsx    # Untere Playerleiste
│   │   ├── Sidebar.jsx      # Linke Suchleiste & Navigation
│   │   └── StationGrid.jsx  # Senderkarten-Raster
│   ├── services/
│   │   ├── playerService.js # Web Audio API – PCM-Wiedergabe
│   │   └── radioService.js  # Radio Browser API
│   ├── pluginLoader.js      # Lädt & initialisiert Plugin-Renderer-Skripte
│   └── styles/              # CSS-Stylesheets
├── plugins/
│   ├── discordRPC/          # Discord Rich Presence Plugin
│   └── logger/              # Logger Plugin
├── themes/
│   ├── default/             # Standard-Theme
│   ├── dark/                # Dark-Theme
│   └── neon/                # Neon-Theme
├── assets/                  # Icons & statische Assets
├── build/                   # Build-Ressourcen (Icons für Installer)
├── forge.config.js          # Electron Forge Konfiguration
└── DEVELOPER_GUIDE.md       # Anleitung für Plugin- & Theme-Entwicklung
```

---

## 🔌 Plugin-System

Plugins können tief in die App integriert werden. Jedes Plugin besteht aus einem optionalen **Backend-Skript** (Node.js, läuft im Hauptprozess) und einem optionalen **Frontend-Skript** (läuft im Renderer).

### Plugin-Struktur

```
plugins/mein-plugin/
├── plugin.json    # Metadaten (Name, ID, Version, Author)
├── plugin.js      # Backend-Logik (Node.js)
└── renderer.js    # Frontend-UI (optional)
```

### Verfügbare Lifecycle-Hooks (Backend)

```javascript
module.exports = {
  init()              { /* Plugin wurde aktiviert */ },
  destroy()           { /* Plugin wurde deaktiviert */ },
  onMetadata(meta)    { /* Neuer Song / StreamTitle */ },
  onStationChange(s)  { /* Sender gewechselt */ },
  onPlay()            { /* Stream gestartet */ },
  onStop()            { /* Stream gestoppt */ },
  onVolumeChange(v)   { /* Lautstärke geändert */ },
  onThemeChange(t)    { /* Theme gewechselt */ }
};
```

Plugins können in den **Einstellungen** aktiviert/deaktiviert werden – ohne Neustart der App.

> Weitere Details im [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)

---

## 🎨 Theme-System

Themes basieren auf CSS-Variablen und werden aus dem `themes/`-Verzeichnis geladen. Ein Theme besteht aus:

```
themes/mein-theme/
├── theme.json   # { "name": "Mein Theme", "css": "style.css" }
└── style.css    # Überschreibt CSS-Custom-Properties
```

Wichtige Variablen:

```css
:root {
  --bg-main: #0f1115;
  --accent-color: #6366f1;
  --text-main: #e2e8f0;
  /* ... */
}
```

Themes können in den **Einstellungen** live gewechselt werden.

---

## 🎮 Enthaltene Plugins

### Discord Rich Presence (`discordRPC`)
Zeigt den aktuell spielenden Radiosender inklusive Sendername und Song direkt in Discord an. Nutzt die Discord RPC API.

### Logger (`logger`)
Einfaches Logging-Plugin für Debugging-Zwecke.

---

## 📦 Build & Release

```bash
# Paket erstellen (ohne Installer)
npm run package

# Installer erstellen (Squirrel für Windows, Deb/RPM für Linux)
npm run make

# Release auf GitHub veröffentlichen (Draft)
npm run publish
```

Releases werden automatisch als **Draft** auf GitHub erstellt. Die Paketierung schließt `themes/` und `plugins/` als `extraResources` ein, sodass sie im installierten Programm erweiterbar bleiben.

---

## 📄 Lizenz

Dieses Projekt steht unter der Lizenz, die in der [LICENSE](./LICENSE)-Datei beschrieben ist.
