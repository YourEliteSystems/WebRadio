# Update-System – Architektur, Erkennung und Provider-Auswahl

Diese Seite beschreibt das Update-System von WebRadio ab **v1.0.7**: die
Systemerkennung, die Installationserkennung, die Provider-Registry, die
Sicherheitsmechanismen und die Grenzen des Systems.

Sie ersetzt die frühere Beschreibung, in der die Provider-Auswahl
ausschließlich auf einem groben „Packaging-Typ“ basierte.

---

## Ziele

Das Update-System muss zuverlässig erkennen,

- welches Betriebssystem und welche Version vorliegt,
- welche System- und Prozessarchitektur verwendet wird,
- welche Linux-Distribution und welcher Paketmanager vorhanden sind,
- in welcher Form und an welchem Ort WebRadio installiert ist,
- über welchen Weg die Installation erfolgte,

und daraus **automatisch den korrekten, sicheren Update-Mechanismus**
auswählen. Wenn kein sicherer automatischer Weg existiert, muss eine
verständliche Meldung mit einem manuellen Update-Weg erscheinen.

Unverändert gilt:

- GitHub Releases bleibt die einzige Quelle für Versionen, Artefakte und
  Release-Metadaten.
- Die Kanäle `stable`, `beta` und `alpha` bleiben vollständig erhalten.
- Die Provider-Auswahl ist **kanalunabhängig**; es findet kein impliziter
  Kanalwechsel statt.
- Bestehende Sicherheitsmechanismen (SHA-512 aus den Release-Metadaten,
  Asset-Whitelist, atomarer Austausch, Rollback) bleiben erhalten.

---

## Architektur

```text
                    ┌──────────────────┐
                    │  SystemDetector  │  OS, Version, Architektur,
                    │                  │  Laufzeit, Distribution
                    └────────┬─────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │InstallationDetector│  Installationsart, Quelle,
                    │                    │  Pfade, Berechtigungen
                    └────────┬───────────┘
                             │
                             ▼
                 ┌───────────────────────────┐
                 │ UpdateProviderRegistry    │  wählt Mechanismus
                 └────────┬──────────────────┘
                          │
                          ▼
                 ┌───────────────────┐
                 │   UpdateManager   │  Zustand, Kanäle, Download,
                 │                   │  Installation, Diagnose
                 └────────┬──────────┘
                          │
        ┌─────────────────┼──────────────────────┐
        ▼                 ▼                      ▼
 WindowsUpdate     LinuxAppImage          Unsupported
 Provider          UpdateProvider         UpdateProvider
 (electron-updater)(atomarer Austausch)   (Paketmanager/manuell)
```

Beteiligte Dateien:

| Aufgabe | Datei |
| ------- | ----- |
| Systemerkennung | `electron/core/platform/SystemDetector.js` |
| Installationserkennung | `electron/core/platform/InstallationDetector.js` |
| Provider-Auswahl | `electron/core/updates/UpdateProviderRegistry.js` |
| Kompatibilitäts-Factory | `electron/core/updates/providers/ProviderFactory.js` |
| Orchestrierung | `electron/core/updates/UpdateManager.js` |
| Integritätsprüfung | `electron/core/updates/verification/ArtifactVerifier.js` |
| AppImage-Installer | `electron/core/updates/providers/LinuxAppImageInstaller.js` |
| Kanäle | `electron/core/updates/UpdateChannel.js` |
| Fehlercodes/Kategorien | `electron/core/updates/UpdateState.js` |

`ProviderFactory` enthält **keine eigene Auswahllogik** mehr. Sie bleibt als
stabile API erhalten und delegiert an die Registry.

---

## SystemDetector

`SystemDetector.detect()` liefert ein JSON-serialisierbares Profil:

```js
{
  status: "VERIFIED",
  os: {
    name: "linux",              // windows | linux | macos | unknown
    version: "41",              // Distro-VERSION_ID bzw. os.release()
    kernelVersion: "6.11.3",
    status: "VERIFIED",
    evidence: "os-release VERSION_ID"
  },
  architecture: {
    system: "x64",              // os.arch()
    process: "x64",             // process.arch
    emulated: false,            // true bei Emulation (z. B. x64 auf arm64)
    status: "DETECTED"
  },
  runtime: {
    runtime: "electron",        // electron | node | unknown
    electron: "44.4.1",
    node: "26.0.0",
    chrome: "140.0.0.0",
    status: "DETECTED"
  },
  linux: {
    distribution: {
      id: "arch",
      name: "Arch Linux",
      prettyName: "Arch Linux",
      versionId: "rolling",
      idLike: ["archlinux"],
      family: "arch",           // arch | debian | fedora | rhel | suse | unknown
      packageManager: "pacman",
      immutable: false,
      status: "VERIFIED",
      matchedId: "arch",
      evidence: "os-release ID/ID_LIKE -> arch"
    },
    kernelVersion: "6.11.3",
    osReleasePath: "/etc/os-release"
  },
  capabilities: {
    isPackaged: true,
    isDevelopment: false,
    hasPackageManager: true,
    immutableSystem: false,
    supportsInAppUpdate: true
  }
}
```

### Linux-Distributionen

Die Distributionsfamilie wird **ausschließlich** über `ID` und `ID_LIKE`
aus `/etc/os-release` aufgelöst – niemals über `NAME`. Damit kann eine
Distribution nicht allein wegen ihres Anzeigenamens als kompatibel gelten.

Aufgelöste Familien und Paketmanager:

| Familie | Paketmanager | Beispiele (über ID/ID_LIKE) |
| ------- | ------------ | --------------------------- |
| `debian` | `apt` | Debian, Ubuntu, Linux Mint, Pop!_OS, elementary, Zorin, Kali, Raspberry Pi OS |
| `arch` | `pacman` | Arch Linux, CachyOS, EndeavourOS, Manjaro, Garuda, Artix, ArcoLinux, Archcraft |
| `fedora` | `dnf` | Fedora, Nobara |
| `rhel` | `dnf` | RHEL, CentOS, Rocky, AlmaLinux, Oracle Linux, Amazon Linux |
| `suse` | `zypper` | openSUSE Leap/Tumbleweed, SLES |
| `unknown` | – | alles andere |

Unbekannte Distributionen fallen bewusst auf `unknown` zurück. Die
Installationserkennung nutzt dann generische Linux-Signale
(Paketmanager-Binaries, Paketdatenbanken), statt eine Familie zu raten.

Deklarative/immutable Systeme (NixOS, Fedora Silverblue/Kinoite, Bazzite,
SteamOS, openSUSE MicroOS) werden als `UNSUPPORTED` markiert.

### Vertrauensstufen

Jede erkannte Information trägt eine Stufe:

| Stufe | Bedeutung |
| ----- | --------- |
| `DETECTED` | zuverlässig erkannt, aber nicht zusätzlich verifiziert |
| `VERIFIED` | zusätzlich gegen eine belastbare Quelle geprüft (z. B. Paketdatenbank, `APPIMAGE` + existierende Datei) |
| `UNKNOWN` | nicht zuverlässig ermittelbar |
| `UNSUPPORTED` | erkannt, aber nicht unterstützt |

---

## InstallationDetector

`InstallationDetector.detect()` unterscheidet ausdrücklich zwischen
Installationspfad, Ausführungspfad, ausführbarer Datei, Anwendungs- und
Benutzerdatenverzeichnis:

```js
{
  status: "VERIFIED",
  kind: "linux-deb",
  format: "deb",                 // nsis | msi | portable | appimage | deb |
                                 // rpm | arch | dmg | pkg | zip |
                                 // development | unknown
  source: "package-manager",     // installer | package-manager | appimage |
                                 // portable | manual | unknown
  sourceStatus: "VERIFIED",
  systemManaged: true,
  trust: { kind, source, paths, permissions },
  paths: {
    installPath: "/opt/webradio",
    executionPath: "/opt/webradio/webradio",
    executablePath: "/opt/webradio/webradio",
    appDirectory: "/opt/webradio/resources/app.asar",
    userDataPath: "/home/user/.config/WebRadio",
    updatePath: "/home/user/.config/WebRadio/updates",
    stagingPath: "/home/user/.config/WebRadio/updates/staging",
    backupPath: "/home/user/.config/WebRadio/updates/backups",
    tempPath: "/tmp"
  },
  permissions: {
    installDirectoryWritable: false,
    executableWritable: false,
    elevationRequired: true,
    status: "DETECTED"
  },
  evidence: "dpkg-Status enthält webradio",
  detectedAt: "2026-11-10T00:00:00.000Z"
}
```

### Erkannte Installationsarten

| Plattform | Art (`kind`) | Quelle (`source`) | Nachweis |
| --------- | ------------ | ----------------- | -------- |
| Windows | `windows-exe` | `installer` | Ausführung unter `Program Files`/`%LOCALAPPDATA%\Programs` |
| Windows | `windows-msi` | `installer` | `WEBRADIO_INSTALLER=msi` oder Marker-Datei |
| Windows | `windows-portable` | `portable` | `PORTABLE_EXECUTABLE_DIR` (verifiziert) oder Pfad außerhalb der Programmverzeichnisse |
| Linux | `linux-appimage` | `appimage` | `APPIMAGE` + existierende Datei (verifiziert) oder Mount-Pfad |
| Linux | `linux-deb` | `package-manager` | Systempfad + Debian-Familie; `dpkg`-Status (verifiziert) |
| Linux | `linux-rpm` | `package-manager` | Systempfad + Fedora/RHEL/SUSE-Familie |
| Linux | `linux-arch` | `package-manager` | Systempfad + Arch-Familie; pacman-Datenbank (verifiziert) |
| Linux | `linux-portable` | `portable` | entpackte Anwendung im Benutzerverzeichnis, schreibbar |
| macOS | `macos-dmg` | `installer`/`unknown` | gemountetes `/Volumes/…` (verifiziert); `/Applications` ohne Receipt nur `DETECTED`, Quelle bleibt `unknown` |
| macOS | `macos-pkg` | `installer` | PKG-Receipt in `/var/db/receipts` (verifiziert) |
| macOS | `macos-zip` | `portable` | App-Bundle außerhalb von `/Applications` |
| – | `development` | `manual` | `app.isPackaged === false` |
| – | `unknown` | `unknown`/`manual` | keine belastbaren Signale |

**Grundregel:** Eine unbekannte Installationsquelle wird nicht durch eine
Vermutung ersetzt. Sie bleibt `unknown`; die Registry wählt dann keinen
automatischen Weg.

### Marker-Datei für Packager

Packager können die Installationsart explizit deklarieren, statt sie
erkennen zu lassen. Gesucht wird `install-source.json` unter
`resources/`, neben der ausführbaren Datei bzw. im App-Verzeichnis:

```json
{ "kind": "linux-portable", "source": "portable" }
```

Nur gültige `kind`/`source`-Kombinationen werden übernommen; ungültige
Marker werden ignoriert.

---

## UpdateProviderRegistry

`UpdateProviderRegistry.select({ system, installation, channel })` liefert
eine serialisierbare Auswahl:

```js
{
  key: "linux-appimage",
  label: "Linux AppImage",
  providerType: "appimage-github-fallback",
  mechanism: "atomic-file-replace",
  automatic: true,
  requiresElevation: false,
  channel: "stable",
  channelIndependent: true,
  channels: ["stable", "beta", "alpha"],
  reason: null,
  suggestion: null,
  manualUpdate: null
}
```

### Auswahlmatrix

| Plattform | Format | Provider-Schlüssel | Automatisch | Mechanismus |
| --------- | ------ | ------------------ | ----------- | ----------- |
| Windows | `nsis` | `windows-nsis` | ja | electron-updater (Installer) |
| Windows | `portable` | `windows-portable` | ja | electron-updater (im Anwendungsverzeichnis) |
| Windows | `msi` | `windows-msi` | nein | manuell über Windows Installer (`msiexec`) |
| Linux | `appimage` | `linux-appimage` | ja | Download, Validierung, atomarer Austausch |
| Linux | `deb` | `linux-deb` | nein | Paketmanager (`apt`/`dpkg`) |
| Linux | `rpm` | `linux-rpm` | nein | Paketmanager (`dnf`/`zypper`) |
| Linux | `arch` | `linux-arch` | nein | Paketmanager (`pacman`) |
| Linux | `portable` | `linux-portable` | nein | manueller Austausch im Anwendungsverzeichnis |
| macOS | `dmg` | `macos-dmg` | nein | manuelles DMG |
| macOS | `pkg` | `macos-pkg` | nein | macOS Installer |
| macOS | `zip` | `macos-zip` | nein | manueller Austausch |
| – | `development` | `development` | nein | – |
| – | `unknown` | `unsupported` | nein | manueller Download |

Harte Regeln:

1. Paketmanagerverwaltete Installationen werden **niemals** automatisch
   überschrieben.
2. Unbekannte Installationsarten werden **niemals** automatisch
   überschrieben.
3. Ist keine sichere automatische Aktualisierung möglich, enthält die
   Auswahl `reason`, `suggestion` und `manualUpdate.url`.
4. Die Kanalwahl beeinflusst die Auswahl nicht; die Auswahl beeinflusst die
   Kanalwahl nicht.

---

## Update-Kanäle

| Kanal | electron-updater | `allowPrerelease` | akzeptierte Releases |
| ----- | ---------------- | ----------------- | -------------------- |
| `stable` | `latest` | `false` | nur stabile Versionen |
| `rc` | `rc` | `true` | RC + Stable (kein Beta/Alpha) |
| `beta` | `beta` | `true` | Beta + RC + Stable (kein Alpha) |
| `alpha` | `alpha` | `true` | Alpha + Beta + RC + Stable |

Die kanonischen IDs und die Zuordnung liegen ausschließlich in
`UpdateState.CHANNELS`, `UpdateChannel` und `ChannelMetadata`. Die
Provider-Auswahl liest den Kanal nur zur Diagnose.

`allowDowngrade` ist in **allen** Kanälen `false`. Eine ältere oder gleiche
Version wird niemals als reguläres Update angeboten – unabhängig davon, welche
Metadaten der Feed liefert. Ein bewusster Downgrade ist ein separater manueller
Vorgang (Neuinstallation) und nicht Teil des Update-Flusses.

### Semantischer Versionsvergleich

`electron/core/updates/VersionCompare.js` implementiert SemVer 2.0.0:

- `major.minor.patch` numerisch, optionales `v`-Präfix.
- Pre-Release-Kennungen punktweise; numerische Identifier numerisch,
  alphanumerische lexikalisch, numerische kleiner als alphanumerische.
- `1.0.8-rc.1 < 1.0.8-rc.2 < 1.0.8`; `alpha < beta < rc < stable`.
- Build-Metadaten (`+build`) werden ignoriert.
- Ungültige oder fehlende Versionen werden abgelehnt und lösen kein Update aus.

Der Vergleich greift an drei Stellen: beim `update-available`-Event, beim
Download und bei der Check-Ergebnisauswertung. Damit kann weder ein falscher
Feed noch eine Fehlkonfiguration eine ältere Version anbieten (beobachteter
Fall: installiert `1.0.8-rc.1`, Feed meldet `1.0.7`).

Fehlt die Feed-Datei eines Kanals (z. B. `rc.yml` vor dem ersten RC-Release),
wird das als "kein Update" und nicht als Netzwerkfehler behandelt; die
Oberfläche bleibt bei "aktuell".

### Visuelle Kennzeichnung

Die Farben und Labels kommen zentral aus `ChannelMetadata` und den
CSS-Tokens `--release-alpha`, `--release-beta`, `--release-rc`,
`--release-stable`:

| Kanal | Farbe | Badge |
| ----- | ----- | ----- |
| Alpha | Rot (`#ef4444`) | `ALPHA` |
| Beta | Orange (`#f59e0b`) | `BETA` |
| Release Candidate | Violett (`#8b5cf6`) | `RC` |
| Stable | Grün (`#22c55e`) | `STABLE` |

Badges werden nicht ausschließlich über Farbe unterschieden, sondern tragen
immer ein Textlabel und ein Icon. Verwendet werden sie in Titlebar,
Update-Einstellungen, Über-Dialog und Update-Benachrichtigungen.

### Release Candidate und Stable-Freigabe

1. RC bauen: `UPDATE_CHANNEL=rc` (Version z. B. `1.0.8-rc.1`) erzeugt `rc.yml`.
2. RC testen und freigeben. Der Kanal `rc` liefert RC-Versionen und – sofern im
   `rc`-Feed veröffentlicht – das finale Stable-Release.
3. Stable bauen und veröffentlichen (`latest.yml`). Damit RC-Nutzer das finale
   Release erhalten, wird dieselbe Version zusätzlich im `rc`-Kanal
   veröffentlicht (`rc.yml` mit denselben Artefakten).
4. Erst danach gilt `1.0.8` als Stable; eine RC-Version wird nie automatisch
   als Stable eingestuft.

Ohne Schritt 3 bleibt ein RC-Nutzer auf dem RC-Kanal und erhält kein Stable –
das ist eine bewusste Release-Entscheidung, kein automatischer Wechsel.

---

## Update-Ablauf

```text
App-Start
  → UpdateManager.initialize() (idempotent)
      → SystemDetector.detect()
      → InstallationDetector.detect()
      → UpdateProviderRegistry.select()
      → Provider erstellen
      → confirmHealthyInstall()  (vorherige Sicherung freigeben)
  → optionaler Auto-Check (nur packaged, nur unterstützte Formate)

Check
  → Provider prüft GitHub-Release-Metadaten des Kanals
  → Kanal-Filter (Alpha/Beta/RC/Stable) wird angewendet
  → semantischer Versionsvergleich: nur echt neuere Versionen werden angeboten

Download
  → Benutzer löst Download explizit aus (autoDownload = false)
  → HTTPS / Größe / Fortschritt werden von electron-updater geführt
  → Unterbrechungen: electron-updater setzt Teil-Downloads fort
  → unvollständige Dateien werden über Größe + SHA-512 erkannt

Installation
  → Berechtigungen prüfen
  → Artefakt validieren (Format, Größe, Hash, ggf. Signatur/Architektur)
  → Staging-Datei im Zielverzeichnis
  → bisherige Datei → Backup
  → atomarer rename auf den Zielpfad
  → Ausführungsrechte prüfen
  → bei Fehler: Rollback aus dem Backup

Nach dem Neustart
  → laufende Datei wird erneut validiert
  → erst dann werden Sicherungen freigegeben
```

---

## Sicherheitsmechanismen

### Download

- GitHub-Release-Quelle über HTTPS (electron-updater).
- `autoDownload = false`: kein Download ohne Benutzerentscheidung.
- Größen- und Fortschrittskontrolle über die Release-Metadaten.
- Fortsetzung von Teil-Downloads durch electron-updater; unvollständige
  Dateien werden anschließend über Größe und Hash abgelehnt.
- Temporäre Dateien liegen im Benutzer-Datenverzeichnis
  (`updates/staging` bzw. der Downloader-Cache), nicht in Systempfaden.

### Integrität (`ArtifactVerifier`)

- SHA-256 und SHA-512, jeweils als Hex oder Base64
  (electron-updater liefert SHA-512 als Base64).
- Die bestehende SHA-512-Prüfung des AppImage-Updaters bleibt erhalten und
  wird zusätzlich vor dem Austausch ausgeführt.
- Dateigröße gegen die Release-Metadaten.
- Dateiformat über Magic Bytes: ELF, PE, Mach-O.
- Architektur aus ELF `e_machine`, PE `Machine` oder Mach-O `cputype`.
- Signaturprüfung, sofern ein öffentlicher Schlüssel und eine Signatur
  bereitgestellt werden. Ohne Prüfdaten lautet das Ergebnis ausdrücklich
  `UNSUPPORTED` – niemals „bestanden“.
- Freier Speicherplatz, sofern vom Laufzeitsystem ermittelbar.

### Installation

- Schreibrechte im Zielverzeichnis und auf der Zieldatei werden vorab
  geprüft (`accessSync`).
- Systemverwaltete Verzeichnisse (`/opt/webradio`, `/usr/lib/webradio`,
  `/usr/share/webradio`) werden ohne Berechtigung nicht verändert.
- Symbolische Links werden vor dem Austausch aufgelöst; die
  Symlink-Integrität bleibt erhalten.
- Atomarer Austausch über eine Staging-Datei im selben Verzeichnis
  (`rename` innerhalb desselben Dateisystems).
- Ausführungsrechte werden erhalten (`stat.mode`, mindestens `0755`,
  niemals world-writable).
- Unter Windows/macOS werden laufende Prozesse und Dateisperren über die
  jeweiligen Provider berücksichtigt; ein Austausch erfolgt nur, wenn der
  Zielpfad schreibbar ist.

### Backup und Rollback

- Vor dem Austausch wird die vorhandene Datei gesichert.
- Nach erfolgreichem `rename` wird die neue Datei validiert
  (Format, Größe, Ausführungsrechte).
- Schlägt der Austausch fehl, wird das Backup zurückgespielt.
- **Eine Sicherung wird niemals gelöscht, nur weil am Zielpfad bereits eine
  Datei existiert.** Freigegeben wird sie erst durch
  `confirmHealthyInstall()` nach einem erfolgreichen Start der neuen
  Version.
- Unvollständige Staging-Dateien (`.tmp`) werden aufgeräumt; `.bak`-Dateien
  bleiben als Wiederherstellungsquelle erhalten.

---

## Fehlerdiagnose

Der UpdateManager führt eine begrenzte, bereinigte Schrittliste
(max. 50 Einträge) und stellt sie über IPC bereit:

| Kanal | Inhalt |
| ----- | ------ |
| `updates:get-diagnostics` | System, Architektur, Distribution, Installationsart, Quelle, Pfade, Berechtigungen, Provider, Kanal, Schritte, Status |
| `updates:get-provider-info` | aktiver Provider, Mechanismus, Automatik, Berechtigungsbedarf, manueller Weg |
| `updates:get-manual-update-hint` | Begründung + Anleitung für manuelle Updates |

Protokolliert werden: Betriebssystem, Architektur, Distribution,
Installationsart, Installationsquelle, Installationspfad, ausgewählter
Provider, Update-Kanal, Berechtigungen, Update-Schritte, erfolgreiche und
fehlgeschlagene Prüfungen sowie Rollback-Ergebnisse.

Nicht protokolliert werden Passwörter, Tokens, private Schlüssel oder
vollständige Umgebungsvariablen.

Fehler tragen einen stabilen Code und eine Kategorie:

| Kategorie | Codes (Auswahl) |
| --------- | --------------- |
| `network` | `UPDATER_CHECK_FAILED`, `UPDATER_DOWNLOAD_FAILED`, `UPDATER_DOWNLOAD_INCOMPLETE` |
| `integrity` | `UPDATER_INTEGRITY_FAILED`, `UPDATER_SIGNATURE_FAILED` |
| `permission` | `UPDATER_PERMISSION_DENIED`, `UPDATER_DISK_SPACE_INSUFFICIENT` |
| `platform` | `UPDATER_PLATFORM_UNSUPPORTED`, `UPDATER_PROVIDER_SELECTION_FAILED` |
| `installation` | `UPDATER_INSTALLATION_UNKNOWN`, `UPDATER_INSTALL_FAILED`, `UPDATER_ROLLBACK_FAILED` |
| `channel` | `UPDATER_INVALID_CHANNEL`, `UPDATER_CHANNEL_SWITCH_FAILED` |

---

## Unterstützte Systeme

| Betriebssystem | Architekturen | Status |
| -------------- | ------------- | ------ |
| Windows 10/11 | x64, ia32 | unterstützt |
| Linux | x64, arm64, arm | unterstützt |
| macOS | x64, arm64 | erkannt, Auto-Update deaktiviert |

---

## Tatsächlich getestete Installationsarten

Diese Tabelle trennt **ausgeführte Tests** von **theoretisch unterstützten**
Funktionen. Simulierte Tests ersetzen keine Plattformintegration.

| Installationsart | Getestet | Art des Tests |
| ---------------- | -------- | ------------- |
| Windows NSIS/EXE | ja | simulierte Erkennung + Provider-Auswahl; echter Windows-Host nur für die Erkennungs-Probe |
| Windows Portable | ja | simulierte Erkennung + Provider-Auswahl |
| Windows MSI | ja (Erkennung) | simulierte Erkennung; kein MSI-Artefakt im Release |
| Linux AppImage | ja | Erkennung, Integrität, atomarer Austausch, Rollback (unit) |
| Linux DEB | ja (Erkennung) | simulierte Erkennung; Paket wird gebaut, aber nicht automatisch aktualisiert |
| Linux RPM | ja (Erkennung) | simulierte Erkennung; kein RPM-Artefakt im Release |
| Linux Arch-Paket | ja (Erkennung) | simulierte Erkennung + echter Arch-Container für die Distributionserkennung |
| Linux Portable | ja (Erkennung) | simulierte Erkennung; kein automatischer Update-Weg |
| macOS DMG/PKG/ZIP | ja (Erkennung) | simulierte Erkennung; **kein macOS-Build und kein macOS-Laufzeittest** |
| Unbekannte Installation | ja | simulierte Erkennung, kein automatischer Weg |

Echte Plattformläufe in der CI:

- **Windows**: `windows-latest` – Erkennungs-Probe auf echtem Windows.
- **Linux (Ubuntu)**: `ubuntu-latest` – Erkennung von `/etc/os-release`
  (Familie `debian`, Paketmanager `apt`).
- **Arch Linux**: `archlinux:latest`-Container – Familie `arch`,
  Paketmanager `pacman`.

Nicht getestet: macOS (weder Build noch Laufzeit) und RPM-Distributionen.

---

## Bekannte Einschränkungen

- **macOS-Auto-Updates** sind nicht implementiert. Ohne Signatur- und
  Notarisierungsprüfung wird kein automatischer Austausch durchgeführt.
- **MSI** wird erkannt, aber nicht automatisch aktualisiert (kein
  MSI-Artefakt im Release).
- **Linux Portable** hat keinen automatischen Update-Weg, weil kein
  prüfbares Archiv-Artefakt veröffentlicht wird.
- **RPM** wird erkannt, aber es wird kein RPM-Artefakt gebaut.
- **Signaturen** werden nur geprüft, wenn ein öffentlicher Schlüssel
  bereitgestellt wird. Derzeit stellt der Release keine Signaturen bereit;
  die Prüfung meldet dann `UNSUPPORTED`.
- **AppImage-Updates** laden die vollständige Datei; es gibt kein
  Delta-Update über zsync/`appimageupdatetool`.
- **Immutable Distributionen** (NixOS, Silverblue, SteamOS …) werden als
  `UNSUPPORTED` markiert.
- **Emulierte Prozesse** (z. B. x64 auf arm64) werden erkannt, aber ein
  passendes Artefakt muss vom Release bereitgestellt werden.

---

## Erweiterung um weitere Installationsformate

1. **Erkennung**: In `InstallationDetector` ein `kind` und ein `format`
   ergänzen (`KINDS`, `FORMAT_BY_KIND`) und in der passenden
   `detect*Kind`-Funktion über ein belastbares Signal setzen. Keine
   Namensheuristik verwenden.
2. **Registry**: In `UpdateProviderRegistry` eine Definition mit `key`,
   `platform`, `formats`, `mechanism`, `automatic`, `reason`/`suggestion`
   und – falls automatisierbar – `create` registrieren.
3. **Provider**: Nur bei sicherer Automatisierung einen Provider
   implementieren, der `checkForUpdates`, `downloadUpdate`,
   `installUpdate`, `dispose` und `getProviderType` bereitstellt.
4. **Sicherheit**: Integritätsprüfungen über `ArtifactVerifier` nutzen;
   niemals ungeprüfte Dateien austauschen.
5. **Tests**: Erkennung, Auswahl, Berechtigungen, Integrität und Rollback
   in `scripts/tests/` abdecken.
6. **Dokumentation**: Die Tabellen „Erkannte Installationsarten“,
   „Auswahlmatrix“ und „Tatsächlich getestete Installationsarten“
   aktualisieren.

Neue Formate dürfen bestehende, getestete Pfade nicht verändern.
