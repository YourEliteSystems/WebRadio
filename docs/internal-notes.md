# Internal Notes

Interne technische Notizen für WebRadio. Diese Datei sammelt Entscheidungen, Aufräumarbeiten und Architekturideen. Die öffentliche Anleitung für Theme- und Plugin-Autoren bleibt im `DEVELOPER_GUIDE.md`.

| Bereich | Status |
| --- | --- |
| Aktuelle Version | `v1.0.4` in Entwicklung |
| Hauptfokus | Stabilisierung nach React-Umstieg |
| Doku-Rolle | interne Planung |
| Roadmap | [docs/roadmap.md](./roadmap.md) |

## Leitlinie

WebRadio soll schrittweise kleiner, stabiler und leichter erweiterbar werden. Neue Features sollen nicht mehr direkt in `electron/main.js` wachsen, sondern in klar abgegrenzte Core-Module wandern.

## Aktueller Stand

| Thema | Einschätzung |
| --- | --- |
| React | frisch integriert |
| Theme-System | vorhanden, aber Übergangslösung |
| Plugin-System | vorhanden, aber API noch im Ausbau |
| Audio | funktional, Performance muss beobachtet werden |
| Sentry | geplant, nach React-Umstieg noch nicht sauber angebunden |
| Core-Struktur | soll neu geordnet werden |

## Aufräumen

### Klare Weg-Kandidaten

| Datei | Grund |
| --- | --- |
| `electron/core/database.js` | Relikt vor React, importiert nicht eingetragenes `better-sqlite3` |
| `renderer/audio/audioPlayer.js` | alte Audio-Logik über `new Audio()` |
| `renderer/services/radioService.js` | alte DOM-basierte Senderliste |
| `renderer/models/stations.js` | leer |
| `renderer/style.css` | alte CSS-Datei, aktuell wird `renderer/styles/core.css` genutzt |

### Erst prüfen

| Datei | Frage |
| --- | --- |
| `renderer/ui/componentRegistry.js` | später für Plugin-UI relevant? |
| `electron/plugins/pluginAPI.js` | in neue Core-Plugin-Struktur übernehmen? |
| `electron/core/depackUserdata.js` | für User-Plugins/User-Themes reaktivieren? |

## Dependencies

### Entfernen prüfen

Diese Pakete wirken aktuell nicht notwendig, wenn kein Tracking oder Telemetry geplant ist:

- `@amplitude/analytics-node`
- `@amplitude/unified`
- `@aptabase/electron`
- `mixpanel`
- `mixpanel-browser`
- `posthog-node`

### Behalten oder parken

| Paket | Entscheidung |
| --- | --- |
| `@sentry/electron` | behalten, wenn Sentry später wieder aktiv genutzt wird |
| `@sentry/cli` | behalten, wenn Sourcemap-Uploads geplant bleiben |

## Geplante Core-Struktur

Ziel: `electron/main.js` soll vor allem starten, registrieren und koordinieren.

```txt
electron/core/
  app/
    appShell.js
    windowManager.js
    trayManager.js
    mediaKeys.js

  audio/
    ffmpegResolver.js
    streamController.js

  events/
    eventBus.js

  plugins/
    pluginManager.js
    pluginAPI.js
    pluginEvents.js
    pluginRegistry.js
    pluginConfig.js

  storage/
    storage.js
    settingsStore.js

  themes/
    themeManager.js

  updates/
    updater.js
```

## Geparkte Core-Bausteine

| Modul | Geplante Rolle |
| --- | --- |
| `electron/core/tray.js` | Tray-Menü, Hintergrundbetrieb, Show/Hide |
| `electron/core/windowManager.js` | MainWindow, SettingsWindow, Fensterzustände |
| `electron/core/mediaKeys.js` | globale Mediensteuerung |
| `electron/core/session.js` | Sentry-Kontext oder Diagnose |
| `electron/core/depackUserdata.js` | User-Plugins und User-Themes |

## Plugin-System

Nächste technische Schritte:

1. Plugin-Code nach `electron/core/plugins/` verschieben.
2. Plugin-API versionieren, z. B. über `apiVersion` in `plugin.json`.
3. Plugin-Konfiguration von Runtime-Logik trennen.
4. Events sauber dokumentieren.
5. Plugin-Einstellungen vorbereiten.
6. Langfristig Permissions einführen.

Wichtige Event-Kandidaten:

- `Play`
- `Stop`
- `Metadata`
- `StationChange`
- `ThemeChange`
- `FavoritesChange`
- `StreamError`

## Theme-System

Aktuell ist das Theme-System ein Übergangssystem nach dem React-Umstieg.

Nächste technische Schritte:

1. Theme-Manager vorbereiten.
2. Theme-Metadaten erweitern.
3. CSS-Variablen als stabilen Standardweg definieren.
4. Optionales Custom-CSS später kontrolliert erlauben.
5. Live-Preview erst nach stabiler Core-Struktur angehen.

## Performance-Punkte

| Bereich | Risiko |
| --- | --- |
| PCM über IPC | viele Nachrichten und mögliche Kopien |
| AudioWorklet | Buffer werden aktuell häufig neu kopiert |
| Visualizer | Canvas-Arbeit pro Frame kann reduziert werden |
| Renderer-Listener | Cleanup nötig, damit sich Listener nicht sammeln |
| React-Keys | keine zufälligen Fallback-Keys verwenden |

## Release-Fokus

### v1.0.4

- alte Relikte entfernen
- unbenutzte Dependencies reduzieren
- Audio-Stabilität prüfen
- Update-Check testen
- Plugin- und Theme-Grundsystem funktional halten

### Spätere Versionen

- Core-Struktur umbauen
- Plugin-System erweitern
- Theme-System neu ordnen
- Sentry sauber mit React-Bundle und Sourcemaps reaktivieren
- Wiki/Doku dezentral aufbauen
