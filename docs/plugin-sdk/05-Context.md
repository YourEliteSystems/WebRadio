# Plugin Context

When a plugin is enabled, WebRadio passes a **Plugin Context** object to the plugin.

The context provides access to the public Plugin SDK and acts as the primary interface between plugins and the WebRadio Core.

Plugins should always use the provided context instead of accessing internal application components directly.

---

# Purpose

The Plugin Context provides a secure and stable API for plugin developers.

Instead of exposing internal application objects, WebRadio exposes only the functionality intended for public use.

This improves:

* Stability
* Security
* Compatibility
* Maintainability

---

# Receiving the Context

The context is passed to the plugin during initialization.

Example:

```javascript id="q2m6hk"
module.exports = {

    async onEnable(context) {

        this.context = context;

    }

};
```

The context should be stored if it is needed later.

---

# What the Context Provides

Depending on the SDK version, the context may provide access to:

```text id="te3k6w"
Context

├── Storage
├── Events
├── Hooks
├── Logger
├── Settings
├── UI
├── Notifications
└── Utilities
```

Additional APIs may be introduced in future WebRadio releases.

---

# Storage

Provides access to plugin-specific persistent data.

Example:

```javascript id="c5t9zf"
await context.storage.set("volume", 75);

const value =
    await context.storage.get("volume");
```

Each plugin has its own isolated storage area.

---

# Events

Plugins can subscribe to application events.

Example:

```javascript id="s4m8qp"
context.events.on(
    "stationChanged",
    station => {

        console.log(station.name);

    }
);
```

Events allow plugins to react to application activity.

---

# Hooks

Hooks allow plugins to extend or modify application behavior.

Example:

```javascript id="g7y2xr"
context.hooks.register(
    "beforePlayback",
    callback
);
```

Unlike events, hooks can actively participate in application workflows.

---

# Logger

Plugins should use the provided logger instead of `console.log()`.

Example:

```javascript id="m1n5vb"
context.logger.info(
    "Plugin initialized."
);
```

Using the shared logger ensures consistent diagnostics and log formatting.

---

# Settings

Plugins may expose configurable settings through the Settings API.

Example:

```javascript id="n9r4lu"
const enabled =
    await context.settings.get(
        "enabled"
    );
```

Settings are managed independently from plugin storage.

---

# UI

Plugins may contribute user interface elements.

Examples include:

* Sidebar pages
* Settings pages
* Toolbar buttons
* Dialogs

UI integration is covered in a dedicated chapter.

---

# Notifications

Plugins may display notifications to the user.

Example:

```javascript id="h8w3ye"
context.notifications.show({

    title: "Plugin",

    message: "Operation completed."

});
```

Notification behavior depends on the operating system and future SDK capabilities.

---

# Best Practices

✔ Use only the public context API.

✔ Store the context if needed.

✔ Avoid accessing internal application objects.

✔ Keep plugins independent from implementation details.

✔ Expect new context features in future SDK versions.

---

# Design Principles

## Stable Interface

The Plugin Context represents the official public API.

---

## Encapsulation

Internal application components remain hidden.

---

## Extensibility

New APIs can be added without breaking existing plugins.

---

## Isolation

Every plugin receives its own context instance.

---

# Future APIs

Future versions of WebRadio may extend the context with:

* Network utilities
* Theme integration
* Package management
* Background tasks
* Scheduler
* Localization
* Permission services

These additions will remain backwards compatible whenever possible.

---

# Next Step

Continue with **Storage** to learn how plugins can safely store and retrieve persistent data.
