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

### Icon Setup

Linux requires PNG icons in various sizes:

```bash
# Create icon sizes using ImageMagick:
convert assets/icons/tray.png -resize 16x16 assets/icons/icon-16.png
convert assets/icons/tray.png -resize 32x32 assets/icons/icon-32.png
convert assets/icons/tray.png -resize 48x48 assets/icons/icon-48.png
convert assets/icons/tray.png -resize 64x64 assets/icons/icon-64.png
convert assets/icons/tray.png -resize 128x128 assets/icons/icon-128.png
convert assets/icons/tray.png -resize 256x256 assets/icons/icon-256.png
convert assets/icons/tray.png -resize 512x512 assets/icons/icon-512.png
```

### Building for Linux

```bash
# Build AppImage (universal Linux)
npm run dist:linux

# Build .deb (Debian/Ubuntu)
npm run dist:linux -- --linux deb

# Build .rpm (Fedora/RHEL)
npm run dist:linux -- --linux rpm
```

### Installation Methods

#### AppImage (Universal)
```bash
chmod +x WebRadio-1.0.5-linux.AppImage
./WebRadio-1.0.5-linux.AppImage
```

#### Debian/Ubuntu
```bash
sudo dpkg -i webradio_1.0.5_amd64.deb
sudo apt-get install -f  # Fix dependencies if needed
```

#### Fedora/RHEL
```bash
sudo rpm -i webradio-1.0.5.x86_64.rpm
```

#### Arch Linux (AUR)
```bash
# From AUR (once published)
yay -S webradio

# Or manually from PKGBUILD
cd assets/
makepkg -si
```

### Linux Desktop Integration

The `.desktop` file at `assets/webradio.desktop` provides:
- Application menu integration
- Icon association
- Proper categorization (Audio/Video)

Install it system-wide:
```bash
sudo cp assets/webradio.desktop /usr/share/applications/
sudo cp assets/icons/tray.png /usr/share/icons/hicolor/256x256/apps/webradio.png
sudo update-desktop-database
```

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

## Release Process

1. Update version in package.json
2. Test on all platforms
3. Create git tag: `git tag v1.1.0`
4. Push tag: `git push origin v1.1.0`
5. GitHub Actions will build all platforms
6. Download and test artifacts
7. Create GitHub Release
8. Publish to AUR (for Arch)
9. Update documentation

## Community Contributions

We welcome platform-specific improvements:
- Better integration with desktop environments
- Platform-specific optimizations
- Translation and localization
- Platform-specific plugins
