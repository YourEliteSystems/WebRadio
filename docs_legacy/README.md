# Dokumentation – Übersicht

> ⚠️ **HISTORISCHE / VERALTETE DOKUMENTATION**  
> Die Dokumente in diesem Ordner (`docs_legacy/`) beschreiben die frühere, monolithische Architektur von WebRadio.  
> **WebRadio verwendet heute ausschließlich das neue modulare Plugin-System (Plugin SDK v1).**  
> Aktuelle Dokumentation befindet sich unter [`docs/`](../docs/) und [`docs/plugin-sdk/`](../docs/plugin-sdk/).

---

Willkommen in der historischen Dokumentation von **WebRadio**. Hier findest du alle archivierten Informationen für Nutzer, Entwickler und Beitragende.

---

## 📚 Inhaltsverzeichnis

### Für Nutzer
| Dokument | Beschreibung |
| --- | --- |
| [🏠 README](../README.md) | Projektübersicht, Quickstart und Features |
| [🗺️ Roadmap](./roadmap.md) | Geplante Versionen und Meilensteine |
| [📝 Changelog](../CHANGELOG.md) | Versionshistorie und Release-Notes |

### Für Entwickler & Modder
| Dokument | Beschreibung |
| --- | --- |
| [🔌 Plugin Development Guide](./plugin-development-guide.md) | Plugin-API, Lifecycle, Views & Slots |
| [🎨 Theme Development Guide](./theme-development-guide.md) | CSS-Variablen, Theme-Struktur, Beispiele |
| [🧭 Interne Notizen](./internal-notes.md) | Technische Notizen für Core-Entwickler |

### Für Beitragende
| Dokument | Beschreibung |
| --- | --- |
| [🤝 Contributing Guide](./CONTRIBUTING.md) | Wie du zum Projekt beitragen kannst |
| [⚖️ Code of Conduct](./CODE_OF_CONDUCT.md) | Community-Regeln und Standards |
| [🔐 Security Policy](./SECURITY.md) | Sicherheitslücken melden |

---

## 🏗️ Architektur-Übersicht

```
WebRadio/
├── electron/                     # Electron Main-Prozess (Backend)
│   ├── main.js                   # App-Einstiegspunkt & Bootstrap
│   ├── preload.js                # Sichere IPC-Bridge (contextBridge)
│   └── core/
│       ├── app/                  # Fenster-Verwaltung (Main/Settings)
│       ├── audio/                # Stream-Management & FFmpeg
│       ├── ipc/                  # IPC-Handler (Favorites, History, ...)
│       ├── plugins/              # Plugin-System (Loader, API, Context)
│       ├── themes/               # Theme-Verwaltung
│       └── updates/              # Auto-Updater
│
├── renderer/                     # React-Frontend (Renderer-Prozess)
│   ├── App.jsx                   # Haupt-Komponente & Routing-State
│   ├── renderer.jsx              # React-Einstiegspunkt
│   ├── components/               # UI-Bausteine (Sidebar, Player, Grid)
│   ├── services/                 # Audio-Player-Service
│   ├── ui/                       # Plugin-Registry (Views & Slots)
│   └── worklets/                 # AudioWorklet für PCM-Ausgabe
│
├── plugins/                      # Plugins (Main + Renderer)
│   ├── discordRPC/               # Discord Rich Presence Plugin
│   └── plugins.json              # Aktivierungsstatus
│
├── themes/                       # CSS-Themes
│   ├── default/
│   ├── dark/
│   └── neon/
│
└── docs/                         # Diese Dokumentation
```

---

## 🔌 Plugin-System in Kürze

Plugins können die App auf zwei Arten erweitern:

| Typ | API | Beschreibung |
| --- | --- | --- |
| **View** | `window.uiRegistry.registerView(id, title, renderFn)` | Fügt einen Menüpunkt in die Sidebar hinzu |
| **Slot** | `window.uiRegistry.registerSlot(slotId, pluginId, renderFn)` | Injiziert ein Widget in einen vordefinierten Bereich |

➡️ Mehr Details im [Plugin Development Guide](./plugin-development-guide.md).

---

## 🎨 Theme-System in Kürze

Themes sind reine CSS-Dateien, die CSS-Variablen in `:root` überschreiben:

```css
/* themes/mein-theme/variables.css */
:root {
  --bg-main: #0a0b10;
  --accent-color: #ff007f;
  --text-main: #fff;
}
```

➡️ Mehr Details im [Theme Development Guide](./theme-development-guide.md).
