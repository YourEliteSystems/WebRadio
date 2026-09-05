# Plugin Lifecycle

Every WebRadio plugin follows a well-defined lifecycle.

Understanding this lifecycle is essential for developing reliable, predictable and maintainable plugins.

The PluginManager ensures that every plugin passes through the same sequence of stages before it becomes available to the application.

---

# Overview

A plugin is never executed immediately after it is discovered.

Instead, it progresses through several stages.

```text
Plugin Folder

↓

Discovery

↓

Manifest Validation

↓

Registration

↓

Loading

↓

Initialization

↓

Running

↓

Shutdown

↓

Unload
```

Each stage has a specific responsibility.

---

# Discovery

The PluginLoader scans the configured plugins directory.

Each subdirectory is treated as a potential plugin.

Example:

```text
plugins/

├── DiscordRPC/
├── LastFM/
├── Visualizer/
└── HelloWorld/
```

Directories without a valid `manifest.json` are ignored.

---

# Manifest Validation

Once a plugin has been discovered, its manifest is validated.

Validation checks include:

* Required fields
* JSON syntax
* Version format
* Entry file
* Duplicate plugin IDs
* API compatibility

Plugins that fail validation are skipped.

No plugin code is executed during validation.

---

# Registration

After successful validation, the plugin is registered.

Registration stores plugin metadata inside the PluginRegistry.

At this stage the plugin is known to WebRadio but is **not yet running**.

---

# Loading

During loading, the PluginRuntime imports the plugin's entry file.

Example:

```text
index.js
```

If loading fails, the plugin is marked as failed and the error is reported through the Diagnostics subsystem.

---

# Initialization

After the plugin has been loaded successfully, WebRadio calls:

```javascript
async onEnable(context)
```

This is where the plugin should:

* initialize resources,
* register events,
* create UI components,
* connect to services,
* prepare internal state.

Initialization should complete quickly.

Long-running operations should execute asynchronously.

---

# Running

After initialization, the plugin enters the running state.

The plugin can now:

* receive events,
* access public APIs,
* interact with the user,
* respond to application changes.

This is the normal operating state.

---

# Shutdown

When WebRadio exits or the plugin is disabled, the PluginRuntime calls:

```javascript
async onDisable()
```

Plugins should use this method to:

* remove event listeners,
* stop timers,
* close network connections,
* save state,
* release resources.

---

# Unloading

After shutdown, the plugin is unloaded.

All references should be released to allow proper garbage collection.

A plugin should never continue executing after it has been unloaded.

---

# Lifecycle Diagram

```text
Discovery
     │
     ▼
Validation
     │
     ▼
Registration
     │
     ▼
Loading
     │
     ▼
onEnable()
     │
     ▼
Running
     │
     ▼
onDisable()
     │
     ▼
Unload
```

Every plugin follows this exact sequence.

---

# Error Handling

Errors may occur during any lifecycle stage.

Typical examples include:

* Invalid manifest
* Missing entry file
* Syntax errors
* Exceptions during initialization
* Runtime failures

Whenever possible, the PluginManager isolates plugin failures so they do not affect the WebRadio Core or other plugins.

---

# Design Principles

## Predictability

Every plugin follows the same lifecycle.

---

## Stability

A failing plugin should never crash the application.

---

## Isolation

Plugins are managed independently.

One plugin should not interfere with another.

---

## Reliability

Each lifecycle stage has a clearly defined purpose.

---

# Best Practices

✔ Keep `onEnable()` fast.

✔ Clean up everything in `onDisable()`.

✔ Handle exceptions gracefully.

✔ Avoid global state.

✔ Release all resources before shutdown.

✔ Treat plugins as independent modules.

---

# Reloading

A plugin can be reloaded while WebRadio is running.

Reloading is primarily intended for development and debugging and is
triggered manually – it does **not** happen automatically.

There are two reload operations with clearly distinct scope:

## Single Plugin

```text
reloadPlugin(id)
   ↓
PluginRuntime.stop()  → destroy()  → cleanup listeners/navigation
   ↓
PluginRuntime.start() → init()
```

## Global Discovery Rescan

Triggered by the **"Plugins neu laden"** button. Performs a full
discovery-rescan of the plugin directory and reconciles the runtime
state with the current filesystem.

```text
reloadPlugins()
   ↓
discover() → compare with currently loaded plugins
   ↓
new plugins           → start()
changed plugins       → stop() + start()
removed plugins       → stop()
disabled (config)     → stop()
unchanged plugins     → keep current state
```

For the full behaviour and return value, see
[`PluginManager.reloadPlugins()`](../api-reference/PluginManager.md#reloadplugins).

The plugin's `destroy()` is called before `init()` again when a plugin
is reloaded individually or detected as changed by the rescan.

---

# Common Mistakes

Typical lifecycle issues include:

* Starting timers without stopping them.
* Leaving event listeners registered.
* Opening connections without closing them.
* Performing heavy work during startup.
* Throwing uncaught exceptions.

These issues can lead to memory leaks or unstable plugin behavior.

---

# Next Step

Continue with **Plugin Context** to learn how plugins interact with WebRadio through the context object provided during initialization.
