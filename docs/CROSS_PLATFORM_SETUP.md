# Einrichtungsleitfaden für mehrere Plattformen

Dieser Leitfaden beschreibt die Einrichtung und den Build-Prozess für die unterstützten Plattformen.

## Status von macOS

macOS-Builds werden **derzeit weder veröffentlicht noch als Release-Downloads unterstützt**. Die aktuellen npm-Skripte des Repositorys bieten keinen eigenen Befehl `dist:mac`; daher wurden historische macOS-Build-Befehle und Beispiele zur Codesignierung aus diesem Leitfaden entfernt.

Wenn du bei der Entwicklung einer möglichen macOS-Unterstützung helfen möchtest, eröffne bitte zunächst ein GitHub-Issue oder eine Discussion. So können die aktuelle Paketierungskonfiguration, native Abhängigkeiten, Signierung und der Release-Prozess geprüft werden, bevor Unterstützung zugesagt wird.

## Linux-Unterstützung

### Voraussetzungen

- Node.js 26 oder neuer
- npm 10 oder neuer
- Build-Werkzeuge für native Module
- Für Arch-Pakete (`.pkg.tar.zst`): `pacman`, `makepkg`, `fakeroot`, `squashfs-tools`, `unzip`
- Alternativ Docker für den Build in einem Arch-Container

### Icons einrichten

Linux benötigt PNG-Icons in verschiedenen Größen. Wir liefern `assets/icons/tray.png` in Standardauflösung mit. `electron-builder` und der `PKGBUILD` erzeugen daraus automatisch die üblichen Icon-Größen (16, 32, 48, 64, 128, 256 und 512 Pixel).

```bash
# Optional: Größen manuell aus dem Quell-Icon erzeugen
convert assets/icons/tray.png -resize 16x16   assets/icons/icon-16.png
convert assets/icons/tray.png -resize 32x32   assets/icons/icon-32.png
convert assets/icons/tray.png -resize 48x48   assets/icons/icon-48.png
convert assets/icons/tray.png -resize 64x64   assets/icons/icon-64.png
convert assets/icons/tray.png -resize 128x128 assets/icons/icon-128.png
convert assets/icons/tray.png -resize 256x256 assets/icons/icon-256.png
convert assets/icons/tray.png -resize 512x512 assets/icons/icon-512.png
```

### Für Linux bauen

```bash
# AppImage und Arch-Paket (primärer Weg)
npm run make:linux

# Nur AppImage
npm run make:linux:appimage

# Nur Arch-Paket (.pkg.tar.zst)
npm run make:linux:arch

# AppImage, Arch-Paket und .deb
npm run make:linux:all
```

### Installationsmethoden

#### AppImage (universell)

```bash
chmod +x WebRadio-*-linux-x86_64.AppImage
./WebRadio-*-linux-x86_64.AppImage
```

#### Debian/Ubuntu (`.deb`)

Ein Build-Skript für `.deb` ist vorhanden, aber ein `.deb`-Paket **ist nicht jedem veröffentlichten Release beigefügt**. Nutze diese Installationsmethode nur, wenn das ausgewählte [GitHub-Release](https://github.com/YourEliteSystems/WebRadio/releases) tatsächlich ein `.deb`-Paket enthält.

```bash
sudo dpkg -i ./webradio_*_amd64.deb
sudo apt-get install -f   # bei Bedarf fehlende Abhängigkeiten installieren
```

#### Arch Linux (offizielles Paket)

```bash
sudo pacman -U webradio-*-x86_64.pkg.tar.zst
```

Deinstallation:

```bash
sudo pacman -R webradio
```

### Linux-Desktopintegration

Die Datei `assets/webradio.desktop` stellt Folgendes bereit:

- Eintrag im Anwendungsmenü
- Zuordnung des Icons
- passende Kategorisierung (Audio/Video/Player/Network)
- `GenericName` und Schlüsselwörter für bessere Auffindbarkeit
- `MimeType` für `x-scheme-handler/webradio`

`electron-builder` installiert die `.desktop`-Datei und das Icon bei AppImage- und .deb-Paketen automatisch. Der `PKGBUILD` installiert sie nach `/usr/share/applications` und das Icon nach `/usr/share/icons/hicolor`.

### Wayland-Unterstützung

WebRadio basiert auf Electron, das nur eingeschränkte native Wayland-Unterstützung bietet. Das tatsächliche Verhalten des Anzeigeservers hängt von der Linux-Distribution und der Desktop-Umgebung ab.

**Aktueller Stand:**

- WebRadio läuft in modernen Linux-Desktopumgebungen mit X11 oder Wayland.
- Electron/Chromium kann auf Wayland-Systemen XWayland als Kompatibilitätsschicht verwenden.
- Derzeit sind keine projektspezifischen Einschränkungen für Wayland bekannt.

**Erwartetes Verhalten:**

- Auf Wayland-Desktops (GNOME 40+, KDE Plasma 5.20+ mit Wayland-Sitzung) läuft WebRadio typischerweise über XWayland.
- Auf X11-basierten Desktops läuft WebRadio nativ unter X11.
- Das genaue Verhalten hängt von der Electron-Paketierung und Konfiguration der Distribution ab.

**Bekannte Hinweise:**

- Die Integration in den System-Tray kann in reinen Wayland-Sitzungen eingeschränkt sein; dies hängt von der Desktop-Umgebung ab.
- Fenstersteuerung und Verhalten sind unter X11 und XWayland weitgehend einheitlich.
- Audiowiedergabe (ALSA/PulseAudio/PipeWire) funktioniert unabhängig vom Anzeigeserver.

**Keine Konfiguration erforderlich:**

WebRadio erzwingt keine bestimmten Wayland- oder X11-Flags. Die Anwendung verwendet das Standardverhalten von Electron, das sich automatisch an die Konfiguration des Anzeigeservers anpasst.

Wenn du Anzeigeprobleme bemerkst, die speziell in deiner Wayland-Umgebung auftreten, melde sie bitte mit Angaben zu Distribution und Desktop-Umgebung.

### FFmpeg

`ffmpeg-static` liefert eine vorkompilierte Linux-x86_64-Binärdatei. `electron-builder` entpackt sie über `asarUnpack` aus dem ASAR-Archiv, damit die ELF-Binärdatei direkt auf dem Zielsystem ausgeführt werden kann.

Für die paketierte Anwendung muss FFmpeg normalerweise **nicht systemweit installiert** werden.

## Plattformspezifischer Code

### Plattform erkennen

```javascript
const { platform } = process;

if (platform === 'darwin') {
  // macOS-spezifischer Code
} else if (platform === 'linux') {
  // Linux-spezifischer Code
} else if (platform === 'win32') {
  // Windows-spezifischer Code
}
```

### Fenstersteuerung

macOS verwendet eine andere Fenstersteuerung:

```javascript
// In renderer/App.jsx oder der Fensterverwaltung
const isMacos = process.platform === 'darwin';

// macOS verwendet native Fenstersteuerung, Windows/Linux verwenden eigene Steuerelemente
{!isMacos && <CustomWindowControls />}
```

## Tests

### Automatisierte Tests

Das Skript `npm test` führt die im Projekt konfigurierte automatisierte Testsuite aus. Es akzeptiert keinen Plattformparameter; plattformspezifische manuelle Prüfungen sollten auf echten Windows- oder Linux-Systemen erfolgen.

```bash
npm test

# Optional: statische Analyse ausführen
npm run lint
```

### Checkliste für manuelle Tests

- [ ] Die Anwendung startet ohne Fehler.
- [ ] Die Audiowiedergabe funktioniert korrekt.
- [ ] Die FFmpeg-Integration funktioniert.
- [ ] Das Plugin-System lädt Plugins.
- [ ] Das Theme-System wendet Themes an.
- [ ] Die Fenstersteuerung funktioniert.
- [ ] Die System-Tray-Integration funktioniert (falls verfügbar).
- [ ] Der automatische Updater funktioniert.
- [ ] Einstellungen bleiben gespeichert.

## CI/CD-Integration

Die aktuellen Build- und Release-Workflows des Repositorys sind die maßgebliche Quelle für automatisierte Builds. Siehe die [GitHub-Actions-Workflows](https://github.com/YourEliteSystems/WebRadio/tree/main/.github/workflows) und den [Leitfaden für Beiträge](https://github.com/YourEliteSystems/WebRadio/blob/main/CONTRIBUTING.md), statt ein separates Workflow-Beispiel zu kopieren, das mit der Projektkonfiguration auseinanderlaufen könnte.

## Fehlerbehebung

### macOS

macOS-Pakete werden derzeit nicht veröffentlicht. Historische Hinweise zu macOS-Signierung und Gatekeeper sind keine unterstützten Installationsanweisungen.

### Linux-Probleme

**Fehler bei Audiowiedergabe oder FFmpeg:**

Paketierte Builds enthalten die FFmpeg-Binärdatei. Normalerweise musst du FFmpeg nicht systemweit installieren, um die paketierte Anwendung auszuführen. Wenn ein Problem in einer Entwicklungsumgebung auftritt, gib bei einer Meldung bitte Betriebssystem, Architektur und relevante Anwendungslogs an.

**AppImage startet nicht:**

```bash
chmod +x WebRadio-*.AppImage
./WebRadio-*.AppImage --appimage-extract
./squashfs-root/AppRun
```

**Wayland-Kompatibilität:**

- Electron bietet nur eingeschränkte Wayland-Unterstützung.
- Verwende XWayland oder warte auf eine umfassendere Wayland-Unterstützung in Electron.

## Release-Prozess und Update-Kanäle

### Architektur des Aktualisierungssystems

WebRadio verwendet ein integriertes Aktualisierungssystem auf Basis von `electron-updater` und GitHub Releases.

Die aktuelle Aktualisierungsschicht besteht aus einem kleinen Kern und unterstützenden Modulen:

- **Repository:** `YourEliteSystems/WebRadio`
- **Kernmodule:**
  - `UpdateManager` – zentrale Steuerung, Status und Verwaltung der Update-Kanäle
  - `UpdateChannel` – Logik für stabile, Beta- und Alpha-Kanäle
  - `UpdateState` – aktueller Update-Status
  - `RuntimeDetector` – erkennt Betriebssystem, Architektur und Pakettyp
  - `ProviderFactory` – wählt den passenden Update-Anbieter aus
- **Anbieter:**
  - `WindowsUpdateProvider` – bindet `electron-updater` für Windows-Builds ein
  - `LinuxAppImageUpdateProvider` – für AppImageUpdate vorbereitet; derzeit mit GitHub-Fallback
  - `UnsupportedUpdateProvider` – für deb, Arch und andere Pakettypen ohne automatische Updates
- **Kanäle:**
  - **Stable** (`latest`): nur offizielle stabile Versionen (z. B. `v1.0.6`)
  - **Beta** (`beta`): stabile und Beta-Vorabversionen (z. B. `v1.0.6-beta.4`)
  - **Alpha** (`alpha`): Alpha-Vorabversionen, sofern verwendet
- **Release-Workflow:**
  - Der Release-Workflow setzt `UPDATE_CHANNEL` anhand des Git-Tags.
  - Der Build verwendet `electron-builder.yml` mit `channel: ${env.UPDATE_CHANNEL}`.
  - Builds verwenden `--publish=never` und laden Artefakte über `softprops/action-gh-release@v2` hoch.
  - Stable-/Beta-Metadaten werden nicht mehr künstlich zwischen Update-YAML-Dateien kopiert.
- **Sicherheit:**
  - Keine GitHub-Tokens oder Secrets im Client.
  - Bereinigte Release Notes.
  - Keine erzwungenen Neustarts.
  - Manuelle Bestätigung vor der Installation.

### Übersicht automatischer Updates nach Plattform

| Ziel | Automatische Updates | Mechanismus |
|---|---|---|
| **Windows (NSIS)** | ✅ Unterstützt | Download in der Anwendung und Installation im Hintergrund über NSIS (`latest.yml` / `beta.yml`) |
| **Linux AppImage** | 🧪 Vorbereitet | Download in der Anwendung und Austausch über den AppImage-Updater (`latest-linux.yml`); die automatische AppImage-Aktualisierung ist vorbereitet, aber noch nicht vollständig implementiert |
| **Linux deb** | ❌ Paketverwaltung | Nur Versionsprüfung; Installation über `apt`/`dpkg` |
| **Arch Linux (`.pkg.tar.zst`)** | ❌ Paketverwaltung | Nur Versionsprüfung; Installation über `pacman -U` |
| **macOS** | ❌ Nicht verfügbar | Derzeit kein unterstützter macOS-Release-Build und kein eigener Build-Befehl |

### Release-Workflow

1. Aktualisiere die Version in `package.json` auf die gewünschte semantische Version.
2. Erstelle und veröffentliche einen passenden Tag. Ersetze im Beispiel `X.Y.Z-beta.N` durch die exakte Version aus `package.json`:

   ```bash
   git tag vX.Y.Z-beta.N
   git push origin vX.Y.Z-beta.N
   ```

3. GitHub Actions ( `.github/workflows/release.yml` ) führt automatisch Folgendes aus:
   - Ermittelt den Release-Kontext anhand des Tags und von `package.json`.
   - Prüft, ob der Tag exakt mit `package.json` übereinstimmt.
   - Prüft die Version auf Einhaltung von SemVer.
   - Setzt `UPDATE_CHANNEL=beta`, `UPDATE_CHANNEL=alpha` oder `UPDATE_CHANNEL=latest`.
   - Erstellt Windows- und Linux-Artefakte mit `--publish=never`.
   - Erzeugt SHA256-Prüfsummen und Release Notes.
   - Veröffentlicht ein GitHub-Release und setzt bei Vorabversionen `prerelease: true`.

## Beiträge aus der Community

Wir freuen uns über Verbesserungen für einzelne Plattformen, zum Beispiel:

- bessere Integration in Desktopumgebungen
- plattformspezifische Optimierungen
- Übersetzungen und Lokalisierung
- plattformspezifische Plugins
