# Cross-Platform Setup Guide

This guide covers the setup and build process for different platforms.

## macOS status

macOS builds are **not currently published or supported as release downloads**. The repository's current npm scripts do not provide a dedicated `dist:mac` command, so the historical macOS build commands and code-signing examples have been removed from this guide.

If you want to help develop future macOS support, please open a GitHub issue or discussion first so the current packaging configuration, native dependencies, signing and release process can be assessed before promising support.

## Linux Support

### Prerequisites
- Node.js 26+
- npm 10+
- Build tools (for native modules)
- Arch-spezifisch (für .pkg.tar.zst): `pacman`, `makepkg`, `fakeroot`, `squashfs-tools`, `unzip`
- Oder: Docker (für Arch-Container-Build)

### Icon Setup

Linux requires PNG icons in various sizes. Wir liefern `assets/icons/tray.png`
in Standard-Auflösung aus; `electron-builder` und der `PKGBUILD` erzeugen
daraus automatisch die üblichen Hicon-Größen (16, 32, 48, 64, 128, 256, 512).

```bash
# Optional – manuell aus dem Quell-Icon ableiten:
convert assets/icons/tray.png -resize 16x16   assets/icons/icon-16.png
convert assets/icons/tray.png -resize 32x32   assets/icons/icon-32.png
convert assets/icons/tray.png -resize 48x48   assets/icons/icon-48.png
convert assets/icons/tray.png -resize 64x64   assets/icons/icon-64.png
convert assets/icons/tray.png -resize 128x128 assets/icons/icon-128.png
convert assets/icons/tray.png -resize 256x256 assets/icons/icon-256.png
convert assets/icons/tray.png -resize 512x512 assets/icons/icon-512.png
```

### Building for Linux

```bash
# AppImage + Arch-Paket (primär)
npm run make:linux

# Nur AppImage
npm run make:linux:appimage

# Nur Arch-Paket (.pkg.tar.zst)
npm run make:linux:arch

# AppImage + Arch + .deb
npm run make:linux:all
```

### Installation Methods

#### AppImage (Universal)
```bash
chmod +x WebRadio-*-linux-x86_64.AppImage
./WebRadio-*-linux-x86_64.AppImage
```

#### Debian/Ubuntu (`.deb`)

A `.deb` build script exists, but a `.deb` package is **not attached to every published release**. Only use this installation method when the selected [GitHub Release](https://github.com/YourEliteSystems/WebRadio/releases) actually includes a `.deb` asset.

```bash
sudo dpkg -i ./webradio_*_amd64.deb
sudo apt-get install -f   # ggf. fehlende Abhängigkeiten nachziehen
```

#### Arch Linux (offizielles Paket)
```bash
sudo pacman -U webradio-*-x86_64.pkg.tar.zst
```

Deinstallation:
```bash
sudo pacman -R webradio
```

### Linux Desktop Integration

The `.desktop` file at `assets/webradio.desktop` provides:
- Application menu integration
- Icon association
- Proper categorization (Audio/Video/Player/Network)
- GenericName + Keywords für Discoverability
- MimeType (x-scheme-handler/webradio)

`electron-builder` installiert die `.desktop`-Datei und das Icon
bei AppImage und .deb automatisch. Der `PKGBUILD` installiert sie
nach `/usr/share/applications` und `/usr/share/icons/hicolor`.

### Wayland Support

WebRadio is built on Electron, which provides limited native Wayland support. The actual display server behavior depends on your distribution and desktop environment.

**Current Status:**
- WebRadio runs on modern Linux desktop environments using either X11 or Wayland
- Electron/Chromium may use XWayland as a compatibility layer on Wayland-based systems
- No project-specific Wayland limitations are currently known

**Expected Behavior:**
- On Wayland-native desktops (GNOME 40+, KDE Plasma 5.20+ with Wayland session), WebRadio typically runs via XWayland
- On X11-based desktops, WebRadio runs natively on X11
- The specific behavior depends on your distribution's Electron package and configuration

**Known Considerations:**
- System tray integration may have limited functionality on pure Wayland sessions (depends on desktop environment)
- Window controls and behavior are consistent across X11 and XWayland
- Audio playback (ALSA/PulseAudio/PipeWire) works independently of display server

**No Configuration Required:**
WebRadio does not force specific Wayland or X11 flags. The application uses Electron's default behavior, which automatically adapts to your system's display server configuration.

If you experience display-related issues specific to your Wayland environment, please report them with details about your distribution and desktop environment.

### FFmpeg

`ffmpeg-static` liefert eine vorkompilierte Linux x86_64 Binary.
`electron-builder` entpackt sie über `asarUnpack` aus dem ASAR-Archiv,
damit der ELF-Binary beim Endanwender direkt ausgeführt werden kann.
Der Benutzer muss KEIN systemweites FFmpeg installieren.

## Platform-Specific Code

### Detecting Platform

```javascript
const { platform } = process;

if (platform === 'darwin') {
  // MacOS specific code
} else if (platform === 'linux') {
  // Linux specific code
} else if (platform === 'win32') {
  // Windows specific code
}
```

### Window Controls

MacOS has different window control behavior:

```javascript
// In renderer/App.jsx or window management
const isMacos = process.platform === 'darwin';

// MacOS uses native window controls, Windows/Linux use custom
{!isMacos && <CustomWindowControls />}
```

## Testing

### Automated Testing

The `npm test` script runs the project's configured automated test suite. It does not accept a platform selector; use real Windows or Linux environments for platform-specific manual checks.

```bash
npm test

# Optional: run static analysis
npm run lint
```

### Manual Testing Checklist

- [ ] App launches without errors
- [ ] Audio playback works correctly
- [ ] FFmpeg integration functions
- [ ] Plugin system loads plugins
- [ ] Theme system applies themes
- [ ] Window controls work properly
- [ ] System tray integration (if applicable)
- [ ] Auto-updater functions
- [ ] Settings persist correctly

## CI/CD Integration

The repository's current build and release workflows are the source of truth for automated builds. See [GitHub Actions workflows](https://github.com/YourEliteSystems/WebRadio/tree/main/.github/workflows) and the [Contributing Guide](https://github.com/YourEliteSystems/WebRadio/blob/main/CONTRIBUTING.md) rather than copying an independent workflow example that may drift from the project configuration.

## Troubleshooting

### macOS

macOS packages are not currently published. Do not treat the historical macOS signing and Gatekeeper notes as supported installation instructions.

### Linux Issues

**Audio playback or FFmpeg errors:**

Packaged builds bundle the FFmpeg binary. You normally do not need to install system-wide FFmpeg just to run the packaged application. For development builds, include the operating system, architecture and relevant application logs when reporting an issue.

**AppImage won't run:**
```bash
chmod +x WebRadio-*.AppImage
./WebRadio-*.AppImage --appimage-extract
./squashfs-root/AppRun
```

**Wayland compatibility:**
- Electron has limited Wayland support
- Use XWayland or wait for full Electron Wayland support

## Release Process & Update Channels

### Update System Architecture

WebRadio uses an integrated update system based on `electron-updater` and GitHub Releases.

The current update layer is organized as a small core with supporting modules:

- **Repository**: `YourEliteSystems/WebRadio`
- **Core modules**:
  - `UpdateManager` – central orchestration, state and channel handling.
  - `UpdateChannel` – stable/beta/alpha channel logic.
  - `UpdateState` – current update state.
  - `RuntimeDetector` – detects OS, architecture and packaging type.
  - `ProviderFactory` – selects the appropriate update provider.
- **Providers**:
  - `WindowsUpdateProvider` – wraps electron-updater for Windows builds.
  - `LinuxAppImageUpdateProvider` – prepared for AppImageUpdate, currently GitHub fallback.
  - `UnsupportedUpdateProvider` – used for deb, arch and other package types without automatic updates.
- **Channels**:
  - **Stable** (`latest`): Official stable versions only (e.g. `v1.0.6`).
  - **Beta** (`beta`): Stable and beta pre-releases (e.g. `v1.0.6-beta.4`).
  - **Alpha** (`alpha`): Alpha pre-releases when used.
- **Release workflow**:
  - The release workflow sets `UPDATE_CHANNEL` from the Git tag.
  - The build uses `electron-builder.yml` with `channel: ${env.UPDATE_CHANNEL}`.
  - Builds use `--publish=never` and upload artifacts via `softprops/action-gh-release@v2`.
  - Stable/Beta metadata is no longer copied artificially between update YAML files.
- **Safety**:
  - No GitHub tokens or secrets in the client.
  - Sanitized release notes.
  - No forced restarts.
  - Manual restart confirmation for installs.

### Platform Auto-Update Matrix

| Target | Auto-Update Capability | Mechanism |
|---|---|---|
| **Windows** (NSIS) | ✅ Supported | In-app download & background install via NSIS (`latest.yml` / `beta.yml`) |
| **Linux AppImage** | 🧪 Prepared | In-app download & replacement via AppImage updater (`latest-linux.yml`); automatic AppImage update tooling is prepared but not fully implemented |
| **Linux deb** | ❌ Package Manager | Version check only; installation managed via `apt`/`dpkg` |
| **Arch Linux** (`.pkg.tar.zst`) | ❌ Package Manager | Version check only; installation managed via `pacman -U` |
| **macOS** | ❌ Not available | No supported macOS release build or dedicated build script is currently provided |

### Release Workflow

1. Update the version in `package.json` to the intended semantic version.
2. Create and push a matching tag. For example, replace `X.Y.Z-beta.N` with the exact version from `package.json`:
   ```bash
   git tag vX.Y.Z-beta.N
   git push origin vX.Y.Z-beta.N
   ```
3. GitHub Actions (`.github/workflows/release.yml`) automatically:
   - Resolves the release context from the tag and `package.json`.
   - Validates that the tag matches `package.json` exactly.
   - Validates the version as SemVer.
   - Sets `UPDATE_CHANNEL=beta`, `UPDATE_CHANNEL=alpha` or `UPDATE_CHANNEL=latest`.
   - Builds Windows and Linux artifacts with `--publish=never`.
   - Generates SHA256 checksums and release notes.
   - Publishes a GitHub Release with `prerelease: true` for pre-releases.

## Community Contributions

We welcome platform-specific improvements:
- Better integration with desktop environments
- Platform-specific optimizations
- Translation and localization
- Platform-specific plugins
