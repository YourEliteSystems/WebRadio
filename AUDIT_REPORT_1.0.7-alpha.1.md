# WebRadio 1.0.7-alpha.1 Vollständiger Projekt-Audit

## Projektübersicht

**Projektversion:** 1.0.7.alpha.1  
**Git Commit:** (aktuell auf main branch)  
**Node:** >=26  
**Electron:** 44.4.1  
**Build-System:** electron-builder 26.15.3  
**React:** 19.2.6  
**Package Manager:** npm

## Architekturübersicht

### Main Process (electron/core/)
- **Application.js** - Zentraler Bootstrapper
- **WindowManager.js** - Verwaltet MainWindow und SettingsWindow
- **ShortcutManager.js** - Media Keys und Shortcuts
- **StreamManager.js** - FFmpeg Audio Streaming
- **PlayerManager.js** - Unified Player API
- **RadioProvider.js** - Radio Player Adapter
- **MediaHubProvider.js** - MediaHub/YouTube Adapter
- **DiscordPresenceAdapter.js** - Discord RPC Integration
- **PluginManager.js** - Plugin Discovery und Lifecycle
- **PluginRuntime.js** - Plugin Execution
- **PluginAPI.js** - Plugin Interface
- **PluginHttpServer.js** - Lokaler HTTP Server für Plugins
- **ThemeManager.js** - Theme System
- **UpdateManager.js** - Update System
- **Diagnostics/** - Logging, Crash Handling, Profiling
- **IPC Handlers** - Zentrale IPC-Kommunikation

### Renderer Process (renderer/)
- **renderer.jsx** - React Hauptanwendung
- **settings.jsx** - React Settings
- **components/** - UI Komponenten
- **hooks/** - React Hooks (useUnifiedPlayer, usePlayer, etc.)
- **services/** - PlayerService, ThemeService
- **worklets/** - AudioWorklet PCM Processing

### Plugins (plugins/)
- **youtube/** - YouTube Integration (MediaHub)

### Themes (themes/)
- Built-in Themes im Projektverzeichnis
- User Themes in userData/themes/

## Kritische Befunde

### AUD-001: Update-Channel System Inkonsistenz (CRITICAL)

**Bereich:** Update-System  
**Schweregrad:** CRITICAL  
**Risiko:** Falsche Updates, Channel-Verwirrung, Update-System-Break

**Problem:**
- `UpdateState.js` definiert nur `CHANNELS.STABLE` und `CHANNELS.BETA`
- `UpdateChannel.js` behandelt alpha nur als Kompatibilitäts-Flag, nicht als separaten Channel
- `release.yml` erkennt alpha-Kanal korrekt und setzt `UPDATE_CHANNEL=alpha`
- `electron-builder.yml` erwartet `UPDATE_CHANNEL` als Environment-Variable
- `app-update.yml` hat `channel: latest` hardcoded
- Keine zentrale `getUpdateChannel()` Funktion

**Ursache:**
Partielle Implementierung von alpha-Channel ohne vollständige Konsistenz über alle Komponenten.

**Empfehlung:**
1. `UpdateState.js` um `CHANNELS.ALPHA` erweitern
2. `UpdateChannel.js` um echte alpha-Channel-Logik erweitern
3. Zentrale `getUpdateChannel()` Funktion implementieren
4. Alle Komponenten auf zentrale Channel-Auswahl umstellen
5. `app-update.yml` Runtime-Channel-Logik implementieren

---

### AUD-002: EventBus Duplikat (HIGH)

**Bereich:** Core Architecture  
**Schweregrad:** HIGH  
**Risiko:** Zustandsinkonsistenz, Event-Leaks, parallele Architektur

**Problem:**
- `electron/core/eventBus.js` - Alte EventBus-Implementierung
- `electron/core/events/EventBus.js` - Neue EventBus-Implementierung
- Beide werden im Codebase importiert und verwendet
- Potenziell parallele Event-Systeme

**Ursache:**
Refactoring wurde nicht vollständig abgeschlossen. Neue EventBus-Implementierung wurde erstellt, aber alte nicht entfernt.

**Empfehlung:**
1. Alle Imports von altem EventBus analysieren
2. Auf neuen EventBus migrieren
3. Alten EventBus entfernen
4. Tests für neue EventBus-Implementierung sicherstellen

---

### AUD-003: Update-Channel Detection Lücke (HIGH)

**Bereich:** Update-System  
**Schweregrad:** HIGH  
**Risiko:** Falsche Channel-Zuordnung, Update-Probleme

**Problem:**
- `UpdateChannel.js` erkennt alpha nur als "Beta-kompatibel"
- `detectChannelFromVersion()` liefert für alpha immer `CHANNELS.BETA`
- Keine saubere Trennung zwischen alpha und beta Channel

**Ursache:**
Alpha-Channel wurde als nachträgliche Erweiterung implementiert ohne vollständige Channel-Logik.

**Empfehlung:**
1. `detectChannelFromVersion()` um alpha-Erkennung erweitern
2. Separate alpha-Channel-Konfiguration implementieren
3. Channel-Übergänge definieren (stable → beta → alpha)

---

### AUD-004: Plugin HTTP Server Security (HIGH)

**Bereich:** Security / HTTP-Origin  
**Schweregrad:** HIGH  
**Risiko:** Sicherheitslücke, unauthorized access

**Problem:**
- `PluginHttpServer.js` bindet auf `127.0.0.1` (korrekt)
- CORS ist auf `*` gesetzt (Access-Control-Allow-Origin: *)
- Keine Authentifizierung für lokale HTTP Requests
- Path-Traversal-Schutz vorhanden, aber muss getestet werden

**Ursache:**
YouTube IFrame API benötigt CORS, aber lokale Authentifizierung nicht implementiert.

**Empfehlung:**
1. CORS auf localhost beschränken
2. Origin-Header validieren
3. Optional: Basic Auth für Plugin-Server
4. Security-Audit durchführen

---

### AUD-005: Player Lifecycle Cleanup (MEDIUM)

**Bereich:** Unified Player API  
**Schweregrad:** MEDIUM  
**Risiko:** Memory Leaks, State-Inkonsistenz

**Problem:**
- `PlayerManager.subscribe()` verwendet Set für Subscribers
- Unsubscribe-Funktion entfernt Subscriber korrekt
- Aber: keine automatische Cleanup bei Provider-Removal
- Provider-Switching könnte alte Subscribers hinterlassen

**Ursache:**
Subscription-System sauber implementiert, aber Provider-Lifecycle nicht vollständig gekoppelt.

**Empfehlung:**
1. Provider-Removal automatisch alle Subscribers cleanup
2. Provider-Switching sicherstellen, dass alte Subscribers entfernt werden
3. Tests für Lifecycle-Cleanup hinzufügen

---

### AUD-006: Audio-System Shutdown Safety (MEDIUM)

**Bereich:** Audio-System  
**Schweregrad:** MEDIUM  
**Risiko:** Zombie-Prozesse, Audio-Hänger

**Problem:**
- `StreamManager.stop()` hat FFmpeg-Kill-Logik
- Event-Listener werden korrekt entfernt
- Aber: keine Timeout-Sicherung für hängende FFmpeg-Prozesse
- Kein SIGKILL-Fallback nach Timeout

**Ursache:**
Bestehende Shutdown-Logik ist grundlegend korrekt, aber ohne Fallback für hängige Prozesse.

**Empfehlung:**
1. Timeout für FFmpeg-Stop implementieren (z.B. 5 Sekunden)
2. SIGKILL-Fallback nach Timeout
3. Prozess-Status vor Shutdown prüfen

---

### AUD-007: Theme System Reload Inkomplett (MEDIUM)

**Bereich:** Theme-System  
**Schweregrad:** MEDIUM  
**Risiko:** Theme-Inkonsistenz, UI-Fehler

**Problem:**
- `ThemeManager.reloadThemes()` implementiert
- Aber: Built-in Themes können nach Reload verschwinden
- User-Theme Override Logik vorhanden, aber nicht vollständig getestet
- Invalid manifest handling teilweise

**Ursache:**
Theme-Reload wurde implementiert, aber Built-in Theme Preservation nicht vollständig.

**Empfehlung:**
1. Built-in Themes garantiert nach Reload wiederherstellen
2. User-Theme Override Logik validieren
3. Invalid manifest handling testen
4. Theme-Reload Tests erweitern

---

### AUD-008: IPC Security Validation (MEDIUM)

**Bereich:** Security / IPC  
**Schweregrad:** MEDIUM  
**Risiko:** Path Traversal, unauthorized access

**Problem:**
- IPC Handlers teilweise validieren Input
- Path-Traversal-Schutz nicht in allen Handlers
- Plugin-controlled paths nicht überall validiert
- Renderer-Input nicht überall sanitisiert

**Ursache:**
Security-Validierung inkonsistent über verschiedene IPC Handlers.

**Empfehlung:**
1. Alle IPC Handlers auf Input-Validierung prüfen
2. Zentrale Validation-Funktionen für paths implementieren
3. Plugin-controlled paths strikt validieren
4. Security-Tests für IPC hinzufügen

---

### AUD-009: Renderer State Management (LOW)

**Bereich:** Renderer  
**Schweregrad:** LOW  
**Risiko:** Stale State, Race Conditions

**Problem:**
- `useUnifiedPlayer()` Hook implementiert
- Aber: keine Fehlerbehandlung für missing window.playerAPI
- Keine Fallback-Logik für API-unavailable
- Potentielle Race Conditions bei API-Initialisierung

**Ursache:**
React Hook ist grundsätzlich korrekt, aber Error-Handling unvollständig.

**Empfehlung:**
1. try-catch um window.playerAPI Aufrufe
2. Fallback-Logik für API-unavailable
3. Loading-States für API-Initialisierung
4. Error-Boundary implementieren

---

### AUD-010: Dependency Security (LOW)

**Bereich:** Dependencies  
**Schweregrad:** LOW  
**Risiko:** Security vulnerabilities

**Problem:**
- `discord-rpc@4.0.1` - ältere Version
- `fluent-ffmpeg@2.1.3` - ältere Version
- Keine aktuellen Security-Scans verfügbar

**Ursache:**
Dependencies wurden nicht kürzlich aktualisiert.

**Empfehlung:**
1. `npm audit` durchführen
2. Security vulnerabilities prüfen
3. Wenn nötig: Updates nach Breaking Changes prüfen
4. Keine Blind-Updates

---

## Top-Prioritäten

1. **AUD-001** - Update-Channel System Inkonsistenz (CRITICAL)
2. **AUD-002** - EventBus Duplikat (HIGH)  
3. **AUD-003** - Update-Channel Detection Lücke (HIGH)
4. **AUD-004** - Plugin HTTP Server Security (HIGH)
5. **AUD-005** - Player Lifecycle Cleanup (MEDIUM)

## Zusammenfassung

Das Projekt hat eine solide Architektur mit Unified Player API, Plugin-System und Theme-System. Die kürzliche Umstellung auf provider-unabhängige Player-Architektur ist weitgehend korrekt implementiert.

**Hauptprobleme:**
1. Update-Channel System ist für alpha-Channel unvollständig
2. EventBus-Duplikat muss bereinigt werden
3. Security-Validierungen müssen konsistent werden

**Positive Aspekte:**
- Unified Player API ist sauber implementiert
- Plugin-System ist strukturiert
- Theme-System funktioniert grundsätzlich
- Audio-System ist stabil
- Tests sind umfangreich

**Nächste Schritte:**
Priorisierte Fehlerbehebung nach CRITICAL → HIGH → MEDIUM → LOW Reihenfolge.
