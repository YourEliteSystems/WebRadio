# Windows Status

In WebRadio 1.0.7-alpha.1, the plugin-facing Windows service is **not** part of the current public Plugin API surface.

Plugins can contribute UI through:

* navigation entries
* UI registration

but they do not get a public `context.windows.create(...)` API in this release.

---

# Future Window Integration

A future SDK may introduce a window management API for plugin-dedicated windows.

Possible future concepts include:

* window creation with unique identifiers
* window show/hide/close lifecycle
* window focus management
* registration and cleanup tied to plugin lifecycle

These are planned ideas, not implemented APIs.

---

# Best Practices for Now

✔ Use only the currently documented plugin APIs.

✔ Do not assume plugin window creation exists.

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

# Window Options

Depending on the implementation, windows may support options such as:

* Width
* Height
* Minimum size
* Maximum size
* Resizable
* Centered
* Modal
* Always on top

Additional options may be introduced in future SDK versions.

---

# Window Communication

Plugin windows may communicate with the plugin through public APIs or IPC mechanisms provided by WebRadio.

Plugins should avoid direct communication with Electron internals.

---

# Error Handling

If a window cannot be created:

* The error is logged.
* The plugin continues running.
* Existing windows remain unaffected.

Window failures should not impact the stability of the application.

---

# Best Practices

✔ Reuse existing windows when possible.

✔ Keep windows responsive.

✔ Close unused windows.

✔ Store window state if appropriate.

✔ Use descriptive titles.

✔ Let the Window Manager control the lifecycle.

---

# Common Mistakes

Typical mistakes include:

* Opening duplicate windows.
* Forgetting to close windows.
* Creating oversized interfaces.
* Blocking the UI thread.
* Depending on Electron APIs directly.

Plugin windows should integrate seamlessly with the rest of the application.

---

# Related APIs

The Windows service commonly works together with:

* PluginContext
* Commands
* Menus
* Notifications
* ThemeManager

Windows provide the user interface, while Commands execute application logic.

---

# Example

```javascript
const settingsWindow = await context.windows.create({

    id: "plugin.settings",

    title: "Plugin Settings",

    width: 800,

    height: 600

});

await context.windows.show("plugin.settings");
```

---

# See Also

* PluginContext
* Commands
* Menus
* Notifications
* ThemeManager
* Application
