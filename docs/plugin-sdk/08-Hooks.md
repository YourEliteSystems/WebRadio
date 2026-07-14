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

# Accessing Hooks

The Hook API is available through the Plugin Context.

```javascript
const hooks = context.hooks;
```

---

# Registering a Hook

Plugins register hooks during initialization.

Example:

```javascript
context.hooks.register(
    "beforePlayback",
    async station => {

        return station;

    }
);
```

The callback becomes part of the playback pipeline.

---

# Hook Flow

Every hook follows the same execution model.

```text
Application

↓

Hook Point

↓

Plugin A

↓

Plugin B

↓

Plugin C

↓

Continue Execution
```

Each registered hook is executed in sequence.

---

# Typical Hook Points

Future versions of WebRadio may expose hooks such as:

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
beforeFavoriteAdded
afterFavoriteAdded
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

---

# Modifying Data

Some hooks may allow plugins to modify values.

Example:

```javascript
context.hooks.register(
    "beforePlayback",
    async station => {

        station.customData = true;

        return station;

    }
);
```

The modified object is then passed to the next hook.

---

# Cancelling Operations

Some hook types may support cancelling an operation.

Example:

```javascript
context.hooks.register(
    "beforePlayback",
    async station => {

        if (!station.online) {

            return false;

        }

        return true;

    }
);
```

Whether cancellation is supported depends on the individual hook.

---

# Execution Order

Hooks are executed in registration order.

```text
Plugin A

↓

Plugin B

↓

Plugin C
```

Each hook receives the output from the previous hook when applicable.

---

# Error Handling

If a hook throws an exception:

* the error is reported,
* the responsible plugin is identified,
* the remaining application continues whenever possible.

A faulty hook should never crash WebRadio.

---

# Design Principles

## Extensibility

Hooks make it possible to extend existing workflows without modifying the core application.

---

## Predictability

Hooks execute in a well-defined order.

---

## Isolation

Each plugin executes independently.

---

## Stability

Errors inside hooks should remain isolated from the application.

---

# Best Practices

✔ Register hooks during `onEnable()`.

✔ Remove hooks during `onDisable()` if required by the API.

✔ Keep hook callbacks fast.

✔ Avoid long-running operations.

✔ Always return valid values when modifying data.

✔ Handle exceptions gracefully.

---

# Common Mistakes

Common problems include:

* Forgetting to return modified objects.
* Performing blocking operations.
* Registering duplicate hooks.
* Assuming execution order between unrelated plugins.
* Throwing uncaught exceptions.

Proper hook implementation keeps application behavior predictable.

---

# Future Improvements

The Hook API is designed to evolve.

Future versions may introduce:

* Hook priorities
* Conditional hooks
* Asynchronous hook chains
* Namespaced hooks
* Hook groups
* Middleware pipelines

These additions will remain compatible with existing plugins whenever possible.

---

# Next Step

Continue with **UI Integration** to learn how plugins can add pages, dialogs, sidebar entries and other user interface elements to WebRadio.
