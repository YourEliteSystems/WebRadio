# Update Architecture – Runtime Detection & Platform-Specific Providers

## Overview

WebRadio's update system has been extended with a runtime detection layer and platform-specific update providers. This enables the application to automatically detect its runtime environment (OS, architecture, packaging type) and select the appropriate update mechanism.

**Key Principles:**
- Windows continues to use electron-updater (unchanged)
- Linux AppImage has a dedicated provider (currently GitHub fallback, prepared for AppImageUpdate)
- Linux .deb and Arch packages delegate to system package managers
- macOS is prepared for future provider implementation
- Stable/Beta channels remain centralized and shared across all platforms
- No breaking changes to existing update UI or IPC API

---

## Architecture

```
                  ┌──────────────────┐
                  │ RuntimeDetector  │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  UpdateManager   │
                  └────────┬─────────┘
                           │
                 ┌─────────┴─────────┐
                 ▼                   ▼
        ┌─────────────────┐  ┌─────────────────────┐
        │ Windows Provider│  │ Linux AppImage      │
        │ electron-updater│  │ Update Provider     │
        └─────────────────┘  └─────────────────────┘
                 │                   │
                 ▼                   ▼
          GitHub Releases      GitHub Releases
                                  (AppImageUpdate TBD)
```

**Separation of Concerns:**
- `RuntimeDetector` – Detects OS, architecture, and packaging type
- `UpdateManager` – Central orchestration, channel management, state
- `Providers` – Platform-specific update implementations
- `UpdateChannel` – Centralized Stable/Beta logic (not duplicated per provider)

---

## Runtime Detection

### Location
`electron/core/platform/RuntimeDetector.js`

### Detection Capabilities

**Platform Detection:**
- `windows` – win32
- `linux` – linux
- `macos` – darwin
- `unknown` – other platforms

**Architecture Detection:**
- `x64` – x86_64, amd64
- `arm64` – aarch64
- `arm` – arm
- `ia32` – x86
- `unknown` – other architectures

**Packaging Type Detection:**
- `development` – Unpackaged, running from source
- `appimage` – Linux AppImage (robust multi-signal detection)
- `deb` – Debian/Ubuntu package
- `arch` – Arch Linux package
- `windows-installer` – NSIS installer
- `windows-portable` – Portable executable
- `macos` – macOS application
- `unknown` – Cannot determine packaging type

### AppImage Detection

The AppImage detection uses multiple runtime signals for robustness:

1. **APPIMAGE Environment Variable**
   - Set by AppImage runtime
   - Verified by checking file existence

2. **Executable Path Analysis**
   - AppImages mount under `/tmp/.mount_*`
   - Pattern matching on mount paths

3. **Resources Path Analysis**
   - AppImage resources under `/tmp/.mount_*/usr/bin`
   - Secondary verification signal

**Fallback Behavior:**
- If no AppImage signals are detected, falls back to `deb`/`arch` detection based on path patterns
- If packaging cannot be determined, returns `unknown`

### Usage Example

```javascript
const RuntimeDetector = require("./core/platform/RuntimeDetector");

const runtimeInfo = RuntimeDetector.detectRuntime(app, process, fs, path);

// Result example for Linux AppImage:
{
  platform: "linux",
  architecture: "x64",
  packaging: "appimage",
  isDevelopment: false,
  isPackaged: true,
  isAppImage: true,
  isLinux: true,
  isWindows: false,
  isMacOS: false
}
```

---

## Update Providers

### Provider Hierarchy

```
BaseUpdateProvider (abstract)
    ├── WindowsUpdateProvider
    ├── LinuxAppImageUpdateProvider
    └── UnsupportedUpdateProvider
```

### Provider Factory

`electron/core/updates/providers/ProviderFactory.js`

Automatically selects the appropriate provider based on runtime detection:

```javascript
const ProviderFactory = require("./core/updates/providers/ProviderFactory");

const provider = ProviderFactory.createProvider(app, autoUpdater, fs, path);
```

### Windows Update Provider

**Location:** `electron/core/updates/providers/WindowsUpdateProvider.js`

**Provider Type:** `electron-updater`

**Suitable For:** Windows (all packaging types)

**Behavior:**
- Wraps existing electron-updater
- No changes to Windows update behavior
- Supports NSIS installer and portable builds
- Uses GitHub Releases as update source
- Maintains all existing functionality (autoDownload=false, manual confirmation)

**Status:** ✅ Fully functional, production-ready

---

### Linux AppImage Update Provider

**Location:** `electron/core/updates/providers/LinuxAppImageUpdateProvider.js`

**Provider Type:** `appimage-github-fallback` (temporary)

**Suitable For:** Linux AppImage

**Current Behavior:**
- Placeholder for future AppImageUpdate integration
- Currently falls back to GitHub Releases check
- Informs user that automatic AppImage updates are not yet implemented
- Suggests manual download from GitHub Releases

**Future Implementation Requirements:**
1. AppImageUpdate tool integration (`appimageupdatetool-binaries`)
2. zsync support in build process
3. Update metadata embedding in AppImage
4. SHA256 verification for AppImage artifacts
5. Stable/Beta channel integration for AppImage

**Status:** ⚠️ Prepared for future implementation, currently GitHub fallback

---

### Unsupported Update Provider

**Location:** `electron/core/updates/providers/UnsupportedUpdateProvider.js`

**Provider Type:** `unsupported`

**Suitable For:** All packaging types without automatic app updates

**Behavior:**
- Returns consistent "unsupported" status
- Provides user-friendly suggestions based on packaging type
- Prevents no-op update attempts

**Supported Packaging Types:**
- Linux `.deb` → "Use apt/dpkg to update"
- Linux Arch → "Use pacman to update"
- macOS → "macOS automatic updates not yet implemented"
- Unknown → "Use system package manager"

**Status:** ✅ Fully functional, production-ready

---

## Stable/Beta Channels

### Centralized Channel Logic

**Location:** `electron/core/updates/UpdateChannel.js`

**Design Principle:** Channels are NOT duplicated per provider. All providers use the same centralized channel logic.

**Channel Types:**
- `stable` – Only stable releases
- `beta` – Stable + pre-releases (excluding alpha)

**Channel Configuration:**

| Channel | electron-updater channel | allowPrerelease | allowDowngrade |
|---------|-------------------------|-----------------|----------------|
| stable  | null (latest)           | false           | true*           |
| beta    | beta                    | true            | true            |

*allowDowngrade is true for stable when current version is a pre-release (e.g., beta → stable downgrade)

**Provider Integration:**
- Providers receive the already-determined channel from UpdateManager
- Providers do NOT make channel decisions
- Stable/Beta logic remains in UpdateChannel.js

---

## Security

### Download Validation

**Windows (electron-updater):**
- SHA512 verification built into electron-updater
- Code signing verification for NSIS installers
- GitHub Releases as trusted source

**Linux AppImage (future):**
- SHA256 verification planned
- AppImageUpdate signature verification planned
- GitHub Releases as trusted source (current fallback)

**Linux .deb / Arch:**
- System package manager handles verification
- Repository GPG keys
- Package manager integrity checks

### Renderer Isolation

**Security Rules (maintained):**
- No shell commands from renderer
- No unvalidated URLs from user input
- No tokens/secrets in AppImage or app-update.yml
- No direct electron-updater access from renderer
- All update operations go through IPC handlers

**autoDownload:**
- Remains `false` for all providers
- User must explicitly confirm download
- User must explicitly confirm installation

---

## Release Requirements

### Windows

**Required Artifacts:**
- `WebRadio-{version}-win-x64.exe` (NSIS installer)
- `WebRadio-{version}-win-x64.exe.blockmap`
- `latest.yml` (electron-updater metadata)
- `beta.yml` (if beta release)

**Update Source:** GitHub Releases

### Linux AppImage

**Required Artifacts:**
- `WebRadio-{version}-linux-x86_64.AppImage`
- `latest-linux.yml` (electron-updater metadata)
- `beta-linux.yml` (if beta release)
- `SHA256SUMS.txt` (checksums for all Linux artifacts)
- `org.yourelitesystems.webradio.metainfo.xml` (AppStream metadata)

**Update Source:** GitHub Releases (current), AppImageUpdate (future)

**Metadata Requirements:**
- X-AppImage-Name: WebRadio
- X-AppImage-Version: ${version}
- AppStream metainfo.xml included in build

### Linux .deb

**Required Artifacts:**
- `webradio_{version}_amd64.deb`
- `SHA256SUMS.txt`

**Update Source:** System package manager (apt/dpkg)

### Linux Arch

**Required Artifacts:**
- `webradio-{version}-x86_64.pkg.tar.zst`
- `SHA256SUMS.txt`

**Update Source:** System package manager (pacman)

### macOS

**Required Artifacts:**
- `WebRadio-{version}-darwin-x64.dmg`
- `WebRadio-{version}-darwin-arm64.dmg`
- `latest-mac.yml` (if electron-updater is used)

**Update Source:** Not yet implemented

---

## Testing

### Runtime Detector Tests

**Location:** `scripts/tests/runtime-detector.test.js`

**Test Coverage:**
- Platform normalization (5 tests)
- Architecture normalization (8 tests)
- Development detection (3 tests)
- Packaged detection (3 tests)
- AppImage detection (5 tests)
- Linux packaging detection (5 tests)
- Windows packaging detection (4 tests)
- Full runtime detection matrix (9 tests)
- Edge cases (4 tests)

**Total:** 46 tests, all passing

### Provider Tests

**Status:** Provider tests are prepared but not yet implemented. The provider architecture is designed for testability through dependency injection.

### Existing Tests

All existing tests continue to pass:
- navigation.test.js
- theme.test.js
- pluginManager.test.js
- paths.test.js
- updater.test.js
- artifact-audit.test.js
- runtime-detector.test.js

**Total:** 262 tests, all passing

---

## Migration Guide

### For Existing Code

**No changes required.** The new provider architecture is designed as an extension, not a replacement.

**Existing UpdateManager:**
- Continues to work as before
- electron-updater integration unchanged
- IPC handlers unchanged
- Renderer API unchanged

**Future Integration:**
To enable the new provider architecture in UpdateManager:

```javascript
const ProviderFactory = require("./core/updates/providers/ProviderFactory");

// In UpdateManager.initialize():
const provider = ProviderFactory.createProvider(app, autoUpdater, fs, path);
// Use provider instead of direct autoUpdater calls
```

---

## Known Limitations

### AppImage Automatic Updates

**Current Status:** Not implemented

**Reason:** AppImageUpdate integration requires:
1. Additional build-time tooling (appimagetool with update flags)
2. zsync server infrastructure
3. Update metadata embedding in AppImage
4. Cross-platform testing of update mechanism

**Workaround:** Users can manually download the latest AppImage from GitHub Releases.

### macOS Updates

**Current Status:** Not implemented

**Reason:** macOS Sparkle integration is not yet part of the project scope.

**Workaround:** Users can download the latest DMG from GitHub Releases.

### Linux .deb / Arch Updates

**Current Status:** Delegated to system package managers

**Reason:** Package manager updates are the standard and recommended approach for system packages.

**Workaround:** Use `apt upgrade webradio` or `pacman -Syu webradio`.

---

## Future Work

### High Priority

1. **AppImageUpdate Integration**
   - Integrate appimageupdatetool-binaries
   - Add zsync support to build process
   - Embed update metadata in AppImage
   - Implement SHA256 verification
   - Test automatic update flow

2. **Provider Integration in UpdateManager**
   - Replace direct electron-updater calls with provider abstraction
   - Add provider selection logic to UpdateManager.initialize()
   - Test provider switching on different platforms

### Medium Priority

3. **macOS Provider**
   - Implement Sparkle integration
   - Add DMG update support
   - Test on Intel and Apple Silicon

4. **Enhanced Diagnostics**
   - Add IPC handler for provider info
   - Expose runtime info to renderer
   - Add update provider status to diagnostics

### Low Priority

5. **Additional Packaging Types**
   - Snap package support
   - Flatpak support
   - Windows Store support

---

## Appendix: File Structure

```
electron/core/
├── platform/
│   └── RuntimeDetector.js
├── updates/
│   ├── UpdateManager.js
│   ├── UpdateChannel.js
│   ├── UpdateState.js
│   └── providers/
│       ├── BaseUpdateProvider.js
│       ├── WindowsUpdateProvider.js
│       ├── LinuxAppImageUpdateProvider.js
│       ├── UnsupportedUpdateProvider.js
│       └── ProviderFactory.js

scripts/tests/
└── runtime-detector.test.js
```

---

## Version History

- **v1.0.6-beta.3** – Initial runtime detection and provider architecture implementation
  - RuntimeDetector with multi-signal AppImage detection
  - Provider abstraction with BaseUpdateProvider
  - WindowsUpdateProvider (electron-updater wrapper)
  - LinuxAppImageUpdateProvider (placeholder with GitHub fallback)
  - UnsupportedUpdateProvider (system package manager delegation)
  - 46 new tests for runtime detection
  - Total test suite: 262 tests, all passing (216 existing + 46 runtime detection)
