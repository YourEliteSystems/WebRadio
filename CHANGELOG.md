# Changelog – WebRadio

Alle wichtigen Änderungen an diesem Projekt werden hier dokumentiert.

---

## [v1.0.5-rc.4] – 2026-07-24

> Release Candidate 4 für v1.0.5 – Vollständige Release-Infrastruktur, erweiterte Storage-Architektur, neue IPC-APIs und Diagnostics-Erweiterungen.

### ✨ Neue Features & Verbesserungen

#### 🚀 Release-Infrastruktur (`scripts/release/`) – vollständig neu

Die gesamte Release-Pipeline wurde als eigenständiges Node.js-Modul-System implementiert, das vollständig unabhängig von GitHub Actions betrieben werden kann:

| Modul | Funktion |
|---|---|
| `index.js` | Zentraler Einstiegspunkt – orchestriert die komplette Pipeline |
| `validate.js` | Prüft `package.json` (Version vorhanden, gültige SemVer) und `CHANGELOG.md` (Version dokumentiert) |
| `semver.js` | SemVer-Hilfsfunktionen: `isValid()`, `SEMVER_REGEX` – unterstützt alle gängigen Prerelease-Formate |
| `changelog.js` | CHANGELOG-Parser: `getVersion(v)` extrahiert den Abschnitt einer Version, `hasVersion(v)` prüft Existenz |
| `release-notes.js` | Generiert GitHub-Release-Notes aus CHANGELOG.md mit Metadaten-Header (Stage, Version, Datum) |
| `checksums.js` | Erstellt `SHA256SUMS.txt` für alle Release-Assets in `dist/` |
| `github.js` | Liest GitHub Actions-Kontext: `getContext()`, `getTag()`, `getCommit()`, `getRepository()`, `isGitHubActions()` |
| `constants.js` | Gemeinsame Konstanten: `RELEASE_STAGE`, `HASH_ALGORITHM`, `PATHS`, `ASSET_EXTENSIONS` |
| `utils.js` | Hilfsfunktionen: `fileExists()`, `readFile()`, `writeFile()`, `readJson()`, `hashFile()`, `execute()`, Plattformerkennung |
| `errors.js` | Typisierte Fehlerklassen: `ReleaseError`, `VersionError`, `ChangelogError`, `ChecksumError`, `PackageError`, `GitHubReleaseError`, `AssetError` |
| `detect-release.js` | Vorbereitet (noch leer) – wird in zukünftiger Version die Release-Stage automatisch erkennen |

#### 🔄 GitHub Actions Release-Workflow (`.github/workflows/release.yml`) – vollständig überarbeitet

- **Trigger:** Automatisch bei Git-Tags der Form `v*` sowie manuell via `workflow_dispatch` mit optionalem `version`-Input und `draft`-Toggle
- **Release-Kontext-Ermittlung (Schritt 4):** PowerShell-Skript ermittelt `RELEASE_TAG`, `RELEASE_VERSION` und `IS_PRERELEASE` mit dreistufiger Priorität (Tag-Push → workflow_dispatch-Input → package.json-Fallback)
- **Pre-release-Erkennung:** Automatisch für `alpha`, `beta`, `rc`, `nightly`
- **Schritt 5 – Validierung:** `node -e "require('./scripts/release/validate')()"` – schlägt fehl wenn package.json oder CHANGELOG.md nicht korrekt sind
- **Schritt 8 – Checksums:** `node scripts/release/checksums.js` erzeugt `SHA256SUMS.txt`
- **Schritt 9 – Release Notes:** PowerShell ruft `release-notes.js` auf und schreibt `release-notes.md`
- **Schritt 10 – Artefakte sammeln:** Filtert `dist/` nach Erweiterung (`.exe`, `.zip`, `.blockmap`, `.yml`, `.json` etc.), schließt `builder-debug.json` und `builder-effective-config.yaml` explizit aus
- **Schritt 11 – GitHub Release:** `softprops/action-gh-release@v2` mit `body_path`, `prerelease`, `draft`, alle Artefakte aus `release-artifacts/`

#### 🗄️ Storage-Architektur – erweitert (`electron/core/storage/`)

- **`StorageManager`** um neue userData-Verzeichnisse erweitert:
  - `getCrashPath()` → `userData/crash/`
  - `getPackagesPath()` → `userData/packages/`
  - `getReportsPath()` → `userData/reports/`
  - `getSettingsFile()` → `userData/settings.json`
  - `initialize()` legt nun alle 7 Verzeichnisse automatisch an (inkl. `crash`, `packages`, `reports`)
- Neue Manager-Klassen als schlanke Fassade über `storage.js`:
  - **`FavoritesManager`** – `getAll()`, `add(entry)`, `remove(url)`
  - **`HistoryManager`** – `getAll()`, `add(entry)`
  - **`SettingsManager`** – `get()`, `update(data)`

#### 🩺 Diagnostics – IPC-API vollständig ausgebaut

**`diagnosticsHandlers.js`** registriert alle Diagnostics-IPC-Handler:

| IPC-Kanal | Funktion |
|---|---|
| `log` (send) | Frontend-Logging-Bridge: leitet `level/context/msg` an `LogManager` weiter |
| `diagnostics:getHealth` | Führt `HealthCheck.run()` aus |
| `diagnostics:getSystemInfo` | Gibt `SystemInfo.getPretty()` zurück |
| `diagnostics:getCrashReports` | Listet alle Crash-Reports via `CrashReportReader` |
| `diagnostics:readCrashReport` | Liest einzelnen Crash-Report |
| `diagnostics:deleteCrashReport` | Löscht einzelnen Crash-Report |
| `diagnostics:clearCrashReports` | Löscht alle Crash-Reports |
| `diagnostics:getLogs` | Listet alle Log-Dateien via `LogReader` |
| `diagnostics:readLog` | Liest einzelne Log-Datei |
| `diagnostics:deleteLog` | Löscht einzelne Log-Datei |
| `diagnostics:clearLogs` | Löscht alle Log-Dateien |
| `diagnostics:getPaths` | Gibt alle userData-Pfade zurück (plugins, themes, logs, crash, pluginData, userData) |

#### 🔌 Preload – neue Context-Bridge-APIs

**`preload.js`** um zwei neue APIs erweitert:

- **`uiAPI`** – `getPages()` → `ui:getPages` IPC-Aufruf für Plugin-UI-Slots
- **`shellAPI`** – `openPath(folderPath)` → `shell:openPath` öffnet Ordner im Datei-Explorer
- **`diagnosticsAPI`** – vollständige Diagnostics-API (alle oben genannten Kanäle) über `contextBridge` exponiert

#### 🪟 Window-Handler – Shell-Integration

**`windowHandlers.js`** um `shell:openPath`-Handler ergänzt:
- `ipcMain.handle("shell:openPath", ...)` → `shell.openPath(folderPath)` öffnet Pfade nativ im OS-Explorer

#### 🏗️ Application – Shutdown-Verbesserungen

**`Application.js`** erhält vollständige `shutdown*`-Methoden für alle Subsysteme:
- `shutdownDiagnostics()` – fährt HealthCheck, CrashReportManager, CrashHandler, LogManager sicher herunter (mit Existenzprüfung)
- `shutdownThemes()` – ruft `ThemeManager.shutdown()` auf
- `shutdownPlugins()` – ruft `PluginManager.shutdown()` auf
- `shutdownMediaKeys()` – ruft `unregisterMediaKeys()` auf
- `shutdownTray()` – ruft `destroyTray()` auf
- `checkForUpdates()` – öffentliche Methode, delegiert an `updater.js`

#### 🔌 Plugin-System – PluginRuntime stabilisiert

**`PluginRuntime.js`** vollständig überarbeitet:
- Hook-System über `hookMap` – verbindet Plugin-Methoden (`onMetadata`, `onStationChange`, `onPlay`, `onStop`, `onVolumeChange`, `onThemeChange`) mit EventBus-Events
- Alle Hook-Aufrufe in `try/catch` gekapselt – kein App-Crash bei fehlerhaften Plugins
- `stop()` entfernt alle EventBus-Listener via `eventBus.off()` und löscht den Node-Module-Cache (`delete require.cache`) für sauberes Hot-Reload
- Logging über `LogManager.getLogger("PluginRuntime")`
- **`PluginService.js`** – neue Fassadenklasse als Export-Einstiegspunkt

#### 📋 Build-Workflow (`.github/workflows/build.yml`) – Cross-Platform-Matrix

- Build-Matrix auf alle drei Plattformen erweitert: `windows-latest`, `ubuntu-latest`, `macos-latest`
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` Umgebungsvariable gesetzt

---

### 🐛 Bugfixes

- **`semver.js` – fehlende Exports**: `isValid()`-Funktion und `module.exports` fehlten komplett → `TypeError: semver.isValid is not a function` in `validate.js` (und damit im gesamten Release-Workflow). Behoben: Funktion implementiert und exportiert.
- **`release-notes.js` – `semver.parse` nicht definiert**: `semver.js` exportierte kein `parse()`; `release-notes.js` rief es dennoch auf → würde beim Release-Lauf crashen. *(Wird in v1.0.6 vollständig implementiert.)*
- **`detect-release.js` – leere Datei**: Das Modul ist registriert (`package.json` → `release:detect`) und im README dokumentiert, aber noch leer. *(Wird in v1.0.6 implementiert.)*
- **`main.js` – doppelter `uncaughtException`-Handler**: `main.js` enthält noch einen eigenen `process.on("uncaughtException")`-Block obwohl `Application.js` bereits `CrashHandler` initialisiert. Beide fangen dieselben Fehler ab. *(Konsolidierung in v1.0.6 geplant.)*

---

### ♻️ Refactoring

- `electron/core/events/EventBus.js` – neue eigenständige EventBus-Klasse unter `electron/core/events/` (zusätzlich zu `electron/core/eventBus.js`)
- `electron/core/diagnostics/logging/transports/` – Transport-Klassen (`ConsoleTransport`, `FileTransport`) in eigenem Unterordner isoliert

---

### 📦 Abhängigkeiten

Keine neuen Abhängigkeiten. Alle Pakete auf demselben Stand wie v1.0.5-rc.3.

---

## [v1.0.5 RC3] – 2026-07-16

> Release Candidate 3 für v1.0.5 – Architektur-Refactoring, stabilisiertes Diagnostics-System und vollständige Entwickler-Dokumentation.

### ✨ Neue Features & Verbesserungen

#### 🏗️ `Application.js` – Neue zentrale Bootstrap-Klasse

- Neue Klasse `Application` in `electron/core/Application.js` bündelt den gesamten App-Lifecycle:
  - Klar gegliederte Startup-Sequenz: **Storage → Diagnostics → Window → IPC → Plugins → Themes → MediaKeys → Tray → Updater**
  - `start()` und `shutdown()` als saubere Lifecycle-Methoden
  - Singleton-Export (`module.exports = new Application()`) – `main.js` ist damit auf wenige Zeilen reduziert
- `initializeDiagnostics()` initialisiert `LogManager`, `CrashHandler`, `CrashReportManager` und `HealthCheck` in der richtigen Reihenfolge
- `shutdown()` fährt alle Subsysteme in umgekehrter Reihenfolge sauber herunter

#### 🎨 `ThemeManager` – Lifecycle & API ausgebaut

- `ThemeManager` erhält vollständige Lifecycle-Methoden: `initialize()`, `shutdown()`
- `initialize()`-Guard verhindert Doppel-Initialisierung
- Neue Methoden: `enableTheme(id)`, `disableTheme(id)`, `reloadTheme(id)`, `getTheme(id)`, `getThemes()`, `hasTheme(id)`, `isInitialized()`
- Themes werden intern in einer `Map` gehalten für O(1)-Zugriff
- `shutdown()` räumt alle geladenen Themes sauber auf

#### 🔌 `PluginLoader` – Manifest-Discovery stabilisiert

- `discoverPlugins()` liest alle Plugin-Ordner aus dem `userData`-Plugins-Verzeichnis
- `loadManifest(pluginPath)` liest und validiert `manifest.json` pro Plugin
- Fehlerhafte Plugins werden übersprungen und geloggt – kein App-Crash bei defekten Plugins

#### 🩺 Diagnostics – Shutdown-Lifecycle ergänzt

- `CrashHandler`, `CrashReportManager` und `HealthCheck` erhalten saubere `shutdown()`-Methoden
- `SystemInfo` überarbeitet: kompaktere Ausgabe, bessere Typisierung
- `StorageManager` um weitere Hilfsmethoden erweitert

#### 🖥️ `main.js` – Reduziert auf reinen Einstiegspunkt

- `electron/main.js` delegiert vollständig an `Application` – keine Geschäftslogik mehr im Einstiegspunkt
- Startup und Shutdown werden ausschließlich über `Application.start()` / `Application.shutdown()` gesteuert

#### 🎵 `PlayerBar.jsx` – Überarbeitet

- Vollständige Überarbeitung der PlayerBar-Komponente für bessere Stabilität und UX
- Robustere Event-Handler und sauberere State-Verwaltung

---

### 📚 Dokumentation (komplett neu)

Die gesamte Entwickler-Dokumentation wurde von Grund auf neu erstellt und strukturiert:

#### 🏛️ Architecture Docs (`docs/architecture/`)

| Datei | Inhalt |
|---|---|
| `01-Application.md` | Application-Klasse, Bootstrap-Lifecycle |
| `02-StorageManager.md` | Pfad-Verwaltung, userData-Struktur |
| `03-WindowManager.md` | Fenster-Verwaltung, Singleton-Pattern |
| `04-Diagnostics.md` | Logging, Crash-Handling, HealthCheck |
| `05-IPC.md` | IPC-Handler-Architektur, Channel-Übersicht |
| `06-ThemeManager.md` | Theme-Lifecycle, Loader, Validator |
| `07-PluginManager.md` | Plugin-Lifecycle, API, Permissions |
| `08-MediaKeys.md` | Globale Tastaturshortcuts |
| `09-Tray.md` | System-Tray, Kontextmenü |
| `10-Updater.md` | Update-Check, SHA-256-Verifikation |

#### 🔌 Plugin SDK (`docs/plugin-sdk/`)

Vollständiger Leitfaden für Plugin-Entwickler:

- `01-GettingStarted.md` – Einstieg und erstes Plugin
- `02-Manifest.md` – `manifest.json` vollständig dokumentiert
- `03-ProjectStructure.md` – Empfohlene Ordnerstruktur
- `04-Lifecycle.md` – `init()`, `onEnable()`, `onDisable()`, `destroy()`
- `05-Context.md` – `PluginContext`-API erklärt
- `06-Storage.md` – Persistente Plugin-Daten
- `07-Events.md` – Events abonnieren und auslösen
- `08-Hooks.md` – App-Hooks erweitern
- `09-UI.md` – Views und Slots registrieren
- `10-BestPractices.md` – Do's & Don'ts
- `11-HelloWorld.md` – Vollständiges Beispiel-Plugin
- `12-FAQ.md` – Häufige Fragen

#### 🎨 Theme SDK (`docs/theme-sdk/`)

Vollständiger Leitfaden für Theme-Entwickler:

- `01-GettingStarted.md` – Einstieg und erstes Theme
- `02-ThemeManifest.md` – `theme.json` vollständig dokumentiert
- `03-DirectoryStructure.md` – Ordnerstruktur für Themes
- `04-CSSVariables.md` – Alle CSS-Variablen der App dokumentiert
- `05-Components.md` – UI-Komponenten und ihre Klassen
- `06-Assets.md` – Icons, Schriften und Bilder einbinden
- `07-BestPractices.md` – Performance und Kompatibilität
- `08-HelloTheme.md` – Vollständiges Beispiel-Theme
- `09-FAQ.md` – Häufige Fragen

#### 📖 API Reference (`docs/api-referance/`)

Vollständige Referenz aller öffentlichen APIs:

`Application`, `Plugin`, `PluginContext`, `PluginManager`, `Commands`, `Events`, `Hooks`, `Logger`, `Settings`, `Storage`, `Theme`, `ThemeManager`, `Windows`, `Menus`, `Notifications`, `Permissions`

---

### ♻️ Refactoring

- Alte Dokumentation nach `docs_legecy/` verschoben (nicht gelöscht)
- `electron/main.js` vereinfacht – vollständige Delegation an `Application`
- `PluginRuntime` und `PluginManager` weiter konsolidiert
- `diagnosticsHandlers.js` für IPC-Anbindung der Diagnostics-API hinzugefügt
- `windowHandlers.js` aktualisiert

---

### 🐛 Bugfixes

- **`StreamManager` – `uncaughtException: ffmpeg was killed with signal SIGTERM`**: Beim Stoppen eines Streams wurde `kill('SIGTERM')` aufgerufen, bevor alle Listener entfernt wurden. `fluent-ffmpeg`'s interner `endCB` (in `processor.js`) ruft nach dem Kill noch asynchron `self.emit('error')` auf – war kein `'error'`-Listener mehr registriert, landete der Fehler als `uncaughtException`. Fix: `removeAllListeners()` → stummen No-op Error-Listener einhängen → `kill()`. Damit ist immer ein Listener vorhanden, wenn `endCB` async feuert.
- **`LogManager` – fehlende `shutdown()`-Methode**: `Application.shutdown()` rief `LogManager.shutdown()` auf, die Methode existierte jedoch nicht → `TypeError` beim Beenden der App. `shutdown()` ergänzt: loggt einen abschließenden Separator, setzt alle internen Referenzen zurück und markiert den Manager als nicht mehr initialisiert.

---

### 📦 Abhängigkeiten

Keine neuen Abhängigkeiten. Alle Pakete auf demselben Stand wie v1.0.5.

---

## [v1.0.5] – 2026-07-09

### ✨ Neue Features

#### 🩺 Diagnostics-Subsystem (komplett neu)

Neues Modul `electron/core/diagnostics/` als zentrales Diagnosesystem der App:

- **`LogManager`** – zentraler Log-Manager mit `initialize()`, `createLogger(context)`, `getLogger()` und `getRootLogger()`
- **`Logger`** – strukturierte Logger-Instanz mit Unterstützung für Log-Level (`debug`, `info`, `warn`, `error`, `fatal`), Child-Logger und Transports
- **`LogEntry`** / **`LogFormatter`** – typisierte Log-Einträge mit Timestamp, Level, Kontext und Nachricht; Formatter gibt strukturierte Ausgaben aus
- **`LogLevel`** – eigene Klasse für Log-Level-Konstanten und Vergleichsoperationen
- **`ConsoleTransport`** – gibt Log-Einträge formatiert auf der Konsole aus
- **`FileTransport`** – schreibt Log-Einträge in rotierte `.log`-Dateien im `userData/logs/`-Ordner
- **`index.js`** – zentraler Export-Einstiegspunkt für das Logging-Subsystem
- **`LogReader`** – Neue Klasse, um die gespeicherten `.log`-Dateien aus dem `userData/logs/`-Ordner strukturiert auszulesen
- **Systemweites Logging:** Der `LogManager` wird nun systemweit (App Lifecycle, Storage, Updater, Audio/FFmpeg) verwendet
- **Frontend-Bridge:** Das React-Frontend sendet nun Logs via IPC (`window.api.log`) sicher an den Main-Process in dieselbe Log-Datei
- **Plugin Logging:** Backend- und Frontend-Plugins erhalten bei Initialisierung automatisch einen eigenen `logger` (`context.logger` bzw. `window.pluginAPI.log`)
- **Diagnostics API:** Neue IPC-Handler (`diagnostics:getLogs`, `readLog`, `deleteLog`, `clearLogs`) wurden hinzugefügt und über `window.diagnosticsAPI` im Frontend exponiert

#### 💥 Crash-Handling-System

- **`CrashHandler`** – fängt `uncaughtException` und `unhandledRejection` global ab; ersetzt den bisherigen einfachen `process.on`-Block in `main.js`
  - Loggt Crashes via `logger.fatal()` mit Stack-Trace und Fehlertyp
  - Fällt auf `console.error` zurück falls Logger nicht verfügbar (Singleton-Schutz mit `initialized`-Flag)
- **`CrashReportManager`** – erstellt strukturierte Crash-Reports mit System-Snapshot (Zeitstempel, App-Version, Runtime, CPU, RAM, Health-Status, Fehlerdetails, erweiterbare Sektionen via `registerSection()`)
- **`CrashReportWriter`** – schreibt Crash-Reports als JSON-Dateien in den `userData`-Ordner
- **`CrashReportReader`** – liest und listet vorhandene Crash-Report-Dateien

#### 🏥 Health-Check-System

- **`HealthCheck`** – führt beim App-Start eine Reihe von Standardprüfungen durch:
  - Plugin Directory vorhanden?
  - Theme Directory vorhanden?
  - Plugin Data Directory vorhanden?
  - Logs-Verzeichnis vorhanden?
  - `storage.json` vorhanden?
  - `registry.json` vorhanden?
- Ergebnis wird via `logger.info()` ins Log geschrieben
- Prüfungen sind erweiterbar per `register(name, callback)`

#### ℹ️ SystemInfo

- **`SystemInfo`** – liefert strukturierten Snapshot des Systems: App-Name/Version/userData, Plattform, Architektur, Hostname, Uptime, CPU-Modell/-Kerne, RAM (total/free), Node/Electron/Chromium/V8-Versionen
- `getPretty()` gibt RAM-Werte in GB formatiert zurück

#### 💾 StorageManager (neu)

- **`StorageManager`** – zentrales Verwaltungsmodul für alle User-Data-Pfade:
  - Stellt Pfade bereit: `getPluginPath()`, `getThemePath()`, `getPluginDataPath()`, `getLogsPath()`, `getStorageFile()`, `getRegistryFile()`
  - `initialize()` legt fehlende Verzeichnisse automatisch an

#### 🖼️ ReactRenderer (Plugin-System)

- **`ReactRenderer`** (`electron/core/ui/ReactRenderer.js`) – ermöglicht Plugins das Rendern von React-Komponenten in dedizierte DOM-Container
  - `render(component, container)` und `unmount(container)` als saubere API
  - Nutzung via `PluginSlot`/`PluginView` im Renderer

#### 🏗️ Erweiterte Plugin & Theme-Architektur

- Neue Plugin-Kernklassen in `electron/core/plugins/`:
  - `PluginAPI`, `PluginLoader`, `PluginManager`, `PluginPermissions`, `PluginRuntime`, `PluginValidator`
- Neue Theme-Kernklassen in `electron/core/themes/`:
  - `ThemeLoader`, `ThemeManager`, `ThemeProvider`, `ThemeValidator`
- UI-Abstraktionsschicht in `electron/core/ui/`:
  - `HtmlRenderer`, `UIManager`, `UIRegistry`, `UIRenderer`, `UIValidator`
- Neue UI-Komponenten im Renderer: `PluginSlot.jsx`, `PluginView.jsx`, `componentRegistry.js`
- `RendererPluginManager.js` für Plugin-Rendering im Renderer-Prozess

#### 🪟 Window- & Stream-Management

- `WindowManager` und `SettingsWindow.js` weiter ausgebaut (Singleton-Verhalten, FFmpeg-basiertes Audio-Stream-Processing)
- `streamManager.js` – Audio-Stream-Verarbeitung mit FFmpeg-Integration und Metadaten-Unterstützung

#### 📋 GitHub Issue Templates

- 4 neue Issue-Templates: `bug_report.md`, `feature_request.md`, `plugin_api.md`, `refactoring.md`
- `config.yml` mit Kontakt-Links für Dokumentation

---

### ♻️ Refactoring & Architektur

#### `main.js` – Saubere Bootstrap-Struktur

- Startup-Sequenz klar in Sektionen gegliedert: **Infrastruktur → Diagnose → Fenster → IPC → Plugins → System**
- `LogManager.initialize()` und `CrashHandler.initialize(logger)` werden jetzt als erste Schritte beim App-Start aufgerufen
- `storageManager` → `StorageManager` (konsistente Schreibweise)
- Alter `process.on("uncaughtException")` Block durch `CrashHandler` ersetzt

#### Logging verschoben

- Logging-Klassen von `electron/core/logging/` nach `electron/core/diagnostics/logging/` verschoben – logisch unter dem Diagnostics-Dach gebündelt

#### Dokumentation

- Theme-Development-Draft entfernt, durch vollständigen **Theme-Development-Guide** (`docs/theme-development-guide.md`) ersetzt
- **Plugin-Development-Guide** (`docs/plugin-development-guide.md`) aktualisiert mit ReactRenderer-Dokumentation
- `DEVELOPER_GUIDE.md` und `README.md` für Plugin-Entwicklung aktualisiert
- Community-Richtlinien: `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md` hinzugefügt / aktualisiert

---

### 🐛 Bugfixes

- **`main.js` – doppelter Semikolon**: `require("./core/app/WindowManager");;` → einfaches `;` *(Tippfehler)*
- **`LogManager` – fehlende `createLogger`-Methode**: `main.js` nutzte `createLogger()`, `LogManager` stellte aber nur `getLogger()` bereit → `createLogger` als Alias ergänzt

---

### 📦 Abhängigkeiten

Keine neuen Abhängigkeiten in v1.0.5. Alle bestehenden Pakete bleiben auf denselben Versionen wie in v1.0.4.

---

## [v1.0.4] – 2026-06-20

### ✨ Neue Features

#### 🎨 Theme-Engine (komplett neu)
- **Neue Theme-Engine** mit eigenem IPC-Handler (`themeHandlers.js`) und `themeService.js` im Renderer
- Themes werden aus dem `themes/`-Ordner dynamisch geladen (jedes Theme = eigener Unterordner mit `theme.json` + CSS-Datei)
- 3 eingebaute Themes: **Default**, **Dark**, **Neon**
- Theme-Auswahl direkt im PlayerBar-Dropdown (Live-Vorschau ohne Neustart)
- Aktives Theme wird persistent in `storage.json` gespeichert und beim Start wiederhergestellt
- Theme-CSS wird korrekt als `file://`-URL aufgelöst, auch auf Windows (Backslash-Fix)
- Einstellungsseite zeigt alle Themes als klickbare Karten mit Active-State und Glow-Effekt
- **`themeAPI`** via `contextBridge` im Preload vollständig exponiert (`getThemes`, `getActiveTheme`, `setActiveTheme`)

#### 🔔 Updater mit SHA-256-Verifikation
- Neuer eigener `updater.js` im Main-Prozess mit **manuellem Download + Hash-Prüfung**
- Lädt `latest.json` vom primären Update-Server `updates.yourelitesystems.de`, mit automatischem Fallback auf GitHub (`raw.githubusercontent.com`)
- **SHA-256-Verifikation** der heruntergeladenen Installer-Datei – bei Hash-Mismatch wird die Datei automatisch gelöscht, kein Setup startet
- Semver-Vergleich (`isNewerVersion`) für zuverlässige Versionserkennung
- `cachedUpdateInfo` hält Update-Daten zwischen Check und Installation vor
- Neue IPC-Handler: `updater:check`, `updater:install`, `app:version`
- **`updaterAPI`** im Preload exponiert: `check`, `install`, `getVersion`, `onUpdateAvailable`

#### ℹ️ „Über"-Seite in den Einstellungen
- Neue **„Über WebRadio"**-Sektion in `settings.html` (Nav-Item + Seite `#page-about`)
- Zeigt App-Name, aktuelle Version (dynamisch), Entwickler und Plattform
- App-Logo-Vorschau (48×48) mit Accent-Farbe

#### 🔔 Update-Badge in der Titelleiste
- Wenn ein Update verfügbar ist, erscheint in der Hauptfenster-Titelleiste ein animiertes **Update-Badge** (`v1.x.x`)
- Klick auf das Badge öffnet direkt die Einstellungen-Updateseite
- Badge pulsiert mit `@keyframes badgePulse` (CSS in `core.css`)

#### 🖥️ System-Tray
- Neues **System-Tray-Icon** (`tray.js`) mit Kontextmenü:  
  WebRadio anzeigen · Play/Pause · Stop · Einstellungen · Update prüfen · Beenden
- Doppelklick auf das Tray-Icon bringt das Fenster in den Vordergrund
- Tray wird beim App-Beenden sauber aufgeräumt (`destroyTray`)

#### ⌨️ Media-Keys / Globale Shortcuts
- Neue Datei `mediaKeys.js` – registriert globale Tastaturshortcuts:  
  `MediaPlayPause`, `MediaStop`, `MediaNextTrack`
- Shortcuts werden beim Beenden der App über `unregisterMediaKeys()` wieder freigegeben

#### 🔌 Plugin-System (erweitert)
- **Plugin-Kontext-System** (`PluginContext.js`, `PluginAPI.js`, `PluginEvents.js`, `PluginLoader.js`, `PluginManager.js`, `PluginPermissions.js`, `PluginStorage.js`) vollständig ausgebaut
- Plugins können jetzt `init(context)` aufgerufen bekommen mit einem isolierten Kontext-Objekt
- Plugin-Renderer-Skripte können via `getRendererScripts` geladen werden
- Hot-Toggle: Plugins können zur Laufzeit aktiviert/deaktiviert werden ohne Neustart
- Event-Unterstützung: `onMetadata`, `onStationChange`, `onPlay`, `onStop`, `onVolumeChange`, `onThemeChange`
- Plugin-Errors werden via `safeExecute()` abgefangen und crashen nicht die App

#### 📻 RadioBrowserService – Verbesserter Mirror-Fallback
- Neue Datei `RadioBrowserService.js` mit automatischem **Mirror-Fallback**
- Serverliste wird von `de1.api.radio-browser.info/json/servers` abgerufen und **24 Stunden gecacht** (Datei `radiobrowser-servers.json` im userData-Ordner)
- Bei Ausfall eines Mirrors: automatischer Retry auf nächsten Spiegel mit 300ms Pause
- **8-Sekunden-Timeout** pro Anfrage via `AbortSignal.timeout(8000)`
- Tag-Filter (`isUsableTag`): filtert Tags mit < 5 Sendern, Tags mit Sonderzeichen oder > 40 Zeichen

#### 🔊 Audio-Engine (Crossfade & Limiter)
- **Crossfade-Switching** beim Senderwechsel: 2 parallele GainNodes (A/B), 300ms linearer Übergang
- Neuer **DynamicsCompressor** als Limiter (Threshold −6 dB, Ratio 20:1, schnelle Attack 1ms)
- `primed`-Flag verhindert mehrfaches `ctx.resume()` beim ersten PCM-Chunk
- Switching-Lock (`switching`-Flag) verhindert Race Conditions beim schnellen Stationswechsel
- `setVolume()` mit `cancelScheduledValues` + `setTargetAtTime` für saubere Lautstärkeänderungen

---

### 🐛 Bugfixes

- **Theme-URL auf Windows**: Backslashes in Dateipfaden werden jetzt immer zu Slashes normalisiert (`.replace(/\\/g, '/')`) bevor sie als `file://`-URL gesetzt werden → Themes wurden auf Windows nicht geladen
- **Radio-Serverlist-Cache**: `timestamp`-Feld wurde beim Speichern falsch als `updated` statt `timestamp` gesetzt → Cache wurde nie als gültig erkannt, Serverliste wurde bei jedem Start neu abgefragt
- **Doppelter `init`-Aufruf im PluginManager**: `startPlugin()` rief `instance.init(context)` zweimal auf (einmal via `safeExecute`, einmal direkt); zweiter Aufruf entfernt
- **`stopPlugin` – doppelter `destroy`-Check**: Beide Bedingungen `typeof p.instance.destroy === "function"` waren identisch; dead code
- **Updater `installBtn`**: Button-Text beim Klick wurde nicht korrekt zurückgesetzt wenn `updaterAPI.install()` fehlschlug – `setTimeout`-Reset von 2 Sekunden hinzugefügt
- **Favoriten-Duplikat-Prüfung**: `addFavorite` prüft nun korrekt sowohl `url` als auch `url_resolved` auf Duplikate
- **History-Sortierung**: Beim erneuten Spielen eines Senders wird der alte Eintrag zuerst entfernt, dann oben neu eingefügt (`unshift`), statt ihn zu duplizieren
- **Settings-Window `Singleton`**: `WindowManager.openSettings()` fokussiert das bestehende Fenster wenn es bereits offen ist, statt ein zweites zu öffnen
- **PlayerBar `onError` Fallback**: Fehlgeschlagene Sender-Logos fallen auf `../assets/default-logo.png` zurück (sowohl in `PlayerBar.jsx` als auch in `StationGrid.jsx`)

#### 🔧 Nachträglich gefixt (Post-Release)

- **RadioBrowserService – Cache-Keys falsch**: Beim Lesen wurde `cache.updated` und `cache.servers` erwartet, aber falsche Keys gespeichert (`timestamp`/`mirrors`) → Cache-Prüfung schlug immer fehl, Serverliste wurde bei jedem Start neu abgerufen *(gefixt in `RadioBrowserService.js`)*
- **Tray – „Update prüfen" ohne Funktion**: `createTray()` erhielt `checkForUpdates` nie als Callback, da `main.js` es beim Aufruf wegließ → Klick im Tray-Menü passierte nichts *(gefixt in `main.js` – Import + Übergabe ergänzt)*

---

### ♻️ Refactoring & Architektur

#### Hauptprozess-Aufteilung (IPC-Handler modularisiert)
| Datei | Zuständigkeit |
|---|---|
| `radioHandlers.js` | Stream-Start/Stop, Sendersuche, Länder, Tags |
| `themeHandlers.js` | Theme laden, aktives Theme lesen/setzen |
| `updaterHandlers.js` | Update-Check, Install, App-Version |
| `storageHandlers.js` | Favoriten, History |
| `pluginHandlers.js` | Plugin-Liste, Toggle, Renderer-Skripte |
| `windowHandlers.js` | Minimize, Maximize, Close, Settings öffnen |
| `registerIpcHandlers.js` | Zentraler Einstiegspunkt, registriert alle Handler |

#### Window-Management ausgelagert
- `WindowManager` (Klasse), `MainWindow.js`, `SettingsWindow.js` in `electron/core/app/`
- `WindowManager` stellt sicher dass Main- und Settings-Fenster jeweils Singletons sind

#### Sonstiges
- `electron/main.js` auf 33 Zeilen reduziert – reiner Bootstrap ohne Logik
- `preload.js` vollständig strukturiert in 6 isolierte `contextBridge`-APIs: `api`, `pluginAPI`, `radioAPI`, `windowControls`, `media`, `themeAPI`, `updaterAPI`
- `eventBus.js` als zentraler In-Prozess-Event-Bus mit `on`, `off`, `emit` und Fehlerabfang
- `storage.js` zentral für History, Favorites und Settings
- `renderer/services/themeService.js` kapselt alle CSS-Theme-Operationen sauber

---

### 🎨 Design & UI

- Einstellungsfenster komplett neu gestaltet (`settings.html`): 4-seitige Navigation (Plugins · Themes · Updates · Über) mit Slide-In-Animation (`fadeIn`)
- Update-Seite: animierter Status-Icon (pulsierendes Glühen bei verfügbarem Update), Release-Notes-Box, direkter Download-Button
- Toggle-Switches für Plugins (Custom-CSS, kein Browser-Default)
- Theme-Karten mit Border-Glow wenn aktiv
- `update-badge` in der Titelleiste mit Pulsanimation (`badgePulse`)
- VU-Meter Visualizer mit Cyan/Blau-Gradient (`#00f2fe` → `#4facfe`)
- Lautstärke-Slider mit eigenem `webkit`-Thumb-Styling

---

### 📦 Abhängigkeiten

- Electron **^40.7.0**
- React **^19.2.6** + ReactDOM **^19.2.6**
- `discord-rpc` ^4.0.1 (Vorbereitung für Discord Rich Presence)
- `ffmpeg-static` ^5.3.0 + `fluent-ffmpeg` ^2.1.3 (für Audio-Stream-Verarbeitung)
- `fs-extra` ^11.3.4
- TypeScript **^6.0.2** (dev)
- esbuild **^0.28.1** (Build)
- electron-builder **^26.15.3** (Packaging)

---

## [v1.0.3] – Vorherige Version

> Baseline-Version. Monolithische Architektur mit `main.legacy.js`, einfachem Update-Check ohne Hash-Verifikation, ohne Theme-Engine und ohne Tray-Support.

---

*Changelog zuletzt aktualisiert: 2026-07-24 · Erstellt von Antigravity · WebRadio by YourEliteSystems*
