# Hooks Status

In WebRadio 1.0.7-alpha.1, the plugin-facing Hooks service is **not** part of the current public Plugin API surface.

The current plugin extension points are:

* events
* navigation
* UI registration
* the Player API (where permitted)
* the HTTP Origin API (where permitted)

---

# Future Extension Points

Hooks are a planned architectural concept for future SDK versions.

If a future SDK introduces hooks, it may provide extension points such as:

* player.beforePlay
* player.afterPlay
* station.beforeChange
* station.afterChange
* theme.beforeApply
* theme.afterApply

These names are illustrative and not yet committed.

---

# Best Practices for Now

✔ Use only the currently documented plugin APIs.

✔ Do not assume hook callbacks exist.

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
* Events
* Navigation
* UI
* Player
* Capabilities & Plugin HTTP Environment
