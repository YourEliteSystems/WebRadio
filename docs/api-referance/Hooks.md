# Hooks

The `Hooks` service provides controlled extension points within WebRadio.

Unlike Events, which notify plugins that something has happened, Hooks allow plugins to participate in or modify specific operations performed by the WebRadio Core.

Hooks are one of the primary mechanisms for extending application behaviour without modifying core code.

---

# Responsibilities

The Hooks service is responsible for:

* Registering hook callbacks
* Executing hook chains
* Allowing plugins to extend core functionality
* Providing controlled extension points
* Isolating plugin behaviour from the application core

Hooks should only be used where extension is intended.

---

# Events vs Hooks

Although similar, Events and Hooks serve different purposes.

| Events                         | Hooks                         |
| ------------------------------ | ----------------------------- |
| Notify that something happened | Extend or modify an operation |
| Fire-and-forget                | Participate in execution      |
| Multiple independent listeners | Ordered callback chain        |
| No return value required       | May return or modify data     |

Choose the appropriate mechanism based on the desired behaviour.

---

# Accessing Hooks

The Hooks service is available through the `PluginContext`.

Example:

```javascript id="d9w6pt"
const hooks = context.hooks;
```

Plugins should never instantiate the Hooks service directly.

---

# Hook Flow

A hook executes in a defined order.

```text id="x7a3hk"
Core Operation

↓

Execute Hook

↓

Plugin A

↓

Plugin B

↓

Plugin C

↓

Continue Operation
```

Each registered callback is executed sequentially.

---

# Methods

## register()

Registers a hook callback.

### Syntax

```javascript id="g4n2rm"
hooks.register(hookName, callback);
```

### Parameters

| Name     | Type     | Description     |
| -------- | -------- | --------------- |
| hookName | String   | Hook identifier |
| callback | Function | Hook callback   |

---

## unregister()

Removes a registered callback.

### Syntax

```javascript id="t8j1my"
hooks.unregister(hookName, callback);
```

Plugins should unregister hooks during shutdown.

---

## execute()

Executes a hook.

### Syntax

```javascript id="m5q7vr"
await hooks.execute(hookName, context);
```

Normally, this method is used internally by WebRadio Core.

---

# Hook Names

Hooks should follow a consistent naming convention.

Recommended examples:

```text id="u1c5nx"
player.beforePlay

player.afterPlay

station.beforeAdd

station.afterAdd

theme.beforeApply

theme.afterApply

plugin.beforeEnable

plugin.afterEnable
```

Using `before` and `after` prefixes improves readability.

---

# Hook Context

Hooks may receive contextual information.

Example:

```javascript id="r2f9wb"
hooks.register(

    "player.beforePlay",

    async (context) => {

        context.logger.info(

            "Preparing playback."

        );

    }

);
```

The provided context depends on the specific hook.

---

# Return Values

Some hooks may return values.

Example:

```javascript id="n8e4jk"
hooks.register(

    "player.beforePlay",

    async (station) => {

        return station;

    }

);
```

Whether return values are supported depends on the hook definition.

---

# Execution Order

Hook callbacks execute in registration order unless documented otherwise.

```text id="k4x8pm"
Plugin A

↓

Plugin B

↓

Plugin C
```

Plugins should not rely on another plugin being registered first.

---

# Error Handling

If a hook callback throws an exception:

* The error is logged.
* The current callback stops.
* Remaining callbacks continue unless the hook is documented as abortable.

This behaviour ensures that one faulty plugin does not disrupt the application.

---

# Best Practices

✔ Register hooks only when needed.

✔ Keep callbacks fast.

✔ Document custom hooks.

✔ Return only valid data.

✔ Remove hooks during shutdown.

✔ Use hooks only for intended extension points.

---

# Common Mistakes

Typical mistakes include:

* Blocking long-running operations.
* Modifying unrelated data.
* Forgetting to unregister callbacks.
* Registering duplicate hooks.
* Assuming execution order between plugins.

Hook callbacks should remain predictable and lightweight.

---

# Related APIs

The Hooks service commonly works together with:

* PluginContext
* Events
* Commands
* Logger
* Application

---

# Example

```javascript id="h6m2qy"
context.hooks.register(

    "station.beforePlay",

    async (station) => {

        context.logger.info(

            `Preparing ${station.name}`

        );

        return station;

    }

);
```

---

# See Also

* PluginContext
* Events
* Commands
* Logger
* Application
