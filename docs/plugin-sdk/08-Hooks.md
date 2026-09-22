# Hooks

The Hook API allows plugins to participate in the execution flow of WebRadio.

Unlike Events, which only notify plugins that something has happened, Hooks allow plugins to extend, modify or influence application behavior before or after specific actions.

Hooks provide one of the most powerful extension mechanisms available in the WebRadio Plugin SDK.

---

# Events vs Hooks

Although Events and Hooks appear similar, they serve different purposes.

## Events

Events notify plugins that something has already happened.

```text
Station Changed

↓

Notify Plugins
```

Plugins receive information but cannot change the application's behavior.

---

## Hooks

Hooks execute as part of the application's workflow.

```text
Application Action

↓

Execute Hooks

↓

Continue Workflow
```

Plugins may inspect, modify or extend the operation before it continues.

---

# Hooks Status (1.0.7-alpha.1)

In WebRadio 1.0.7-alpha.1, the Hook API is **not** part of the current public plugin context.

Plugins should not use `context.hooks` in this release.

---

# Planned Concept

A future SDK may introduce hooks as extension points that allow plugins to participate in application workflows.

Planned examples include:

## Playback

```text
beforePlayback
afterPlayback
beforePause
afterPause
beforeStop
afterStop
```

---

## Stations

```text
beforeStationChange
afterStationChange
```

---

## Themes

```text
beforeThemeLoad
afterThemeLoad
```

---

## Plugins

```text
beforePluginEnable
afterPluginEnable
beforePluginDisable
afterPluginDisable
```

---

## Application

```text
beforeShutdown
afterStartup
```


These are illustrative names, not committed APIs.

---

# Best Practices for Now

✔ Use only the currently documented plugin APIs.

✔ Do not assume hook callbacks exist.

✔ Watch the Plugin SDK and API Reference for future extension points.

---

# Next Step

Continue with **UI Integration** to learn how plugins can add pages, dialogs, sidebar entries and other user interface elements to WebRadio.
