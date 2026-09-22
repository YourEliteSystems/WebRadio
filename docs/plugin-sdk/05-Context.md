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

# What the Context Provides (1.0.7-alpha.1)

In WebRadio 1.0.7-alpha.1, the public plugin context provides:

```text id="te3k6w"
Context

├── plugin
├── version
├── logger
├── events
├── storage
├── settings
├── ui
├── navigation
├── httpOrigin
└── player
```

Additional APIs may be introduced in future WebRadio releases.

In this release there is **no** `context.hooks`, `context.commands`, `context.notifications` and `context.windows` as public plugin APIs.

---

# Storage

Provides access to plugin-specific persistent data.

In WebRadio 1.0.7-alpha.1, the plugin-facing Storage API is synchronous and operates on a plugin's isolated storage file.

Example:

```javascript id="c5t9zf"
if (!context.storage.exists()) {

    context.storage.set("volume", 75);

}

const value = context.storage.get("volume");
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

        context.logger.info(station.name);

    }
);
```

Events allow plugins to react to application activity.

---

# Hooks

Hooks are **not** part of the current plugin-facing context in WebRadio 1.0.7-alpha.1.

Plugins should not rely on `context.hooks` in this release.

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

Plugins can read and write selected global settings through `context.settings`.

In WebRadio 1.0.7-alpha.1, the plugin-facing Settings API is synchronous.

Example:

```javascript id="n9r4lu"
const enabled = context.settings.get("enabled");
```

Settings are managed independently from plugin storage.

---

# Navigation and UI

Plugins may contribute user interface elements through:

* navigation (sidebar sections and items)
* UI registration

These are the current public UI integration points for plugins.

---

# Notifications

Notifications are **not** part of the current plugin-facing context in WebRadio 1.0.7-alpha.1.

Even though `notifications` may appear in the current permission set, there is no public `context.notifications` API to use in this release.

---

# Best Practices

✔ Use only the public context API.

✔ Store the context if needed.

✔ Avoid accessing internal application objects.

✔ Keep plugins independent from implementation details.

✔ Do not assume future context features already exist.

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
