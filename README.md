# 📻 WebRadio

> Ein moderner, erweiterbarer Desktop-Radioplayer von **Your Elite Systems** – gebaut mit Electron, React 19 und FFmpeg.

[![Version](https://img.shields.io/badge/version-1.0.7--alpha.1-6366f1?style=flat-square)](./CHANGELOG.md)
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
| 🧩 **Plugin-System** | Erweiterbar durch Vanilla-JS Plugins mit Capability-System und Plugin-HTTP-Umgebung |
| 🎮 **Discord RPC** | Zeigt den aktuellen Sender und Songtitel live in Discord an |
| ⚙️ **Einstellungen** | Plugins und Themes verwalten, Updates prüfen |
| 🔄 **Auto-Updater** | GitHub-basierte Updates mit **Alpha**-, **Beta**- und **Stable**-Kanal |

---

## 🚀 Quickstart

### Voraussetzungen

- **Node.js** 26 oder neuer
- **npm** 10 oder neuer

### Installation & Start

```bash
git clone https://github.com/YourEliteSystems/WebRadio.git
cd WebRadio
npm install
npm run dev
```

`npm run dev` baut zuerst das React-Frontend mit esbuild und startet danach Electron im Entwicklungsmodus.

---

## 🛠️ Tech Stack

| Bereich | Technologie |
| --- | --- |
| App-Framework | [Electron](https://www.electronjs.org/) |
| UI | [React 19](https://react.dev/) |
| Build / Bundle | [esbuild](https://esbuild.github.io/), [electron-builder](https://www.electron.build/) |
| Audio | [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg), ffmpeg-static, Web Audio API |
| Plugins | Vanilla JavaScript (ES Modules), Capability-System |
| Installer | electron-builder (NSIS / AppImage / deb / pkg.tar.zst / DMG) |

---

## 📦 Skripte

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsmodus starten |
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

> **Hinweis Auto-Updates:** Auf **AppImage** und **.deb** funktioniert der integrierte Auto-Updater (electron-updater). Auf **Arch Linux (.pkg.tar.zst)** läuft die Versionsverwaltung bewusst über den Paketmanager – die App zeigt verfügbare Updates an, verlinkt aber auf den GitHub-Release.

---

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
│       ├── diagnostics/          # Logging, Crash-Handler, Bootup-Diagnostics
│       ├── integrations/         # Offizielle Integrationen
│       ├── ipc/                  # IPC-Handler (Radio, Player, Plugins, ...)
│       ├── navigation/           # Plugin-gesteuerte Navigation
│       ├── platform/             # RuntimeDetector (OS/Packaging-Erkennung)
│       ├── player/               # Unified Player (PlayerManager + Provider)
│       ├── plugins/              # Plugin-System (Manager, Runtime, API, HTTP)
│       ├── services/             # CredentialManager, Discord, RadioBrowser
│       ├── storage/              # Settings, Favoriten, Verlauf
│       ├── themes/               # Theme-Manager & Loader
│       ├── ui/                   # UI-Registry & Renderer
│       └── updates/              # UpdateManager & Provider
│
├── renderer/                     # React-Frontend
│   ├── components/               # UI-Bausteine (Sidebar, PlayerBar, Grid)
│   ├── hooks/                    # u. a. useUnifiedPlayer
│   ├── models/                   # Datenmodelle
│   ├── plugins/                  # RendererPluginManager
│   ├── services/                 # Audio-Player-Logik
│   ├── styles/                   # Basis-Styles
│   ├── ui/                       # Plugin-Registry (Views & Slots)
│   └── worklets/                 # Audio-Worklets
│
├── plugins/                      # Plugins
│   └── youtube/                  # YouTube-Integration (MediaHub-Anwendungsfall)
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
│   ├── release/                  # Release- & Validierungs-Skripte
│   └── tests/                    # Automatisierte Tests
│
└── docs/                         # 📚 Dokumentation (hier findest du alles!)
```

---

## 📚 Dokumentation

Die vollständige Dokumentation liegt im [`docs/`](./docs/Readme.md) Ordner.

| Dokument | Inhalt |
| --- | --- |
| [📖 Docs-Übersicht](./docs/Readme.md) | Zentrales Inhaltsverzeichnis aller Dokumentation |
| [🏛️ Architektur](./docs/architecture.md) | Aufbau des Core, Lifecycle und Subsysteme |
| [🧩 Plugin SDK](./docs/plugin-sdk/README.md) | Plugins entwickeln (Manifest, Lifecycle, API) |
| [🔐 Capability System](./docs/plugin-sdk/13-Capabilities.md) | Capabilities, Validierung und Plugin-HTTP-Umgebung |
| [🎨 Theme SDK](./docs/theme-sdk/README.md) | Themes erstellen und anpassen |
| [📘 API Reference](./docs/api-reference/README.md) | Technische Referenz der öffentlichen APIs |
| [🔌 Integration SDK](./docs/IntegrationSDK.md) | Offizielle Integrationen |
| [🔄 Update-Architektur](./docs/UPDATE_ARCHITECTURE.md) | Runtime-Erkennung & Update-Provider |
| [🛠 Cross-Platform Setup](./docs/CROSS_PLATFORM_SETUP.md) | Build & Distribution pro Plattform |
| [🤝 Contributing](./CONTRIBUTING.md) | Wie du beitragen kannst |
| [⚖️ Code of Conduct](./CODE_OF_CONDUCT.md) | Community-Regeln |
| [🔐 Security Policy](./SECURITY.md) | Sicherheitslücken melden |
| [🗺️ Roadmap](./ROADMAP.md) | Geplante Versionen und Meilensteine |

---

## 🧩 Plugin-System

WebRadio lädt Plugins über einen zentralen `PluginManager`. Ein Plugin besteht aus einem Manifest
(`plugin.json` oder `manifest.json`) und optional einem Renderer-Skript.

```text
Plugin
   ↓
Capability Request (Manifest)
   ↓
Core Validation (PluginPermissions + CapabilityRegistry)
   ↓
Core Security Policy
   ↓
Capability Granted / Denied
   ↓
PluginContext / PluginAPI
   ↓
Controlled Runtime
```

> **Wichtig:** Plugins können Fähigkeiten anfordern, aber keine Fähigkeiten gewähren, erweitern oder
> Sicherheitsgrenzen verändern. Der Core enthält keine Plugin-ID-Sonderfälle.
> Für den aktuellen Stand der Capabilities und der Plugin-HTTP-Umgebung siehe
> [Capability System](./docs/plugin-sdk/13-Capabilities.md).

### Plugin-Komponenten

| Komponente | Aufgabe |
| --- | --- |
| `PluginManager` | Entdeckung, Lifecycle, Enable/Disable, Rescan |
| `PluginLoader` | Manifest-Discovery & Fingerprinting |
| `PluginRuntime` | `init()` / `destroy()`, Event-Hooks, Cleanup |
| `PluginContext` | Isolierter Kontext pro Plugin |
| `PluginAPI` | Öffentliche API (logger, storage, settings, events, navigation, player, ui) |
| `PluginPermissions` | Permission- und Capability-Validierung |
| `CapabilityRegistry` | Zentrale Registry bekannter Capabilities |
| `PluginHttpServer` | Lokaler HTTP-Server für Plugin-Ressourcen (127.0.0.1) |
| `PluginStorage` | Plugin-spezifische Persistenz |

### Capabilities

| Capability | Benötigt | Erlaubte externe Origins |
| --- | --- | --- |
| `http-origin` | – | – (nur lokal) |
| `local-assets` | `http-origin` | – |
| `external-origin` | `http-origin` | – |
| `youtube-iframe` | `external-origin` | youtube.com, youtube-nocookie.com, s.ytimg.com, i.ytimg.com |
| `youtube-api` | `youtube-iframe` | wie `youtube-iframe` |
| `player` | – | – |

Unbekannte Capabilities werden immer abgelehnt. Details:
[Capability System](./docs/plugin-sdk/13-Capabilities.md).

### Plugin HTTP Environment

- Lauscht ausschließlich auf `127.0.0.1` (localhost-only, dynamischer Port)
- Nur registrierte Plugin-Pfade werden ausgeliefert
- Path-Traversal-Schutz (Pfad darf Plugin-Root nicht verlassen)
- Origin-Validation über die gewährten Capabilities
- CORS: nur für erlaubte Origins
- Nur `GET` und `HEAD` erlaubt
- Sauberer Shutdown über den `Application`-Lifecycle

### MediaHub als erster Anwendungsfall

Das YouTube-Integrationsplugin (`plugins/youtube/`) nutzt dieses generische System:

- Permissions: `player`, `http-origin`
- Capabilities: `youtube-iframe`, `youtube-api`
- Lädt Assets über `http://127.0.0.1:<port>/plugins/youtube/...`
- Nutzt die YouTube IFrame API und meldet den State an den Unified Player

---

## 🎵 Unified Player

Der Unified Player bündelt alle Wiedergabequellen hinter einer einheitlichen API.

### PlayerManager

- Provider-Registry (`registerProvider` / `unregisterProvider` / `setActiveProvider`)
- Controls (`play` / `pause` / `stop` / `toggle` / `setVolume`)
- State (`getState` / `subscribe` / `updateProviderState`)
- Nur der aktive Provider darf den globalen State setzen

### Provider

| Provider | Quelle |
| --- | --- |
| `RadioProvider` | Internetradio über FFmpeg + Web Audio API (Core) |
| `MediaHubProvider` | YouTube über das YouTube-Integrationsplugin |

### Player State

```javascript
{
  state:   "idle",       // idle | loading | playing | paused | stopped | error
  title:   "Songtitel",
  artist:  "Künstler",
  artwork: "https://...",
  volume:  0.7,
  source:  {
    id:       "mediahub",
    name:     "MediaHub",
    provider: "YouTube",
    type:     "youtube"
  }
}
```

Im Renderer wird der State über `useUnifiedPlayer` / `playerAPI` konsumiert; die PlayerBar zeigt
Sender, interpret und Titel an. Technische Provider-Felder werden nicht als sichtbarer Musik-Inhalt
verwendet.

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

## 🔄 Update-System

WebRadio bezieht Updates aus dem offiziellen GitHub-Repository und nutzt die integrierte Auto-Update-Logik auf Basis von `electron-updater`.

### Kanäle

In den Einstellungen kann zwischen drei Kanälen gewählt werden:

- **Stable** – Standard. Liefert ausschließlich stabile Releases.
- **Beta** – Liefert Beta- und stabile Releases. Beim erstmaligen Aktivieren erscheint eine deutliche Sicherheitswarnung.
- **Alpha** – Liefert Alpha-, Beta- und stabile Releases für frühe Tests.

Der Kanal wird zentral ermittelt (User-Setting → Versions-Fallback → Stable-Fallback) und im Main-Prozess dauerhaft in `settings.json` (`userData`) gespeichert. Der Wechsel ist jederzeit in beide Richtungen möglich. Beta → Stable funktioniert auch, wenn die installierte Beta-Version **numerisch neuer** ist als die stabile – die `allowDowngrade`-Option von electron-updater kümmert sich darum.

**Persistenz & Neustart:** Die Auswahl (Alpha, Beta, Stable) bleibt nach einem vollständigen Neustart erhalten und ist danach in UI und Updater identisch aktiv. Fehlt eine Einstellung, greift der bestehende Standard (Versions-Erkennung; bei Stable-Builds `stable`). Ein ungültig gespeicherter Wert fällt sicher auf den Standard zurück und löscht keine anderen Einstellungen.

**Kanal-Wechsel:** Der Wechsel wirkt sofort für manuelle und automatische Update-Prüfungen – ein Neustart ist dafür nicht nötig. Die installierte Version (z. B. `1.0.7-alpha.1`) bleibt bis zum nächsten installierten Update unverändert; die UI kennzeichnet Kanal der installierten Version und aktiven Update-Kanal getrennt.

**Update-API:** `window.updatesAPI` (alias `window.updateAPI`) bietet `getChannel()`, `getStoredChannel()`, `setChannel()`, `getChannelMetadata()`, `getAllChannelMetadata()` und `getCurrentVersion()`. Alle Werte werden im Main-Prozess validiert; der Renderer hat keinen Dateisystemzugriff und kann keine Pfade oder Manager-Instanzen beeinflussen.

> **Hinweis:** Channel und Severity sind unterschiedliche Konzepte. Die Severity (`normal` / `important` / `critical`) eines Updates ist unabhängig vom gewählten Channel.

### Versionen

Releases folgen strikt [SemVer](https://semver.org/):

```
v1.0.7-alpha.1   (alpha)
v1.0.7-beta.1    (beta)
v1.0.7           (stable)
```

Stable-Releases werden als „Latest" auf GitHub veröffentlicht, Alpha- und Beta-Releases werden als **Pre-Release** markiert.

### Verhalten

- **Auto-Check**: optional beim App-Start (in Einstellungen deaktivierbar), danach höchstens alle 6 Stunden
- **Auto-Download**: aus. Updates werden zur Bestätigung angezeigt („Später" oder „Update herunterladen")
- **Release Notes**: werden aus den GitHub Release Notes gelesen und sicher dargestellt
- **Notifications**: System-Benachrichtigung nur einmal pro Version (Deduplizierung)
- **Offline**: WebRadio funktioniert vollständig offline. Der Update-Check ist optional und blockiert nie den App-Start

### Plattform-Unterstützung

| Plattform | Auto-Update | Hinweis |
| --- | --- | --- |
| Windows (NSIS) | ✅ | via `latest.yml` / `beta.yml` |
| Linux AppImage | ✅ | via `latest-linux.yml` / `beta-linux.yml` |
| Linux .deb | ✅ | via `latest-linux.yml` / `beta-linux.yml` |
| Linux Arch (.pkg.tar.zst) | ❌ | Update via `pacman -U` aus GitHub-Releases |
| macOS | 🟡 Vorbereitet | electron-builder-Konfig vorhanden, kein Release-Workflow |

Arch-Linux-Benutzer sehen in der App verfügbare Updates, müssen das `.pkg.tar.zst` aber manuell über `pacman` installieren. Das ist eine bewusste Designentscheidung – das `PKGBUILD` ist die einzige autoritative Quelle für Arch-Pakete.

### Sicherheit

- Es werden **keine GitHub-Tokens oder persönlichen Credentials** im Client ausgeliefert
- Update-Quellen sind ausschließlich die offiziellen GitHub-Releases
- Release Notes werden vor dem Rendern sanitiert (kein rohes HTML, keine `javascript:`-URLs)
- Renderer hat keinen Zugriff auf `exec`, `spawn` oder `shell.openExternal` für die Installation – diese läuft ausschließlich über electron-updater im Main-Prozess

## 🤝 Beitragen

Beiträge sind herzlich willkommen! Lies unseren [Contributing Guide](./CONTRIBUTING.md) für Infos zu Branch-Konventionen, Commit-Nachrichten und dem PR-Prozess.

Bitte beachte unseren [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## 🔐 Sicherheit

Sicherheitslücken bitte **nicht** über öffentliche Issues melden. Lies stattdessen unsere [Security Policy](./docs/SECURITY.md).

---

## 📄 Lizenz

Dieses Projekt steht unter der Lizenz, die in der [LICENSE](./LICENSE)-Datei beschrieben ist.

© 2026 Your Elite Systems. Alle Rechte vorbehalten.
