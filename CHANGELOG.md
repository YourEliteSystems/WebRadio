# Changelog – WebRadio

Alle wichtigen Änderungen an diesem Projekt werden hier dokumentiert.

---

## [v1.0.7-alpha.3] – 2026-09-26

> Vorabversion 1.0.7-alpha.3: Behebt die Diskrepanz zwischen Arch Linux PKGBUILD Binary-Namen und electron-builder Konfiguration (`WebRadio` vs. `webradio`), stellt dynamische Berechtigungsvergabe (`chmod 755`) und korrekte `/usr/bin/webradio` Symlink-Auflösung sicher, erweitert das Packaging-Audit-Testframework, stellt die MediaHub-Player-Steuerung auf eine sichere Main→Renderer-IPC-Brücke (`mainWindow.webContents.send` → `mediaHubPlayerAPI.onCommand()` → YouTube-Plugin) um, ergänzt die Update-Kanal-Auswahl um durchgängig dargestellte Kanal-Icons, entfernt veraltete Legacy-Dokumentation und richtet die bestehende `docs/`-Dokumentation über Read the Docs (MkDocs) ein.

### 🐧 Linux & Arch Packaging

- **Dynamische Binary-Erkennung im PKGBUILD:** `package()` in `packaging/arch/PKGBUILD` prüft nun dynamisch das Vorhandensein von `WebRadio` (standardmäßig durch `electron-builder.yml` als `executableName: WebRadio` generiert) oder `${_pkgname}` (`webradio`).
- **Berechtigungen & Symlink-Auflösung:** Die ermittelte Binärdatei erhält präzise Ausführungsrechte (`chmod 755`) und wird als Ziel für den symbolischen Link `/usr/bin/webradio` verknüpft, sodass Anwendungsstarts über Desktop-Launcher und Terminal fehlerfrei funktionieren.
- **Audit-Testabdeckung:** `scripts/tests/artifact-audit.test.js` prüft nun automatisiert, dass der Symlink im PKGBUILD konsistent auf die installierte Binärdatei verweist.

### 🎧 MediaHub – Sichere Main→Renderer-Player-Brücke

- **`ipcRenderer` aus dem Main-Prozess entfernt:** `MediaHubProvider._sendCommand()` sendet die Kommandos `play/pause/stop/setVolume` ausschließlich über `mainWindow.webContents.send("mediahub:command", …)`. Der Window-Zugriff wird per `setWindowManager()` aus `Application.initializePlayer()` injiziert; fehlende bzw. zerstörte Fenster werden geprüft und führen zu `false` statt zu einer Exception.
- **Vollständige Nachrichten-Nutzlast:** Neben `channel`, `commandId`, `videoId`, `sessionId` und `timestamp` gehen nun auch `title`, `artist`, `artwork`, `source` und `volume` unverändert an den Renderer – zuvor ging insbesondere `volume` verloren.
- **Neue Preload-API `window.mediaHubPlayerAPI.onCommand(cb)`:** Exponiert ausschließlich das Abonnieren des `mediahub:command`-Kanals und gibt eine Unsubscribe-Funktion zurück, die nur den eigenen Listener entfernt. Kein generisches `send`/`invoke`, kein `ipcRenderer` im Renderer.
- **YouTube-Plugin bindet die Kommandos:** `plugins/youtube/renderer.js` hängt sich beim Laden (nicht erst beim Öffnen der Ansicht) an `mediaHubPlayerAPI.onCommand()`, führt die IFrame-Befehle `playVideo/pauseVideo/stopVideo/setVolume` aus und meldet ausschließlich tatsächlich ausgeführte Zustände zurück. Die Command-Queue ist auf 8 Einträge begrenzt, ungültige/veraltete Kommandos werden protokolliert ignoriert. Beim Deaktivieren des Plugins ruft der `destroy()`-Hook von `registerPluginRenderer('youtube', …)` den Listener ab – kein Leak beim Teardown.
- **Fehlerbehebung `initPlayer`:** `window.youtubePlugin` referenzierte eine nicht existierende Funktion und warf beim Skriptladen einen `ReferenceError`, wodurch die YouTube-Ansicht nie registriert wurde; jetzt korrekt an `createYouTubePlayer` gebunden.
- **Status-Modell:** `MediaHubProvider` meldet einen Zustand nur, wenn das Kommando tatsächlich versendet wurde; `setVolume` löst keine `loading`-Statusmeldung mehr aus. Der Renderer korrigiert nicht ausführbare Befehle (`idle`) statt einen erfundenen Zustand zu melden.
- **Globale Controls respektieren den aktiven Provider:** Medientasten-/Tray-Stop läuft über die Unified Player API (Legacy-Radio-Stop nur, wenn Radio aktiv ist), die Player-Leiste und die Medientasten-Lautstärke steuern den Radio-Gain nicht, solange MediaHub aktiv ist, und Medientasten-Lautstärke erreicht jetzt auch den YouTube-Player.
- **Tests:** `scripts/tests/mediahub-player.test.js` (13 Tests) verifiziert Main-IPC ohne `ipcRenderer`, Nachrichtenformat, 0..1-Volumen, Preload-Vertrag (inkl. Unsubscribe-Isolation), Renderer-Ausführung der vier Befehle, Provider-Wechsel-Routing und den Listener-Teardown; in `npm test` integriert.

### 🏷️ Update-Kanal – Icons in den Einstellungen

- **Fester SVG-Iconsatz als Fallback:** `renderer/components/settings/UpdatesSettings.jsx` definiert `FALLBACK_ICONS` für `alpha`, `beta` und `stable` – inline-SVG-Pfad-Daten in `currentColor`, keine externen Dateien und kein Icon-Server.
- **Zentrale `getChannelIcon(meta)`:** Liefert bevorzugt das Icon aus den Channel-Metadaten (`ChannelMetadata`) und fällt bei fehlender, leerer oder ungültiger Angabe auf den passenden Fallback (sonst `stable`) zurück. Damit ist an jeder Stelle garantiert ein Icon dargestellt.
- **Icon überall dargestellt:** Zusätzlich zum Kanal-Label erscheint das Icon nun auch im Badge der aktuell installierten Version, in den auswählbaren Kanal-Optionen sowie im Alpha-/Beta-Hinweis; zuvor wurde `channelMeta?.icon` an diesen Stellen teils gar nicht, teils nur als roher String gerendert.
- **Tests:** `scripts/tests/update-channel.test.js` um fünf Fälle erweitert (36 Tests gesamt): Icon-SVG-Validierung für alpha/beta/stable (`<svg>`, `viewBox`, `currentColor`/`stroke`), Kopie-Verhalten von `getUpdateChannelMetadata()` sowie Vollständigkeit von Icon, Label und Farbe über alle Kanal-IDs.

### 🧹 Projektstruktur – Legacy-Dokumentation entfernt

- **14 veraltete Dokumente gelöscht (3.498 Zeilen):** `ABSCHLUSSBERICHT_SETTINGS_MIGRATION.md`, `ARCHITECTURE_DIAGRAM.md`, `AUDIT_REPORT_1.0.7-alpha.1.md`, `INSTALL.md`, `MIGRATION_SETTINGS_REACT.md`, `vorstellungen.md` sowie der komplette Ordner `docs_legacy/` mit `roadmap.md`, `theme-development-guide.md`, `plugin-development-guide.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `README.md` und `internal-notes.md`.
- **Begründung:** Abgeschlossene Migrations-/Audit-Berichte, durch die aktuelle Dokumentation abgelöste Leitfäden und veraltete Projektunterlagen – die inhaltlich gültigen Fassungen existieren weiterhin: `ROADMAP.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` und `README.md` im Projektstamm, die Leitfäden unter `docs/plugin-sdk/` und `docs/theme-sdk/`.
- **`.gitignore`:** Ordner `protected/` (lokale, nicht versionierte Schutzdateien) ergänzt.

### 📚 Read the Docs – Dokumentations-Pipeline

- **`.readthedocs.yaml` (neu):** Read-the-Docs-Konfiguration in Version 2 mit `ubuntu-24.04`, Python `3.12`, MkDocs-Build über `mkdocs.yml`, Abhängigkeiten aus `docs/requirements.txt` und `fail_on_warning: true` – gebrochene Links oder ungültige Navigation brechen den Build ab, statt sie zu unterdrücken.
- **`mkdocs.yml` (neu):** MkDocs 1.6 mit Material-Theme; Navigation, Startseite und Sitemap werden ausschließlich aus den real vorhandenen Dateien in `docs/` erzeugt. `docs/` bleibt damit Single Source of Truth – keine zweite Dokumentationsstruktur, keine Duplikate, keine umbenannten Dateien. `markdown_extensions` auf `tables`, `toc`, `attr_list`, `pymdownx.highlight` und `pymdownx.superfences` begrenzt.
- **Neue Startseite `docs/index.md`:** schlanke Landingpage mit Features und Dokumentations-Übersicht; die vorhandene `docs/Readme.md` bleibt unverändert und trägt den Eintrag „Getting Started".
- **Tote Links bereinigt:** Sieben nicht existierende Ziele in `docs/api-reference/README.md` aufgelöst – `StorageManager`, `Navigation` und `UI` verweisen jetzt auf die vorhandenen Seiten unter `docs/architecture/` bzw. `docs/plugin-sdk/`, `RuntimeDetector` und `UpdateManager` auf `docs/UPDATE_ARCHITECTURE.md`. Für `UnifiedPlayer` und `PluginHttpOrigin` existiert keine Seite, diese Einträge sind daher bewusst ohne Link als Text geführt.
- **Saubere Build-Grenzen:** `exclude_docs` hält `docs/requirements.txt` und den nicht versionierten Ordner `docs/internal/` (durch `.gitignore` geschützt) aus dem veröffentlichten Build; das Ausgabeverzeichnis `site/` wurde `.gitignore` hinzugefügt.
- **Verifikation:** `mkdocs build --strict` läuft lokal und auf einem frischen Klon des Repositorys ohne einen einzigen Warnung durch (64 HTML-Seiten inkl. Start- und 404-Seite).

---

## [v1.0.7-alpha.2] – 2026-09-26

> Abrufvorbereitung 1.0.7-alpha.2: MediaHub-Provider-Activation via Unified Player API (setActiveProvider), Main-to-Renderer-Playback-Kommandos (play/pause/stop/setVolume) mit `mediahub:command`-Kanal und verarbeiteter Status-Rückmeldung, Discord Rich Presence Persistence/Startup (Einstellung aus settings.json laden, bei Aktivierung initialisieren, IPC-Update mit Rollback) und zentrale Provider-Kontrolle.

### 🎧 MediaHub – Provider-Activation & Main-to-Renderer-Kommandos

- **Neue `playerAPI.setActiveProvider(id)`-Methode:** Der Renderer kann den MediaHub-Provider aus dem Renderer-Code über `playerAPI.setActiveProvider('mediahub')` aktivieren. `PlayerManager` akzeptiert nur Meldungen von aktiven Providern (`activeProviderId`), daher war der Provider bisher nie in den Zuständigkeitswechsel eingetreten.
- **`MediaHubProvider.activate()` / `deactivate()`:** Explicite Aktivierung/Deaktivierung des Providers via Unified Player API; `play()/pause()/stop()/setVolume()` rufen `_ensureActivated()` auf, bevor sie State und Kommandos senden.
- **Neuer IPC-Kanal `player:setActiveProvider`:** `PlayerManager.setActiveProvider(id)` im Main-Prozess, validiert Provider-IDs, gibt `ok:true/false` mit `activeProviderId|error` zurück.
- **Main-to-Renderer-Kommandos:** `MediaHubProvider` sendet pro Kommand `commandId`, `videoId`, `sessionId`, `timestamp` über `mediahub:command` an den Renderer. Der Renderer (YouTube-Plugin) hängt sich auf diesen Kanal und verarbeitet `play/pause/stop/setVolume` als echte IFrame-Steuerungen.
- **Kommando-Queue & Verfallsmanagement:** Befehle, die vor der IFrame-Bereitschaft (`ytReady`/`ytPlayer`) eintreffen, werden einer Warteschlange zugeordnet und nur nach vollständiger Initialisierung ausgeführt. Ältere Befehle mit abgelaufener `timestamp` werden verworfen.
- **Status-Rückmeldungen:** Renderer meldet nach jedem Befehl `playerAPI.reportProviderState('mediahub', { state: 'playing'|'paused'|'stopped'|'volume-changed', ... })`; PlayerBar und Unified Player zeigen den tatsächlichen Status.
- **Zustandsverluste verhindert:** Doppelte Player-Instanzen werden nicht erzeugt (`ytPlayer.destroyed` prüft), Session und Metadaten bleiben (Stop nicht unnötig zerstören).

### 💬 Discord Rich Presence – Persistence & Startup

- **Ladereihenfolge korrigiert:** `DiscordRichPresence.initialize()` liest jetzt ausdrücklich die gespeicherte Einstellung aus `settings.json` via `loadStoredSettings()`, validiert den Wert (`true`/`false`) und fällt bei ungültigem/fehlendem Wert auf `false` ohne andere Einstellungen zu löschen.
- **`updateSettings(enabled)`:** Akzeptiert Boolean, validiert, speichert dauerhaft (Main-Prozess nur), gibt `{ok, changed, enabled}` zurück. Bei Speicherfehlern wird der vorherige gültige Wert wiederhergestellt (Rollback); kein erfolgreicher Toggle bei schreibgeschützter Konfiguration.
- **Startup-Initialisierung:** Discord wird nur bei `isEnabled = true` initialisiert (`connect()`). `setupEventListeners()` ist unabhängig von der Einstellung registriert, damit das Handler-Verhalten konsistent bleibt.
- **IPC & Preload:** `integrations:get`, `integrations:toggle`, `integrations:update` für `discord-rpc`; Renderer erhält `enabled`-Status über `integrationsAPI.get()` und wird bei `enabled` nie als `discordConnected` bewertet.
- **UI-Differenzierung:** Renderer zeigt `Rich Presence aktiviert/deaktiviert` sowie `verbunden/nicht verbunden` und `Aktivität veröffentlicht/nicht veröffentlicht` separat; kein falsches `connected`-Statement.
- **Regressionssicherheit:** Disconnect/Reconnect-Logik (Initialversuche, Delay-Faktor, Maximum) bleibt vollständig erhalten; Shutdown entfernt EventBus-Listener und disconnectet sauber.

### 📦 Sonstiges

- **`package.json`** auf `1.0.7-alpha.2` angehoben; `scripts/release/validate.js` und `CHANGELOG.md` aktualisiert.
- Alle existierenden Tests (`npm test`), Build (`npm run build`), Lint (`npm run lint`) und Release-Validierung (`npm run release:validate`) bestanden.
- **Keine Breaking Changes:** Unified Player API, Plugin-System, Discord RPC, Update-Kanäle und PackageManager bleiben unverändert.

### 🔄 Update-System & Channel-Persistenz

- **Persistente Speicherung:** Der vom Benutzer ausgewählte Update-Channel (Alpha, Beta, Stable) wird dauerhaft im Electron-Main-Prozess (`settings.json` im `userData`-Verzeichnis) über das zentrale `SettingsManager`- und `StorageManager`-System gespeichert.
- **Neustart-Sicherheit:** Nach einem vollständigen Anwendungsneustart bleibt die ausgewählte Channel-Einstellung garantiert erhalten und wird sowohl im Updater als auch in der UI konsistent aktiviert.
- **Startup-Validierung & Fallback:** Beim Start wird die gespeicherte Konfiguration gegen gültige Channel-IDs (`alpha`, `beta`, `stable`) validiert. Ungültige oder fehlende Werte fallen sicher auf den Versions-Standard zurück, ohne andere Benutzereinstellungen zu beeinträchtigen.
- **Keine Playback-Unterbrechung:** Das Wechseln des Update-Channels erfolgt nahtlos im Hintergrund ohne Unterbrechung der laufenden Radio- oder MediaHub-Wiedergabe.
- **IPC & Preload-Konsistenz:** Die Update-API wurde über `updatesAPI` und `updateAPI` (`getChannel`, `getStoredChannel`, `setChannel`, `getChannelMetadata`, `getAllChannelMetadata`) sicher und strukturiert für Renderer-Prozesse bereitgestellt.

### 🆕 Update-Kanäle (Alpha/Beta/Stable) & Release-Routing

- **Alpha als vollwertiger dritter Kanal:** `UpdateState.CHANNELS.ALPHA`, `UpdateChannel.isValidChannel()` und `UpdateChannel.getUpdaterConfig()` behandeln Alpha gleichberechtigt zu Beta/Stable (electron-updater-Channel `alpha`, `allowPrerelease = true`, `allowDowngrade` bei Pre-Release-Ausgangsversion).
- **Zentrale Channel-Ermittlung:** `UpdateChannel.getUpdateChannel(settings, version)` mit der Priorität Benutzerauswahl → Versions-Erkennung (`detectChannelFromVersion()`: `-alpha` → `alpha`, `-beta`/`-rc`/`-nightly` → `beta`, sonst `stable`) → Stable-Fallback. Keine parallele Channel-Logik in Providern oder Renderern.
- **Zentrale Kanal-Metadaten:** Neues `electron/core/updates/ChannelMetadata.js` liefert `id`, `label`, `shortLabel`, `color`, `icon`, `description` und `order` für Alpha/Beta/Stable (`getUpdateChannelMetadata()`, `getAllUpdateChannelMetadata()`, `hasChannelMetadata()`) und wird über `electron/core/updates/index.js` exportiert.
- **Release-Channel-Ableitung:** Neues `electron/core/updates/ReleaseChannel.js` (`resolveChannel()`, `resolve()`, `isPrerelease()`) plus Renderer-Mapping (`renderer/services/releaseChannel.js`) für Labels, Farben und CSS-Variablen.
- **Pre-Release-Filter:** `getAllowedPreReleaseFilter()` – Stable lehnt alle Pre-Releases ab, Beta schließt Alpha aus, Alpha akzeptiert alle Pre-Releases.
- **Release-Routing:** `.github/workflows/release.yml` leitet `update_channel` aus dem Tag ab (`latest`/`beta`/`alpha`; `rc`/`nightly` → `latest`) und übergibt `UPDATE_CHANNEL` an electron-builder; `electron-builder.yml` nutzt `channel: ${env.UPDATE_CHANNEL}` mit `generateUpdatesFilesForAllChannels: true` (erwartete Metadaten: `alpha.yml`/`beta.yml`/`latest.yml` je Plattform). `app-update.yml` bleibt Build-Zeit-Default (`channel: latest`) und wird zur Laufzeit von der gespeicherten Benutzerauswahl überschrieben.
- **UI:** Kanal-Auswahl mit Bestätigungsdialogen für Beta und Alpha, farbige Kanal-Badges und Hinweisboxen (`--update-channel-color`, Styles in `renderer/styles/core.css`) sowie Live-Synchronisation über `updates:channel-changed`.

### 🎨 UI-Konsistenz & Transparenz

- **Zentrale Channel-Metadaten in der UI:** Farbe, Icon und Label von Kanal-Auswahl, Kanal-Badge und Update-Anzeige stammen ausschließlich aus `ChannelMetadata` (Core) über die Update-API. Veraltete Anzeigen nach einem Kanal-Wechsel sind damit ausgeschlossen (die Metadaten werden abgeleitet, nicht in einem separaten State gespiegelt).
- **Installierte Version vs. aktiver Kanal:** Der Versions-Stempel der UI zeigt den Kanal der **installierten Build-Version** (`versionChannel`, zentral über `UpdateChannel.detectChannelFromVersion()`); Update-Badges zeigen den **aktiven** Update-Channel. Ein Kanal-Wechsel deutet die laufende Build-Version nicht mehr um.
- **Transparente Aktivierung:** Die UI kommuniziert, dass der gewählte Kanal sofort für Update-Prüfungen aktiv ist, sich die installierte Version aber erst mit dem nächsten installierten Update ändert. Für die Aktivierung des Kanals ist kein Neustart erforderlich.
- **Korrekte System-Benachrichtigungen:** Die Update-Benachrichtigung nutzt das Channel-Label aus der zentralen Channel-Metadata (Alpha wurde zuvor fälschlich als „Stable“ angezeigt).
- **Keine Listener-Duplikate:** Die Event-Subscriptions der Update-Einstellungen werden beim Verlassen der Seite sauber abgemeldet.

### 📻 Unified Player, Now Playing & Lautstärke

- **Provider-basierter Player-Kern:** Neue Module `PlayerManager`, `RadioProvider`, `MediaHubProvider` und `DiscordPresenceAdapter` unter `electron/core/player/` – zentrale Registrierung von Providern, State, Volume und Lifecycle. Die Initialisierung erfolgt über `Application.initializePlayer()` (Bootup-Marke `player-init`) und wird beim Shutdown sauber disposed.
- **Player-IPC & Preload:** Neuer Handler `electron/core/ipc/playerHandlers.js` mit `player:getState`, `player:play`, `player:pause`, `player:stop`, `player:toggle`, `player:setVolume` und `player:reportProviderState` sowie dem Broadcast `player:stateChanged`; exponiert als `window.playerAPI` (inkl. `onStateChanged` mit Unsubscribe-Funktion).
- **Renderer-Integration:** Neuer Hook `renderer/hooks/useUnifiedPlayer.js`; `PlayerBar.jsx` nutzt den Unified-Player-State (Legacy-Props bleiben als Fallback erhalten), Play/Pause/Stop und Lautstärke laufen über die zentrale API statt über verteilte Einzellistener.
- **Now-Playing-Anzeige:** Neue Komponente `renderer/components/player/NowPlayingDisplay.jsx` (Titel, Artist, Artwork) mit stabiler Identitätsbildung, damit unveränderte Metadaten keine erneute Anzeige auslösen; neue Einstellungsseite „Player" (`renderer/components/settings/PlayerSettings.jsx`) inklusive Sidebar- und Registry-Eintrag.
- **Lautstärke-Steuerung:** Zentrale Skalenkonvertierung 0–100 ↔ 0–1 in `renderer/services/playerService.js` (Gain wird unmittelbar gesetzt, keine hörbaren Aussetzer) und Persistenz der Benutzerlautstärke im Renderer (`localStorage`-Schlüssel `webradio_volume`).
- **Discord Rich Presence:** Neuer `DiscordPresenceAdapter` verbindet den Unified-Player-State mit dem bestehenden `DiscordRichPresence`-Service; Discord-Fehler beeinflussen die Wiedergabe nicht.

### 📦 Paket-System

- **Neue Module:** `LocalSource`, `PackageModel`, `PackageValidator`, `PackageRegistry`, `PackageInstaller`, `PackageManager`, `events.js` und `index.js` unter `electron/core/packages/`.
- **Validierung:** `PackageValidator` prüft Manifest-Struktur, plugin-/theme-spezifische Felder, Pfad-Traversal (`containsPathTraversal`, `isAbsolutePath`) und Sicherheitsaspekte; `PackageModel` normalisiert IDs, Versionen, Typen und Capabilities.
- **Registry & Installer:** Installation/Deinstallation mit Pfadsandboxing (`isWithinUserPackagePath`, `isAppPackagePath`) und Event-Benachrichtigungen über `events.js`.
- **IPC & Preload:** Neuer Handler `electron/core/ipc/packageHandlers.js`, registriert über `registerIpcHandlers()` und für den Renderer über die Preload-Paket-API erreichbar.
- **Startup:** `Application.initializePackages()` mit der Bootup-Marke `packages-init`.
- **Quellen (Zukunftsplanung):** Nur lokale Verzeichnisse sind implementiert (`LocalSource` mit `allowedBaseDirs`-Whitelist). `GitHubSource`, `HTTPSource` und `StoreSource` existieren ausschließlich als Typ-Platzhalter und werfen `NotImplementedError` – Online-Quellen und Store bleiben ausdrücklich zukünftigen Releases vorbehalten.

### 🔌 Plugins: Capabilities, Permissions & Plugin-HTTP-Umgebung

- **Capability-System:** Neues `electron/core/plugins/CapabilityRegistry.js` (`canGrant()`, `isOriginAllowedForCapability()`) verknüpft Capabilities mit Basis-Permissions und erlaubten Origins.
- **Permissions erweitert:** `PluginPermissions.js` erhält `validateCapabilities()`, `hasCapability()` und `isOriginAllowed()` sowie die neue Permission `player`; die bisherigen `navigation`/`navigation.register`-Fallbacks bleiben abwärtskompatibel.
- **Plugin-HTTP-Umgebung:** Neuer `electron/core/plugins/PluginHttpServer.js` – core-kontrollierter localhost-Server für Plugin-Assets mit Origin-Prüfung (nur `http://127.0.0.1`/`http://localhost` bzw. capability-erlaubte Origins), Ablehnung mit `Forbidden: Invalid Origin` und kontrollierten CORS-Headern; dazu die IPC-Handler `pluginHttpHandlers` (`plugin:getHttpOrigin`, `plugin:getAssetUrl`) und `window.pluginHttpAPI`.
- **Kontext, API & Manager:** `PluginContext`, `PluginAPI` und `PluginManager` reichen Capabilities/Permissions an Plugins weiter und erzwingen sie bei Registrierung, Navigation und HTTP-Zugriffen; die Plugin-HTTP-Initialisierung läuft über `initializePluginHttpServer()` (Bootup-Marke `plugin-http-init`).
- **YouTube-/MediaHub-Plugin:** `plugins/youtube/plugin.json` deklariert jetzt `permissions: ["player", "http-origin"]` und `capabilities: ["youtube-iframe", "youtube-api"]`; das neue `plugins/youtube/renderer.js` meldet den Provider-State über `player:reportProviderState` an den Main-Prozess.
- **Dokumentation:** Neues Kapitel `docs/plugin-sdk/13-Capabilities.md`.

### 🧠 Diagnostics & Profiling (Ergänzungen zu v1.0.6)

- **Neue Module:** `CPUProfiler`, `MemoryProfiler`, `ProcessProfiler`, `CrashDumpWriter` und `DiagnosticsStore` unter `electron/core/diagnostics/`.
- **IPC & Preload:** Erweiterte `diagnosticsHandlers` und `window.diagnosticsAPI` (Logs lesen/löschen, Log-Pfade, Speicher-Statistiken, EventBus-Statistiken, Bootup-State) für die Diagnose-Einstellungsseite.
- **Bootup-Marken:** `Application.js` markiert zusätzlich `plugin-http-init`, `packages-init` und `player-init` (BootupDiagnostics, DiagnosticsManager, CrashHandler und Electron 44.4.1 sind unter v1.0.6 dokumentiert).

### 🛡️ Robustheit, Bugfixes & Audit-Befunde

- **EventBus-Duplikat entfernt:** `electron/core/events/EventBus.js` wurde gelöscht; es bleibt ausschließlich `electron/core/eventBus.js` (Audit-Befund AUD-002).
- **FFmpeg-Shutdown gehärtet:** `streamManager.js` erzwingt nach 5 Sekunden ohne Reaktion auf `SIGTERM` ein `SIGKILL`; der Timeout wird bei sauberem Prozessende aufgeräumt.
- **Theme-System:** `ThemeLoader.getBuiltInThemes()` ergänzt; `ThemeManager` stellt gelöschte Built-in-Themes beim Reload automatisch wieder her.
- **IPC-Eingabevalidierung:** `storageHandlers` prüft Typen und Längen (`validateString`, `validateEntry`); `updaterHandlers` liefert durchgehend strukturierte Fehlerobjekte (`{ ok: false, error: { code, message } }`).
- **Player-Lifecycle:** Zentrale Initialisierung und Dispose-Logik über den `PlayerManager` statt verstreuter Listener (Audit-Befund AUD-005).
- **Audit-Dokument:** `AUDIT_REPORT_1.0.7-alpha.1.md` mit zehn priorisierten Befunden (AUD-001 … AUD-010) hinzugefügt; die Update-Channel-Konsistenz (AUD-001/AUD-003) und das EventBus-Duplikat (AUD-002) sind mit dieser Version adressiert.

### ⚙️ Build, Release & Dependencies

- **Version:** `package.json` auf `1.0.7-alpha.1` angehoben; `scripts/release/validate.js` ist direkt ausführbar (`npm run release:validate`) und prüft Version und Changelog-Eintrag.
- **Dependencies:** `allowScripts`-Eintrag für `ffmpeg-static@5.3.0` ergänzt (Electron-Upgrade auf 44.4.1 siehe v1.0.6).
- **Release-Workflow:** Manueller „Clean Dist Directory"-Schritt aus `release.yml` entfernt, da electron-builder das Ausgabeverzeichnis selbst verwaltet.
- **Testsuite-Kette:** `npm test` um `diagnostics.test.js`, `nowPlaying.test.js`, `unified-player.test.js` und `update-channel.test.js` erweitert.
- **GitBook:** `gitbook-docs.yaml` für den Git-Sync der Dokumentationsseiten ergänzt.

### 📚 Dokumentation

- **README:** Umfangreich überarbeitet (Architektur, Unified Player, Paket-/Plugin-System, Update-Kanäle inklusive Persistenz und API-/Security-Grenzen).
- **ROADMAP:** Aktueller Milestone auf `1.0.7-alpha.1` gesetzt (Unified Player, Plugin-System, Capability-System, Plugin-HTTP-Umgebung, Update-Kanäle, Theme-System, Diagnostics) sowie ein Abschnitt „Explicitly Not Implemented" für Plugin-/Theme-Store, Online-Quellen und Cloud-Sync.
- **API-Referenz & SDK:** `docs/api-reference/*`, `docs/plugin-sdk/*` (neu: `13-Capabilities.md`) und `docs/theme-sdk/*` konsolidiert.
- **Architektur:** `docs/architecture.md`, `docs/architecture/04-Diagnostics.md`, `06-ThemeManager.md`, `10-Updater.md` und `docs/UPDATE_ARCHITECTURE.md` aktualisiert (Update-Kanäle, Persistenz, Startup-Reihenfolge, API-/Security-Grenzen).

### 🧪 Tests & Qualitätssicherung

- **Persistenz-Testsuite:** Neue und reaktivierte Komponententests in `updater.test.js` und `update-channel.test.js` zur Verifikation der Channel-Persistenz (Alpha, Beta, Stable) über simulierte Neustarts, Validierungsprüfungen und Injection-Schutz.
- **Echter Prozess-Neustart:** Zusätzlicher Test, der die Persistenz in zwei voneinander unabhängigen Node-Prozessen über die reale `settings.json` im `userData`-Bereich verifiziert (echter Neustart statt Cache-Simulation).
- **Konsistenz-Tests:** Kanal-Metadaten ↔ aktive Channel-ID, ungültige gespeicherte Werte ohne fehlerhafte Updater-Konfiguration, Erhalt bestehender Benutzereinstellungen, Trennung von aktivem Channel und Versions-Channel sowie Beibehaltung der vorherigen Einstellung bei IPC-Fehlern.
- **Neue Testsuiten:** `diagnostics.test.js` (Bootup, Profiler, Crash-Handler, DiagnosticsStore), `nowPlaying.test.js` (Now-Playing-Anzeige und Identitätslogik), `unified-player.test.js` (Provider-Registry, Controls, Volume, State-Subscription, Provider-State-Reporting), `update-channel.test.js` (Kanal-Erkennung, Validierung, Metadaten) sowie `package-system.test.js` und `package-integration.test.js` (Paket-Validierung, Installation, Events); `volume.test.js` wurde erweitert.

### ⚠️ Hinweise & bekannte Einschränkungen

- **Nicht implementiert (Zukunftsplanung):** Online-Paketquellen (`GitHubSource`, `HTTPSource` und `StoreSource` sind reine Typ-Platzhalter), Plugin-/Theme-Store, Marketplace, Remote-Installation sowie Cloud-Synchronisation.
- **Automatische Updates:** macOS ist nicht implementiert; `.deb`- und Arch-Pakete werden über den System-Paketmanager aktualisiert (`UnsupportedUpdateProvider`); AppImage lädt weiterhin die vollständige Datei (kein Delta-Update über `appimageupdatetool`/zsync).
- **Kanal-Metadaten beim Release:** Alpha- und Beta-Kanäle setzen die vom Release-Workflow erzeugten Update-Metadaten (`alpha.yml`/`beta.yml` inklusive `-linux.yml`) voraus. Fehlen diese für eine Version, schlägt ein Update-Check in diesem Kanal fehl – es gibt keinen stillen Fallback auf `latest`.
- **Testabdeckung:** `package-system.test.js`, `package-integration.test.js` und `volume.test.js` sind noch nicht Teil der `npm test`-Kette und werden separat ausgeführt.
- **Legacy-Dateien:** Weiterhin im Baum, aber nicht referenziert: `electron/core/settings.js` (roher `settings.json`-Zugriff), `renderer/settings.js` (Vanilla-Einstellungsseite; `settings.html` lädt `dist/settings.js` aus `settings.jsx`) und `renderer/components/NowPlayingDisplay.jsx` (veraltete Kopie; verwendet wird `renderer/components/player/NowPlayingDisplay.jsx`).

---

## [v1.0.6] – 2026-09-18

> Stabile Release-Version v1.0.6. Build-Infrastruktur-Updates: Electron 40.7.0 → 44.4.1, package-lock.json synchronisiert, Worktree-Pfade korrigiert und Diagnose-Infrastruktur für Boot-Time-Metriken erweitert. **Hinweis:** Die Security-Lückenbehebungen aus v1.0.6-beta.7 sind in dieser Version enthalten (siehe beta.7 Changelog).

### 🔒 Security & Dependencies

- **Electron:** 40.7.0 → 44.4.1 (Major-Upgrade in devDependency; mögliche Brechpunkte in electron-updater/electron-builder-Integrationen prüfen)
- **package-lock.json:** Vollständig auf v1.0.6 synchronisiert und von node_modules-Status bereinigt
- **npm overrides:** `register-scheme: 1.0.0` beibehalten (npm-ci-Kompatibilität)
- **Security-Lückenbehebungen (aus v1.0.6-beta.7):**
  - @xmldom/xmldom 0.8.13 → 0.8.15
  - js-yaml 4.3.1 → 4.3.2
  - fast-uri → 3.1.8

### ⚙️ Build & Release-Infrastruktur

- **GitHub Actions Permissions:** Workflow-Berechtigungen für Releases und GitHub Actions aktualisiert
- **Dist-Verzeichnis:** Build-Artefakte bereinigt
- **Worktree-Kompatibilität:** Pfade und require()-Aufrufe für parallele Arbeitsverzeichnisse korrigiert

### 🧠 Diagnostics & Boot-Time-Metriken

- **BootupDiagnostics:** Neues Modul für Startzeit-Messung und Boot-State-Exposition
- **DiagnosticsManager:** Zentrale Initialisierung/shutdown-Schnittstelle für das Diagnosesystem
- **IPC:** Neuer Channel `diagnostics:getBootupState` für Renderer
- **CrashHandler-Architektur:** Zentraler CrashHandler unter `electron/core/diagnostics/CrashHandler.js`, re-exportierter Wrapper unter `electron/core/diagnostics/crash/CrashHandler.js` entfernt Doppel-Initialisierung und konkurrierende Listener
- **Application.js:** Bootup-Markierungen um jeden Initialisierungsschritt ergänzt (`core-init`, `storage-init`, `diagnostics-init`, `window-created`, `ipc-init`, `navigation-init`, `plugins-init`, `integrations-init`, `themes-init`, `shortcuts-init`, `tray-init`, `updater-init`, `services-init`, `app-ready`)
- **main.js:** Diagnostics-Initialisierung vor `app.whenReady()` verschoben, saubere Einrückung und Trennung von Aufträgen

### 🐛 Bugfixes & Konsistenz

- **Electron-Pfad-Konsistenz:** `CrashHandler`-Import von `./diagnostics/crash/CrashHandler` auf `./diagnostics/CrashHandler` korrigiert
- **Preload-JSON-Konsistenz:** IPC-Diagnostics-Liste mit abschließendem Komma und neuer `getBootupState`-Methode aktualisiert

### 🧪 Tests

- **Diagnostics-Tests:** `scripts/tests/diagnostics.test.js` ergänzt für Bootup-, CrashHandler- und DiagnosticsManager-Integration

---

- **@xmldom/xmldom:** 0.8.13 → 0.8.15
  - Behebt multiple XML-Injection-Schwachstellen (GHSA-6gmq-8vp8-gcm6, GHSA-w2rr-34g9-rvrj, GHSA-4w3w-2rp5-g8jm, GHSA-c7q8-3ch8-vqpv, GHSA-27p8-2357-5qqv, GHSA-6h8r-xr42-gp59, GHSA-8344-3jmq-59r6, GHSA-x4fp-j954-r2f4, GHSA-965w-775f-mr7g, GHSA-93r5-fhx6-vmg9)
  - Transitive Dependency über electron-builder → app-builder-lib → plist
- **js-yaml:** 4.3.1 → 4.3.2
  - Behebt CPU-Exhaustion-Schwachstelle (GHSA-2883-xcg3-v3hh)
  - Transitive Dependency über electron-builder, electron-updater, eslint
- **fast-uri:** → 3.1.8
  - Behebt multiple URI-Parsing-Schwachstellen (GHSA-5jgf-p345-68v8, GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf, GHSA-jqff-g426-hqxp)
  - Transitive Dependency über electron-builder

### 📦 Dependency Updates

- **Electron:** 40.7.0 → 40.10.6 (innerhalb semver-Range)
- **esbuild:** 0.28.1 → 0.28.2
- **fs-extra:** 11.3.4 → 11.4.0
- **react/react-dom:** 19.2.6 → 19.3.0
- **prettier:** 3.6.2 → 3.9.7
- **@eslint/js:** 9.39.5 → 9.39.5 (kein Update innerhalb Range)
- **eslint:** 9.39.5 → 9.39.5 (kein Update innerhalb Range)

### ⚙️ Konfiguration

- **npm overrides:** `register-scheme: 1.0.0` hinzugefügt für npm ci-Kompatibilität (ersetzt git+ssh Referenz)
- **package-lock.json:** Version auf 1.0.6-beta.6 synchronisiert

### 📊 Audit-Ergebnis

- **Vor npm update:** 23 Vulnerabilities (1 low, 3 moderate, 19 high)
- **Nach npm update:** 20 Vulnerabilities (1 low, 3 moderate, 16 high)
- **Verbleibende Lücken:** Alle in Build-Time Dependencies (npm@10.9.9 bundled mit semantic-release, electron 40.10.6)
- **Bewertung:** Keine Runtime-kritischen Security-Lücken. Verbleibende Lücken erfordern Major-Upgrades (electron 40.x→44.x, semantic-release 24.x→25.x)

---

## [v1.0.6-beta.6] – 2026-09-16

> Google OAuth Client Secret direkt integriert, Credential-Management für Secret entfernt, Settings vereinfacht, MediaHub OAuth Flow finalisiert.

### 🔐 MediaHub OAuth Client-Secret – Direkte Integration

- **Feste Client-Secret-Integration:**
  - `CLIENT_SECRET` als Konstante direkt in `MediaHubOAuth.js` integriert
  - Keine Abhängigkeit mehr von `process.env.MEDIAHUB_GOOGLE_CLIENT_SECRET`
  - Keine Benutzereingabe des Secrets mehr erforderlich
- **Token-Austausch korrigiert:**
  - Authorization-Code-Austausch sendet jetzt `client_secret` an Google OAuth Endpoint
  - Refresh-Token-Austausch sendet jetzt `client_secret` an Google OAuth Endpoint
  - Behebt den Fehler "client_secret is missing"
- **Sicherheitsarchitektur:**
  - Secret bleibt ausschließlich im Electron Main Process
  - Secret gelangt niemals in Renderer, Plugins oder IPC-Payloads
  - Kein Logging des Secrets

### ⚙️ Credential-Management Bereitnigung

- **Google Client Secret Handler entfernt:**
  - `credentialHandlers.js`: Alle 4 IPC Handler für Google Client Secret entfernt
  - `preload.js`: `credentialsAPI` auskommentiert (nicht mehr benötigt)
- **Settings-Seite vereinfacht:**
  - Google Client Secret Sektion aus `IntegrationsSettings.jsx` entfernt
  - Keine Benutzereingabe des Secrets mehr möglich/erforderlich

### 🧪 Tests

- **MediaHub OAuth Tests aktualisiert:**
  - Test "Client Secret ist direkt integriert" ersetzt alten Test
  - Test "Client Secret ist direkt in den Code integriert" ersetzt alten Fehlermeldungs-Test
  - Alle 11 Tests bestehen

---

## [v1.0.6-beta.5] – 2026-09-14

> Theme-System stabilisiert (Built-in/User-Theme-Support, Reload, Override), Volume-System optimiert, MediaHub OAuth Client-Secret-Fix, Linux Desktop-Integration verbessert und Tests erweitert.

### 🎨 Theme-System Stabilisierung

- **Built-in und User Themes:**
  - `ThemeLoader` umgebaut um zwei separate Theme-Quellen zu scannen:
    - `getBuiltinThemesPath()`: Built-in Themes aus `themes/` (Development) oder `resources/themes` (Production)
    - `getUserThemesPath()`: User Themes aus `<userData>/themes/`
  - `discoverThemes()` scannt nun beide Verzeichnisse und merge die Ergebnisse
  - User Themes überschreiben Built-in Themes mit gleicher ID (Priority: User > Built-in)
  - Themes erhalten ein `source`-Feld ("builtin" oder "user") zur Identifikation
- **Theme-Reload:**
  - `ThemeManager.reloadThemes()` implementiert (analog zu `PluginManager.reloadPlugins()`)
  - Reload scannt Built-in und User-Verzeichnisse erneut
  - Liefert strukturiertes Ergebnis mit added/removed/changed/unchanged/errors
  - Broadcastet `themes:changed` Event an alle Renderer-Fenster
  - Aktives Theme wird während Reload beibehalten (in Settings gespeichert)
- **Theme-Ordner öffnen:**
  - `themeHandlers.js` um `theme:openFolder` IPC-Handler erweitert
  - Erstellt User-Theme-Verzeichnis falls nicht vorhanden
  - Öffnet Ordner im System-Explorer via `shell.openPath()`
  - `preload.js` um `themeAPI.openThemeFolder()` erweitert
  - `ThemesSettings.jsx` Button nutzt neue API mit Loading-State

### 🔊 Volume-System Optimierung

- **Volume-Preservation bei Station-Wechsel:**
  - `playerService.switchStream()` erweitert um sicherzustellen dass `gainNode` den aktuellen `currentVolume` während Crossfade beibehält
  - Verhindert unerwartete Lautstärkeänderungen bei Stream-Wechseln
- **Volume-Architektur verifiziert:**
  - UI → usePlayer hook → playerService.setVolume → gainNode.gain → Audio Output
  - Volume in localStorage persistiert
  - Volume beim Start wiederhergestellt

### 🔐 MediaHub OAuth Client-Secret Fix

- **Client-Secret aus Umgebungsvariable:**
  - `CLIENT_SECRET = process.env.MEDIAHUB_GOOGLE_CLIENT_SECRET` in `MediaHubOAuth.js`
  - Authorization-Code-Austausch erweitert um `client_secret` Parameter
  - Refresh-Token-Austausch erweitert um `client_secret` Parameter
  - Fehlerbehandlung für fehlendes Secret mit klarer Fehlermeldung
- **Sicherheitsmaßnahmen:**
  - Secret wird nur aus Umgebungsvariable gelesen (nicht im Code hardcoded)
  - Secret wird nicht geloggt
  - Secret wird nicht an Renderer weitergegeben
  - Secret wird nicht in Plugin- oder Theme-Dateien gespeichert

### 🐧 Linux Desktop-Integration

- **WM_CLASS Fix:**
  - `MainWindow.js` erweitert um `title: 'WebRadio'` auf Linux
  - Verhindert dass die App als Chromium-Instanz gruppiert wird
  - Ermöglicht korrekte Desktop-Integration (Launcher-Zuordnung)
  - Titel muss mit `StartupWMClass` in .desktop-Datei übereinstimmen

### 🧪 Tests

- **Theme-Tests erweitert** (`theme.test.js`):
  - 18 Tests bestanden (10 bestehende + 8 neue)
  - Neue Tests für Built-in/User-Theme-Scan, User-Override, Reload-Struktur
  - Tests die Electron app benötigen werden im Test-Environment übersprungen
- **Volume-Tests neu erstellt** (`volume.test.js`):
  - 11 Tests bestanden
  - Prüft Volume-Flow-Architektur, Persistenz, Preservation bei Operationen
  - Verifiziert AudioWorklet und StreamManager Integration
- **MediaHub OAuth Tests erweitert** (`mediahub-oauth.test.js`):
  - 11 Tests bestanden (10 bestehende + 1 neuer)
  - Neuer Test: "Fehlendes Client Secret wird sauber behandelt"
  - Verifiziert: Prüfung auf fehlendes Secret, klare Fehlermeldung, kein Logging des Secrets

### 🔧 Build-Konfiguration

- **Version auf beta.5 aktualisiert** (`package.json`)
- **Build-Command korrekt:**
  - `"build": "npm run build-react && npm run build-settings"`
  - Baut sowohl renderer.jsx als auch settings.jsx (separate Dateien)

---

## [v1.0.6-beta.4] – 2026-09-13

> Provider-Architektur ist jetzt produktiv aktiv, Linux-AppImage-Updates laufen über den LinuxAppImageUpdateProvider, **Audio-Ruckler behoben, MediaHub-OAuth in den Core integriert, Plugin-Persistenz korrigiert** und die Testbasis auf 335 Tests erweitert.

### 🔄 Update-System v1.1 (Provider-Architektur aktiviert)

- **Provider-Routing in UpdateManager**:
  - `RuntimeDetector` + `ProviderFactory` werden jetzt zur Laufzeit im UpdateManager genutzt.
  - **Windows** → `WindowsUpdateProvider` (electron-updater, unverändert).
  - **Linux AppImage** → `LinuxAppImageUpdateProvider`.
  - **Linux .deb / Arch / macOS / unknown** → `UnsupportedUpdateProvider` (Updates über System-Paketmanager).
  - Development/`npm run dev` → kein Produktions-Updater.
- **LinuxAppImageUpdateProvider vervollständigt**:
  - GitHub-basierter Update-Check über electron-updater (`latest-linux.yml` / `beta-linux.yml`).
  - Download/Install delegieren an electron-updater, wenn ein AutoUpdater verfügbar ist; andernfalls saubere „unsupported"-Antwort mit manueller Anleitung.
  - `autoDownload = false` bleibt aktiv – Benutzer muss den Download explizit auslösen.
- **Stable/Beta-Semantik unverändert zentral**:
  - Stable → nur stable Releases; Beta → stable + Pre-Releases (ohne alpha).
  - allowDowngrade für Beta→Stable-Wechsel bleibt erhalten.
- **AppImage-Metadaten**: X-AppImage-Name/Version (electron-builder.yml) geprüft, AppStream-Metainfo vorhanden, SHA256SUMS via Release-Infrastruktur.

### 🧪 Tests (neue Suiten)

- **Provider-Routing-Tests** (`scripts/tests/provider-routing.test.js`):
  - korrektes Provider-Routing für Windows / AppImage / deb / arch / macOS / unknown / development
  - Unsupported-Gate im UpdateManager (keine electron-updater-Aufrufe auf deb/arch)
- **StreamManager-Tests** (`scripts/tests/streamManager.test.js`):
  - Start, Stop, Restart, Stationwechsel, FFmpeg-SIGTERM, Fehler, ungültiger Stream, mehrfaches Stoppen, Listener-/Prozess-Cleanup, Shutdown
  - Zusätzlich: Regressionstest, dass `Application.shutdown()` den Stream stoppt (kein Zombie-Prozess)
- **RadioBrowser-Tests** (`scripts/tests/radioBrowser.test.js`):
  - erfolgreiche Suche, leere Ergebnisse, API-/Netzwerkfehler, Timeout, ungültige Antworten, Feldvalidierung, Logo/Fallback-Hilfen, Filter- und Limit-Semantik

### 🐛 Bugfixes

- UpdateManager: Auto-Check & Listener-Wiring werden bei nicht unterstützten Packaging-Typen (deb/arch/macOS) nicht mehr gestartet.

### 🎵 Audio-Hardening (Ruckler-Beseitigung)

- **AudioWorklet (`pcm-processor.js`)**:
  - Buffer-Unterlauf gibt jetzt **Stille** aus statt den letzten Block unverändert zu wiederholen (Chromium wiederholte sonst das alte Sample-Fenster → hörbares „Ruckeln“/Stottern).
  - **200-ms-Vorpuffer** (`preBufferSamples`) puffert IPC-/Renderer-Jitter ab; die Wiedergabe startet erst nach ausreichendem Vorlauf.
  - Kontrollnachrichten `flush` (Stream-Wechsel/Stop) und `stats` (Bedarfs-Diagnostik) – kein permanentes Polling.
- **StreamManager**:
  - Verlustbehaftetes „Backpressure“-Chunk-Verwerfen entfernt – PCM wird wieder vollständig und verlustfrei an den Renderer gesendet.
  - Leichtgewichtige Diagnose-Zähler (`chunksReceived`, `chunksSent`, `ffmpegStarts`, `streamStartAt`, `lastDataAt`) und `getDiagnostics()`.
  - Stream-/Worklet-Diagnostik unter `radio:getAudioDiagnostics` (Main-Zustand + Worklet-Zähler).
- **Renderer (`playerService.js`)**:
  - PCM wird immer an den AudioWorklet übergeben (kein stilles Verwerfen bei unerwarteten Typen).
  - Worklet-Puffer wird bei **Station-Wechsel** und **Stop** geleert (`flush`) → keine Vermischung alter/neuer Stream-Daten.
- **Visualizer (PlayerBar)**: erheblich reduzierte Renderer-Last – ein Verlauf und begrenzte Balkenzahl pro Frame statt ~1000 Gradienten-Objekten → weniger Jitter im Audiopfad.

### 🔐 MediaHub OAuth (Core-Integration)

- **Neuer Core-Service** `electron/core/services/MediaHubOAuth.js`:
  - Google-Anmeldung über den Systembrowser (`shell.openExternal`).
  - **PKCE (S256)** im Authorization-Code-Flow, Callback ausschließlich auf `127.0.0.1`.
  - Kein Client-Secret im Code, kein Secret am Renderer.
  - Token nur lokal in `userData/plugin-data/mediahub-oauth.json` mit restriktiven Dateirechten (`0o600`/`0o700`).
- **IPC-Bridge** `electron/core/ipc/mediaHubHandlers.js`: `mediahub:auth-status`, `auth-sign-in`, `auth-sign-out`, `search` – registriert im zentralen `registerIpcHandlers.js`.
- **Preload-API** `mediaHubAuth` (status/signIn/signOut/search) für das MediaHub-Plugin.

### 🔌 Plugin-System: Disabled bleibt registriert

- **Bugfix:** Nach einem Disable/Rescan fehlte dem registrierten Plugin der konsistente `loaded=false`-Status – `reloadPlugins()` setzt `loaded=false` für deaktivierte Plugins und hält sie registriert.
- **Korrigiertes Verhalten:** Deaktivierte Plugins bleiben in `this.plugins` **und** in `plugins.json` mit `"enabled": false` erhalten; Disable (nicht laden) und Uninstall (entfernen) sind strikt getrennt.
- Lifecycle: Aktivieren → `enabled=true` und laden; Deaktivieren → `enabled=false`, bleibt registriert, wird nicht gestartet; App-Neustart/Reinit behält den Status.

### 🎛 UI / Renderer (Begleitarbeiten)

- **Media-Key-Integration (VolumeUp/Down/Mute, Windows/Linux)** inkl. Stumm-Toggle in der PlayerBar.
- **Navigation-Validierung:** ungültige `currentView` wird auf den ersten verfügbaren Navigationspunkt zurückgesetzt (asynchrone Navigations-Ladung).
- **LogManager/FileTransport:** test-freundliche `transports`-Option, Lazy-Verzeichnis-Initialisierung mit ENOENT-Retry (keine Log-Ausfälle bei entfernten Temp-Verzeichnissen).
- **Preload-Listener-Hygiene:** Cleanup über `removeListener`-Rückgaben für `onPCM`/`onThemeChanged`/`onPluginsChanged`/`onPluginToggled`/`onUpdated`.

### 🧪 Tests (Erweiterung)

- **MediaHub OAuth** (`mediahub-oauth.test.js`): 10 Tests – Status, SignOut, Preload-API, IPC-Registrierung, Sicherheit (kein Secret, PKCE, 127.0.0.1), Token-Pfad.
- **Plugin-Persistenz** (`plugin-persistence.test.js`): 10 Tests – Installieren/Deaktivieren/Reinit/Reaktivieren/Uninstall, Disable ≠ Uninstall, mehrfaches Toggeln ohne Duplikate.
- **Audio-Pfad** (`audio-backpressure.test.js`): 9 Tests – verlustfreier PCM-Versand, keine Drop-Obergrenzen, zerstörtes Fenster, Stop-Cleanup, Diagnostik, Fehlertoleranz.
- **AudioWorklet-Verträge** (`audio-worklet.test.js`): 12 Vertragstests – Pre-Buffer, Stille bei Unterlauf, Flush/Stats, Diagnose-IPC.
- **RadioBrowser-Tests:** auf sequenzielle Ausführung umgestellt (parallele async-Ausführung verursachte Races am geteilten Fetch-Mock).
- Alle Suiten sind in `npm test` integriert: **335 passed / 0 failed / 5 skipped**, `build-react` PASS, Lint ohne Fehler.

---

## [v1.0.6-beta.3] – 2026-09-07

> Bugfixes für Discord RPC, Plugin Fingerprinting und EventBus sowie umfassende Regressionstests.

### 🐛 Bugfixes

- **Discord RPC (BUG-001/002)**:
  - Konsolidierung auf Single Source of Truth (`settings.json`)
  - Entfernung der parallelen `integrations.json` für Discord-RPC
  - Legacy-Migration von `integrations/discord-rpc` nach `settings.json`
  - Virtuelle Integration im IPC-Handler für konsistente API
- **Plugin Fingerprinting (BUG-004)**:
  - Fallback-Logik für fehlende Fingerprints hinzugefügt
  - Plugin-Reload erkennt jetzt korrekt unveränderte Plugins
  - Verhindert unnötige Neustarts von unveränderten Plugins
- **EventBus (BUG-005)**:
  - False Positive bestätigt – Implementierung bereits korrekt
  - `once()` Listener Cleanup funktioniert wie erwartet
  - `off()` entfernt korrekt wrapped callbacks über `_originalCb`

### 🧪 Tests

- **Discord RPC Regressionstests** (`scripts/tests/discord-rpc.test.js`):
  - 8 Tests für Single Source of Truth, Persistence, Legacy Migration und IPC Integration
- **EventBus Regressionstests** (`scripts/tests/eventbus.test.js`):
  - 14 Tests für normale Listener, `once()`, `off()`, Listener Counts und Event Names
- **Plugin Fingerprint Regressionstests** (`scripts/tests/plugin-fingerprint.test.js`):
  - 6 Tests für Initialisierung, unveränderte/geänderte/neue/entfernte Plugins und Fallback

### 🔧 Code Quality

- Entfernung von Dead Code (`electron/core/events/EventBus.js` – leere Datei)

### 🐧 Linux / AppImage

- **AppImage-Metadaten verbessert**:
  - X-AppImage-Name und X-AppImage-Version zu electron-builder.yml hinzugefügt
  - Bessere Desktop-Integration und Update-Erkennung
- **AppStream-Metainfo ergänzt**:
  - `assets/org.yourelitesystems.webradio.metainfo.xml` erstellt
  - Software-Center-Integration für Linux-Distributionen
- **SHA256SUMS**:
  - Bestehendes Release-Infrastructure-System deckt .AppImage und .deb ab
  - Automatische SHA256-Generierung in CI/CD
- **Wayland-Dokumentation**:
  - CROSS_PLATFORM_SETUP.md mit Wayland-Support-Dokumentation erweitert
  - XWayland-Fallback und Verhalten dokumentiert

---

## [v1.0.6-beta.2] – 2026-09-05

> Update System v1 mit Stable- und Beta-Kanälen, native Arch Linux Paketierungs-Unterstützung (.pkg.tar.zst) und Plugin-Discovery-Laufzeit-Rescan.

### 🔄 Update System v1 (GitHub Stable & Beta Channels)

- **Zentraler UpdateManager (`electron/core/updates/`)**:
  - Eigenständiges Core-Modul basierend auf `electron-updater` und den offiziellen GitHub Releases (`YourEliteSystems/WebRadio`).
  - Idempotente Initialisierung, Singleton-Architektur, kein Polling, defensive Kopien aller States.
  - Saubere Trennung in `UpdateManager.js`, `UpdateChannel.js`, `UpdateState.js`, `MarkdownSanitizer.js` und `index.js`.
- **Release-Kanäle (Stable & Beta)**:
  - **Stable (`latest`)**: Erhält ausschließlich offizielle stabile Releases (z. B. `1.0.5`, `1.0.6`).
  - **Beta (`beta`)**: Erhält Vorabversionen sowie stabile Releases (z. B. `1.0.6-beta.1`, `1.0.6-beta.2`).
  - **SemVer-Konformität**: Dynamische Aktivierung von `allowDowngrade: true` bei installierter Pre-Release-Version, sodass ein Wechsel von Beta zurück auf Stable jederzeit reibungslos funktioniert.
  - Alpha-Releases sind in v1 für beide Kanäle explizit ausgeschlossen.
- **Sicherheit**:
  - Keine persönlichen Access Tokens (PAT) oder Credentials im Client; Nutzung des unauthentifizierten GitHub Releases Providers.
  - `MarkdownSanitizer`: Neutralisiert `<script>`, `<iframe>`, `<embed>`, `<object>`, Inline-Event-Handler (`onerror`, `onload` etc.) sowie gefährliche URL-Schemata (`javascript:`, `data:`, `vbscript:`).
  - Keine Shell- oder Installer-Ausführung aus dem Renderer – Installation läuft ausschließlich über `autoUpdater.quitAndInstall()` im Main-Prozess.
- **IPC & Preload-Integration**:
  - `window.api.updates`: Vollständige Schnittstelle mit `check()`, `download()`, `install()`, `getState()`, `getChannel()`, `setChannel()`, `getAutoCheck()`, `setAutoCheck()`, `dismissLater()` und typsicheren Event-Listenern (`onStateChanged`, `onAvailable`, `onProgress`, `onDownloaded`, `onError`, `onChannelChanged`).
  - Vollständige Abwärtskompatibilität für `window.updatesAPI` und `window.updaterAPI`.
- **Settings UI & Interaktion**:
  - Neue Update-Kategorie mit Status-Box, Kanal-Auswahl (Radio für Stable und Beta).
  - Interaktiver Bestätigungsdialog mit deutlicher Warnung beim erstmaligen Aktivieren des Beta-Kanals.
  - Fortschrittsanzeige mit Prozentbalken, Download-Geschwindigkeit und transferierten Megabytes.
  - Benutzergesteuerter Workflow: `[Update herunterladen]`, `[Später]`, `[Jetzt neu starten]` und `[Später neu starten]`.
  - Option `☑ Beim Start nach Updates suchen` (`updates.autoCheckOnStart`).
- **Main Window Titlebar Integration**:
  - Anzeige der aktuellen Version mit farbigem `BETA`-Badge bei Pre-Releases in der Titlebar.
  - Pulsierender `Update verfügbar`-Button in der Titelleiste, der direkt in die Update-Einstellungen führt.
- **Release Pipeline & Build-Konfiguration**:
  - `.github/workflows/release.yml` erkennt anhand des Git-Tags automatisch, ob es sich um ein Pre-Release handelt (`IS_PRERELEASE`).
  - Setzt zur Build-Zeit `UPDATE_CHANNEL=beta` bzw. `UPDATE_CHANNEL=latest`.
  - `electron-builder.yml` erzeugt plattformspezifische Update-Metadaten (`latest*.yml` / `beta*.yml`, `.blockmap`) über `generateUpdatesFilesForAllChannels: true`.
- **Tests**:
  - 67 Unit- und Integrationstests in `scripts/tests/updater.test.js` (u. a. Kanalmatrix, Downgrade-Handling, Markdown-Sanitizer, IPC-Handler, Deduplizierung und Event-Listener).

### 🐧 Linux & Arch Linux Paketierung

- **Natives Arch Linux Paket (`.pkg.tar.zst`)**:
  - Eigener `PKGBUILD`-Template unter `packaging/arch/PKGBUILD` mit korrekten Dateirechten, Hicolor-Icons in 7 Größen (16 bis 512px) und Desktop-Integration.
  - Node.js-Build-Skript `scripts/build-linux-arch.js` zur Template-Generierung und SHA256-Prüfung.
  - Docker-Unterstützung für den Arch-Build in isolierten `archlinux:latest`-Containern.
  - Neue npm-Scripts: `make:linux:arch`, `make:linux:appimage`, `make:linux` und `make:linux:all`.
- **GitHub Actions Linux Workflow**:
  - `.github/workflows/build-linux.yml` zum automatisierten Bauen von Linux AppImage und Arch Linux `.pkg.tar.zst`-Paketen.
- **Plattform-Audit & Pfad-Tests**:
  - `scripts/tests/artifact-audit.test.js` (24 Tests für WM_CLASS, .desktop-Einträge, Permissions, Icons und ASAR-Unpack).
  - `scripts/tests/paths.test.js` (Pfad-Auflösung auf Windows, Linux und macOS).

### 🧩 Plugin-System & Discovery

- **Laufzeit-Rescan für Plugins**:
  - `PluginManager.rescan()` und `PluginLoader.reloadPlugins()` für dynamisches Wiedererkennen von hinzugefügten/geänderten Plugins zur Laufzeit.
  - IPC-Kanal `plugins:reload` und Event `plugins:changed` im Preload exponiert.
  - `scripts/tests/pluginManager.test.js` zur Verifikation des gesamten Plugin-Lebenszyklus.
- **Dokumentation**:
  - Erweiterte Guides für Plugin-Lifecycle (`docs/plugin-sdk/04-Lifecycle.md`) und Tray-Steuerung (`docs/architecture/09-Tray.md`).
  - Plattform-Dokumentation in `docs/CROSS_PLATFORM_SETUP.md` und `README.md`.

---

## [v1.0.6-beta.1] – 2026-08-23

> Plugin-gesteuerte Navigation, Theme-System-Konsolidierung, Projektstruktur-Bereinigung, Quality-Tooling und Refactoring – keine neuen Features.

### 🧹 Packaging & Release-Infrastruktur

- **Doppeltes Packaging-System entfernt**:
  - `forge.config.js` gelöscht (referenzierte nicht installierte `@electron-forge/*`-Pakete)
  - Konsolidierung auf electron-builder (`electron-builder.yml`)
  - `@electron/fuses` aus devDependencies entfernt
- **Version auf gültiges SemVer umgestellt**: `1.0.5.1` → `1.0.6-beta.1`
- **semantic-release aktualisiert**: ^21 → ^24
- **Autor-Tippfehler korrigiert** („Your Elite Systms" → „Your Elite Systems")
- **`engines`-Feld ergänzt**: Node >= 20 erforderlich
- **Build-Scripts erweitert**:
  - `dev:watch` – esbuild im Watch-Modus für schnellere Entwicklung
  - Production-Build mit `--minify`

### 🧪 Testing & Linting

- **Test-Runner eingerichtet**: `npm test` führt die bestehenden Testskripte aus (40/40 bestanden)
- **ESLint eingeführt** (Flat Config, `eslint.config.js`):
  - Inklusive react-hooks-Regeln (`rules-of-hooks`, `exhaustive-deps`)
  - Von 21 Fehlern auf 0 Fehler bereinigt
- **Prettier konfiguriert** (`.prettierrc.json`, `.prettierignore`)
- **Neue Scripts**: `lint`, `lint:fix`, `format`, `test`, `test:watch`

### 🐛 Bugfixes (durch Linting aufgedeckt)

- **uiHandlers.js repariert**:
  - Fehlende Imports ergänzt (`ipcMain`, `UIManager`)
  - Handler war zuvor nie registriert – jetzt als `registerUiHandlers()` in `registerIpcHandlers.js` eingebunden
  - Modul folgt jetzt demselben Muster wie alle anderen IPC-Handler
- **Ungültige Regex-Escapes entfernt** (`RendererPluginManager.js`)
- **Leerer catch-Block dokumentiert** (`RadioBrowserService.js`)

### ♻️ Renderer-Refactoring

- **App.jsx in Custom Hooks aufgeteilt** (God-Component reduziert):
  - `renderer/hooks/useRadioSearch.js` – Suche, Filter, Länder/Tags
  - `renderer/hooks/usePlayer.js` – Wiedergabe, Volume, Metadaten-Listener
  - `renderer/hooks/useFavorites.js` – Favoriten-Verwaltung
  - `renderer/hooks/useUpdateInfo.js` – Update-Benachrichtigungen
- **Preload-Navigation-API vervollständigt**: `removeSection` in `navigationAPI` ergänzt (fehlte gegenüber `pluginAPI.navigation`)

### 🔒 Sicherheit & Offline-Fähigkeit

- **Google Fonts lokal gebündelt**:
  - Inter-Font (28 woff2-Dateien inkl. Unicode-Ranges) unter `renderer/assets/fonts/`
  - Neue `renderer/styles/fonts.css` mit lokalen `@font-face`-Definitionen
  - Keine externen Requests mehr – App ist vollständig offline-fähig
- **CSP verschärft** (in `index.html` und `settings.html`):
  - `font-src 'self'` statt Google-Domains und Wildcard
  - Externe Font-Requests vollständig entfernt

### 📁 Projektstruktur

- **Tippfehler-Ordner umbenannt**:
  - `docs_legecy/` → `docs_legacy/`
  - `docs/api-referance/` → `docs/api-reference/`
  - Alle Referenzen aktualisiert

### 🔌 Plugin-gesteuerte Navigation korrigiert

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

### 🎨 Theme-System konsolidiert

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

### 🔄 Technische Änderungen (Navigation & Theme)

- **electron/core/navigation/NavigationManager.js**: Default-Parameter von `"core"` auf `null` korrigiert
- **electron/core/Application.js**: Core-Navigation (Radio) über `NavigationManager.registerItem()` registriert
- **renderer/components/Sidebar.jsx**: Hartcodierter Radio-Button entfernt, Navigation vollständig aus Tree gerendert
- **electron/core/ipc/themeHandlers.js**: Anbindung an ThemeManager für zentrale Theme-Verwaltung, Fallback für Abwärtskompatibilität beibehalten
- **electron/core/themes/ThemeManager.js**: ThemeRuntime-Referenzen entfernt, vereinfacht auf reine Theme-Verwaltung, Logging integriert
- **electron/core/themes/ThemeProvider.js**: ENTFERNT (ungenutzt)

### 🧪 Tests

- **Navigation Tests** (26/26 bestanden):
  - Validator Tests, Core Initialisierung, Plugin-gesteuerte Navigation
  - Isolation & Duplicate Protection, Plugin Lifecycle Cleanup
  - Permissions & PluginAPI, Visibility & Disabled, Collapsible & Expanded
  - Order-Sortierung
- **Theme Tests** (14/14 bestanden):
  - ThemeValidator Tests, ThemeManager Lifecycle, ThemeManager Getters
  - ThemeLoader, Architecture Check (kein ThemeRuntime, kein ThemeProvider)

### 🐛 Weitere Bugfixes

- NavigationManager Default-Parameter-Inkonsistenz behoben
- ThemeRuntime fehlende Referenzen entfernt
- Theme-System Duplikation bereinigt
- **HealthCheck.js: `StorageManager.getStorageFile()` behoben** – Die Methode existiert nicht mehr seit der Storage-Aufteilung in history.json/favorites.json/settings.json. Ersetzt durch drei separate Prüfungen für die individuellen Dateien.
- **integrationHandlers.js: Fehlender `integrations:update` IPC-Handler** – Preload expose `integrations:update` aber kein Handler registriert. Handler hinzugefügt der an `toggleIntegration()` delegiert.

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
