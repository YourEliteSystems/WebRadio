# Unified Player

The Unified Player API is the single control surface for playback in WebRadio.

One state machine, one set of controls and one subscription mechanism cover every playback source — radio streams (FFmpeg), the MediaHub YouTube player and plugin-provided players — so the renderer never has to know which source is active.

---

# Architecture

```text
Renderer (PlayerBar / useUnifiedPlayer / window.playerAPI)
        ↓  IPC  player:*
PlayerManager  (state, registry, controls, capabilities)
        ↓  provider interface
┌───────────────┬─────────────────┬──────────────────┐
│ RadioProvider │ MediaHubProvider│ Plugin providers │
└───────┬───────┴────────┬────────┴────────┬─────────┘
        ↓                ↓                 ↓
   StreamManager      IPC → Renderer     plugin host
   → FFmpeg → PCM     → YouTube IFrame
```

* `PlayerManager` contains no media-specific logic.
* Every source implements the provider interface and reports its state back through `updateProviderState()`.
* Only the **active** provider may change the player state.

---

# States

| State | Meaning |
| ----- | ------- |
| `idle` | No provider activity yet (initial state) |
| `loading` | A start was requested, no data yet |
| `playing` | Playback in progress |
| `paused` | Playback paused (not available for radio) |
| `stopped` | Explicitly stopped |
| `error` | Playback failed; `state.error` holds `{ code, message }` |

---

# State Schema

`PlayerManager.getState()` returns:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `state` | `string` | one of the states above |
| `title` / `artist` / `artwork` | `string\|null` | now-playing information |
| `volume` | `number` | `0.0` – `1.0` |
| `muted` | `boolean` | mute flag |
| `provider` | `{ id, name, type } \| null` | active provider metadata |
| `source` | `{ id, type, url } \| null` | active media source |
| `capabilities` | `object` | merged capabilities of the active provider |
| `position` / `duration` | `number\|null` | optional, seconds |
| `error` | `object\|null` | `{ code, message }` when `state === "error"` |

`volume`, `muted` and `provider` always stay under `PlayerManager` control — a provider cannot overwrite them through `updateProviderState()`.

---

# Provider Interface

A provider is a plain object (or class instance) with:

| Member | Required | Notes |
| ------ | -------- | ----- |
| `play(...args)` | no | arguments are passed through from `PlayerManager.play()` |
| `pause()` | no | |
| `stop()` | no | |
| `setVolume(value)` | no | |
| `setMuted(muted)` | no | optional |
| `getState()` | no | |
| `getCapabilities()` | no | merged over the defaults |
| `id` / `name` / `type` | no | used for the `provider` field |

Default capabilities: `play`, `pause`, `stop`, `volume`, `mute` → `true`; `seek`, `next`, `previous` → `false`.

---

# Built-in Providers

## RadioProvider (`radio`)

Adapter between the Unified Player API and the FFmpeg pipeline.

* Capabilities: `play`, `stop`, `volume`, `mute` → `true`; `pause` → `false` (pause is treated as stop); `seek`, `next`, `previous` → `false`.
* Listens to the EventBus (`play`, `stop`, `metadata`) to keep its own state in sync.
* **URL restoration:** `player:play` and `player:toggle` call `PlayerManager.play()` **without arguments**. The provider then resumes the last stream URL it recorded. This is real restoration of the previously used source — no fallback URL is ever invented.
* **Diagnostics:** when no URL is available at all, `play()` returns `{ success:false, error:{ code:"MISSING_URL" } }` and logs a line containing `commandId`, `providerId` and `sessionId`.
* **No re-entry:** the EventBus is synchronous and `streamManager.start()` emits `play` before returning. The `play` handler therefore only records the source and reports the state — it must never call `play()` again, otherwise `start()` would recurse indefinitely.
* `stop()` keeps the URL and station so that stop → play resumes the same source; title and artist are cleared because they belong to the finished run.

## MediaHubProvider (`mediahub`)

Bridges the MediaHub YouTube IFrame player in the renderer through `player:command`. Registered at startup, activated when the MediaHub plugin is used.

## Plugin providers

Registered through `context.player.registerProvider(spec)` (requires the `player` permission) or through the `player:registerProvider` IPC channel.

---

# Main-Process API (PlayerManager)

| Method | Description |
| ------ | ----------- |
| `registerProvider(id, provider)` | Registers a provider; returns `{ unregister() }` |
| `unregisterProvider(id)` | Stops the provider if it is active and removes it |
| `setActiveProvider(id)` | Stops the previous provider, resets the state and applies the new provider's metadata and capabilities |
| `getActiveProvider()` | Returns the active provider or `null` |
| `play(...args)` | Delegates to the active provider |
| `pause()` / `stop()` | Delegate to the active provider |
| `toggle()` | `loading` → no-op (prevents double starts), `playing` → `pause()`, otherwise → `play()` |
| `setVolume(value)` | Clamps to `0.0` – `1.0` and notifies subscribers |
| `getVolume()` / `setMuted(muted)` / `toggleMute()` | Volume and mute helpers |
| `getCapabilities()` | Capabilities of the active provider, defaults otherwise |
| `getMediaCapabilities()` / `requestMediaAction(action)` | Supported media actions and validated play/pause/next/previous requests |
| `getState()` | Full state snapshot including capabilities |
| `subscribe(callback)` | Invokes immediately and on every change; returns an unsubscribe function |
| `updateProviderState(providerId, partialState)` | Partial state update; ignored for non-active providers |

---

# Renderer API (`window.playerAPI`)

| Method | IPC channel |
| ------ | ----------- |
| `getState()` | `player:getState` |
| `play()` / `pause()` / `stop()` / `toggle()` | `player:play`, `player:pause`, `player:stop`, `player:toggle` |
| `setVolume(value)` | `player:setVolume` |
| `getVolume()` / `setMuted(muted)` / `toggleMute()` | `player:getVolume`, `player:setMuted`, `player:toggleMute` |
| `getCapabilities()` / `getMediaCapabilities()` | `player:getCapabilities`, `player:getMediaCapabilities` |
| `subscribe(cb)` / `onStateChanged(cb)` | `player:stateChanged` (push) |
| `onCommand(cb)` | `player:command` (push) |
| `reportProviderState(id, state)` | `player:reportProviderState` |
| `setActiveProvider(id)` | `player:setActiveProvider` |

`subscribe()` returns an unsubscribe function and must be called once on mount; `onStateChanged()` is the alias without the initial state fetch.

---

# Plugin API (`context.player`)

Requires the `player` permission in the plugin manifest.

```javascript
const handle = context.player.registerProvider({
  id: "my-player",
  name: "My Player",
  type: "video",
  async play() { /* ... */ },
  async stop() { /* ... */ },
  getState()   { return { state: "idle" }; }
});

context.player.setActiveProvider("my-player");
const state = context.player.getState();
const unsubscribe = context.player.subscribe((s) => console.log(s));

handle.unregister();
```

---

# System Media Session

The main renderer publishes the active Unified Player state through Chromium's `navigator.mediaSession` when the API is available. It updates OS-facing metadata and playback state from PlayerManager notifications, and registers only actions supported by the active provider. Remote play/pause actions and hardware media keys call the existing provider controls; radio pause maps to stop because radio streams do not support pausing. Next/previous follow the current visible station list and are unavailable unless the current radio station is present in a list with at least two entries. Failed streams stay in `error` rather than appearing as playing. Plugins use the guarded `context.mediaControls` API instead of direct media-action IPC.

Electron has no dedicated cross-platform main-process media-session API. `navigator.mediaSession` behavior and OS exposure vary by Chromium build and platform; Linux desktop integration is particularly environment-dependent, and this project has not verified OS media surfaces on its target platforms. Electron `globalShortcut` media keys are separate main-process registrations: they can fail when another application owns the key, macOS may require accessibility authorization, and Wayland behavior depends on the desktop portal. Treat hardware-key registration and OS media-session UI as best-effort, not as guaranteed cross-platform support.

## Plugin media-controls API

For the planned `v1.0.7-beta.3` plugin integration, plugins that need read-only media state and requested playback controls must declare both the `media-control` permission and the `media-controls` capability. The optional API is exposed as `context.mediaControls`. Its state projection omits the stream URL; callbacks receive an initial snapshot and subsequent changes:

```json
{
  "permissions": ["media-control"],
  "capabilities": ["media-controls"]
}
```

```javascript
const state = context.mediaControls.getState();
const capabilities = context.mediaControls.getCapabilities();
const unsubscribe = context.mediaControls.subscribe((nextState) => {
  console.log(nextState.state, nextState.source?.name);
});
await context.mediaControls.requestAction("pause"); // play | pause | next | previous
// Call unsubscribe() on teardown; PluginRuntime also disposes subscriptions.
```

Missing either grant throws a permission error. Unsupported actions and invalid action names return structured failures; subscriptions emit an initial snapshot and then state changes. `getCapabilities()` reports platform, the Media Session API name, and the active provider's supported actions.

# IPC Surface

| Channel | Direction | Purpose |
| ------- | --------- | ------- |
| `player:getState` | renderer → main | Read the state |
| `player:play` / `pause` / `stop` / `toggle` | renderer → main | Controls (no arguments) |
| `player:setVolume` / `getVolume` / `setMuted` / `toggleMute` / `getCapabilities` | renderer → main | Volume, mute, capabilities |
| `player:registerProvider` / `unregisterProvider` / `setActiveProvider` | renderer → main | Provider registry (`registerProvider(id, provider)`) |
| `player:reportProviderState` | renderer → main | Renderer-side providers report their state |
| `player:getMediaCapabilities` | renderer → main | Query active provider media-action support (main-window sender required) |
| `player:stateChanged` | main → renderer | State push |
| `player:command` | main → renderer | Generic player commands (e.g. MediaHub) |
| `radio:start` / `radio:stop` | renderer → main | Direct radio control (`radio:start(url, station)`) |

---

# Error Codes

| Code | Raised by | Meaning |
| ---- | --------- | ------- |
| `NO_ACTIVE_PROVIDER` | `PlayerManager` | No provider is active |
| `UNSUPPORTED_ACTION` | `PlayerManager.requestMediaAction` | The active provider does not support the requested media action |
| `INVALID_ACTION` | `context.mediaControls.requestAction` | Invalid action name |
| `PROVIDER_ERROR` | `PlayerManager` | The provider threw; message is included |
| `MISSING_URL` | `RadioProvider` / `StreamManager` | No usable stream URL |
| `INVALID_VOLUME` | `player:setVolume` | Value outside `0.0` – `1.0` or not a number |
| `INVALID_ARGUMENT` | provider registry | Non-string ID or non-object provider |
| `INVALID_PROVIDER_ID` / `PROVIDER_NOT_FOUND` | `player:setActiveProvider` | Unknown provider |

> `player:play` forwards `PlayerManager.play()` results. Radio remains `loading` until FFmpeg supplies the first PCM chunk; a failed or missing stream is reported as `error`, not as successful playback. Media Session `play` is a no-op while already playing/loading, and `pause` is a no-op when already stopped, preventing duplicate stream commands.

---

# Best Practices

✔ Always render from the subscribed state, never from local assumptions.

✔ Respect `getCapabilities()` instead of hard-coding which controls exist.

✔ Call `playerAPI.subscribe()` exactly once and use the returned unsubscribe function.

✔ Let a station or media change go through `stop` + `start`; do not send two starts in a row (`toggle()` deliberately ignores a second start while `loading`).

✔ A provider must never start playback from a state event it caused itself.

✔ Renderer-side providers must report their state via `reportProviderState()`.

---

# Related Documentation

* [StreamManager](./StreamManager.md)
* [IPC](../architecture/05-IPC.md)
* [MediaKeys](../architecture/08-MediaKeys.md)
* [Application](./Application.md)
