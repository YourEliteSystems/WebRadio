# 📻 WebRadio

> Ein moderner, erweiterbarer Desktop-Radioplayer von **Your Elite Systems** – gebaut mit Electron, React 19 und FFmpeg.

[![Version](https://img.shields.io/badge/version-1.0.5-6366f1?style=flat-square)](./CHANGELOG.md)
[![Platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)]()
[![License](https://img.shields.io/badge/license-see%20LICENSE-green?style=flat-square)](./LICENSE)

---

## ✨ Was ist WebRadio?

WebRadio ist ein plattformübergreifender Desktop-Radioplayer mit einem modernen Glassmorphism-Design. Er verbindet tausende Radiosender aus aller Welt mit einem leistungsstarken Plugin- und Theme-System, das sich für Entwickler und Modder gleichermaßen öffnet.

| Feature | Beschreibung |
| --- | --- |
| 🌍 **Sendersuche** | Durchsuche tausende Sender über die Radio Browser API – filterbar nach Land und Genre |
| ▶️ **Wiedergabe** | FFmpeg dekodiert Streams direkt und gibt PCM-Daten an die Web Audio API weiter |
| ⭐ **Favoriten & Verlauf** | Sender speichern und zuletzt gehörte Sender sofort wiederfinden |
| 🎨 **Theme-Engine** | Komplett anpassbares Design über CSS-Variablen und Theme-Pakete |
| 🧩 **Plugin-System** | Erweiterbar durch Vanilla-JS Plugins (eigene Seiten, Widgets & Overlays) |
| 🎮 **Discord RPC** | Zeigt den aktuellen Sender und Songtitel live in Discord an |
| ⚙️ **Einstellungen** | Plugins und Themes verwalten, Updates prüfen |
| 🔄 **Auto-Updater** | Sucht im Hintergrund nach neuen Versionen |

---

## 🚀 Quickstart

### Voraussetzungen

- **Node.js** 20 oder neuer
- **npm** 10 oder neuer

### Installation & Start

```bash
git clone https://github.com/YourEliteSystems/WebRadio.git
cd WebRadio
npm install
npm start
```

`npm start` baut zuerst das React-Frontend mit esbuild und startet danach Electron Forge im Entwicklungsmodus.

---

## 🛠️ Tech Stack

| Bereich | Technologie |
| --- | --- |
| App-Framework | [Electron](https://www.electronjs.org/) |
| UI | [React 19](https://react.dev/) |
| Build / Bundle | [esbuild](https://esbuild.github.io/), [Electron Forge](https://www.electronforge.io/) |
| Audio | [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg), ffmpeg-static, Web Audio API |
| Plugins | Vanilla JavaScript (ES Modules) |
| Installer | Electron Forge Squirrel (Windows) |

---

## 📦 Skripte

| Befehl | Zweck |
| --- | --- |
| `npm start` | Entwicklungsmodus starten |
| `npm run build-react` | Nur den Renderer neu bauen |
| `npm run make` | Installerpaket erstellen |
| `npm run package` | App paketieren (ohne Installer) |
| `npm run publish` | Release über Electron Forge veröffentlichen |

---

## 📁 Projektstruktur

```
WebRadio/
├── electron/                     # Electron Main-Prozess (Backend)
│   ├── main.js                   # App-Einstiegspunkt
│   ├── preload.js                # Sichere IPC-Bridge
│   └── core/
│       ├── app/                  # Fenster-Management
│       ├── audio/                # Stream-Management & FFmpeg
│       ├── ipc/                  # IPC-Handler (Favorites, History, ...)
│       └── plugins/              # Plugin-Loader, API, Context
│
├── renderer/                     # React-Frontend
│   ├── App.jsx                   # Haupt-Komponente & View-Routing
│   ├── components/               # UI-Bausteine (Sidebar, Player, Grid)
│   ├── services/                 # Audio-Player-Logik
│   └── ui/                       # Plugin-Registry (Views & Slots)
│
├── plugins/                      # Plugins
│   └── discordRPC/               # Discord Rich Presence Plugin
│
├── themes/                       # CSS-Themes
│   ├── default/
│   ├── dark/
│   └── neon/
│
└── docs/                         # 📚 Dokumentation (hier findest du alles!)
```

---

## 📚 Dokumentation

Die vollständige Dokumentation liegt im [`docs/`](./docs/README.md) Ordner.

| Dokument | Inhalt |
| --- | --- |
| [📖 Docs-Übersicht](./docs/README.md) | Zentrales Inhaltsverzeichnis aller Dokumentation |
| [🔌 Plugin Development Guide](./docs/plugin-development-guide.md) | Plugin-API, Views, Slots, Lifecycle |
| [🎨 Theme Development Guide](./docs/theme-development-guide.md) | Themes erstellen und anpassen |
| [🤝 Contributing](./docs/CONTRIBUTING.md) | Wie du beitragen kannst |
| [⚖️ Code of Conduct](./docs/CODE_OF_CONDUCT.md) | Community-Regeln |
| [🔐 Security Policy](./docs/SECURITY.md) | Sicherheitslücken melden |
| [🗺️ Roadmap](./docs/roadmap.md) | Geplante Versionen und Meilensteine |

---

## 🧩 Erweiterbarkeit

WebRadio ist als offene Plattform konzipiert:

- **Themes** ändern das komplette Aussehen der App über CSS-Variablen.
- **Plugins** können eigene Seiten (`registerView`) oder Widgets (`registerSlot`) tief in die React-Oberfläche integrieren – in purem Vanilla JavaScript.
- Das **Plugin-API** wächst mit jeder Version. In v1.2 kommt ein vollständiges Permissions-System dazu.

---

## 🧪 Plattform-Support

| Plattform | Status |
| --- | --- |
| Windows | ✅ Haupt-Testplattform |
| Linux (Wine) | ⚠️ Erster Test erfolgreich (Wine 11) |
| Linux nativ | 🔜 Geplant |
| macOS | 💡 Langfristig angedacht |

---

## 🤝 Beitragen

Beiträge sind herzlich willkommen! Lies unseren [Contributing Guide](./docs/CONTRIBUTING.md) für Infos zu Branch-Konventionen, Commit-Nachrichten und dem PR-Prozess.

Bitte beachte unseren [Code of Conduct](./docs/CODE_OF_CONDUCT.md).

---

## 🔐 Sicherheit

Sicherheitslücken bitte **nicht** über öffentliche Issues melden. Lies stattdessen unsere [Security Policy](./docs/SECURITY.md).

---

## 📄 Lizenz

Dieses Projekt steht unter der Lizenz, die in der [LICENSE](./LICENSE)-Datei beschrieben ist.

© 2025 Your Elite Systems. Alle Rechte vorbehalten.
