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

The PluginContext exposes a controlled subset of the public SDK. Optional services can require additional manifest permissions and capabilities.

The current plugin-facing surface includes:

```text
context.plugin

context.version

context.logger

context.events

context.storage

context.settings

context.navigation

context.ui

context.httpOrigin

context.player

context.mediaControls (requires `media-control` + `media-controls`)

context.webSession (requires `web-session`; media methods additionally `web-session-media`)
```

Additional services may be introduced in future SDK versions.

For the exact shape of the current API, plugins should rely on the Plugin API documentation rather than assuming future services.

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

# Navigation Extension API

Plugins with the appropriate permission can register sidebar sections and items through `context.navigation`.

This is the current public navigation integration point for plugins.

---

# UI Registration

Plugins can register UI elements through `context.ui`.

This is the current public UI registration point for plugins.

---

# HTTP Origin API

Plugins with the appropriate capability can access plugin HTTP-origin helpers through `context.httpOrigin`.

This is the current public plugin HTTP-origin surface.

---

# System Media Controls API

Plugins declaring both the `media-control` permission and `media-controls` capability may use `context.mediaControls` to query current player state, inspect supported actions, subscribe/unsubscribe from updates, and request supported play/pause/next/previous actions. Runtime permission checks apply to every method, and plugin subscriptions are removed on teardown. The state projection omits stream URLs. Access to Electron, IPC, FFmpeg and audio resources is not exposed through this API.

See the [Unified Player reference](./UnifiedPlayer.md#plugin-media-controls-api) for the declaration and method contract.

# Web Session API

Plugins declaring `web-session` and at least one exact HTTPS origin in `webSessionOrigins` may use `context.webSession`. The core creates an isolated `WebContentsView` with its own persistent partition, blocks downloads, popups, webviews, file/custom protocols and permission prompts, and keeps navigation on the declared origins. Plugin code never receives cookies, headers, tokens or the underlying Electron objects.

```text
create({ sessionId, origin })   → { sessionId, state }
openLogin(sessionId)            → loads the declared origin
load(sessionId, url)            → declared HTTPS origin only
getState(sessionId)             → web-session-media required
command(sessionId, { type })    → play | pause | stop (web-session-media required)
show(sessionId, bounds)         → visible login/repair view
hide(sessionId) / reload(sessionId) / destroy(sessionId)
onState / onNavigationRequired / onError → unsubscribe functions
getCapabilities()               → supported commands and optional DRM availability
```

Each method re-checks the capability at call time. Missing grants throw an error with `code: "CAPABILITY_DENIED"`; unknown sessions fail with `SESSION_NOT_FOUND`; invalid arguments are rejected before any Electron object is touched. `create()` returns only the coarse `{ sessionId, state }`; full metadata requires `web-session-media` through `getState()` or `onState()`. Subscriptions are removed by the returned unsubscribe function and by PluginRuntime on unload. `context.webSession` is a main-process plugin API; there is deliberately no global `window.pluginWebSessionAPI`, because all renderer plugins share one renderer and could impersonate another plugin's capability.

Limitations: `seek`/`setVolume` have no documented arguments and are rejected with `COMMAND_ARGUMENTS_UNSPECIFIED`. There is no settings UI yet to delete a stored session partition; `destroy()` closes the view but keeps cookies so a login survives a restart. Real provider login and playback (for example Google/YouTube Music) were not verified in the development environment.

See [Capabilities & Plugin HTTP Environment](../plugin-sdk/13-Capabilities.md#web-session) for the manifest contract and limitations.

# Player API

Plugins with the appropriate permission can access the Unified Player API through `context.player`.

This includes provider registration, state subscription and related control methods.

---

# Theme and Application Information

Direct theme editing and full application introspection are not exposed as general plugin services in this release.

Plugins should use only the documented context surface and avoid relying on internal application objects.

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
* Assuming future services already exist.
* Bypassing the PluginContext.

Using only the PluginContext keeps plugins compatible with future releases.

---

# Related APIs

The PluginContext commonly interacts with:

* PluginManager
* Application
* Storage
* Logger
* Events
* Navigation
* UI
* Player

---

# See Also

* PluginManager
* Application
* Storage
* Logger
* Events
* Navigation
* UI
* Player
* Capabilities & Plugin HTTP Environment
