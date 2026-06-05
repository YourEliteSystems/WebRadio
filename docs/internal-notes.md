# Internal Notes

Diese Datei ist fuer interne Planung gedacht. Der `DEVELOPER_GUIDE.md` bleibt vorerst die schlanke Anleitung fuer Theme- und Plugin-Autoren.

## Stand 1.0.4

- React ist frisch integriert und ersetzt nach und nach alte DOM-basierte Renderer-Logik.
- Plugin-System und Theme-System existieren, sind aber bewusst noch nicht final ausgebaut.
- Der aktuelle Fokus liegt auf Stabilitaet, Audio-Zuverlaessigkeit, kleinerem Codeumfang und besser wartbarer Core-Struktur.
- Sentry soll perspektivisch erhalten bleiben, ist durch den React-Umstieg aber vorerst nicht sauber angebunden.

## Aufraeumen

Klare Altlasten oder starke Weg-Kandidaten:

- `electron/core/database.js`: Relikt aus der Zeit vor React, importiert ausserdem `better-sqlite3`, das nicht als Dependency eingetragen ist.
- `renderer/audio/audioPlayer.js`: alte Audio-Logik ueber `new Audio()`.
- `renderer/services/radioService.js`: alte DOM-basierte Senderliste.
- `renderer/models/stations.js`: leer.
- `renderer/style.css`: alte CSS-Datei; aktuell wird `renderer/styles/core.css` genutzt.

Nur nach Entscheidung entfernen:

- `renderer/ui/componentRegistry.js`: eventuell spaeter fuer Plugin-UI interessant.
- `electron/plugins/pluginAPI.js`: pruefen, ob es in die neue Core-Plugin-Struktur uebernommen wird.

## Dependencies

Kann voraussichtlich entfernt werden, wenn kein Tracking/Telemetry geplant ist:

- `@amplitude/analytics-node`
- `@amplitude/unified`
- `@aptabase/electron`
- `mixpanel`
- `mixpanel-browser`
- `posthog-node`

Sentry getrennt behandeln:

- `@sentry/electron` behalten, wenn Sentry spaeter wieder aktiv eingebunden wird.
- `@sentry/cli` behalten, wenn Sourcemap-Upload fuer Releases weiter geplant ist.

## Core-Struktur

Ziel: `electron/main.js` soll langfristig kleiner werden und hauptsaechlich Initialisierung und Registrierung koordinieren.

Moegliche Struktur:

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

  storage/
    storage.js
    settingsStore.js

  updates/
    updater.js

  plugins/
    pluginManager.js
    pluginAPI.js
    pluginEvents.js
    pluginRegistry.js
    pluginConfig.js

  themes/
    themeManager.js

  events/
    eventBus.js
```

## Geparkte Core-Bausteine

Diese Module wirken aktuell nicht voll angebunden, koennen aber spaeter bewusst reaktiviert oder umgebaut werden:

- `electron/core/tray.js`: spaeter Tray-Menue, Hintergrundbetrieb und Show/Hide.
- `electron/core/windowManager.js`: spaeter MainWindow, SettingsWindow und Fensterzustaende zentralisieren.
- `electron/core/mediaKeys.js`: globale Mediensteuerung.
- `electron/core/session.js`: spaeter nutzbar fuer Sentry-Kontext oder Diagnose.
- `electron/core/depackUserdata.js`: spaeter fuer User-Plugins und User-Themes pruefen.

## Plugin-System

Naechste sinnvolle Schritte:

- Plugin-Code aus `electron/plugins/` nach `electron/core/plugins/` verschieben.
- Plugin-API versionieren, z. B. `apiVersion` in `plugin.json`.
- Plugin-Konfiguration getrennt von Plugin-Laufzeitlogik halten.
- Events sauber dokumentieren: Play, Stop, Metadata, StationChange, ThemeChange, FavoritesChange, StreamError.
- Langfristig Plugin-Permissions einfuehren.
- Plugin-Einstellungen pro Plugin vorbereiten.

## Theme-System

Aktuell ist das Theme-System ein Uebergangssystem nach dem React-Umstieg.

Naechste sinnvolle Schritte:

- Theme-Manager in `electron/core/themes/` vorbereiten.
- Theme-Metadaten erweitern: Autor, Version, Beschreibung, kompatible App-Version.
- CSS-Variablen als stabilen Standardweg nutzen.
- Optionales Custom-CSS spaeter kontrolliert erlauben.
- Live-Preview und Theme-Vorschau erst nach stabiler Core-Struktur angehen.

## Performance-Punkte

Wichtige Baustellen:

- PCM-Audio wird aktuell sehr haeufig ueber IPC geschickt.
- `pcm-processor.js` kopiert Buffer bei jedem eingehenden Chunk neu.
- Visualizer erzeugt pro Frame und Balken neue Gradients.
- Einige Renderer-Listener brauchen Cleanup, damit sie sich nicht mehrfach registrieren.
- React-Keys in der Senderliste sollten stabil sein und nicht auf `Math.random()` fallen.

## Release-Fokus

Fuer 1.0.4:

- Alte Relikte entfernen.
- Unbenutzte Dependencies reduzieren.
- Audio-Stabilitaet pruefen.
- Update-Check testen.
- Plugin- und Theme-System funktionsfaehig halten, aber noch nicht finalisieren.

Fuer spaetere Versionen:

- Core-Struktur umbauen.
- Plugin-System erweitern.
- Theme-System neu ordnen.
- Sentry sauber mit React-Bundle und Sourcemaps reaktivieren.
- Wiki/Doku dezentral aufbauen, sobald die Developer-Doku zu gross wird.
