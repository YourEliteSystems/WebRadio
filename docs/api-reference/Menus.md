# Menus Status

In WebRadio 1.0.7-alpha.1, the plugin-facing Menus service is **not** part of the current public Plugin API surface.

The current plugin integration points for UI are:

* navigation (sidebar sections and items)
* UI registration

---

# Future Menu Integration

A future SDK may introduce a menu registration API that connects plugin actions to menus or commands.

Possible future concepts include:

* menu item registration with unique identifiers
* linking menu items to commands
* dynamic menu visibility
* automatic cleanup during plugin deactivation

These are planned ideas, not implemented APIs.

---

# Best Practices for Now

✔ Use only the currently documented plugin APIs.

✔ Do not assume menu or command registration exists.

✔ Watch the Plugin SDK and API Reference for future extension points.

---

# Related APIs

The current plugin extension model works together with:

* PluginContext
* Events
* Logger
* Navigation
* UI
* Player

---

# See Also

* PluginContext
* Navigation
* UI
* Player
* Capabilities & Plugin HTTP Environment


---

# Menu Structure

Menus may support nested items.

Example:

```text
Plugins

├── Example Plugin

│   ├── Settings

│   ├── Statistics

│   └── About
```

Nested menus improve organization.

---

# Commands

Menus should execute Commands instead of containing business logic.

```text
Menu Click

↓

Command

↓

Plugin Logic
```

This keeps the architecture modular and reusable.

---

# Visibility

Menu items may become visible only under certain conditions.

Examples:

* Plugin enabled
* Station selected
* Playback active
* Development mode

Visibility rules should be evaluated dynamically.

---

# Error Handling

If a menu cannot be registered:

* The error is logged.
* The plugin continues running.
* Other menu items remain available.

---

# Best Practices

✔ Keep menu titles concise.

✔ Use Commands for menu actions.

✔ Group related menu items.

✔ Remove menus during plugin shutdown.

✔ Avoid duplicate entries.

---

# Common Mistakes

Typical mistakes include:

* Embedding business logic inside menus.
* Registering duplicate identifiers.
* Forgetting to unregister menus.
* Creating deeply nested structures.
* Using unclear menu names.

Menus should remain intuitive and lightweight.

---

# Related APIs

The Menus service commonly works together with:

* Commands
* PluginContext
* Windows
* Notifications

Menus are responsible for presentation, while Commands execute the underlying functionality.

---

# Example

```javascript
context.menus.register({

    id: "plugin.settings",

    title: "Plugin Settings",

    command: "plugin.openSettings"

});
```

---

# See Also

* Commands
* Windows
* PluginContext
* Notifications
* Application
