# Package System

The Package System provides an optional installation and management layer for plugins and themes. It is strictly separated from the runtime discovery and execution system.

**Version:** 2.0  
**Applies to:** WebRadio v1.0.7+

---

# Architecture Principles

The Package System is designed around one fundamental principle:

> **Installation is not Runtime.**

This means:

* Package installation is optional – plugins and themes can still be installed manually
* The runtime discovery works independently of the Package Registry
* `install.json` is for installation metadata only, not required for runtime
* Manually installed extensions are fully functional without a registry entry
* The Package System manages installations; the Plugin/Theme Managers manage execution

---

# Architecture Overview

```text
┌─────────────────────────────────────────────┐
│           INSTALLATION / MANAGEMENT          │
│                                             │
│  PackageSource                              │
│      ↓                                      │
│  PackageManager                             │
│      ↓                                      │
│  PackageDiscovery                           │
│      ↓                                      │
│  PackageValidator                           │
│      ↓                                      │
│  PackageInstaller                           │
│      ↓                                      │
│  PackageRegistry                            │
│                                             │
└─────────────────────┬───────────────────────┘
                      │
                      │ Filesystem
                      ▼
              userData/plugins
              userData/themes
                      │
                      │
┌─────────────────────┴───────────────────────┐
│                 RUNTIME                     │
│                                             │
│  PluginLoader / ThemeLoader                  │
│      ↓                                      │
│  Manifest Validation                         │
│      ↓                                      │
│  PluginManager / ThemeManager                │
│      ↓                                      │
│  Runtime                                     │
│                                             │
└─────────────────────────────────────────────┘
```

The only shared boundary between installation and runtime is the installed filesystem and valid package structure.

---

# Installation Phase

## Components

### PackageDiscovery

Inspects packages without installing them.

**API:**

```javascript
const info = await PackageDiscovery.inspect(sourcePath);
// Returns: { id, type, version, manifestPath, installManifestPath, sourcePath, valid }
```

### PackageValidator

Validates packages and manifests.

**API:**

```javascript
await PackageValidator.validate(manifest, type);
await PackageValidator.validateSource(sourcePath);
```

**Validates:**

* Package structure
* Package type
* Manifest fields
* ID, version, name
* Permissions
* Capabilities
* Security constraints (path traversal, absolute paths)

### PackageInstaller

Installs, updates, and removes packages.

**API:**

```javascript
await PackageInstaller.install(sourcePath, type, options);
await PackageInstaller.update(packageId, sourcePath, type, options);
await PackageInstaller.remove(packageId, options);
```

**Does NOT:**

* Load or execute plugin code
* Start runtime
* Invoke PluginManager or ThemeManager directly

### PackageRegistry

Manages metadata for installed packages.

**Stores:**

* Package ID
* Type
* Version
* Installation path (relative to userData)
* Source (local, future: GitHub, HTTP, Store)
* Enabled/disabled state
* Installation/update timestamps

**Does NOT:**

* Serve as runtime discovery source
* Filter which plugins are loaded at runtime

### PackageManager

Orchestrates the installation flow.

**Flow:**

```text
resolve source
    ↓
discovery
    ↓
validation
    ↓
installation
    ↓
registry update
```

**Provides runtime callbacks:**

```javascript
PackageManager.setRuntimeCallbacks({
  onPackageInstalled: (package) => { /* notify runtime */ },
  onPackageUpdated: (package) => { /* notify runtime */ },
  onPackageRemoved: (package) => { /* notify runtime */ }
});
```

---

# Runtime Phase

## Components

### PluginLoader

Discovers plugins from the filesystem.

**Discovery sources:**

* `userData/plugins/` – user plugins
* `app/plugins/` – app-bundled plugins (development/resources)

**Manifest priority:**

1. `install.json` → uses `manifest` field to find the actual manifest
2. `plugin.json` – legacy plugin manifest
3. `manifest.json` – generic manifest
4. Fallback to directory name

**NO dependency on:** PackageManager, PackageRegistry

### ThemeLoader

Discovers themes from the filesystem.

**Discovery sources:**

* `userData/themes/` – user themes
* `app/themes/` – app-bundled themes

**Manifest priority:**

1. `install.json` → uses `manifest` field
2. `theme.json` – legacy theme manifest

**NO dependency on:** PackageManager, PackageRegistry

### PluginManager / ThemeManager

Manage runtime lifecycle of plugins and themes.

**Responsibilities:**

* Load plugins/themes discovered by loaders
* Start/stop runtime
* Track runtime state
* Handle plugin configuration

**NO dependency on:** PackageRegistry for discovery

---

# Installation Paths

## User Packages

```text
userData/
├── plugins/
│   └── <plugin-id>/
│       ├── plugin.json (or manifest.json)
│       ├── main.js
│       └── ...
├── themes/
│   └── <theme-id>/
│       ├── theme.json
│       ├── style.css
│       └── ...
└── package-data/
    └── registry.json
```

## Package Targets

```javascript
const PACKAGE_TARGETS = {
  plugin: "plugins",
  theme: "themes"
};
```

The installation target is determined by the package type and cannot be freely specified by the caller.

## Registry Paths

The registry stores paths **relative to userData**:

```json
{
  "id": "com.example.myplugin",
  "type": "plugin",
  "path": "plugins/com.example.myplugin",
  "version": "1.2.0"
}
```

**NOT allowed:**

* Absolute paths
* Paths outside `userData/plugins/` or `userData/themes/`
* Paths in `package-data/`
* App directory paths

---

# install.json

The optional `install.json` describes installation metadata.

**Example:**

```json
{
  "schemaVersion": 1,
  "package": {
    "id": "com.example.myplugin",
    "type": "plugin"
  },
  "manifest": "plugin.json",
  "installation": {
    "mode": "managed"
  }
}
```

**Fields:**

* `schemaVersion` – must be `1`
* `package.id` – package identifier
* `package.type` – `"plugin"` or `"theme"`
* `manifest` – filename of the actual manifest
* `installation.mode` – must be `"managed"`

**Runtime behavior:**

* PluginLoader and ThemeLoader can read `install.json` to find the manifest
* But they **do not require** it
* Missing `install.json` does not prevent runtime discovery

---

# Supported Manifests

## Plugin Manifests

* `plugin.json` – primary plugin manifest
* `manifest.json` – generic manifest
* `webradio.json` – generic WebRadio manifest (if `type: "plugin"` or has `main` field)

## Theme Manifests

* `theme.json` – primary theme manifest
* `webradio.json` – generic WebRadio manifest (if `type: "theme"` or has `css` field)

---

# Installation Workflow

```text
Package
    ↓
PackageDiscovery.inspect()
    ↓
PackageValidator.validateSource()
    ↓
PackageValidator.validate(manifest)
    ↓
PackageInstaller.install()
    ↓
Determine target (plugins/ or themes/)
    ↓
Copy files to userData/plugins/<id> or userData/themes/<id>
    ↓
PackageRegistry.addOrUpdate()
    ↓
Emit package:installed event
    ↓
Runtime callback (if registered)
```

**Important:** Installation does **not** automatically start the plugin/theme.

---

# Update Workflow

```text
validate
    ↓
backup existing
    ↓
install new version
    ↓
verify
    ↓
registry update
    ↓
restore backup on failure
```

**Important:** Updates only affect packages recorded as package-managed. Manually copied extensions are not overwritten.

---

# Removal Workflow

```text
Registry lookup
    ↓
Validate recorded path
    ↓
Ensure package-managed installation
    ↓
Remove package-owned files/directory
    ↓
Update/remove registry entry
```

**Important:** Only registry-managed installations are removed. Arbitrary/manual packages are not deleted.

---

# Package States vs Runtime States

## Package States (Installation)

* `not-installed`
* `installed`
* `enabled`
* `disabled`
* `update-available`
* `error`

## Runtime States (Execution)

* `discovered`
* `loading`
* `loaded`
* `starting`
* `running`
* `stopping`
* `stopped`
* `error`

These states are **not mixed**. A package can be:

* `installed: true`, `enabled: false`, `running: false`
* `installed: true`, `enabled: true`, `running: false` (during startup)
* `installed: true`, `enabled: true`, `running: true`

---

# Security

## Path Traversal Protection

The system validates all paths to prevent:

* `../` directory traversal
* Absolute paths outside allowed directories
* Symlink escapes
* Arbitrary directory installation

## Allowed Installation Targets

Only `userData/plugins/` and `userData/themes/` are valid installation targets.

**Rejected:**

* App directory paths
* `package-data/` directory
* Arbitrary system paths
* Relative paths with traversal artifacts

## Manifest Path Validation

Manifest fields like `main`, `renderer`, and `css` must be relative paths without traversal.

---

# Installation Scenarios

## Developer Workflow

```text
Plugin develop
    ↓
plugin.json
    ↓
plugins/ (manual or via PackageManager)
    ↓
PluginLoader discovers
    ↓
Runtime
```

## Manual Installation

```text
Plugin download
    ↓
Copy to userData/plugins/
    ↓
PluginLoader discovers
    ↓
Runtime
```

## Package Installation

```text
Package
    ↓
PackageManager
    ↓
Validation
    ↓
Installation
    ↓
Registry
    ↓
userData/plugins/
    ↓
PluginLoader discovers
    ↓
Runtime
```

## Future Store Integration

```text
WebRadio Store
    ↓
Package Source
    ↓
PackageManager
    ↓
Installation
    ↓
userData/plugins/
    ↓
PluginLoader discovers
    ↓
Runtime
```

All paths lead to the same runtime system.

---

# Events

## Package Events

* `package:discover`
* `package:validated`
* `package:installing`
* `package:installed`
* `package:updating`
* `package:updated`
* `package:removing`
* `package:removed`
* `package:enabled`
* `package:disabled`
* `package:error`

## Runtime Events

* `plugin:discovered`
* `plugin:loading`
* `plugin:loaded`
* `plugin:starting`
* `plugin:started`
* `plugin:stopping`
* `plugin:stopped`
* `plugin:error`

Events are **not mixed**. `package:installed` does **not** automatically trigger `plugin:started`.

---

# IPC API

## Package Management

```javascript
window.webRadio.packages.list()
window.webRadio.packages.install(...)
window.webRadio.packages.update(...)
window.webRadio.packages.remove(...)
window.webRadio.packages.enable(...)
window.webRadio.packages.disable(...)
```

## Runtime

```javascript
window.webRadio.plugins.list()
window.webRadio.plugins.get(...)
```

The renderer **never** gets direct filesystem access. All path and manifest validation stays in the main process.

---

# Best Practices

✔ **For Package Developers:**

* Always provide a valid manifest
* Use `install.json` for installation metadata
* Follow package type conventions
* Test installation and removal

✔ **For Plugin/Theme Developers:**

* Your plugin/theme works without `install.json`
* Test manual installation by copying to `userData/plugins/` or `userData/themes/`
* Don't depend on Package Registry for runtime functionality

✔ **For Core Developers:**

* Never make PluginLoader/ThemeLoader depend on PackageRegistry
* Keep installation and runtime strictly separated
* Validate all paths before filesystem operations
* Emit appropriate events for each phase

---

# Future Extensions

The architecture is designed to support:

* Remote sources (GitHub, HTTP, WebRadio Store)
* Package dependencies
* Version constraints
* Rollback functionality
* Update notifications
* Package marketplace integration

All of these can be added without modifying the runtime system.

---

# Related Documentation

* [Architecture Overview](readme.md)
* [PluginManager](07-PluginManager.md)
* [ThemeManager](06-ThemeManager.md)
* [StorageManager](02-StorageManager.md)
* [Plugin SDK](../plugin-sdk/README.md)
* [Theme SDK](../theme-sdk/README.md)
