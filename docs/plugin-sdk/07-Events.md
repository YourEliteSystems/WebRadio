# Events

The Event API allows plugins to react to changes inside WebRadio.

Instead of constantly checking the application's state, plugins can subscribe to events and respond automatically whenever something happens.

The Event API follows an event-driven architecture and is one of the primary communication mechanisms between WebRadio and plugins.

---

# Why Events?

Many actions occur while WebRadio is running.

Examples include:

* A new station starts playing.
* Playback is paused.
* The volume changes.
* A theme is applied.
* A plugin is enabled.
* The application starts.

Rather than polling for these changes, plugins simply listen for events.

---

# Accessing Events

The Event API is available through the Plugin Context.

```javascript
const events = context.events;
```

---

# Registering an Event

Use `on()` to subscribe to an event.

```javascript
context.events.on(
    "stationChanged",
    station => {

        console.log(
            station.name
        );

    }
);
```

Whenever the active station changes, the callback is executed automatically.

---

# Removing an Event

Event listeners should always be removed when the plugin is disabled.

```javascript
context.events.off(
    "stationChanged",
    callback
);
```

Cleaning up listeners prevents memory leaks.

---

# Event Flow

Every event follows the same sequence.

```text
Application

↓

Event occurs

↓

Event Manager

↓

Subscribed Plugins

↓

Plugin Callback
```

Multiple plugins may receive the same event.

---

# Example Events

The following events may be available depending on the WebRadio version.

## Application

```text
applicationStarted
applicationReady
applicationClosing
```

---

## Playback

```text
playbackStarted
playbackPaused
playbackStopped
playbackResumed
```

---

## Station

```text
stationChanged
stationAdded
stationRemoved
stationFavorite
```

---

## Volume

```text
volumeChanged
muteChanged
```

---

## Themes

```text
themeLoaded
themeChanged
```

---

## Plugins

```text
pluginEnabled
pluginDisabled
```

Future releases may introduce additional events.

---

# Event Parameters

Some events provide additional information.

Example:

```javascript
context.events.on(
    "volumeChanged",
    volume => {

        console.log(
            volume
        );

    }
);
```

The callback receives event-specific data supplied by WebRadio.

---

# Multiple Listeners

More than one plugin can listen to the same event.

```text
Station Changed

↓

Plugin A

Plugin B

Plugin C
```

Every registered listener receives the event independently.

---

# Design Principles

## Event Driven

Plugins react to application changes instead of continuously checking state.

---

## Decoupling

The application does not need to know which plugins are listening.

---

## Scalability

Any number of plugins may subscribe to the same event.

---

## Simplicity

Registering an event should require minimal code.

---

# Best Practices

✔ Register listeners during `onEnable()`.

✔ Remove listeners during `onDisable()`.

✔ Keep callbacks lightweight.

✔ Avoid blocking operations inside event handlers.

✔ Handle unexpected values gracefully.

---

# Common Mistakes

Common problems include:

* Forgetting to remove listeners.
* Registering the same listener multiple times.
* Performing expensive operations inside callbacks.
* Assuming event data is always valid.

Proper event handling improves both performance and stability.

---

# Future Improvements

Future versions of the Event API may introduce:

* Event priorities
* One-time listeners
* Wildcard subscriptions
* Namespaced events
* Asynchronous event pipelines

The API is designed to evolve while remaining backwards compatible whenever possible.

---

# Next Step

Continue with **Hooks** to learn how plugins can extend or modify WebRadio's behavior before or after specific application actions.
