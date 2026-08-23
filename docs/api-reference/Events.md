# Events

The `Events` service provides a publish-subscribe communication system for WebRadio.

It allows plugins and core services to communicate without directly depending on each other.

Plugins can subscribe to events, react to application changes and emit their own events where appropriate.

---

# Responsibilities

The Events service is responsible for:

* Registering event listeners
* Removing event listeners
* Emitting events
* Broadcasting application events
* Decoupling plugins from the WebRadio Core

Events enable communication while keeping the application modular.

---

# Accessing Events

The Events service is available through the `PluginContext`.

Example:

```javascript id="x4m8vn"
const events = context.events;
```

Plugins should never instantiate the Events service manually.

---

# Event Flow

A typical event follows this sequence.

```text id="a9q6pt"
Event Occurs

↓

Event Emitted

↓

Listeners Found

↓

Callbacks Executed

↓

Event Completed
```

Multiple listeners may receive the same event.

---

# Methods

## on()

Registers an event listener.

### Syntax

```javascript id="d2q7mf"
events.on(eventName, listener);
```

### Parameters

| Name      | Type     | Description       |
| --------- | -------- | ----------------- |
| eventName | String   | Event identifier  |
| listener  | Function | Callback function |

---

## once()

Registers a listener that executes only once.

### Syntax

```javascript id="p6e9tk"
events.once(eventName, listener);
```

The listener is automatically removed after its first execution.

---

## off()

Removes an event listener.

### Syntax

```javascript id="m8z4yr"
events.off(eventName, listener);
```

Plugins should unregister listeners during shutdown.

---

## emit()

Emits an event.

### Syntax

```javascript id="h7k3qw"
events.emit(eventName, payload);
```

### Parameters

| Name      | Type   | Description      |
| --------- | ------ | ---------------- |
| eventName | String | Event identifier |
| payload   | Any    | Event data       |

---

## removeAllListeners()

Removes every listener registered by the current plugin.

### Syntax

```javascript id="v3n5cp"
events.removeAllListeners();
```

This is especially useful during plugin shutdown.

---

# Event Names

Event names should follow a consistent naming convention.

Recommended format:

```text id="e4r8zy"
station.changed

station.play

station.stop

player.volumeChanged

theme.changed

plugin.enabled

plugin.disabled
```

Dot notation improves readability and organization.

---

# Event Payload

Events may include additional information.

Example:

```javascript id="u9m2fk"
events.emit(

    "station.changed",

    {

        id: station.id,

        name: station.name

    }

);
```

Payload objects should remain lightweight and well documented.

---

# Listener Example

```javascript id="c5q7rx"
events.on(

    "theme.changed",

    (theme) => {

        context.logger.info(

            `Theme changed to ${theme.name}`

        );

    }

);
```

Listeners should execute quickly and avoid blocking the application.

---

# Error Handling

Errors inside event listeners should be isolated.

If one listener throws an exception:

* The error is logged.
* Remaining listeners continue executing.

One faulty plugin should not interrupt event delivery.

---

# Best Practices

✔ Use descriptive event names.

✔ Keep payloads small.

✔ Remove listeners during shutdown.

✔ Handle errors gracefully.

✔ Keep listeners fast and lightweight.

✔ Document custom events.

---

# Common Mistakes

Typical mistakes include:

* Forgetting to unregister listeners.
* Blocking inside callbacks.
* Emitting unnecessary events.
* Using inconsistent event names.
* Passing very large payloads.

Events should remain efficient and predictable.

---

# Related APIs

The Events service commonly works together with:

* PluginContext
* Hooks
* Logger
* Commands
* Notifications

---

# Example

```javascript id="k2x6jh"
context.events.on(

    "station.play",

    (station) => {

        context.logger.info(

            `Now playing: ${station.name}`

        );

    }

);
```

---

# See Also

* PluginContext
* Hooks
* Commands
* Logger
* Application
