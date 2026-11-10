# Updater

The `Updater` subsystem is responsible for checking whether newer versions of WebRadio are available.

Its purpose is to inform users about updates while remaining independent from the application's core functionality.

---

# Responsibilities

The Updater subsystem is organized as a small core layer with supporting modules:

* **UpdateManager** – central orchestration, state and channel handling.
* **UpdateChannel** – stable/beta/alpha channel logic.
* **UpdateState** – current update state.
* **ProviderFactory** – stable compatibility API delegating to the provider registry.
* **RuntimeDetector** – detects platform, architecture and packaging type.
* **SystemDetector** – detects OS version, architecture, runtime and Linux distribution.
* **InstallationDetector** – detects installation kind, source, paths and permissions.
* **UpdateProviderRegistry** – selects the update mechanism independently of the channel.
* Platform-specific providers – Windows, Linux AppImage, unsupported.

The Updater is responsible for:

* Detecting the current runtime environment
* Selecting the appropriate update provider
* Checking for updates
* Comparing versions
* Notifying the user
* Handling release channels
* Managing update state

The Updater should never interfere with normal application operation.

---

# Lifecycle

```text
Application.start()

↓

Updater initialized

↓

User requests update check
or
Automatic check

↓

Version comparison

↓

Notify user
```

---

# Runtime Detection

Before checking for updates, the Updater determines the current runtime environment.

This includes:

* Operating system and OS version (Windows, Linux, macOS)
* System and process architecture (x64, arm64, arm, ia32) including emulation
* Linux distribution, distribution family and package manager from `/etc/os-release`
* Installation kind (nsis, msi, portable, appimage, deb, rpm, arch, dmg, pkg, zip, development, unknown)
* Installation source (installer, package-manager, appimage, portable, manual, unknown)
* Install path, execution path and user data path, plus write permissions

This information is used to select the correct update provider. Package-manager
managed installations are never overwritten; unknown installation kinds never use
an automatic update path. See [Update Architecture](../UPDATE_ARCHITECTURE.md) for
the complete matrix and the list of tested installation kinds.

---

# Provider Architecture

The Updater uses a provider-based architecture:

```text
UpdateManager

↓

SystemDetector → InstallationDetector

↓

UpdateProviderRegistry (ProviderFactory delegates)

↓

Selected Provider
```

Supported providers:

* **WindowsUpdateProvider** – wraps electron-updater for Windows NSIS and portable builds.
* **LinuxAppImageUpdateProvider** – validates and atomically replaces the AppImage.
* **UnsupportedUpdateProvider** – used for deb, rpm, arch, MSI, macOS and unknown
  installations. It returns a clear reason plus a manual update path and never
  replaces package-manager managed files.

> macOS automatic updates are not implemented in 1.0.7. macOS builds are not
> produced by the release pipeline and are not covered by platform tests.

---

# Update Process

A typical update workflow consists of:

1. Detect runtime environment.
2. Select update provider.
3. Request version information.
4. Compare installed version.
5. Determine update availability.
6. Notify the user.
7. Start update process when supported.

---

# Update Channels & Persistenz (1.0.7-alpha.5)

WebRadio unterstützt drei offizielle Update-Kanäle:

* **alpha** – Experimentelle Vorab-Builds für frühes Feedback
* **beta** – Vorabversionen mit neuen Funktionen vor dem Stable-Release
* **stable** – Offizielle, stabile Versionen (in electron-updater als `latest` geführt)

### Gültige Channel-IDs

Die gültigen IDs stammen ausschließlich aus der Core-Implementierung (`UpdateState.CHANNELS`, `UpdateChannel.isValidChannel()` und `ChannelMetadata.CHANNEL_IDS`):

| Channel-ID | electron-updater channel | allowPrerelease | Akzeptierte Releases |
| ---------- | ------------------------ | --------------- | -------------------- |
| `alpha`    | `alpha`                  | `true`          | Alpha, Beta, Stable  |
| `beta`     | `beta`                   | `true`          | Beta, Stable         |
| `stable`   | `null` (= `latest`)      | `false`         | nur Stable           |

`allowDowngrade` ist zusätzlich aktiv, wenn die installierte Version ein Pre-Release ist. Die Channel-IDs werden nicht umbenannt; die Zuordnung zum electron-updater-Kanal erfolgt zentral in `UpdateChannel.getUpdaterConfig()`.

### Persistente Speicherung

* **Speicherort:** Gespeichert im Electron-Main-Prozess in `settings.json` im `userData`-Bereich über das `SettingsManager` / `StorageManager`-System (Schlüssel: `updateChannel` bzw. `updates.channel`).
* **Sicherheit:** Der Renderer-Prozess besitzt keinen direkten Dateisystemzugriff. Änderungen werden ausschließlich über validierte IPC-Kanäle abgewickelt.
* **Erster Start (Default):** Ist keine Einstellung vorhanden, greift die automatische Versions-Erkennung (`detectChannelFromVersion()`). Bei Standard-Builds ist der Standardkanal `stable`; Pre-Release-Builds verwenden den Kanal ihrer eigenen Version (z. B. `1.0.7-alpha.5` → `alpha`).
* **Ungültige Einstellungen:** Wurde ein ungültiger Wert in der Konfiguration hinterlegt, fällt das System sicher auf den Standardkanal zurück, ohne andere Benutzereinstellungen zu überschreiben oder zu löschen. Es entsteht keine ungültige Updater-Konfiguration.
* **Neustart-Sicherheit:** Ein vom Benutzer explizit ausgewählter Kanal (z. B. `alpha`) bleibt über jeden Anwendungsneustart hinweg garantiert erhalten.
* **Channel-Wechsel:** Der Wechsel über die UI speichert die Wahl unmittelbar und rekonfiguriert den AutoUpdater zur Laufzeit. Die laufende Radio- oder MediaHub-Wiedergabe wird zu keinem Zeitpunkt unterbrochen. Für die Wirksamkeit des Kanals ist **kein Neustart** erforderlich – der Kanal gilt sofort für manuelle und automatische Update-Prüfungen.
* **Installierte Version bleibt unverändert:** Der Wechsel des Kanals ändert nicht die laufende Build-Version. Die UI zeigt daher den Kanal der installierten Version (`versionChannel`) getrennt vom aktiven Update-Channel und weist darauf hin, dass die Version erst nach einem installierten Update wechselt.
* **Zukunftsplanung:** Online-Stores, App-Kataloge und zusätzliche Update-Quellen bleiben ausdrücklich zukünftigen Releases vorbehalten.

### Startup-Reihenfolge

```text
Application.start()
  → StorageManager.initialize()      (userData-Struktur + settings.json)
  → updateManager.initialize()       (idempotent)
      → ChannelStore.getStoredChannel()   (settings.json, validiert)
      → Fallback: UpdateChannel.getUpdateChannel(settings, app-Version)
      → _configureAutoUpdater()           (channel / allowPrerelease / allowDowngrade)
  → IPC-Handler registriert
  → Renderer fragt updates:get-channel / updates:get-current-version ab
```

Der Renderer erhält damit immer den tatsächlich aktiven Channel – unabhängig davon, ob der Wert gespeichert, aus der Version abgeleitet oder als Fallback gesetzt wurde.

### Update-API (IPC/Preload)

Verfügbar über `window.updatesAPI` und identisch über `window.updateAPI`:

| Methode | Zweck |
| ------- | ----- |
| `getChannel()` | aktiver Update-Channel |
| `getStoredChannel()` | dauerhaft gespeicherter Channel (`null`, wenn keiner gespeichert ist) |
| `setChannel(channel)` | Channel validieren, speichern und aktivieren |
| `getChannelMetadata()` | Metadaten (Label, Farbe, Icon) eines Channels |
| `getAllChannelMetadata()` | Metadaten aller Channels (inkl. Anzeigereihenfolge) |
| `getCurrentVersion()` | Version, `isPrerelease`, `channel` (aktiv) und `versionChannel` (installierte Build) |
| `onChannelChanged()` | Ereignis nach erfolgreichem Channel-Wechsel |

**Sicherheitsgrenzen:**

* Channel-Validierung ausschließlich im Main-Prozess; der Renderer kann lediglich eine der drei kanonischen IDs übergeben.
* Kein Dateisystemzugriff und keine Node.js-Core-Module im Renderer.
* Es werden keine Manager-Instanzen und keine Konfigurationspfade exponiert; Renderer-Parameter können keine Pfade bestimmen.
* Fehler werden strukturiert (`{ ok: false, error: { code, message } }`) zurückgegeben; es werden keine Secrets oder internen Dateisystempfade ausgeliefert.
* Bei einem Speicherfehler bleibt die vorherige gültige Einstellung aktiv.

Channel und Severity sind getrennte Konzepte:
* Channel steuert den Release-Stream (`alpha` / `beta` / `stable`).
* Severity beschreibt die Dringlichkeit eines konkreten Updates (`normal` / `important` / `critical`).

---

# Design Principles

## Independent

The application must remain fully functional even if update checks fail.

---

## Non-Blocking

Update checks should never delay application startup.

---

## Extensible

Future versions may support:

* Automatic downloads
* Background updates
* Release channels
* Rollback support
* Delta updates

---

# Best Practices

✔ Perform update checks asynchronously.

✔ Handle network failures gracefully.

✔ Never block the user interface.

✔ Notify users only when necessary.

✔ Keep provider selection separate from channel logic.

---

# Related Documentation

* Application
* Tray
* Diagnostics
* Runtime Detection
* Provider Architecture
* Update Architecture
