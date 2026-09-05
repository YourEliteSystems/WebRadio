# PluginManager

The `PluginManager` is responsible for discovering, validating, loading and managing all plugins installed in WebRadio.

It serves as the central coordinator of the Plugin System and ensures that every plugin follows the expected lifecycle.

The PluginManager is initialized by the `Application` during startup.

---

# Responsibilities

The PluginManager is responsible for:

* Discovering installed plugins
* Loading plugin manifests
* Validating plugin metadata
* Creating plugin instances
* Managing plugin lifecycle
* Enabling and disabling plugins
* Unloading plugins
* Tracking plugin state
* Providing information about installed plugins

The PluginManager ensures a stable and predictable plugin environment.

---

# Lifecycle

The PluginManager manages the complete lifecycle of every plugin.

```text
Plugin Directory

↓

Plugin Discovery

↓

Manifest Loading

↓

Manifest Validation

↓

Plugin Creation

↓

Plugin Loading

↓

Plugin Enabled

↓

Plugin Running

↓

Plugin Disabled

↓

Plugin Unloaded
```

Every plugin follows this lifecycle.

---

# Constructor

The PluginManager is created internally by WebRadio.

Plugins should never instantiate a PluginManager themselves.

Example:

```javascript
const pluginManager = new PluginManager();
```

Normally, plugins access the Plugin System through the `PluginContext` instead of interacting directly with the PluginManager.

---

# Methods

## discoverPlugins()

Searches the configured plugin directory for available plugins.

### Syntax

```javascript
const plugins = await pluginManager.discoverPlugins();
```

### Returns

```javascript
Array<PluginManifest>
```

Only plugins containing a valid `manifest.json` are returned.

---

## loadPlugins()

Loads every discovered plugin.

### Syntax

```javascript
await pluginManager.loadPlugins();
```

This method performs:

* Manifest loading
* Validation
* Instance creation
* Plugin registration

Plugins are not considered active until they have been enabled.

---

## enablePlugin()

Enables a plugin.

### Syntax

```javascript
await pluginManager.enablePlugin(pluginId);
```

This method calls the plugin's `onEnable()` lifecycle method.

---

## disablePlugin()

Disables a running plugin.

### Syntax

```javascript
await pluginManager.disablePlugin(pluginId);
```

This method invokes `onDisable()` before marking the plugin as inactive.

---

## unloadPlugin()

Removes a plugin from memory.

### Syntax

```javascript
await pluginManager.unloadPlugin(pluginId);
```

Before unloading, `onUnload()` is called to allow the plugin to release any remaining resources.

---

## reloadPlugin()

Reloads a single, already-known plugin without restarting WebRadio.

### Syntax

```javascript
await pluginManager.reloadPlugin(pluginId);
```

A reload performs the following sequence:

```text
Disable

↓

Unload

↓

Load

↓

Enable
```

Reloading is primarily intended for development and debugging.

> **See also:** [`reloadPlugins()`](#reloadplugins) for the global
> discovery-rescan that detects new, changed or removed plugins in the
> plugin directory.

---

## reloadPlugins()

Performs a global **discovery-rescan** of the plugin directory and
reconciles the runtime state with the current filesystem state.

This is the method triggered by the **"Plugins neu laden"** button in
the settings UI.

### Syntax

```javascript
const result = pluginManager.reloadPlugins();
```

### Behaviour

The rescan performs the following steps:

1. Re-scan the plugin directory via `PluginLoader.discoverPlugins()`.
2. Compare the discovered plugins with the currently loaded ones
   (matched by `manifest.id`).
3. Detect changes using a stable fingerprint of each plugin
   (manifest fields + plugin path + main file).
4. Treat plugins that are no longer present as removed.
5. Honour the `enabled` flag from `userData/plugins/plugins.json`.
6. Start, restart or stop plugins as required using the existing
   `PluginRuntime.start()` / `PluginRuntime.stop()` lifecycle.
7. Emit a `plugins:changed` event on the eventBus and broadcast
   `plugins:changed` via IPC to all renderer windows.

A plugin that fails during start or stop is logged via the existing
`LogManager` and the rescan continues with the remaining plugins.

### Returns

```javascript
{
    success: true | false,
    added:    ["plugin-id", ...],   // newly discovered
    removed:  ["plugin-id", ...],   // no longer present
    changed:  ["plugin-id", ...],   // fingerprint differed
    unchanged:["plugin-id", ...],   // already loaded and identical
    disabled: ["plugin-id", ...],   // loaded before, now disabled in config
    errors:   [{ id, error }, ...]  // per-plugin start/stop failures
}
```

### Differences from `reloadPlugin(id)`

| Concern | `reloadPlugin(id)` | `reloadPlugins()` |
| --- | --- | --- |
| Scope | single plugin | entire plugin directory |
| Discovery | no | yes |
| Detects new plugins | no | yes |
| Detects removed plugins | no | yes |
| Detects manifest changes | only if you call it after the change | yes, via fingerprint |
| Result | boolean | structured report |

### Atomicity

If a plugin fails to start after its old version has been stopped,
the plugin is left in the unloaded state. The old instance is **not**
re-started, to prevent duplicate event listeners or navigation entries.

---

## getPlugin()

Returns a plugin by its unique identifier.

### Syntax

```javascript
const plugin = pluginManager.getPlugin(pluginId);
```

### Returns

```javascript
Plugin | undefined
```

---

## getPlugins()

Returns every registered plugin.

### Syntax

```javascript
const plugins = pluginManager.getPlugins();
```

### Returns

```javascript
Array<Plugin>
```

---

## hasPlugin()

Checks whether a plugin is installed.

### Syntax

```javascript
pluginManager.hasPlugin(pluginId);
```

### Returns

```javascript
Boolean
```

---

# Plugin States

A plugin may exist in one of the following states.

```text
Discovered

Loaded

Enabled

Disabled

Unloaded

Failed
```

The current state reflects where the plugin is within its lifecycle.

---

# Validation

Before loading a plugin, the PluginManager validates:

* Plugin ID
* Plugin version
* Manifest structure
* Entry file
* SDK compatibility
* Dependencies (future)

Invalid plugins are skipped and reported through the logging system.

---

# Error Handling

If a plugin fails to load:

* The error is logged.
* The plugin is marked as failed.
* Remaining plugins continue loading.

A single faulty plugin should not prevent WebRadio from starting.

---

# Best Practices

✔ Validate every plugin before loading.

✔ Continue loading when one plugin fails.

✔ Keep plugin states synchronized.

✔ Log meaningful startup errors.

✔ Ensure plugins clean up their resources before unloading.

✔ Never expose internal PluginManager state directly.

---

# Common Mistakes

Typical implementation issues include:

* Skipping manifest validation.
* Loading plugins twice.
* Forgetting to call lifecycle methods.
* Leaving disabled plugins in an inconsistent state.
* Stopping startup because of a single faulty plugin.

The PluginManager should remain resilient even when plugins fail.

---

# Related APIs

The PluginManager works closely with:

* Application
* Plugin
* PluginContext
* PluginLoader
* PluginValidator
* Storage
* Logger

Together these components form the WebRadio Plugin System.

---

# Example

```javascript
await pluginManager.loadPlugins();

const plugins = pluginManager.getPlugins();

console.log(plugins.length);
```

---

# See Also

* Application
* Plugin
* PluginContext
* PluginLoader
* PluginValidator
* Logger
* Storage
