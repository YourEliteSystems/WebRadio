# Übersetzungsplan für die WebRadio-Dokumentation

## Ziel

Die veröffentlichte Dokumentation unter Read the Docs soll schrittweise vollständig auf Deutsch umgestellt werden. Die bestehenden Markdown-Dateien bleiben zunächst an ihren bisherigen Pfaden. So bleiben MkDocs-Navigation, interne Links, Anker und Verweise aus dem Repository möglichst stabil.

Diese Datei ist ein Arbeitsplan und noch keine Übersetzung der aufgeführten Seiten.

## Bestandsaufnahme

- **71 Markdown-Seiten** im Verzeichnis `docs/`
- **341.978 Byte** Markdown-Quelldateien (rund 342 KB)
- **MkDocs-Konfiguration:** `mkdocs.yml` verwendet derzeit `theme.language: en`; die Navigation ist überwiegend englisch beschriftet.
- **Erster sichtbarer Sprachbefund:** `docs/index.md` und `docs/Readme.md` sind überwiegend englisch; `docs/Readme.md` enthält bereits einen deutschsprachigen Datenschutzabschnitt.
- **Build:** Read the Docs Build `35211021` vom 17. Oktober 2026 war erfolgreich und lief mit `mkdocs build --strict` ohne dokumentationsbezogene Build-Fehler durch.

Die Sprachbewertung jeder einzelnen Seite ist noch nicht abgeschlossen. Daher wird keine Seite allein anhand ihres Dateinamens als vollständig übersetzt eingestuft.


## Fortschritt

### Bereits ins Deutsche übertragen

- `docs/index.md` – Startseite
- `docs/Readme.md` – Erste Schritte und Projektüberblick
- `docs/CONTRIBUTING.md` – Mitwirken am Projekt
- `docs/CODE_OF_CONDUCT.md` – Verhaltenskodex
- `docs/SECURITY.md` – Sicherheitsrichtlinie
- `docs/VERSIONING.md` – Versionierung der Dokumentation
- `docs/CROSS_PLATFORM_SETUP.md` – plattformübergreifende Einrichtung

Die MkDocs-Navigation, die Theme-Sprache und die Theme-Umschalter wurden ebenfalls auf Deutsch umgestellt.

### In der aktuellen Übersetzungsrunde

- `docs/architecture.md`
- `docs/architecture/readme.md`
- `docs/api-reference/README.md`
- `docs/plugin-sdk/README.md`
- `docs/theme-sdk/README.md`

### Noch gesondert prüfen

- `docs/PRIVACY.md) ist bereits weitgehend deutschsprachig. Vor einer Überarbeitung müssen die Aussagen zu Telemetrie, Diagnose und Integrationen gegen den aktuellen Implementierungsstand geprüft werden.
- `docs/DOWNLOAD_STATS.md` wird automatisch aus GitHub-Release-Daten erzeugt. Übersetzungen an dieser Datei sollten daher im erzeugenden Workflow bzw. Skript vorgenommen werden, nicht nur in der generierten Ausgabe.

## Vollständiges Dateiinventar

### Allgemeine Dokumentation und Projektregeln (11 Seiten)

- `docs/CODE_OF_CONDUCT.md`
- `docs/CONTRIBUTING.md`
- `docs/CROSS_PLATFORM_SETUP.md`
- `docs/DOWNLOAD_STATS.md`
- `docs/IntegrationSDK.md`
- `docs/PRIVACY.md`
- `docs/Readme.md`
- `docs/SECURITY.md`
- `docs/UPDATE_ARCHITECTURE.md`
- `docs/VERIFIED_INTEGRATIONS.md`
- `docs/VERSIONING.md`

### Startseite (1 Seite)

- `docs/index.md`

### API-Referenz (20 Seiten)

- `docs/api-reference/README.md`
- `docs/api-reference/Application.md`
- `docs/api-reference/Commands.md`
- `docs/api-reference/Events.md`
- `docs/api-reference/Hooks.md`
- `docs/api-reference/Logger.md`
- `docs/api-reference/Menus.md`
- `docs/api-reference/Notifications.md`
- `docs/api-reference/Permissions.md`
- `docs/api-reference/Plugin.md`
- `docs/api-reference/PluginContext.md`
- `docs/api-reference/PluginManager.md`
- `docs/api-reference/RadioBrowserService.md`
- `docs/api-reference/Settings.md`
- `docs/api-reference/Storage.md`
- `docs/api-reference/StreamManager.md`
- `docs/api-reference/Theme.md`
- `docs/api-reference/ThemeManager.md`
- `docs/api-reference/UnifiedPlayer.md`
- `docs/api-reference/Windows.md`

### Architektur (13 Seiten)

- `docs/architecture.md`
- `docs/architecture/readme.md`
- `docs/architecture/01-Application.md`
- `docs/architecture/02-StorageManager.md`
- `docs/architecture/03-WindowManager.md`
- `docs/architecture/04-Diagnostics.md`
- `docs/architecture/05-IPC.md`
- `docs/architecture/06-ThemeManager.md`
- `docs/architecture/07-PluginManager.md`
- `docs/architecture/08-MediaKeys.md`
- `docs/architecture/09-Tray.md`
- `docs/architecture/10-Updater.md`
- `docs/architecture/11-PackageSystem.md`

### Plugin-SDK (16 Seiten)

- `docs/plugin-sdk/README.md`
- `docs/plugin-sdk/01-GettingStarted.md`
- `docs/plugin-sdk/02-Manifest.md`
- `docs/plugin-sdk/03-ProjectStructure.md`
- `docs/plugin-sdk/04-Lifecycle.md`
- `docs/plugin-sdk/05-Context.md`
- `docs/plugin-sdk/06-PluginAPI.md`
- `docs/plugin-sdk/06-Storage.md`
- `docs/plugin-sdk/07-Events.md`
- `docs/plugin-sdk/08-Hooks.md`
- `docs/plugin-sdk/08-Navigation.md`
- `docs/plugin-sdk/09-UI.md`
- `docs/plugin-sdk/10-BestPractices.md`
- `docs/plugin-sdk/11-HelloWorld.md`
- `docs/plugin-sdk/12-FAQ.md`
- `docs/plugin-sdk/13-Capabilities.md`

### Theme-SDK (10 Seiten)

- `docs/theme-sdk/README.md`
- `docs/theme-sdk/01-GettingStarted.md`
- `docs/theme-sdk/02-ThemeManifest.md`
- `docs/theme-sdk/03-DirectoryStructure.md`
- `docs/theme-sdk/04-CSSVariables.md`
- `docs/theme-sdk/05-Components.md`
- `docs/theme-sdk/06-Assets.md`
- `docs/theme-sdk/07-BestPractices.md`
- `docs/theme-sdk/08-HelloTheme.md`
- `docs/theme-sdk/09-FAQ.md`

## Übersetzungsreihenfolge

1. **Einstieg und Orientierung:** `docs/index.md`, `docs/Readme.md`, Navigationsbeschriftungen in `mkdocs.yml`.
2. **Installation und Nutzung:** `docs/CROSS_PLATFORM_SETUP.md`, `docs/PRIVACY.md`, `docs/VERIFIED_INTEGRATIONS.md`, `docs/IntegrationSDK.md`.
3. **Projektregeln und Betrieb:** `docs/CONTRIBUTING.md`, `docs/CODE_OF_CONDUCT.md`, `docs/SECURITY.md`, `docs/VERSIONING.md`, `docs/DOWNLOAD_STATS.md`, `docs/UPDATE_ARCHITECTURE.md`.
4. **Architektur:** zuerst Übersichtsseiten, danach die einzelnen Komponenten.
5. **Plugin-SDK:** in Reihenfolge von Einrichtung und Manifest über Lebenszyklus bis API, Navigation und Fähigkeiten.
6. **Theme-SDK:** in Reihenfolge von Einrichtung und Manifest bis Komponenten, Assets und FAQ.
7. **API-Referenz:** abschnittsweise, mit besonderer Prüfung der technischen Bedeutung und aller Codebeispiele.

Jede Gruppe wird separat geprüft und veröffentlicht. Die Reihenfolge kann angepasst werden, wenn die erste Seitenprüfung dringlichere oder bereits vollständig deutsche Inhalte aufzeigt.

## Übersetzungsregeln

- Erklärtexte, Überschriften, Navigation, Bildbeschreibungen und Anleitungen werden in natürliches Deutsch übertragen.
- Technische Bezeichner bleiben unverändert: API-Namen, Klassen, Methoden, Events, Berechtigungen, Konfigurationsschlüssel, Dateipfade, CLI-Befehle und Codebeispiele.
- Englische Fachbegriffe bleiben dort erhalten, wo sie als feststehende Begriffe in Code oder im Entwicklerumfeld gebraucht werden; bei der ersten Nennung kann eine deutsche Erklärung ergänzt werden.
- Tatsächlicher Funktionsumfang und Statusangaben dürfen durch die Übersetzung nicht erweitert oder übertrieben werden.
- Vorhandene Links, Markdown-Anker, Tabellen, Codeblöcke und relative Dateipfade müssen erhalten bleiben oder nach einer Änderung überprüft werden.
- Keine maschinelle Übersetzung ungeprüft in alle Dateien schreiben. Jede übersetzte Gruppe erhält einen eigenen Diff- und Build-Check.

## Abschlusskriterien

- Alle 71 Seiten sind einzeln auf Sprache und Aktualität geprüft.
- Sämtliche erklärenden Inhalte der veröffentlichten Dokumentation sind deutschsprachig; Code und offizielle technische Bezeichner bleiben unverändert.
- Navigationslabels und Theme-Sprache sind passend auf Deutsch eingestellt.
- MkDocs läuft weiterhin mit `--strict` erfolgreich.
- Interne Links, Anker, Installationsbefehle und Statusaussagen wurden stichprobenartig und für die geänderten Seiten gezielt geprüft.
- Der veröffentlichte Read-the-Docs-Auftritt wurde nach dem Build kontrolliert.
