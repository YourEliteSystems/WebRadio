# Notifications Status

In WebRadio 1.0.7-alpha.1, the plugin-facing Notifications service is **not** part of the current public Plugin API surface.

Although `notifications` is listed as a valid plugin permission in the current permission set, there is no public `context.notifications` API exposed to plugins in this release.

That means:

* a plugin may declare the permission
* a plugin should not rely on a working `context.notifications` object
* a plugin should not build UX around plugin-triggered notifications in this release

---

# Planned Concept

A future SDK may introduce a notifications API for plugin-initiated user feedback.

Possible future concepts include:

* informational, success, warning and error notification types
* concise, actionable messages
* separate technical logging via the Logger
* cleanup and deduplication behavior

These are planned ideas, not implemented APIs.

---

# Best Practices for Now

✔ Use only the currently documented plugin APIs.

✔ Do not assume plugin notifications exist.

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
* Logger
* Navigation
* UI
* Player
* Capabilities & Plugin HTTP Environment
