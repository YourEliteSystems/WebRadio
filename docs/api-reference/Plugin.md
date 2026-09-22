# Plugin Surface

In WebRadio 1.0.7-alpha.1, the plugin-facing surface is the object exported by a plugin entry point and the `context` passed to it.

Plugins should integrate through the public Plugin API rather than by extending a prescribed plugin class.

---

# Responsibilities

A plugin is responsible for:

* initializing its own runtime behavior
* registering the resources it wants to expose
* cleaning up listeners and registrations during shutdown
* using only the public Plugin API

Plugins should focus only on their own functionality.

---

# Lifecycle Overview

A plugin follows a predictable lifecycle.

```text id="l7dh82"
Discovered

↓

Validated

↓

Loaded

↓

Enabled

↓

Running

↓

Disabled

↓

Unloaded
```

Every plugin passes through these stages.

---

# Plugin Entry Point

The plugin entry point is the main file referenced by the manifest.

The exact export shape used by the current runtime is documented in the Plugin SDK and Plugin API reference.

Plugins should not assume a fixed class hierarchy.

---

# Properties

## context

Provides access to the public WebRadio services available to the plugin.

Example:

```javascript id="u6h4pj"
context
```

Available services are documented in **PluginContext.md**.

---

## manifest

Returns the plugin manifest information.

Example:

```javascript id="p8v2ts"
manifest.name

manifest.version

manifest.author
```

The manifest is loaded before the plugin starts.



---

# Error Handling

Lifecycle methods should throw errors only when necessary.

Unexpected exceptions should be logged and handled gracefully.

WebRadio may disable plugins that repeatedly fail during startup.

---

# Best Practices

✔ Keep startup fast.

✔ Register everything during `onEnable()`.

✔ Release everything during `onDisable()`.

✔ Keep plugin state inside the plugin.

✔ Avoid global variables.

✔ Log meaningful messages.

✔ Clean up all resources before unloading.

---

# Common Mistakes

Common problems include:

* Forgetting to unregister event listeners.
* Leaving timers running.
* Blocking the startup process.
* Throwing uncaught exceptions.
* Storing application state globally.

Proper cleanup improves application stability.

---

# Related APIs

The Plugin class commonly interacts with:

* PluginContext
* Events
* Hooks
* Storage
* Logger
* Commands
* Notifications
* Windows

---

# See Also

* PluginContext
* PluginManager
* Application
* Events
* Storage
* Logger
