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
| `getCapabilities()` | `player:getCapabilities` |
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

# IPC Surface

| Channel | Direction | Purpose |
| ------- | --------- | ------- |
| `player:getState` | renderer → main | Read the state |
| `player:play` / `pause` / `stop` / `toggle` | renderer → main | Controls (no arguments) |
| `player:setVolume` / `getVolume` / `setMuted` / `toggleMute` / `getCapabilities` | renderer → main | Volume, mute, capabilities |
| `player:registerProvider` / `unregisterProvider` / `setActiveProvider` | renderer → main | Provider registry (`registerProvider(id, provider)`) |
| `player:reportProviderState` | renderer → main | Renderer-side providers report their state |
| `player:stateChanged` | main → renderer | State push |
| `player:command` | main → renderer | Generic player commands (e.g. MediaHub) |
| `radio:start` / `radio:stop` | renderer → main | Direct radio control (`radio:start(url, station)`) |

---

# Error Codes

| Code | Raised by | Meaning |
| ---- | --------- | ------- |
| `NO_ACTIVE_PROVIDER` | `PlayerManager.play/pause/stop` | No provider is active |
| `PROVIDER_ERROR` | `PlayerManager` | The provider threw; message is included |
| `MISSING_URL` | `RadioProvider` / `StreamManager` | No usable stream URL |
| `INVALID_VOLUME` | `player:setVolume` | Value outside `0.0` – `1.0` or not a number |
| `INVALID_ARGUMENT` | provider registry | Non-string ID or non-object provider |
| `INVALID_PROVIDER_ID` / `PROVIDER_NOT_FOUND` | `player:setActiveProvider` | Unknown provider |

> **Note:** `PlayerManager.play()` does not forward the provider's return value to the renderer — `player:play` answers `{ success:true }` whenever a provider is active. Provider-level failures such as `MISSING_URL` are reported in the main-process log.

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
