# WebRadio

Ein moderner Desktop-Player für Webradio, gebaut mit **Electron**, **React** und **FFmpeg**. WebRadio verbindet klassische Radiosender mit einem anpassbaren Theme- und Plugin-System.

| Bereich | Stand |
| --- | --- |
| Version | `v1.0.4` in Entwicklung |
| Fokus | Stabilisierung nach dem React-Umstieg |
| Plattform | Windows im Fokus, erster Wine-Test erfolgreich |
| Erweiterbarkeit | Plugins und Themes vorhanden, Ausbau geplant |

> WebRadio ist aktuell in einer Übergangsphase: React ist frisch integriert, alte Module werden entfernt und die Core-Struktur wird für kommende Versionen vorbereitet.

## 🎧 Überblick

WebRadio soll ein schlanker, erweiterbarer Desktop-Radio-Player werden. Der aktuelle Stand bringt bereits Wiedergabe, Sendersuche, Favoriten, Verlauf, Themes, Plugins und ein Update-Fenster mit.

Die nächsten Versionen konzentrieren sich auf Stabilität, bessere Wartbarkeit und den Ausbau der Plugin- und Theme-Systeme.

## ✨ Features

| Feature | Beschreibung |
| --- | --- |
| 🔎 Suche | Suche über die Radio Browser API |
| ▶️ Wiedergabe | FFmpeg dekodiert Streams und gibt PCM-Daten an die Web Audio API weiter |
| 🎚️ Player | Lautstärke, Play, Stop und aktueller Sender |
| ⭐ Favoriten | Sender lokal speichern und wieder laden |
| 🕘 Verlauf | zuletzt gespielte Sender lokal speichern |
| 🎨 Themes | Themes über `theme.json` und CSS-Dateien |
| 🔌 Plugins | Main-Plugins und optionale Renderer-Plugins |
| 🎮 Discord RPC | Beispiel-Plugin für Discord Rich Presence |
| ⚙️ Einstellungen | Plugins, Themes und Updates in einem eigenen Fenster |
| ⬆️ Update-Check | Prüfung über `latest.json` mit externem Download-Link |
| 🪟 Fenster | rahmenloses Fenster mit eigenen Fensterbuttons |

## 🛠️ Im Umbau

Diese Funktionen sind vorbereitet oder geplant, aber noch nicht final:

| Bereich | Ziel |
| --- | --- |
| Core-Struktur | `main.js` entlasten und Logik in klare Module verschieben |
| Tray | Hintergrundbetrieb und Tray-Menü sauber anbinden |
| Media-Keys | globale Mediensteuerung reaktivieren |
| Plugin-System | API-Versionen, Events, Settings und Permissions |
| Theme-System | stabilere Metadaten, Vorschau und bessere React-Integration |
| Audio | effizienteres Buffering und weniger IPC-Last |
| Sentry | nach dem React-Umstieg sauber neu anbinden |

## 🧱 Tech Stack

| Bereich | Technologie |
| --- | --- |
| App | Electron |
| UI | React |
| Build | esbuild, Electron Forge |
| Audio | fluent-ffmpeg, ffmpeg-static, Web Audio API |
| Erweiterungen | Node.js-Plugins und Renderer-Plugins |
| Paketierung | Electron Forge Maker |

## 🚀 Quickstart

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

## 📦 Skripte

| Befehl | Zweck |
| --- | --- |
| `npm start` | React bauen und Electron im Entwicklungsmodus starten |
| `npm run build-react` | Renderer nach `renderer/dist/renderer.js` bauen |
| `npm run package` | App paketieren |
| `npm run make` | Installer oder Distributionspakete erstellen |
| `npm run publish` | Veröffentlichung über Electron Forge vorbereiten |
| `npm run sentry:sourcemaps` | Sentry-Sourcemaps, aktuell noch im Umbau |

## 📁 Projektstruktur

```txt
WebRadio/
  electron/
    main.js                  # Hauptprozess, IPC, Fenster, Streaming
    preload.js               # sichere Bridge zwischen Main und Renderer
    core/                    # Core-Bausteine und geplante Struktur
    plugins/                 # aktueller Plugin-Manager

  renderer/
    App.jsx                  # React-Root
    renderer.jsx             # React-Einstieg
    components/              # Player, Sidebar, Senderliste
    services/                # Player- und Audio-Logik
    worklets/                # AudioWorklet für PCM-Ausgabe
    styles/                  # Basisdesign

  plugins/
    discordRPC/              # Discord Rich Presence
    logger/                  # Debug-Plugin
    plugins.json             # Aktivierungsstatus

  themes/
    default/
    dark/
    neon/

  docs/
    internal-notes.md        # interne technische Notizen
    roadmap.md               # grobe Entwicklungsplanung

  DEVELOPER_GUIDE.md         # Anleitung für Plugins und Themes
```

## 📚 Dokumentation

| Datei | Inhalt |
| --- | --- |
| [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) | Themes und Plugins erstellen |
| [docs/roadmap.md](./docs/roadmap.md) | Meilensteine und geplante Funktionen |
| [docs/internal-notes.md](./docs/internal-notes.md) | interne technische Planung |

## 🔌 Erweiterbarkeit

WebRadio ist nicht nur als Radio-Player gedacht, sondern als erweiterbare App:

- Themes verändern das Aussehen der App.
- Plugins können auf Events reagieren und eigene Renderer-Elemente einhängen.
- Die Plugin-API wird in kommenden Versionen schrittweise stabilisiert.

## 🧪 Teststand

| Umgebung | Status |
| --- | --- |
| Windows | Haupt-Testplattform |
| Arch Linux mit Wine 11 | erster erfolgreicher Test |
| Linux nativ | geplant, noch nicht offiziell |
| macOS | Idee für spätere Versionen |

## 📄 Lizenz

Dieses Projekt steht unter der Lizenz, die in der [LICENSE](./LICENSE)-Datei beschrieben ist.
