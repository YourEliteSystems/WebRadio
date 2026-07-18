# Windows

The `Windows` service allows plugins to create and manage their own application windows.

Plugin windows provide dedicated user interfaces for settings, tools, dashboards and other plugin-specific functionality.

All windows are managed by the WebRadio Window Manager to ensure a consistent user experience.

---

# Responsibilities

The Windows service is responsible for:

* Creating plugin windows
* Managing the window lifecycle
* Opening and closing windows
* Focusing existing windows
* Tracking registered windows
* Integrating plugin windows into WebRadio

Plugins should never create native Electron windows directly.

---

# Accessing Windows

The Windows service is available through the `PluginContext`.

Example:

```javascript
const windows = context.windows;
```

Plugins should never instantiate the Windows service themselves.

---

# Window Lifecycle

Every plugin window follows a predictable lifecycle.

```text
Plugin Loaded

↓

Register Window

↓

Create Window

↓

Show Window

↓

Hide / Close

↓

Destroy Window

↓

Plugin Unloaded
```

The Window Manager controls every stage.

---

# Methods

## create()

Creates a new plugin window.

### Syntax

```javascript
const window = await windows.create({

    id: "plugin.settings",

    title: "Plugin Settings",

    width: 900,

    height: 600

});
```

### Parameters

| Name   | Type   | Description              |
| ------ | ------ | ------------------------ |
| id     | String | Unique window identifier |
| title  | String | Window title             |
| width  | Number | Initial width            |
| height | Number | Initial height           |

---

## show()

Displays a registered window.

### Syntax

```javascript
await windows.show("plugin.settings");
```

---

## hide()

Hides a window without destroying it.

### Syntax

```javascript
await windows.hide("plugin.settings");
```

---

## close()

Closes a window.

### Syntax

```javascript
await windows.close("plugin.settings");
```

Closing a window releases its associated resources.

---

## focus()

Brings an existing window to the foreground.

### Syntax

```javascript
await windows.focus("plugin.settings");
```

If the window is already open, it becomes the active window.

---

## get()

Returns a registered window.

### Syntax

```javascript
const window = windows.get("plugin.settings");
```

### Returns

```javascript
Window | undefined
```

---

## getWindows()

Returns every registered plugin window.

### Syntax

```javascript
const windows = context.windows.getWindows();
```

### Returns

```javascript
Array<Window>
```

---

# Window Options

Depending on the implementation, windows may support options such as:

* Width
* Height
* Minimum size
* Maximum size
* Resizable
* Centered
* Modal
* Always on top

Additional options may be introduced in future SDK versions.

---

# Window Communication

Plugin windows may communicate with the plugin through public APIs or IPC mechanisms provided by WebRadio.

Plugins should avoid direct communication with Electron internals.

---

# Error Handling

If a window cannot be created:

* The error is logged.
* The plugin continues running.
* Existing windows remain unaffected.

Window failures should not impact the stability of the application.

---

# Best Practices

✔ Reuse existing windows when possible.

✔ Keep windows responsive.

✔ Close unused windows.

✔ Store window state if appropriate.

✔ Use descriptive titles.

✔ Let the Window Manager control the lifecycle.

---

# Common Mistakes

Typical mistakes include:

* Opening duplicate windows.
* Forgetting to close windows.
* Creating oversized interfaces.
* Blocking the UI thread.
* Depending on Electron APIs directly.

Plugin windows should integrate seamlessly with the rest of the application.

---

# Related APIs

The Windows service commonly works together with:

* PluginContext
* Commands
* Menus
* Notifications
* ThemeManager

Windows provide the user interface, while Commands execute application logic.

---

# Example

```javascript
const settingsWindow = await context.windows.create({

    id: "plugin.settings",

    title: "Plugin Settings",

    width: 800,

    height: 600

});

await context.windows.show("plugin.settings");
```

---

# See Also

* PluginContext
* Commands
* Menus
* Notifications
* ThemeManager
* Application
