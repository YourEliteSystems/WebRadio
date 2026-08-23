# Changelog – WebRadio

Alle wichtigen Änderungen an diesem Projekt werden hier dokumentiert.

---

## [v1.0.5.1] – 2026-08-23

> Navigation-System-Korrektur und Theme-System-Konsolidierung – Plugin-gesteuerte Navigation und zentraler Theme-Wechsel.

### ✨ Highlights & Hauptänderungen

#### 🔌 Plugin-gesteuerte Navigation korrigiert

- **Navigation vollständig plugin-gesteuert**:
  - Core erstellt keine festen MediaHub-Sections mehr
  - Plugins entscheiden selbst über Sections, Items, Hierarchie und Reihenfolge
  - Navigation API erweitert: `registerSection()`, `registerItem()` mit vollständiger Kontrolle
  - Core-Navigation (Radio) wird über API registriert, nicht hardcoded
- **NavigationManager Default-Parameter korrigiert**:
  - `ownerPluginId` Default von `"core"` auf `null` korrigiert
  - Konsistente Trennung zwischen Core (null) und Plugins (pluginId)
- **Sidebar.jsx generisch gemacht**:
  - Entfernung von hartcodiertem Radio-Button
  - Radio wird als Top-Level Item aus Navigation-Tree gerendert
  - Keine MediaHub-Sonderfälle mehr
- **Navigation Lifecycle**:
  - `PluginRuntime.stop()` ruft `NavigationManager.clearPlugin()` auf
  - Plugin-Navigation wird beim Stop sauber entfernt
  - Keine verwaisten Navigationseinträge
- **Isolation & Permissions**:
  - Plugins können nur eigene Einträge verwalten
  - Keine Überschreibung fremder Navigation
  - Permission `navigation` erforderlich für API-Zugriff

#### 🎨 Theme-System konsolidiert

- **Geteiltes Theme-System zusammengeführt**:
  - themeHandlers.js an ThemeManager angebunden
  - Zentraler Theme-Wechselpfad über ThemeManager
  - Entfernung von ThemeRuntime (nicht benötigt für CSS-Wechsel)
- **ThemeManager vereinfacht**:
  - Entfernung von `enableTheme()`, `disableTheme()`, `reloadTheme()` (benötigten ThemeRuntime)
  - Fokus auf Theme-Discovery und -Verwaltung
  - Logging mit LogManager integriert
- **Ungenutzte Komponenten entfernt**:
  - ThemeProvider.js entfernt (ungenutzter Wrapper)
  - Keine parallelen Theme-Systeme mehr
- **Nahtloser Theme-Wechsel**:
  - CSS-Wechsel über einzelnes `<link>` Element mit href-Aktualisierung
  - Kein App-Neustart oder Renderer-Reload
  - Theme-Persistenz über SettingsManager
  - Theme wird beim Start vor React-Render angewendet (kein Flashing)
- **Plugin-Kompatibilität**:
  - Plugins können über `onThemeChange` Hook reagieren
  - EventBus `themechange` für Core-Systeme
  - IPC Broadcast `theme:changed` für Renderer

### 🔄 Technische Änderungen

- **electron/core/navigation/NavigationManager.js**:
  - Default-Parameter von `"core"` auf `null` korrigiert
- **electron/core/Application.js**:
  - Core-Navigation (Radio) über `NavigationManager.registerItem()` registriert
- **renderer/components/Sidebar.jsx**:
  - Hartcodierter Radio-Button entfernt
  - Navigation vollständig aus Tree gerendert
- **electron/core/ipc/themeHandlers.js**:
  - Anbindung an ThemeManager für zentrale Theme-Verwaltung
  - Fallback für Abwärtskompatibilität beibehalten
- **electron/core/themes/ThemeManager.js**:
  - Entfernung von ThemeRuntime-Referenzen
  - Vereinfachung auf reine Theme-Verwaltung
  - Logging integriert
- **electron/core/themes/ThemeProvider.js**:
  - ENTFERNT (ungenutzt)

### 🧪 Tests

- **Navigation Tests** (26/26 bestanden):
  - Validator Tests, Core Initialisierung, Plugin-gesteuerte Navigation
  - Isolation & Duplicate Protection, Plugin Lifecycle Cleanup
  - Permissions & PluginAPI, Visibility & Disabled, Collapsible & Expanded
  - Order-Sortierung
- **Theme Tests** (12/12 bestanden):
  - ThemeValidator Tests, ThemeManager Lifecycle, ThemeManager Getters
  - ThemeLoader, Architecture Check (kein ThemeRuntime, kein ThemeProvider)

### 🐛 Bugfixes

- NavigationManager Default-Parameter-Inkonsistenz behoben
- ThemeRuntime fehlende Referenzen entfernt
- Theme-System Duplikation bereinigt

---

## [v1.0.5] – 2026-07-30

> Offizielles Release v1.0.5 – Logging-Refactoring, ShortcutManager, Cross-Platform Vorbereitungen, Plugin-Architektur-Konsolidierung, Integration-System und Release-Infrastruktur.

### ✨ Highlights & Hauptänderungen

#### 🔌 Plugin-Architektur-Konsolidierung

- **Vollständige Konsolidierung des Plugin-Systems**:
  - Entfernung des alten `electron/plugins/pluginManager.js` (Legacy-PluginManager)
  - Konsolidierung auf die neue Architektur unter `electron/core/plugins/`
  - Es existiert jetzt nur noch eine produktive Plugin-Architektur
- **PluginLoader erweitert**:
  - Unterstützt beide Manifest-Formate: `plugin.json` (altes Format) und `manifest.json` (neues Format)
  - Automatischer Fallback-Mechanismus für maximale Kompatibilität
  - Rückwärtskompatibel mit bestehenden Plugins
- **PluginManager erweitert**:
  - Config-Management (readConfig, writeConfig) für plugins.json
  - togglePlugin() für Hot-Toggle zur Laufzeit ohne Neustart
  - getRendererScripts() für Renderer-Plugin-Scripts
  - Volle Funktionsübernahme vom alten PluginManager
- **PluginRuntime stabilisiert**:
  - Context wird vor Event-Handler-Registrierung erstellt (Reihenfolge korrigiert)
  - Event-Handler erhalten Context als zweiten Parameter
  - Deprecation-Checks für direkte Core-Imports
  - Verbesserte Fehlerbehandlung mit try-catch um init() und destroy()
  - Hook-System über `hookMap` – verbindet Plugin-Methoden mit EventBus-Events
  - Alle Hook-Aufrufe in `try/catch` gekapselt – kein App-Crash bei fehlerhaften Plugins
  - `stop()` entfernt alle EventBus-Listener und löscht den Node-Module-Cache für sauberes Hot-Reload
- **Migration aller Komponenten**:
  - Application.js: Import von `./core/plugins/PluginManager`
  - pluginHandlers.js: Import von `../plugins/PluginManager`
  - main.legacy.js: Import von `./core/plugins/PluginManager` und Aufruf von `PluginManager.initialize()`
- **Redundante Klassen entfernt**:
  - `electron/plugins/pluginManager.js` (alter PluginManager)
  - `electron/core/plugins/PluginService.js` (redundant)
- **Dokumentation aktualisiert**:
  - Plugin API Dokumentation erweitert mit Architektur-Beschreibung
  - Plugin-Lifecycle-Diagramm hinzugefügt
  - Manifest-Format-Kompatibilität dokumentiert
  - Event-Handler Context-Parameter dokumentiert
- **Keine Breaking Changes**:
  - Alle Plugins funktionieren weiterhin ohne Änderungen
  - Plugin API als einzige offizielle Schnittstelle
  - Volle Rückwärtskompatibilität gewährleistet

#### 🔧 Integration-System (Neu)

- **Offizielle Integrationen**:
  - Neues Integration-System für offizielle WebRadio-Komponenten
  - Integrationen nutzen dieselbe PluginAPI und Runtime wie Plugins
  - Keine öffentliche API für Integrationen – vollständig gekapselt
  - IntegrationManager und IntegrationLoader unter `electron/core/integrations/`
- **Integration-Beispiele**:
  - YouTube Integration (Grundstruktur)
  - Discord RPC Integration (Grundstruktur)
- **Integration Manifest**:
  - `type: "integration"` Feld für Manifest-Validierung
  - Unterstützung für `manifest.json` in `integrations/` Verzeichnis
- **Dokumentation**:
  - IntegrationSDK.md erstellt mit vollständiger Dokumentation

#### 🔧 Logging-System Refactoring

- **Vollständiges Logging-Refactoring**:
  - Alle `console.*` Aufrufe durch professionellen Logger ersetzt (41 Dateien)
  - Konsistentes Logging über gesamtes Projekt
  - Verbesserte Fehlerbehandlung und Debugging
- **Diagnostics-Subsystem**:
  - Neues Modul `electron/core/diagnostics/` als zentrales Diagnosesystem
  - LogManager mit initialize(), createLogger(), getLogger(), getRootLogger()
  - Logger mit Log-Level (debug, info, warn, error, fatal), Child-Logger und Transports
  - LogEntry, LogFormatter, LogLevel für strukturiertes Logging
  - ConsoleTransport und FileTransport für rotierte .log-Dateien
  - LogReader zum Auslesen gespeicherter Log-Dateien
  - Systemweites Logging über gesamtes Projekt
  - Frontend-Bridge: React-Frontend sendet Logs via IPC an Main-Process
  - Plugin Logging: Plugins erhalten eigenen logger über context.logger
- **Crash-Handling-System**:
  - CrashHandler fängt uncaughtException und unhandledRejection global ab
  - CrashReportManager erstellt strukturierte Crash-Reports mit System-Snapshot
  - CrashReportWriter und CrashReportReader für Report-Management
- **Health-Check-System**:
  - HealthCheck führt Standardprüfungen beim App-Start durch
  - Prüft Plugin/Theme/Logs-Verzeichnisse, storage.json, registry.json
  - Erweiterbar per register(name, callback)
- **SystemInfo**:
  - Strukturierter Snapshot des Systems (App, Plattform, CPU, RAM, Versionen)
  - getPretty() gibt RAM-Werte in GB formatiert zurück
- **CrashHandler Verbesserungen**:
  - Fehler bei Logger-Initialisierung behoben
  - Robustere Fehlerbehandlung bei Crashes

#### ⌨️ ShortcutManager Implementierung

- **Zentrale Shortcut-Verwaltung**:
  - Neuer ShortcutManager für alle Tastenkombinationen
  - Media-Shortcuts (immer aktiv): MediaPlayPause, MediaStop, MediaNextTrack
  - Development-Shortcuts (nur im Dev-Modus): F12, F5, Ctrl+R, Ctrl+Shift+R, Ctrl+Shift+I
  - F-Tasten über `webContents.before-input-event` (zuverlässiger für Funktionstasten)
  - Ctrl-Kombinationen über `window.before-input-event`
- **Alte mediaKeys.js als DEPRECATED markiert**:
  - Warnungen bei Verwendung des veralteten Moduls
  - Rückwärtskompatibilität gewährleistet
- **Saubere Integration**:
  - Integration in Application.js Lifecycle
  - Robuste Shutdown-Logik mit Fehlerbehandlung

#### 🌍 Cross-Platform Vorbereitungen

- **FFmpeg-Resolver Verbesserungen**:
  - Prüft zuerst nach systemweitem FFmpeg auf Linux/MacOS
  - Verwendet `which ffmpeg` für PATH-Suche
  - Prüft häufige Installationspfade (/usr/bin, /usr/local/bin, Homebrew)
  - Fallback auf gebündeltes ffmpeg-static wenn nichts gefunden
  - Spart ~50MB Speicher auf Linux/MacOS Builds
- **Cross-Platform Konfigurationen**:
  - electron-builder.yml für MacOS (x64 und arm64/Apple Silicon)
  - Linux .desktop Entry für Application Menu Integration
  - Arch Linux AUR PKGBUILD für einfache Installation
- **Dokumentation**:
  - Cross-Platform Setup Guide erstellt
  - Icon-Konvertierung und -Erstellung dokumentiert

#### 🚀 Release-Infrastruktur

- **Release-Pipeline** (`scripts/release/`):
  - Vollständiges Node.js-Modul-System für Release-Automatisierung
  - Unabhängig von GitHub Actions betreibbar
  - Module: validate.js, semver.js, changelog.js, release-notes.js, checksums.js, github.js, constants.js, utils.js, errors.js
- **SemVer-Utility**:
  - parse() Funktion für Semantic Versioning
  - resolveStage() für Staging-Auflösung (stable, rc, beta, alpha, nightly)
  - SEMVER_REGEX für alle gängigen Pre-Release- und Build-Metadaten
  - isValid() Funktion für SemVer-Validierung
- **Changelog-Parser**:
  - getVersion(v) extrahiert den Abschnitt einer Version
  - hasVersion(v) prüft Existenz
  - normalizeVersion() für Versionsnummern-Normalisierung
- **Release Validation**:
  - npm run release:validate prüft package.json und CHANGELOG.md
  - Sicherstellung der Release-Bereitschaft
- **GitHub Actions Release-Workflow**:
  - Trigger bei Git-Tags der Form v* und manuell via workflow_dispatch
  - Release-Kontext-Ermittlung mit dreistufiger Priorität
  - Pre-release-Erkennung für alpha, beta, rc, nightly
  - Checksums-Erstellung (SHA256SUMS.txt)
  - Release-Notes-Generierung aus CHANGELOG.md
  - Artefakte-Sammlung und GitHub Release
- **Build-Workflow**:
  - Cross-Platform-Matrix: windows-latest, ubuntu-latest, macos-latest
  - FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true Umgebungsvariable

#### 🏗️ Application.js – Zentrale Bootstrap-Klasse

- **Neue Application-Klasse**:
  - Bündelt den gesamten App-Lifecycle
  - Startup-Sequenz: Storage → Diagnostics → Window → IPC → Plugins → Integrations → Themes → MediaKeys → Tray → Updater
  - start() und shutdown() als saubere Lifecycle-Methoden
  - Singleton-Export – main.js auf wenige Zeilen reduziert
- **Shutdown-Methoden**:
  - shutdownDiagnostics() – fährt alle Diagnostics-Subsysteme sicher herunter
  - shutdownPlugins() – ruft PluginManager.shutdown() auf
  - shutdownIntegrations() – ruft IntegrationManager.shutdown() auf
  - shutdownThemes() – ruft ThemeManager.shutdown() auf
  - shutdownMediaKeys() – ruft unregisterMediaKeys() auf
  - shutdownTray() – ruft destroyTray() auf
- **initializeDiagnostics()**:
  - Initialisiert LogManager, CrashHandler, CrashReportManager, HealthCheck in richtiger Reihenfolge

#### �️ Storage-Architektur

- **StorageManager erweitert**:
  - getCrashPath() → userData/crash/
  - getPackagesPath() → userData/packages/
  - getReportsPath() → userData/reports/
  - getSettingsFile() → userData/settings.json
  - initialize() legt alle 7 Verzeichnisse automatisch an
- **Neue Manager-Klassen**:
  - FavoritesManager – getAll(), add(entry), remove(url)
  - HistoryManager – getAll(), add(entry)
  - SettingsManager – get(), update(data)

#### 🩺 Diagnostics – IPC-API

- **Diagnostics-Handler**:
  - log (send) – Frontend-Logging-Bridge
  - diagnostics:getHealth – HealthCheck.run()
  - diagnostics:getSystemInfo – SystemInfo.getPretty()
  - diagnostics:getCrashReports – Listet alle Crash-Reports
  - diagnostics:readCrashReport – Liest einzelnen Crash-Report
  - diagnostics:deleteCrashReport – Löscht einzelnen Crash-Report
  - diagnostics:clearCrashReports – Löscht alle Crash-Reports
  - diagnostics:getLogs – Listet alle Log-Dateien
  - diagnostics:readLog – Liest einzelne Log-Datei
  - diagnostics:deleteLog – Löscht einzelne Log-Datei
  - diagnostics:clearLogs – Löscht alle Log-Dateien
  - diagnostics:getPaths – Gibt alle userData-Pfade zurück

#### 🔌 Preload – Context-Bridge-APIs

- **uiAPI** – getPages() für Plugin-UI-Slots
- **shellAPI** – openPath(folderPath) öffnet Ordner im Datei-Explorer
- **diagnosticsAPI** – vollständige Diagnostics-API über contextBridge exponiert

#### 🎨 Theme-System

- **ThemeManager Lifecycle**:
  - initialize() und shutdown() Methoden
  - initialize()-Guard verhindert Doppel-Initialisierung
  - Neue Methoden: enableTheme(), disableTheme(), reloadTheme(), getTheme(), getThemes(), hasTheme(), isInitialized()
  - Themes werden intern in einer Map gehalten für O(1)-Zugriff
  - shutdown() räumt alle geladenen Themes sauber auf
- **Live Theme Sync**:
  - theme:setActive führt IPC-Broadcast (theme:changed) an alle BrowserWindow-Instanzen
  - window.themeAPI um onThemeChanged-Listener erweitert
  - themeService.js und PlayerBar.jsx lauschen auf Theme-Wechsel
  - CSS-Änderungen werden sofort live angewendet

#### 🪟 Window-Handler

- **shell:openPath-Handler**:
  - shell.openPath(folderPath) öffnet Pfade nativ im OS-Explorer

#### 📋 GitHub Issue Templates

- 4 neue Issue-Templates: bug_report.md, feature_request.md, plugin_api.md, refactoring.md
- config.yml mit Kontakt-Links für Dokumentation

### �🔄 Technische Änderungen

- **electron/core/ShortcutManager.js** - Neuer zentraler ShortcutManager
- **electron/core/mediaKeys.js** - Als DEPRECATED markiert
- **electron/core/ffmpeg-resolver.js** - Systemweites FFmpeg-Support
- **electron/core/diagnostics/crash/CrashHandler.js** - Logger-Initialisierung behoben
- **electron/core/Application.js** - ShortcutManager Integration, PluginManager Import angepasst, IntegrationManager hinzugefügt
- **electron/main.js** - Logger für Uncaught Exceptions, auf Bootstrap reduziert
- **electron/main.legacy.js** - Logger und ShortcutManager Integration, PluginManager Import angepasst
- **electron/core/app/MainWindow.js** - Automatische DevTools-Öffnung entfernt
- **electron/core/app/SettingsWindow.js** - Automatische DevTools-Öffnung entfernt
- **electron/core/plugins/PluginManager.js** - Config-Management, togglePlugin, getRendererScripts
- **electron/core/plugins/PluginLoader.js** - plugin.json und manifest.json Unterstützung
- **electron/core/plugins/PluginRuntime.js** - Context-Reihenfolge korrigiert, Event-Handler Context-Parameter, Hook-System
- **electron/core/plugins/PluginService.js** - ENTFERNT (redundant)
- **electron/plugins/pluginManager.js** - ENTFERNT (Legacy-PluginManager)
- **electron/core/integrations/IntegrationManager.js** - NEU
- **electron/core/integrations/IntegrationLoader.js** - NEU
- **electron/core/ipc/pluginHandlers.js** - PluginManager Import angepasst
- **electron/core/ipc/integrationHandlers.js** - Für IntegrationManager aktualisiert
- **electron/core/ipc/registerIpcHandlers.js** - IntegrationHandler Registrierung
- **electron/core/events/EventBus.js** - Neue eigenständige EventBus-Klasse
- **electron/core/diagnostics/logging/transports/** - Transport-Klassen isoliert
- **electron/core/services/DiscordRichPresence.js** - Reconnection-Logik implementiert

### 🐛 Bugfixes

- CrashHandler Fehler bei Logger-Initialisierung behoben
- ShortcutManager Shutdown-Fehler ("Object has been destroyed") behoben
- F-Tasten Shortcuts funktionieren jetzt zuverlässig über webContents.before-input-event
- StreamManager uncaughtException (ffmpeg SIGTERM) behoben – removeAllListeners() vor kill()
- LogManager fehlende shutdown() Methode ergänzt
- Theme-URL auf Windows: Backslashes zu Slashes normalisiert
- Radio-Serverlist-Cache: timestamp-Feld korrigiert
- Doppelter init-Aufruf im PluginManager entfernt
- stopPlugin doppelter destroy-Check entfernt
- Updater installBtn Text-Reset hinzugefügt
- Favoriten-Duplikat-Prüfung korrigiert
- History-Sortierung verbessert
- Settings-Window Singleton-Fix
- PlayerBar onError Fallback auf default-logo.png
- RadioBrowserService Cache-Keys korrigiert
- Tray "Update prüfen" Callback-Fix
- DiscordRichPresence connection closed Fehler behoben – automatischer Reconnect implementiert

### 📚 Dokumentation

- **Vollständige Entwickler-Dokumentation neu erstellt**:
  - Architecture Docs (10 Dateien): Application, StorageManager, WindowManager, Diagnostics, IPC, ThemeManager, PluginManager, MediaKeys, Tray, Updater
  - Plugin SDK (12 Dateien): GettingStarted, Manifest, ProjectStructure, Lifecycle, Context, Storage, Events, Hooks, UI, BestPractices, HelloWorld, FAQ
  - Theme SDK (9 Dateien): GettingStarted, ThemeManifest, DirectoryStructure, CSSVariables, Components, Assets, BestPractices, HelloTheme, FAQ
  - API Reference: Vollständige Referenz aller öffentlichen APIs
- **IntegrationSDK.md** – Vollständige Dokumentation des Integration-Systems
- **VERIFIED_INTEGRATIONS.md** – Architekturplanung für Verified Integrations
- **CROSS_PLATFORM_SETUP.md** – Cross-Platform Setup Guide
- Alte Dokumentation nach docs_legecy/ verschoben

### ♻️ Refactoring

- Alte Dokumentation nach docs_legecy/ verschoben
- electron/main.js vereinfacht – vollständige Delegation an Application
- PluginRuntime und PluginManager weiter konsolidiert
- diagnosticsHandlers.js für IPC-Anbindung hinzugefügt
- windowHandlers.js aktualisiert
- Logging-Klassen von electron/core/logging/ nach electron/core/diagnostics/logging/ verschoben
- Theme-Development-Draft entfernt, durch Theme-Development-Guide ersetzt
- Plugin-Development-Guide aktualisiert
- DEVELOPER_GUIDE.md und README.md aktualisiert
- CODE_OF_CONDUCT.md, CONTRIBUTING.md, SECURITY.md hinzugefügt/aktualisiert
- preload.js vollständig strukturiert in 6 isolierte contextBridge-APIs
- eventBus.js als zentraler In-Prozess-Event-Bus
- storage.js zentral für History, Favorites und Settings
- renderer/services/themeService.js kapselt alle CSS-Theme-Operationen

### 📦 Abhängigkeiten

Keine neuen Abhängigkeiten. Alle Pakete auf demselben Stand wie v1.0.4.

---

## [v1.1.0] – TODO (Geplant)

> Cross-Platform Erweiterung – MacOS und Linux Support inklusive systemweiter FFmpeg-Integration.

### ✨ Neue Features & Verbesserungen

#### 🌍 Cross-Platform Support

- **MacOS Support**:
  - electron-builder.yml Konfiguration für MacOS (x64 und arm64/Apple Silicon)
  - Vorbereitung für .icns Icon-Format
  - Kategorie: public.app-category.music
- **Linux Support**:
  - electron-builder.yml Konfiguration für Linux (AppImage, deb, rpm)
  - Linux .desktop Entry für Application Menu Integration
  - Arch Linux AUR PKGBUILD für einfache Installation
- **Systemweites FFmpeg auf Linux/MacOS**:
  - Verbesserter FFmpeg-Resolver prüft zuerst nach systemweitem FFmpeg
  - Verwendet `which ffmpeg` für PATH-Suche
  - Prüft häufige Installationspfade (/usr/bin, /usr/local/bin, Homebrew)
  - Fallback auf gebündeltes ffmpeg-static wenn nichts gefunden
  - Spart ~50MB Speicher auf Linux/MacOS Builds

#### 📚 Dokumentation

- **Cross-Platform Setup Guide** (`docs/CROSS_PLATFORM_SETUP.md`):
  - Umfassende Anleitungen für MacOS und Linux Builds
  - Icon-Konvertierung und -Erstellung
  - Platform-spezifische Installation-Methoden
  - CI/CD Integration Beispiele
  - Troubleshooting für häufige Probleme

#### 🔧 Konfiguration

- **electron-builder.yml**:
  - MacOS arm64 Support (Apple Silicon)
  - Linux Targets: AppImage, deb, rpm
  - Icon-Pfade und Kategorien für alle Plattformen
- **assets/webradio.desktop**:
  - Desktop Entry für Linux Application Menu Integration
  - Proper categorization (AudioVideo/Audio/Player)
- **assets/PKGBUILD**:
  - Arch Linux AUR Package Konfiguration
  - Abhängigkeiten: electron, ffmpeg, nss
  - Systemweite Installation unter /opt/webradio

### 🔄 Technische Änderungen

- **electron/core/ffmpeg-resolver.js**:
  - `findSystemFFmpeg()` Funktion für systemweite FFmpeg-Suche
  - Platform-spezifische Logik (Linux/MacOS vs Windows)
  - Verbessertes Logging für Debugging
- **assets/PKGBUILD**:
  - Optimiert für systemweites FFmpeg-Nutzung
  - Installiert Icons, Desktop Entry und Launcher Script

### 📋 Offene Aufgaben für v1.1 Release

- [ ] MacOS Icons (.icns) erstellen
- [ ] Linux Icons in verschiedenen Größen erstellen
- [ ] MacOS Window Controls im Code anpassen
- [ ] Builds auf MacOS testen
- [ ] Builds auf Linux/Arch testen
- [ ] CI/CD für Multi-Platform Builds einrichten

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
