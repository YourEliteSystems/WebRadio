# PluginContext

The `PluginContext` is the primary interface between a plugin and the WebRadio Core.

Every plugin receives exactly one `PluginContext` instance during construction.

Through this context, plugins gain controlled access to the public WebRadio API.

The PluginContext serves as the gateway to all supported services.

---

# Responsibilities

The PluginContext provides access to the public SDK while keeping the internal application architecture isolated.

Typical responsibilities include:

* Accessing core services
* Registering events
* Accessing persistent storage
* Logging
* Sending notifications
* Managing commands
* Working with themes
* Accessing application information

Plugins should use the PluginContext instead of accessing internal classes directly.

---

# Constructor

The PluginContext is created by WebRadio.

Plugins should never instantiate it manually.

Example:

```javascript
class HelloPlugin extends Plugin {

    constructor(context) {

        super(context);

    }

}
```

---

# Available Services

A PluginContext may expose the following services:

```text
context.logger

context.storage

context.settings

context.events

context.hooks

context.commands

context.notifications

context.windows

context.theme

context.application
```

Additional services may be introduced in future SDK versions.

---

# Logger

Provides access to the WebRadio logging system.

Example:

```javascript
context.logger.info("Plugin started.");

context.logger.warn("Something looks unusual.");

context.logger.error(error);
```

---

# Storage

Provides persistent plugin storage.

Example:

```javascript
await context.storage.set(

    "volume",

    50

);

const volume = await context.storage.get("volume");
```

Storage is isolated for each plugin.

---

# Settings

Accesses plugin settings.

Example:

```javascript
const language =

await context.settings.get("language");
```

Settings should be preferred over hardcoded configuration values.

---

# Events

Registers or emits application events.

Example:

```javascript
context.events.on(

    "station.changed",

    handler

);
```

Plugins should unregister listeners during shutdown.

---

# Hooks

Allows plugins to extend application behaviour.

Example:

```javascript
context.hooks.register(

    "player.beforePlay",

    callback

);
```

Hooks enable safe extensibility without modifying core code.

---

# Commands

Registers custom commands.

Example:

```javascript
context.commands.register({

    id: "hello",

    execute() {

        console.log("Hello");

    }

});
```

Commands can later be used by menus, shortcuts or plugins.

---

# Notifications

Displays notifications to the user.

Example:

```javascript
context.notifications.info(

    "Station added."

);
```

Notifications should provide meaningful feedback.

---

# Windows

Provides access to plugin windows.

Example:

```javascript
context.windows.create({

    title: "Plugin Settings"

});
```

Future SDK versions may provide additional window management features.

---

# Theme

Allows interaction with the Theme SDK.

Possible use cases include:

* Reading active theme
* Reacting to theme changes
* Requesting theme information

Plugins should never modify themes directly.

---

# Application

Provides basic application information.

Examples include:

* Version
* Platform
* Development mode

Application internals remain inaccessible.

---

# Best Practices

✔ Use the PluginContext exclusively.

✔ Never access internal modules directly.

✔ Keep service usage minimal.

✔ Clean up registered resources.

✔ Prefer documented APIs.

---

# Common Mistakes

Typical mistakes include:

* Accessing internal classes.
* Modifying core objects.
* Forgetting to unregister listeners.
* Storing global state.
* Bypassing the PluginContext.

Using only the PluginContext keeps plugins compatible with future releases.

---

# Related APIs

The PluginContext commonly interacts with:

* Plugin
* Application
* Storage
* Logger
* Events
* Hooks
* Commands
* Notifications
* ThemeManager

---

# See Also

* Plugin
* PluginManager
* Application
* Storage
* Logger
* Events
* Hooks
* Commands
* Notifications
* ThemeManager
