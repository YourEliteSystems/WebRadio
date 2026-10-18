# 📻 WebRadio

> **ONE WORLD. ONE SIGNAL.**
>
> Dein Internetradio für den Desktop: WebRadio vereint die Suche nach Sendern aus aller Welt, Favoriten und eine anpassbare Oberfläche in einer quelloffenen Anwendung für Windows und Linux.

[![Version](https://img.shields.io/github/v/release/YourEliteSystems/WebRadio?include_prereleases&style=for-the-badge)](https://github.com/YourEliteSystems/WebRadio/releases)
[![Plattformen](https://img.shields.io/badge/Plattformen-Windows%20%7C%20Linux-blue?style=for-the-badge)](https://github.com/YourEliteSystems/WebRadio/releases)
[![Lizenz](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FYourEliteSystems%2FWebRadio%2Fmain%2Fpackage.json&query=%24.license&label=Lizenz&style=for-the-badge)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/YourEliteSystems/WebRadio/ci.yml?branch=main&label=CI&style=for-the-badge)](https://github.com/YourEliteSystems/WebRadio/actions/workflows/ci.yml)
[![GitHub Stars](https://img.shields.io/github/stars/YourEliteSystems/WebRadio?style=for-the-badge)](https://github.com/YourEliteSystems/WebRadio/stargazers)

**[⬇️ Downloads](../../releases) · [📚 Dokumentation](https://webradio.readthedocs.io/de/latest/) · [🧩 Plugin-SDK](./docs/plugin-sdk/README.md) · [🔒 Datenschutz](./docs/PRIVACY.md) · [🐛 Fehler melden](../../issues) · [💬 Discussions](../../discussions) · [🎮 Discord](https://discord.gg/6PfkRNYw)**

> **Beta-Status:** WebRadio wird aktiv entwickelt. Funktionen und Pakete können sich zwischen Vorabversionen ändern. Prüfe vor der Installation die Hinweise und Dateien des jeweiligen [Releases](../../releases).

---

## 🌍 Radio. Everywhere.

### Dein Radio. Deine Sender. Deine Oberfläche.

Entdecke Internetradios aus aller Welt, speichere deine Favoriten und passe WebRadio mit Themes und Plugins an. Die Anwendung verbindet eine eigene Audiopipeline mit einer erweiterbaren Desktop-Oberfläche – und bleibt als Open-Source-Projekt nachvollziehbar.

**[WebRadio herunterladen](../../releases) · [Projekt erkunden](../../tree/main/docs) · [Mitentwickeln](./CONTRIBUTING.md)**

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

| Plattform | Download | Aktuell veröffentlichte Formate |
| --- | --- | --- |
| 🪟 **Windows** | [Releases](../../releases) | Windows-Installer (EXE); weitere Formate je nach Release |
| 🐧 **Linux** | [Releases](../../releases) | AppImage |
| 🐧 **Arch Linux** | [Releases](../../releases) | `.pkg.tar.zst` |
| 🍎 **macOS** | Derzeit nicht verfügbar | Noch in Vorbereitung |

**Hinweis zu `.deb`:** Ein Build-Skript ist im Repository vorhanden, aber `.deb` ist nicht in jedem veröffentlichten Release enthalten. Verlasse dich bei Downloads auf die tatsächlich angehängten Dateien des jeweiligen Releases.

### Aktuelle Version und Release-Kanäle

Der Quellstand dokumentiert derzeit **v1.0.7-beta.2**. Das zuletzt veröffentlichte GitHub-Beta-Release ist aktuell **[v1.0.7-beta.1](../../releases/tag/v1.0.7-beta.1)**. Diese Angaben können auseinanderliegen, wenn neuere Änderungen noch nicht als Release veröffentlicht wurden. **v1.0.7-beta.2 ist damit nicht automatisch herunterladbar.** Für Downloads gelten ausschließlich die Dateien und Hinweise, die im jeweiligen offiziellen GitHub Release aufgeführt sind.

- **Stable** – verwenden, wenn ein entsprechender stabiler Release veröffentlicht wurde.
- **Beta** – Vorabversionen zum Testen; Fehler und Änderungen sind möglich.
- **Alpha** – frühe Entwicklungsstände, sofern als Release angeboten.

Die Verfügbarkeit von Kanälen und Installationspaketen kann sich je nach Release unterscheiden. Nicht jede Plattform oder jeder Kanal muss für jede Version ein Artefakt enthalten.

📊 **[Download-Statistik](./docs/DOWNLOAD_STATS.md)** – Statistiken zu den GitHub-Release-Assets.

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
| Linux x86_64 .deb | 🟡 Build-Skript vorhanden; nicht in jedem Release veröffentlicht |
| Arch Linux x86_64 | ✅ Produktions-Build |
| macOS | Noch nicht verfügbar – in Vorbereitung |

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
| [📖 Datenschutz](./docs/PRIVACY.md) | Datenschutz und Datenflüsse |
| [🤝 CONTRIBUTING](./CONTRIBUTING.md) | Beiträge und Pull Requests |
| [⚖️ CODE_OF_CONDUCT](./CODE_OF_CONDUCT.md) | Community-Regeln |
| [🔐 SECURITY](./SECURITY.md) | Sicherheitsmeldungen |
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

## 📄 Datenschutz

Externe Datenflüsse werden im Dokumentationsverzeichnis unter [docs/PRIVACY.md](./docs/PRIVACY.md) beschrieben.

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

**Hinweis zur Lizenz:** WebRadio selbst steht unter der Apache License 2.0. Eingebundene Bibliotheken und mitgelieferte Programme können abweichende Lizenzbedingungen haben. Eine erste Übersicht steht in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md); die vollständige transitive Lizenzinventur und die Prüfung der mitgelieferten FFmpeg-Binärdateien sind noch offen.

---

## ❤️ WebRadio

**Eine Anwendung. Tausende Sender. Unzählige Möglichkeiten.**

> **ONE WORLD. ONE SIGNAL.** 📻

Wenn du WebRadio interessant findest, kannst du das Projekt auf GitHub mit einem ⭐ unterstützen.

**[⭐ WebRadio auf GitHub](https://github.com/YourEliteSystems/WebRadio)**
