# 📻 WebRadio

> **ONE WORLD. ONE SIGNAL.**
>
> Ein moderner, plattformübergreifender Open-Source-Radioplayer für Windows und Linux – mit tausenden Sendern, leistungsstarker Audiowiedergabe, Themes und einem echten Plugin-System.

[![Version](https://img.shields.io/badge/version-1.0.7--alpha.5-6366f1?style=for-the-badge)](./CHANGELOG.md)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=for-the-badge)]()
[![License](https://img.shields.io/badge/license-see%20LICENSE-green?style=for-the-badge)](./LICENSE)
[![Build](https://img.shields.io/github/actions/workflow/status/YourEliteSystems/WebRadio/ci.yml?branch=main&label=CI&style=for-the-badge)](https://github.com/YourEliteSystems/WebRadio/actions/workflows/ci.yml)
[![GitHub Stars](https://img.shields.io/github/stars/YourEliteSystems/WebRadio?style=for-the-badge)](https://github.com/YourEliteSystems/WebRadio/stargazers)

**[⬇️ Downloads](../../releases) · [📚 Documentation](https://webradio.readthedocs.io/de/latest/) · [🧩 Plugin SDK](./docs/plugin-sdk/README.md) · [🐛 Issues](../../issues) · [💬 Discussions](../../discussions) · [🎮 Discord](https://discord.gg/6PfkRNYw)**

---

## 🌍 Radio. Everywhere.

Warum zwischen Webseiten, Tabs und einzelnen Apps wechseln?

**WebRadio bringt Internetradio an einen Ort.**

Suche Sender aus aller Welt, speichere deine Favoriten, höre Musik direkt über eine native FFmpeg-Audiopipeline und passe die Anwendung mit Themes und Plugins an deine eigenen Vorstellungen an.

> **Nicht nur ein Radioplayer.**
> **Eine Plattform, die du erweitern kannst.**

---

## ✨ Was macht WebRadio besonders?

### 🌍 Tausende Sender
Finde Radiosender aus aller Welt über die **Radio Browser API** – mit Filtern für Länder und Genres.

### 🎧 Native Audiopipeline
Streams werden über **FFmpeg** verarbeitet und als PCM über eine **AudioWorklet-Pipeline** wiedergegeben.

```
Radio Stream
     ↓
   FFmpeg
     ↓
    PCM
     ↓
 AudioWorklet
     ↓
   Output
```

Kein HTML-`<audio>`-Element als zentrale Wiedergabelösung.

### 🧩 Erweiterbar durch Plugins
WebRadio besitzt ein echtes Plugin-System mit Manifesten, Permissions, Capabilities, Lifecycle, Storage, Navigation, UI-Erweiterungen und kontrollierter HTTP-Umgebung.

Plugins können WebRadio erweitern, ohne den Core mit projektspezifischen Sonderfällen zu überladen.

### 🎨 Deine Oberfläche
Themes basieren auf CSS-Variablen und Theme-Paketen.

Passe WebRadio an deinen Stil an – von schlicht bis auffällig.

### 🎮 Discord Rich Presence
Zeige deinen aktuellen Sender und Songtitel direkt in Discord.

### ⭐ Favoriten & Verlauf
Speichere Sender und finde kürzlich gehörte Stationen schnell wieder.

### 🔄 Update-Kanäle
Wähle zwischen **Stable**, **Beta** und **Alpha** – direkt über die Einstellungen.

---

## 🖥️ Ein Blick auf WebRadio

WebRadio soll sich nicht wie eine Webseite im Desktop-Fenster anfühlen, sondern wie eine eigenständige Anwendung.

**Ziel:** eine klare Oberfläche, schnelle Navigation und ein Player, der während der gesamten Nutzung im Mittelpunkt bleibt.

> 📸 **Screenshots und ein kurzer Demo-Clip folgen hier, sobald aktuelles Material aus der finalen UI vorliegt.**
>
> Wir verzichten bewusst darauf, veraltete Screenshots einzubauen – die README soll immer die tatsächlich aktuelle Anwendung zeigen.

---

## 🧩 Make WebRadio yours

Das Plugin-System ist ein zentraler Bestandteil der Architektur.

Ein Plugin kann unter anderem:

- eigene Navigation bereitstellen
- eigene UI-Views und Slots registrieren
- den Unified Player verwenden
- eigene Einstellungen und Storage nutzen
- Events abonnieren
- kontrollierte externe Ressourcen verwenden
- eigene Integrationen bereitstellen
- Capabilities über das Manifest anfordern

### Sicherheitsmodell

```text
Plugin
   ↓
Capability Request
   ↓
Core Validation
   ↓
Security Policy
   ↓
Capability Granted / Denied
   ↓
PluginContext / PluginAPI
   ↓
Controlled Runtime
```

Plugins können Fähigkeiten **anfordern**, aber nicht selbst gewähren oder Sicherheitsgrenzen verändern.

Unbekannte Capabilities werden abgelehnt.

Weitere Informationen:
[📖 Capability System](./docs/plugin-sdk/13-Capabilities.md)

### Aktuelles Beispiel: YouTube Integration

Das YouTube-Plugin zeigt, wie Integrationen außerhalb des Core umgesetzt werden können.

Es nutzt unter anderem:

- `player`
- `http-origin`
- `youtube-iframe`
- `youtube-api`

und bindet die Wiedergabe über den **Unified Player** ein.

---

## 🎨 Theme-System

Themes sind ein weiterer Weg, WebRadio individuell zu gestalten.

Aktuell sind unter anderem folgende Themes im Projekt vorhanden:

- `default`
- `dark`
- `neon`

Eigene Themes können als externe Theme-Pakete bereitgestellt werden.

Mehr dazu:
[🎨 Theme SDK](./docs/theme-sdk/README.md)

---

## 🎵 Unified Player

WebRadio bündelt unterschiedliche Wiedergabequellen hinter einer gemeinsamen Player-API.

| Provider | Quelle |
| --- | --- |
| `RadioProvider` | Internetradio über FFmpeg + Web Audio API |
| `MediaHubProvider` | YouTube über das Integrationsplugin |

Der Player stellt unter anderem bereit:

- Play / Pause / Stop
- Lautstärke
- aktiven Provider
- Wiedergabestatus
- Titel / Interpret
- Artwork
- Provider-Informationen

Der Renderer greift über `useUnifiedPlayer` und die Player-API darauf zu.

---

## ⬇️ Download

Du möchtest WebRadio einfach ausprobieren? Du brauchst **keine Entwicklungsumgebung**.

| Plattform | Download | Format |
| --- | --- | --- |
| 🪟 **Windows** | [Releases](../../releases) | NSIS Installer / Portable |
| 🐧 **Linux** | [Releases](../../releases) | AppImage / .deb |
| 🐧 **Arch Linux** | [Releases](../../releases) | .pkg.tar.zst |
| 🍎 **macOS** | [Releases](../../releases) | derzeit vorbereitet |

### Welche Version?

- **Stable** → für den normalen täglichen Einsatz
- **Beta** → neue Funktionen früher testen
- **Alpha** → aktuelle Entwicklung ausprobieren

> Die verfügbaren Artefakte und Release Notes findest du immer direkt im jeweiligen **GitHub Release**.

---

## 🚀 Schnellstart für Entwickler

### Voraussetzungen

- **Node.js 26 oder neuer**
- **npm 10 oder neuer**

### Installation

```bash
git clone https://github.com/YourEliteSystems/WebRadio.git
cd WebRadio
npm install
npm run dev
```

`npm run dev` baut das React-Frontend mit esbuild und startet anschließend Electron.

---

## 👋 Für wen ist WebRadio?

**Für Hörer:** Sender suchen, Favoriten speichern und einfach Musik oder Radio hören.

**Für Entwickler:** Eine Electron-/React-Anwendung mit klar getrennten Core-, Player-, Plugin- und UI-Bereichen.

**Für Creator & Modder:** Eigene Plugins, Themes und Integrationen bauen und WebRadio um neue Funktionen erweitern.

**Für Open-Source-Begeisterte:** Code lesen, testen, Fehler melden, Ideen einbringen oder direkt mitentwickeln.

---

## 🛠️ Technologie

| Bereich | Technologie |
| --- | --- |
| Desktop | Electron |
| UI | React 19 |
| Build | esbuild + electron-builder |
| Audio | FFmpeg + Web Audio API |
| Sender | Radio Browser API |
| Plugins | Vanilla JavaScript / ES Modules |
| Themes | CSS / Theme Packages |
| Updates | electron-updater |
| RPC | Discord Rich Presence |

---

## 🖥️ Plattformen

| Plattform | Status |
| --- | --- |
| Windows x64 | ✅ Haupt-Testplattform |
| Linux x86_64 AppImage | ✅ Produktions-Build |
| Linux x86_64 .deb | ✅ Produktions-Build |
| Arch Linux x86_64 | ✅ Produktions-Build |
| macOS | 💡 Vorbereitet |

### Linux

Die Linux-Builds sind eigenständig. Auf dem Zielsystem werden für die fertige Anwendung **kein Node.js, npm, Electron oder FFmpeg** benötigt.

**AppImage**

```bash
chmod +x WebRadio-*-linux-x86_64.AppImage
./WebRadio-*-linux-x86_64.AppImage
```

**Arch Linux**

```bash
sudo pacman -U webradio-*-x86_64.pkg.tar.zst
```

Weitere Informationen:
[🛠 Cross-Platform Setup](./docs/CROSS_PLATFORM_SETUP.md)

---

## 📦 Build-Skripte

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsmodus |
| `npm run build` | React-Renderer produktiv bauen |
| `npm run dist` | Installer für aktuelle Plattform |
| `npm run dist:win` | Windows NSIS + Portable |
| `npm run dist:linux` | Linux AppImage + deb |
| `npm run dist:linux:appimage` | Nur AppImage |
| `npm run dist:linux:deb` | Nur .deb |
| `npm run dist:linux:arch` | Arch-Paket |
| `npm run make:linux` | AppImage + Arch |
| `npm run make:linux:all` | AppImage + Arch + deb |
| `npm test` | Test-Suite |

---

## 📚 Dokumentation

Wenn du WebRadio nicht nur benutzen, sondern **erweitern** möchtest:

| Dokument | Inhalt |
| --- | --- |
| [📖 Docs-Übersicht](./docs/Readme.md) | Zentrales Inhaltsverzeichnis |
| [🏛️ Architektur](./docs/architecture.md) | Core, Lifecycle und Subsysteme |
| [🧩 Plugin SDK](./docs/plugin-sdk/README.md) | Plugins entwickeln |
| [🔐 Capability System](./docs/plugin-sdk/13-Capabilities.md) | Permissions & Capabilities |
| [🎨 Theme SDK](./docs/theme-sdk/README.md) | Eigene Themes |
| [📘 API Reference](./docs/api-reference/README.md) | Öffentliche APIs |
| [🔌 Integration SDK](./docs/IntegrationSDK.md) | Offizielle Integrationen |
| [🔄 Update-Architektur](./docs/UPDATE_ARCHITECTURE.md) | Update-System |
| [🤝 Contributing](./CONTRIBUTING.md) | Beiträge und Pull Requests |
| [⚖️ Code of Conduct](./CODE_OF_CONDUCT.md) | Community-Regeln |
| [🔐 Security Policy](./SECURITY.md) | Sicherheitsmeldungen |
| [🗺️ Roadmap](./ROADMAP.md) | Geplante Entwicklung |

---

## 🏗️ Architektur

Der Core ist in klar getrennte Bereiche aufgeteilt:

```text
WebRadio
├── Electron Main
│   ├── Audio / FFmpeg
│   ├── Player
│   ├── Plugins
│   ├── Navigation
│   ├── Storage
│   ├── Updates
│   ├── Diagnostics
│   └── Services
│
├── React Renderer
│   ├── Components
│   ├── Hooks
│   ├── UI Registry
│   ├── Plugin Manager
│   └── AudioWorklets
│
├── Plugins
├── Themes
├── Packaging
└── Documentation
```

Der Core bleibt dabei möglichst generisch. Erweiterungen wie MediaHub-Funktionen werden über Plugins umgesetzt.

---

## 🔄 Update-System

WebRadio unterstützt drei Update-Kanäle:

- **Stable** – reguläre Releases
- **Beta** – Beta- und stabile Releases
- **Alpha** – Alpha-, Beta- und stabile Releases

Die Auswahl wird in den Einstellungen gespeichert und wirkt ohne Neustart auf manuelle und automatische Update-Prüfungen.

### Plattformen

| Plattform | Auto-Update |
| --- | --- |
| Windows NSIS | ✅ |
| Linux AppImage | ✅ |
| Linux .deb | ✅ |
| Linux Arch | ❌ – Paketmanager |
| macOS | 🟡 Vorbereitet |

Updates stammen ausschließlich aus den offiziellen GitHub-Releases.

---

## 🤝 Mitmachen

WebRadio ist ein Open-Source-Projekt und lebt von Menschen, die es ausprobieren, testen, verbessern und erweitern.

Du kannst beispielsweise:

- 🐛 Bugs melden
- 💡 Ideen einbringen
- 🧩 Plugins entwickeln
- 🎨 Themes erstellen
- 🌍 Übersetzungen beitragen
- 💻 Code verbessern
- 📖 Dokumentation erweitern

👉 **[Beitragen → CONTRIBUTING.md](./CONTRIBUTING.md)**

Bitte beachte außerdem unseren
[Code of Conduct](./CODE_OF_CONDUCT.md).

---

## 🔐 Sicherheit

Sicherheitslücken bitte **nicht öffentlich über Issues melden**.

Weitere Informationen:
[🔐 Security Policy](./SECURITY.md)

---

## 📄 Lizenz

Die Lizenz dieses Projekts ist in [LICENSE](./LICENSE) beschrieben.

© 2026 Your Elite Systems

---

## ❤️ WebRadio

**Eine Anwendung. Tausende Sender. Unzählige Möglichkeiten.**

> **ONE WORLD. ONE SIGNAL.** 📻

Wenn du WebRadio interessant findest, kannst du das Projekt auf GitHub mit einem ⭐ unterstützen.

**[⭐ WebRadio auf GitHub](https://github.com/YourEliteSystems/WebRadio)**
