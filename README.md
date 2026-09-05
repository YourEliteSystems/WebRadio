# 📻 WebRadio

> Ein moderner, erweiterbarer Desktop-Radioplayer von **Your Elite Systems** – gebaut mit Electron, React 19 und FFmpeg.

[![Version](https://img.shields.io/badge/version-1.0.5-6366f1?style=flat-square)](./CHANGELOG.md)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=flat-square)]()
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

`npm start` baut zuerst das React-Frontend mit esbuild und startet danach Electron im Entwicklungsmodus.

---

## 🛠️ Tech Stack

| Bereich | Technologie |
| --- | --- |
| App-Framework | [Electron](https://www.electronjs.org/) |
| UI | [React 19](https://react.dev/) |
| Build / Bundle | [esbuild](https://esbuild.github.io/), [electron-builder](https://www.electron.build/) |
| Audio | [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg), ffmpeg-static, Web Audio API |
| Plugins | Vanilla JavaScript (ES Modules) |
| Installer | electron-builder (NSIS / AppImage / deb / pkg.tar.zst / DMG) |

---

## 📦 Skripte

| Befehl | Zweck |
| --- | --- |
| `npm start` | Entwicklungsmodus starten |
| `npm run build` | Renderer (React) produktions-bauen |
| `npm run dist` | Installer für die aktuelle Plattform |
| `npm run dist:win` | Windows-Installer (NSIS + Portable) |
| `npm run dist:linux` | Linux AppImage + deb |
| `npm run dist:linux:appimage` | Nur AppImage bauen |
| `npm run dist:linux:deb` | Nur .deb bauen |
| `npm run dist:linux:arch` | Arch-Linux-Paket (.pkg.tar.zst) |
| `npm run make:linux` | AppImage + Arch-Paket |
| `npm run make:linux:all` | AppImage + Arch + deb |
| `npm test` | Test-Suite (inkl. Plattform-Pfade) |

---

## 🐧 Linux / Arch Linux

WebRadio wird für Linux x86_64 als AppImage und als natives Arch-Paket ausgeliefert. Beide Builds sind eigenständig – es muss **kein Node.js, npm, Electron oder FFmpeg** auf dem Zielsystem installiert sein.

### AppImage nutzen

```bash
chmod +x WebRadio-*-linux-x86_64.AppImage
./WebRadio-*-linux-x86_64.AppImage
```

### Arch-Paket installieren

```bash
sudo pacman -U webradio-*-x86_64.pkg.tar.zst
```

WebRadio ist anschließend über das Desktop-Menü und via `webradio` im Terminal verfügbar.

### Deinstallation

```bash
sudo pacman -R webradio
```

### Lokaler Build

```bash
npm install
npm run make:linux
```

Ergebnis:

- `dist/WebRadio-<version>-linux-x86_64.AppImage`
- `dist/webradio-<version>-x86_64.pkg.tar.zst`

> Das Arch-Paket wird lokal über `makepkg` gebaut – Arch-spezifische Tools (`pacman`, `makepkg`) müssen installiert sein. In CI läuft der Arch-Build in einem offiziellen `archlinux:latest`-Container (siehe [`.github/workflows/build-linux.yml`](./.github/workflows/build-linux.yml)).

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
│       ├── plugins/              # Plugin-Loader, API, Context
│       └── themes/               # Theme-Manager
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
├── packaging/                    # Distributions-Bausteine
│   └── arch/                     # PKGBUILD für Arch Linux
│
├── scripts/
│   ├── build-linux-arch.js       # Helfer für Arch-Build
│   └── tests/                    # Automatisierte Tests
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
| [🛠 Cross-Platform Setup](./docs/CROSS_PLATFORM_SETUP.md) | Build & Distribution pro Plattform |

---

## 🧩 Erweiterbarkeit

WebRadio ist als offene Plattform konzipiert:

- **Themes** ändern das komplette Aussehen der App über CSS-Variablen.
- **Plugins** können eigene Seiten (`registerView`) oder Widgets (`registerSlot`) tief in die React-Oberfläche integrieren – in purem Vanilla JavaScript.
- Das **Plugin-API** wächst mit jeder Version.

---

## 🧪 Plattform-Support

| Plattform | Status |
| --- | --- |
| Windows (x64) | ✅ Haupt-Testplattform |
| Linux x86_64 (AppImage) | ✅ Produktions-Build |
| Linux x86_64 (.deb) | ✅ Produktions-Build |
| Arch Linux x86_64 (.pkg.tar.zst) | ✅ Produktions-Build |
| macOS | 💡 Vorbereitet (electron-builder) |

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
