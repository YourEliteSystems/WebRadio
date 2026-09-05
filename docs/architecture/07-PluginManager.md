# PluginManager

The `PluginManager` is responsible for discovering, loading, validating, managing and controlling all plugins available to WebRadio.

Plugins extend the functionality of WebRadio without requiring modifications to the core application.

The PluginManager serves as the central entry point for the complete plugin ecosystem.

---

# Responsibilities

The PluginManager is responsible for:

* Discovering installed plugins
* Loading plugin manifests
* Validating plugins
* Registering plugins
* Starting plugins
* Stopping plugins
* Tracking plugin state
* Providing plugin information

The PluginManager coordinates the plugin lifecycle but does not implement plugin functionality itself.

---

# Architecture

The PluginManager delegates responsibilities to several specialized components.

```text
PluginManager

├── PluginLoader
├── PluginValidator
├── PluginRegistry
└── PluginRuntime
```

Each component performs one specific task within the plugin lifecycle.

---

# Plugin Lifecycle

Every plugin follows the same lifecycle.

```text
Discover Plugin Folder

↓

Read manifest.json

↓

Validate Manifest

↓

Register Plugin

↓

Plugin Available

↓

Start Plugin

↓

Running

↓

Stop Plugin
```

This lifecycle ensures that every plugin behaves consistently.

---

# Plugin Discovery

During startup, the PluginLoader scans the configured plugins directory.

Example:

```text
plugins/

├── DiscordRPC/
│   ├── manifest.json
│   ├── index.js
│   └── assets/
│
├── LastFM/
│   ├── manifest.json
│   └── index.js
│
└── Visualizer/
```

Each directory represents exactly one plugin.

Only directories containing a valid `manifest.json` are considered plugins.

---

# Plugin Validation

Before a plugin is registered, the PluginValidator verifies its manifest.

Typical validation includes:

* Plugin ID
* Name
* Version
* Entry file
* Author
* API compatibility
* Required fields

Invalid plugins are skipped and reported through the Diagnostics subsystem.

---

# Plugin Registration

Successfully validated plugins are registered in the PluginRegistry.

The registry maintains a list of all available plugins and their metadata.

Registration does not automatically start a plugin.

---

# Plugin Runtime

The PluginRuntime controls the execution of plugins.

Typical responsibilities include:

* Starting plugins
* Stopping plugins
* Reloading plugins
* Tracking plugin status
* Error handling

The runtime isolates execution management from plugin discovery and validation.

---

# Plugin States

A plugin can exist in several states.

```text
Discovered

↓

Registered

↓

Loaded

↓

Running

↓

Disabled

↓

Stopped
```

These states provide predictable lifecycle management.

---

# Plugin Rescan (Discovery)

The `PluginManager` exposes two reload entry points:

* `reloadPlugin(id)` – targeted reload of a single known plugin.
* `reloadPlugins()`  – global discovery-rescan of the plugin
  directory. This is the implementation behind the
  **"Plugins neu laden"** UI button.

## Reload a Single Plugin

```text
reloadPlugin(id)
   ↓
disable(id)    → PluginRuntime.stop()
   ↓
enable(id)     → PluginRuntime.start()
```

## Reload All Plugins

```text
reloadPlugins()
   ↓
PluginLoader.discoverPlugins()      ← re-scan directory
   ↓
compare discovered vs loaded plugins
   ↓
new plugins           → PluginRuntime.start()
changed plugins       → PluginRuntime.stop() + start()
removed plugins       → PluginRuntime.stop()
disabled (config)     → PluginRuntime.stop()
unchanged plugins     → keep current state
   ↓
emit "plugins:changed" via eventBus + IPC
```

The rescan never deletes listener or navigation entries belonging to
a plugin that stays loaded – those are removed exclusively by the
existing `PluginRuntime.stop()` path.

See also [`PluginManager.reloadPlugins()`](../api-reference/PluginManager.md#reloadplugins).

---

# Why a Dedicated PluginManager?

Without a dedicated PluginManager:

* plugins would require manual loading,
* lifecycle management would be inconsistent,
* plugin validation would be duplicated,
* runtime behavior would become difficult to maintain.

A centralized PluginManager ensures that every plugin follows the same workflow.

---

# Design Principles

## Extensibility

Plugins should extend WebRadio without modifying the core.

---

## Isolation

Plugins should operate independently whenever possible.

A failure in one plugin should not affect the entire application.

---

## Validation First

Every plugin must be validated before execution.

---

## Predictable Lifecycle

Every plugin follows the same loading sequence.

---

## Separation of Responsibilities

Discovery, validation, registration and execution are handled by separate components.

---

# Best Practices

✔ Always provide a valid `manifest.json`.

✔ Keep plugin resources inside the plugin directory.

✔ Handle errors gracefully.

✔ Clean up resources during shutdown.

✔ Avoid modifying application internals directly.

✔ Use only the public Plugin API.

---

# Future Improvements

Future versions of the PluginManager may introduce:

* Plugin dependency resolution
* Version compatibility checks
* Hot reloading
* Sandboxed execution
* Permission system
* Plugin marketplace integration

---

# Related Documentation

* Architecture
* Application
* ThemeManager
* StorageManager
* Plugin SDK
* Plugin Manifest
* Plugin Runtime
