# Commands

The `Commands` service provides a centralized way for plugins to register executable actions within WebRadio.

Commands allow plugins to expose functionality that can later be invoked by menus, keyboard shortcuts, toolbar buttons, context menus or other plugins.

The Commands service acts as a central command registry for the entire application.

---

# Responsibilities

The Commands service is responsible for:

* Registering commands
* Executing commands
* Removing commands
* Discovering registered commands
* Providing a unified command interface

Commands separate application actions from the user interface.

---

# Accessing Commands

The Commands service is available through the `PluginContext`.

Example:

```javascript
const commands = context.commands;
```

Plugins should never instantiate the Commands service directly.

---

# Command Lifecycle

Every command follows a simple lifecycle.

```text
Plugin Loaded

↓

Register Command

↓

Command Available

↓

Execute Command

↓

Unregister Command

↓

Plugin Unloaded
```

Commands exist only while the owning plugin is active.

---

# Methods

## register()

Registers a new command.

### Syntax

```javascript
commands.register({

    id: "hello.world",

    title: "Hello World",

    execute() {

        console.log("Hello World");

    }

});
```

### Parameters

| Name    | Type     | Description                 |
| ------- | -------- | --------------------------- |
| id      | String   | Unique command identifier   |
| title   | String   | Human-readable command name |
| execute | Function | Command callback            |

Every command must have a unique identifier.

---

## unregister()

Removes a registered command.

### Syntax

```javascript
commands.unregister("hello.world");
```

Commands should always be removed when the plugin is disabled.

---

## execute()

Executes a command.

### Syntax

```javascript
await commands.execute("hello.world");
```

### Parameters

| Name | Type   | Description        |
| ---- | ------ | ------------------ |
| id   | String | Command identifier |

Returns the value produced by the command, if any.

---

## has()

Checks whether a command exists.

### Syntax

```javascript
commands.has("hello.world");
```

### Returns

```javascript
Boolean
```

---

## get()

Returns a registered command.

### Syntax

```javascript
const command = commands.get("hello.world");
```

### Returns

```javascript
Command | undefined
```

---

## getCommands()

Returns every registered command.

### Syntax

```javascript
const commands = context.commands.getCommands();
```

### Returns

```javascript
Array<Command>
```

---

# Command Identifiers

Command identifiers should remain unique.

Recommended format:

```text
plugin.command

station.play

station.stop

player.pause

player.next

settings.open
```

Namespaces prevent identifier collisions.

---

# Command Context

Commands may receive contextual information.

Example:

```javascript
commands.register({

    id: "station.play",

    async execute(station) {

        console.log(station.name);

    }

});
```

The provided context depends on the caller.

---

# Return Values

Commands may return values.

Example:

```javascript
commands.register({

    id: "player.volume",

    execute() {

        return 50;

    }

});
```

The caller may use the returned value.

---

# Error Handling

If command execution fails:

* The error is logged.
* The caller receives the failure.
* Other commands remain unaffected.

A faulty command should never destabilize the application.

---

# Best Practices

✔ Use descriptive command identifiers.

✔ Keep commands focused on a single action.

✔ Validate command arguments.

✔ Return meaningful values where appropriate.

✔ Unregister commands during plugin shutdown.

✔ Document public commands.

---

# Common Mistakes

Typical mistakes include:

* Registering duplicate command IDs.
* Forgetting to unregister commands.
* Performing unrelated work inside a command.
* Using generic identifiers.
* Blocking long-running operations.

Commands should remain predictable and reusable.

---

# Related APIs

The Commands service commonly works together with:

* PluginContext
* Events
* Hooks
* Menus
* Windows
* Notifications

Commands provide reusable application actions that can be triggered from multiple parts of the user interface.

---

# Example

```javascript
context.commands.register({

    id: "hello.world",

    title: "Hello World",

    execute() {

        context.notifications.info(

            "Hello from WebRadio!"

        );

    }

});
```

---

# See Also

* PluginContext
* Menus
* Notifications
* Hooks
* Events
* Windows
