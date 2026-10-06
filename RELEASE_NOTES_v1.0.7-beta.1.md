# WebRadio v1.0.7-beta.1 Release Notes

## 🚀 Major Package Architecture Refactoring

This release introduces a major architectural refactoring to strictly separate package installation from runtime discovery and execution.

### 📦 Package System Changes

**New Components:**
- **PackageDiscovery** - Inspect packages without installation
- **Enhanced PackageValidator** - Source-level validation and security checks
- **Fixed PackageRegistry** - Resolved naming conflicts and improved path handling
- **Fixed PackageInstaller** - Delegates validation, removed runtime coupling
- **Fixed PackageManager** - Corrected install base directory to userData

**Runtime Independence:**
- PluginLoader and ThemeLoader now ignore `install.json` for runtime discovery
- Runtime discovery works independently of PackageRegistry
- Manually installed plugins/themes work without registry entries
- Package installation does not automatically start/stop runtime components

**Architecture Principles:**
- Installation is not Runtime
- Registry is not Runtime-Discovery
- `install.json` is not the Runtime-Manifest
- Manually installed extensions are full runtime extensions
- PackageManager manages packages; PluginLoader/PluginRuntime manage execution

### 📚 Documentation

- Added comprehensive Package System documentation (`docs/architecture/11-PackageSystem.md`)
- Updated architecture readme with package system principles
- Configured ReadTheDocs for native versioning (removed mike dependency)
- Updated README with official Discord link: https://discord.gg/6PfkRNYw
- Updated README with ReadTheDocs URL: https://webradio.readthedocs.io/de/latest/

### 📊 New Features

**Download Statistics:**
- Download statistics system with GitHub API integration
- Automated download stats update workflow (daily cron at 03:17 UTC)
- `docs/downloads.json` and `docs/DOWNLOAD_STATS.md` for release statistics
- GitHub workflow `.github/workflows/download-stats.yml`

### 🧪 Testing

All package system tests passing:
- package-system.test.js: 20/20 ✅
- package-architecture.test.js: 28/28 ✅
- package-integration.test.js: 12/12 ✅

Runtime verified to work without PackageRegistry.

### 🐛 Bug Fixes

- Fixed ThemeLoader test to validate install.json ignoring behavior
- Fixed PackageRegistry naming conflict (packageDataPath property vs method)
- Fixed PackageInstaller to use FilesPolicy for path validation
- Fixed PluginManager to include plugin runtime in application shutdown

### 🔧 Internal Changes

- Enhanced RadioProvider and StreamManager with session and command IDs for improved diagnostics
- Enhanced radioAPI to accept station parameter in startStream
- Updated roadmap with upcoming milestones and future ideas

---

## Installation

### Windows
- Download `WebRadio-1.0.7-beta.1-win-x64.exe` or `WebRadio-1.0.7-beta.1-portable.exe`

### Linux
- Download `WebRadio-1.0.7-beta.1-linux-x86_64.AppImage` or `.deb` package
- Arch Linux: `WebRadio-1.0.7-beta.1-linux-x86_64.pkg.tar.zst`

### macOS
- Download `WebRadio-1.0.7-beta.1-dmg` (x64 or arm64)

---

## Upgrade Notes

**For Plugin Developers:**
- Plugins work with or without install.json
- Runtime manifests (plugin.json, theme.json) are the only source for runtime behavior
- install.json is optional and only used for package installation
- Manually copied plugins to userData/plugins/ work without registry

**For Users:**
- Package system is optional for runtime
- Manually installed plugins/themes work without registry
- Package installation does not automatically start plugins
- Enable/disable is separate from installed/not-installed state

---

## Known Issues

None.

---

## Full Changelog

```
89e4f4c - Release v1.0.7-beta.1: Package Architecture Refactoring
9821255 - test: enforce runtime manifest separation
1cf2997 - refactor: isolate theme runtime manifest from package install metadata
bc3a8f5 - refactor: isolate plugin runtime manifest from package install metadata
4f7c8e0 - fix: include plugin runtime in application shutdown
ccfad28 - docs: update release download statistics
e49394d - docs: publish initial download statistics
1bcf4db - docs: add initial download statistics
65adbb0 - docs: add download statistics to README
5641074 - chore: add download statistics script
8356d36 - ci: automate release download statistics
a77b2dc - feat: add release download statistics generator
445a203 - docs: add Discord link to README for community engagement
b8be2ad - docs: update documentation for ReadTheDocs integration and remove mike references
6d97011 - docs: update architecture guide and add versioning documentation
4e9388d - docs: update roadmap with upcoming milestones and future ideas
3a09f3e - Refactor package validation and discovery logic
1b6e459 - docs: update roadmap for plugin package architecture
46ba0b2 - feat: enhance radioAPI to accept station parameter in startStream
8847b62 - feat: Add session and command IDs for improved diagnostics in RadioProvider and StreamManager
```

---

**Download:** [GitHub Releases](https://github.com/YourEliteSystems/WebRadio/releases/tag/v1.0.7-beta.1)
**Documentation:** [ReadTheDocs](https://webradio.readthedocs.io/de/latest/)
**Discord:** [Join our Discord](https://discord.gg/6PfkRNYw)
