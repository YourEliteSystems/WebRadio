# Menus

The `Menus` service allows plugins to extend the WebRadio user interface by registering menu entries.

Menus provide users with direct access to plugin functionality through the application's navigation system.

Plugins should use the Menus service instead of modifying the user interface directly.

---

# Responsibilities

The Menus service is responsible for:

* Registering menu items
* Removing menu items
* Organizing menu hierarchies
* Connecting menu items to commands
* Managing menu visibility
* Supporting plugin integration

Menus provide a consistent way to expose plugin functionality.

---

# Accessing Menus

The Menus service is available through the `PluginContext`.

Example:

```javascript
const menus = context.menus;
```

Plugins should never instantiate the Menus service directly.

---

# Menu Lifecycle

Every menu entry follows a predictable lifecycle.

```text
Plugin Loaded

↓

Register Menu

↓

Menu Available

↓

User Interaction

↓

Execute Command

↓

Plugin Disabled

↓

Remove Menu
```

Menu entries exist only while the owning plugin is enabled.

---

# Methods

## register()

Registers a new menu item.

### Syntax

```javascript
menus.register({

    id: "example.menu",

    title: "Example",

    command: "example.open"

});
```

### Parameters

| Name    | Type   | Description                    |
| ------- | ------ | ------------------------------ |
| id      | String | Unique menu identifier         |
| title   | String | Display name                   |
| command | String | Command executed when selected |

---

## unregister()

Removes a registered menu.

### Syntax

```javascript
menus.unregister("example.menu");
```

---

## get()

Returns a menu by its identifier.

### Syntax

```javascript
const menu = menus.get("example.menu");
```

### Returns

```javascript
Menu | undefined
```

---

## getMenus()

Returns every registered menu.

### Syntax

```javascript
const registeredMenus = menus.getMenus();
```

### Returns

```javascript
Array<Menu>
```

---

# Menu Structure

Menus may support nested items.

Example:

```text
Plugins

├── Example Plugin

│   ├── Settings

│   ├── Statistics

│   └── About
```

Nested menus improve organization.

---

# Commands

Menus should execute Commands instead of containing business logic.

```text
Menu Click

↓

Command

↓

Plugin Logic
```

This keeps the architecture modular and reusable.

---

# Visibility

Menu items may become visible only under certain conditions.

Examples:

* Plugin enabled
* Station selected
* Playback active
* Development mode

Visibility rules should be evaluated dynamically.

---

# Error Handling

If a menu cannot be registered:

* The error is logged.
* The plugin continues running.
* Other menu items remain available.

---

# Best Practices

✔ Keep menu titles concise.

✔ Use Commands for menu actions.

✔ Group related menu items.

✔ Remove menus during plugin shutdown.

✔ Avoid duplicate entries.

---

# Common Mistakes

Typical mistakes include:

* Embedding business logic inside menus.
* Registering duplicate identifiers.
* Forgetting to unregister menus.
* Creating deeply nested structures.
* Using unclear menu names.

Menus should remain intuitive and lightweight.

---

# Related APIs

The Menus service commonly works together with:

* Commands
* PluginContext
* Windows
* Notifications

Menus are responsible for presentation, while Commands execute the underlying functionality.

---

# Example

```javascript
context.menus.register({

    id: "plugin.settings",

    title: "Plugin Settings",

    command: "plugin.openSettings"

});
```

---

# See Also

* Commands
* Windows
* PluginContext
* Notifications
* Application
