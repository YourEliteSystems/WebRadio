# Plugin

The `Plugin` class is the foundation of every WebRadio plugin.

Every plugin should extend this class to integrate with the WebRadio Plugin SDK.

The Plugin API provides lifecycle methods that allow WebRadio to load, start, stop and unload plugins safely.

---

# Responsibilities

The Plugin class represents a single plugin instance.

Its responsibilities include:

* Plugin initialization
* Startup logic
* Shutdown logic
* Resource cleanup
* Access to the PluginContext
* Responding to lifecycle events

Plugins should focus only on their own functionality.

---

# Lifecycle

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

# Constructor

## Syntax

```javascript id="f4wp8s"
class MyPlugin extends Plugin {

    constructor(context) {

        super(context);

    }

}
```

The constructor receives a `PluginContext` instance.

---

# Properties

## context

Provides access to all public WebRadio services.

Example:

```javascript id="u6h4pj"
this.context
```

Available services are documented in **PluginContext.md**.

---

## manifest

Returns the plugin manifest information.

Example:

```javascript id="p8v2ts"
this.manifest.name

this.manifest.version

this.manifest.author
```

The manifest is loaded before the plugin starts.

---

# Lifecycle Methods

## onLoad()

Called immediately after the plugin has been loaded.

### Syntax

```javascript id="w9ec4m"
async onLoad() {

}
```

Use this method to prepare internal resources.

---

## onEnable()

Called when the plugin becomes active.

### Syntax

```javascript id="m3yk7r"
async onEnable() {

}
```

Typical tasks include:

* Register commands
* Register events
* Create windows
* Initialize services

---

## onDisable()

Called before the plugin is disabled.

### Syntax

```javascript id="e5ph2j"
async onDisable() {

}
```

Use this method to:

* Remove listeners
* Save data
* Stop timers
* Close resources

---

## onUnload()

Called before the plugin is unloaded from memory.

### Syntax

```javascript id="k2rb6q"
async onUnload() {

}
```

Perform final cleanup operations here.

---

# Example

```javascript id="x7qm1d"
class HelloPlugin extends Plugin {

    async onEnable() {

        this.context.logger.info(

            "Hello Plugin started."

        );

    }

}
```

---

# Plugin Lifecycle Example

```text id="c5j0ah"
Load Plugin

↓

onLoad()

↓

onEnable()

↓

Plugin Running

↓

onDisable()

↓

onUnload()
```

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
