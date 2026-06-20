# Changelog – WebRadio

Alle wichtigen Änderungen an diesem Projekt werden hier dokumentiert.

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

*Changelog erstellt von Antigravity · WebRadio by YourEliteSystems*
