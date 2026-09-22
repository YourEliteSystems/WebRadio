# Commands Status

In WebRadio 1.0.7-alpha.1, the plugin-facing Commands service is **not** part of the current public Plugin API surface.

The current plugin extension points are:

* events
* navigation
* UI registration
* the Player API (where permitted)
* the HTTP Origin API (where permitted)

---

# Future Command Integration

A future SDK may introduce a command registry that allows plugins to expose actions for menus, shortcuts or other triggers.

Possible future concepts include:

* command registration with unique identifiers
* command execution through a central registry
* command removal during plugin shutdown

These are planned ideas, not implemented APIs.

---

# Best Practices for Now

✔ Use only the currently documented plugin APIs.

✔ Do not assume command registration exists.

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
* Events
* Navigation
* UI
* Player
* Capabilities & Plugin HTTP Environment


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
