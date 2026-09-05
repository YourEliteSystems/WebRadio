# Cross-Platform Setup Guide

This guide covers the setup and build process for different platforms.

## MacOS Support

### Prerequisites
- MacOS 10.15 (Catalina) or later
- Xcode Command Line Tools
- Node.js 20+
- npm 10+

### Icon Setup

MacOS requires `.icns` format icons. Convert your existing `.ico` file:

```bash
# On MacOS:
# 1. Create iconset directory
mkdir -p assets/icons/tray.iconset

# 2. Convert icon to different sizes (requires ImageMagick or similar)
# You can use online converters or tools like:
# - https://cloudconvert.com/ico-to-icns
# - iconutil (built-in MacOS tool)

# 3. Using iconutil (if you have the individual PNGs):
iconutil -c icns assets/icons/tray.iconset -o assets/icons/tray.icns
```

### Building for MacOS

```bash
# Build DMG for Intel (x64)
npm run dist:mac

# Build for Apple Silicon (arm64) - requires MacOS with Apple Silicon
npm run dist:mac -- --mac --arm64

# Build universal binary (requires both architectures)
npm run dist:mac -- --mac --universal
```

### MacOS-Specific Features

- **Window Controls**: MacOS uses native window controls (red/yellow/green buttons)
- **Menu Bar**: Integration with MacOS menu bar
- **Code Signing**: Required for distribution outside App Store

### Code Signing

```bash
# Install electron-builder code-signing tools
npm install --save-dev @electron/osx-sign

# Add to electron-builder.yml:
mac:
  identity: "Developer ID Application: Your Name"
```

## Linux Support

### Prerequisites
- Node.js 20+
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

#### Debian/Ubuntu
```bash
sudo dpkg -i webradio_*_amd64.deb
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

```bash
# Add platform-specific tests
npm test -- --platform=linux
npm test -- --platform=macos
npm test -- --platform=windows
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

### GitHub Actions Example

```yaml
name: Build Multi-Platform

on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm install
      - run: npm run build
      
      - run: npm run dist
        if: matrix.os == 'windows-latest'
      
      - run: npm run dist:mac
        if: matrix.os == 'macos-latest'
      
      - run: npm run dist:linux
        if: matrix.os == 'ubuntu-latest'
      
      - uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-build
          path: dist/*
```

## Troubleshooting

### MacOS Issues

**"App is damaged" error:**
- This is a Gatekeeper issue
- Right-click → Open → Accept
- Or disable Gatekeeper for testing: `sudo spctl --master-disable`

**Code signing errors:**
- Ensure you have a valid Apple Developer certificate
- Check certificate identity in electron-builder.yml

### Linux Issues

**Missing dependencies:**
```bash
# Install FFmpeg
sudo apt-get install ffmpeg  # Debian/Ubuntu
sudo dnf install ffmpeg       # Fedora
sudo pacman -S ffmpeg         # Arch
```

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

### Update System v1 Architecture

WebRadio uses an integrated update system based on `electron-updater` and GitHub Releases:

- **Repository**: `YourEliteSystems/WebRadio`
- **Channels**:
  - **Stable** (`latest`): Only official stable versions (e.g. `v1.0.5`, `v1.0.6`).
  - **Beta** (`beta`): Pre-releases and stable versions (e.g. `v1.0.6-beta.1`, `v1.0.6-beta.2`). Users receive a clear warning before activating Beta.
- **Downgrade Support**: Beta users can switch back to Stable at any time; `allowDowngrade` ensures that a stable release is accepted even if the beta version string is numerically higher.
- **Auto-Check**: Optional toggle in Settings (`updates.autoCheckOnStart`). Checked on app startup (debounced by 4s) and throttled to once every 6 hours.
- **Safety**: No GitHub tokens or secrets in the client, sanitized release notes, no forced restarts (`autoInstallOnAppQuit` / manual restart confirmation).

### Platform Auto-Update Matrix

| Target | Auto-Update Capability | Mechanism |
|---|---|---|
| **Windows** (NSIS) | ✅ Supported | In-app download & background install via NSIS (`latest.yml` / `beta.yml`) |
| **Linux AppImage** | ✅ Supported | In-app download & replacement via AppImage updater (`latest-linux.yml`) |
| **Linux deb** | ✅ Supported | In-app download & update (`latest-linux.yml`) |
| **Arch Linux** (`.pkg.tar.zst`) | ❌ Package Manager | Version check only; installation managed via `pacman -U` |
| **macOS** | 🟡 Prepared | electron-builder config ready; requires macOS signing for distribution |

### Release Workflow

1. Update version in `package.json` (e.g. `1.0.6` for Stable or `1.0.6-beta.2` for Beta).
2. Create and push tag:
   ```bash
   git tag v1.0.6-beta.2
   git push origin v1.0.6-beta.2
   ```
3. GitHub Actions (`.github/workflows/release.yml`) automatically:
   - Detects whether the tag is a pre-release (`-beta.*`).
   - Sets `UPDATE_CHANNEL=beta` or `UPDATE_CHANNEL=latest`.
   - Builds artifacts and update manifests (`latest*.yml` / `beta*.yml`).
   - Generates SHA256 checksums and release notes.
   - Publishes GitHub Release with `prerelease: true` for beta tags.

## Community Contributions

We welcome platform-specific improvements:
- Better integration with desktop environments
- Platform-specific optimizations
- Translation and localization
- Platform-specific plugins
